const { app, BrowserWindow, ipcMain, Notification } = require('electron');
const path = require('path');

// ─── Init SQLite (shared) ───────────────────────────────
const db = require('./db'); // uses better-sqlite3 instance
// Enforce foreign key constraints on every connection
if (db.pragma) db.pragma('foreign_keys = ON');

// ─── Single-Instance Lock ──────────────────────────────
// Prevent multiple instances from writing to the same SQLite database simultaneously
// Must be checked before any DB writes or IPC handler registration
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
}

// ─── Startup Cleanup ────────────────────────────────────
// Auto-cleanup quick sales older than 30 days
try {
  const oldSales = db.prepare(
    `SELECT qs_id FROM quick_sales WHERE date(qs_date) < date('now', '-30 days')`
  ).all();
  if (oldSales.length > 0) {
    const cleanupTxn = db.transaction(() => {
      for (const row of oldSales) {
        db.prepare('DELETE FROM quick_sale_items WHERE qs_id = ?').run(row.qs_id);
        db.prepare('DELETE FROM quick_sales WHERE qs_id = ?').run(row.qs_id);
      }
    });
    cleanupTxn();
  }
} catch (e) { console.error('[Scheduler] Quick sales cleanup error:', e.message); }

// ─── Register IPC handlers ─────────────────────────────
const registerIpcHandlers = require('./ipcHandlers');
registerIpcHandlers(ipcMain, db);

// ─── PDF Printing via node-pdf-printer ──────────────────
const NodePdfPrinter = require('node-pdf-printer');
const fs = require('fs');
const os = require('os');

ipcMain.handle('print:listPrinters', async () => {
  try {
    const printers = await NodePdfPrinter.listPrinter('en-US');
    return { success: true, printers };
  } catch (err) {
    return { success: false, error: err.message, printers: [] };
  }
});

ipcMain.handle('print:pdf', async (_event, { pdfBase64, printerName, fileName }) => {
  try {
    if (!pdfBase64) return { success: false, error: 'No PDF data provided' };

    // Write PDF to temp file (async to avoid blocking UI)
    const tempDir = os.tmpdir();
    const tempFile = path.join(tempDir, (fileName || 'invoice') + '.pdf');
    const buffer = Buffer.from(pdfBase64, 'base64');
    await fs.promises.writeFile(tempFile, buffer);

    // Print via node-pdf-printer
    if (printerName) {
      await NodePdfPrinter.printFiles([tempFile], printerName);
    } else {
      await NodePdfPrinter.printFiles([tempFile]); // default printer
    }

    // Clean up temp file after a longer delay (printer may still be reading)
    setTimeout(() => {
      fs.unlink(tempFile, (err) => {
        if (err) console.warn(`[print:pdf] Failed to clean up temp file ${tempFile}:`, err.message);
      });
    }, 30000);

    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});


// ─── Create the window ─────────────────────────────────
let mainWindow;

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});
function createWindow() {

  mainWindow = new BrowserWindow({
    icon: "icons/icon.ico",
    fullscreenable: true,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },

  });

  // Maximize the window and then show it
  mainWindow.maximize();
  mainWindow.show();

  // Load the bundled React build from the dist folder
  mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
}

app.whenReady().then(() => {
  createWindow();

  // ─── Pending Invoice Reminder Scanner ──────────────────
  // Runs once per calendar day. Uses a single JOIN query per entity type.
  // Skips entirely if already scanned today (1 tiny SELECT on app_state).
  try {
    const today = new Date().toISOString().split('T')[0];
    const lastScan = db.prepare("SELECT value FROM app_state WHERE key = 'last_notification_scan'").get();

    if (!lastScan || lastScan.value !== today) {
      const nowISO = new Date().toISOString();
      let newCount = 0;

      // ── Customer overdue invoices (single query) ──
      const customerOverdue = db.prepare(`
        SELECT
          c.customer_id   AS account_id,
          c.name          AS account_name,
          c.reminder_days,
          m.id            AS maal_id,
          m.maal_invoice_no AS invoice_no,
          m.maal_date     AS invoice_date,
          m.maal_amount,
          COALESCE(j.paid, 0) AS paid_amount
        FROM customers c
        JOIN customer_maal_account m ON m.customer_id = c.customer_id
        LEFT JOIN (
          SELECT jama_remark, SUM(jama_amount) AS paid
          FROM customer_jama_account
          GROUP BY jama_remark
        ) j ON j.jama_remark = 'Invoice ' || m.maal_invoice_no
        LEFT JOIN notifications n ON n.reminder_key = 'customer:maal:' || m.id
        WHERE c.reminder_enabled = 1
          AND c.reminder_days > 0
          AND date(m.maal_date, '+' || c.reminder_days || ' days') <= date('now')
          AND n.id IS NULL
          AND (m.maal_amount - COALESCE(j.paid, 0)) > 0
      `).all();

      const insertNotif = db.prepare(`
        INSERT OR IGNORE INTO notifications
          (type, account_id, account_name, invoice_no, invoice_date, pending_amount, message, is_read, created_at, reminder_key)
        VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
      `);

      const insertCustomerBatch = db.transaction((rows) => {
        for (const r of rows) {
          const pending = r.maal_amount - r.paid_amount;
          const invoiceLabel = r.invoice_no || `Entry #${r.maal_id}`;
          const msg = `${invoiceLabel} for ${r.account_name}: ₹${Math.round(pending).toLocaleString('en-IN')} still pending`;
          const key = `customer:maal:${r.maal_id}`;
          const res = insertNotif.run('customer', r.account_id, r.account_name, r.invoice_no, r.invoice_date, pending, msg, nowISO, key);
          if (res.changes > 0) newCount++;
        }
      });
      insertCustomerBatch(customerOverdue);

      // ── Supplier overdue invoices (single query) ──
      const supplierOverdue = db.prepare(`
        SELECT
          s.supplier_id   AS account_id,
          s.name          AS account_name,
          s.reminder_days,
          m.id            AS maal_id,
          m.maal_invoice_no AS invoice_no,
          m.maal_date     AS invoice_date,
          m.maal_amount,
          COALESCE(j.paid, 0) AS paid_amount
        FROM suppliers s
        JOIN supplier_maal_account m ON m.supplier_id = s.supplier_id
        LEFT JOIN (
          SELECT jama_remark, SUM(jama_amount) AS paid
          FROM supplier_jama_account
          GROUP BY jama_remark
        ) j ON j.jama_remark = 'Invoice ' || m.maal_invoice_no
        LEFT JOIN notifications n ON n.reminder_key = 'supplier:maal:' || m.id
        WHERE s.reminder_enabled = 1
          AND s.reminder_days > 0
          AND date(m.maal_date, '+' || s.reminder_days || ' days') <= date('now')
          AND n.id IS NULL
          AND (m.maal_amount - COALESCE(j.paid, 0)) > 0
      `).all();

      const insertSupplierBatch = db.transaction((rows) => {
        for (const r of rows) {
          const pending = r.maal_amount - r.paid_amount;
          const invoiceLabel = r.invoice_no || `Entry #${r.maal_id}`;
          const msg = `${invoiceLabel} for ${r.account_name}: ₹${Math.round(pending).toLocaleString('en-IN')} still pending`;
          const key = `supplier:maal:${r.maal_id}`;
          const res = insertNotif.run('supplier', r.account_id, r.account_name, r.invoice_no, r.invoice_date, pending, msg, nowISO, key);
          if (res.changes > 0) newCount++;
        }
      });
      insertSupplierBatch(supplierOverdue);

      // Mark today as scanned
      db.prepare("INSERT OR REPLACE INTO app_state (key, value) VALUES ('last_notification_scan', ?)").run(today);

      if (newCount > 0) {

        // Desktop notification (single summary, not per-invoice)
        if (Notification.isSupported()) {
          new Notification({
            title: 'AGS ERP — Payment Reminders',
            body: `${newCount} invoice${newCount > 1 ? 's' : ''} with pending payments need attention.`,
            silent: false
          }).show();
        }
        // Push updated unread count to renderer (only when new notifications created)
        const unread = db.prepare('SELECT COUNT(*) AS count FROM notifications WHERE is_read = 0').get();
        if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents && !mainWindow.webContents.isDestroyed()) {
          if (mainWindow.webContents.isLoading()) {
            mainWindow.webContents.once('did-finish-load', () => {
              if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents && !mainWindow.webContents.isDestroyed()) {
                mainWindow.webContents.send('notifications:countUpdate', unread.count);
              }
            });
          } else {
            mainWindow.webContents.send('notifications:countUpdate', unread.count);
          }
        }
      } else {

      }
    } else {

    }
  } catch (e) { console.error('[Notifications] Scanner error:', e.message); }

  // Batch transliterate any products missing Marathi names (non-blocking)
  setTimeout(async () => {
    try {
      // One-time migration: clear old Google Translate data (status='translated')
      // New transliterations will use status='transliterated' to avoid re-reset
      const needsReset = db.prepare(
        "SELECT COUNT(*) as cnt FROM products WHERE marathi_status = 'translated' AND marathi_name IS NOT NULL"
      ).get();
      if (needsReset && needsReset.cnt > 0) {
        db.prepare("UPDATE products SET marathi_name = NULL, marathi_status = 'missing' WHERE marathi_status = 'translated'").run();

      }

      const missing = db.prepare(
        "SELECT code, name FROM products WHERE (marathi_name IS NULL OR marathi_name = '') AND (is_deleted = 0 OR is_deleted IS NULL)"
      ).all();
      if (missing.length === 0) return;

      // Notify renderer that batch transliteration is starting
      if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents && !mainWindow.webContents.isDestroyed()) {
        mainWindow.webContents.send('marathi:batchStart', { total: missing.length });
      }

      // Word-by-word transliteration using Google Input Tools
      async function transliterateWord(word) {
        if (/^[^a-zA-Z]+$/.test(word)) return word; // keep numbers/special chars
        const url = `https://inputtools.google.com/request?text=${encodeURIComponent(word)}&itc=mr-t-i0-und&num=1`;
        const res = await fetch(url);
        if (!res.ok) return word;
        const data = await res.json();
        if (data[0] === 'SUCCESS' && data[1] && data[1][0] && data[1][0][1] && data[1][0][1][0]) {
          return data[1][0][1][0];
        }
        return word;
      }

      let translated = 0;
      for (const prod of missing) {
        try {
          const words = prod.name.split(/\s+/);
          const transliterated = [];
          for (const w of words) {
            transliterated.push(await transliterateWord(w));
          }
          const marathiName = transliterated.join(' ');
          db.prepare("UPDATE products SET marathi_name = ?, marathi_status = 'transliterated' WHERE code = ?").run(marathiName, prod.code);
          translated++;
          await new Promise(r => setTimeout(r, 100)); // rate limit safety
        } catch (e) { console.error(`[Marathi] Failed for ${prod.code}:`, e.message); }
      }

      // Notify renderer if window is available
      if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents && !mainWindow.webContents.isDestroyed()) {
        mainWindow.webContents.send('marathi:batchComplete', { translated, total: missing.length });
      }
    } catch (e) { console.error('[Marathi] Batch transliteration error:', e.message); }
  }, 3000); // Delay 3s to let the app fully load
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});