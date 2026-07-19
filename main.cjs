const { app, BrowserWindow, ipcMain, Notification, dialog, Menu } = require('electron');
const path = require('path');

// ─── Init SQLite (shared) ───────────────────────────────
const db = require('./db');
if (db.pragma) db.pragma('foreign_keys = ON');

// ─── DB Error Guard ─────────────────────────────────────
// If db.js detected a schema mismatch or migration failure,
// show a native error dialog and quit immediately.
if (db.dbError) {
  app.whenReady().then(() => {
    dialog.showErrorBox(
      'AGS ERP — Database Error',
      `App version: ${app.getVersion()}\n\n`
      + db.dbError
      + '\n\nPlease contact Vansh Agrawal (+91-7378882317) and share this full message.'
    );
    app.quit();
  });
  // Return from the module — skip ALL other initialization
  return;
}

// ─── Single-Instance Lock ──────────────────────────────
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  // Show a native dialog so the user knows why the app didn't open
  dialog.showErrorBox(
    'AGS ERP — Already Running',
    'AGS ERP is already open.\n\nYou cannot run two instances at the same time.\nPlease switch to the existing window.'
  );
  app.quit();
  process.exit(0);
}

// When a second instance is attempted, focus the existing window
app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});
// ═══════════════════════════════════════════════════════════════════════════
// DAILY JOBS — Extracted as module-level functions so they can be called
// from both startup AND the midnight rollover interval.
// ═══════════════════════════════════════════════════════════════════════════

/** Helper: get local YYYY-MM-DD date string */
function getToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

/**
 * Job 1: Quick Sales Cleanup — deletes QS older than 30 days.
 * Returns the number of deleted records.
 */
function runQsCleanup() {
  const today = getToday();
  const lastCleanup = db.prepare("SELECT value FROM app_state WHERE key = 'last_qs_cleanup'").get();
  if (lastCleanup && lastCleanup.value === today) return 0; // Already done today

  const cleanupTxn = db.transaction(() => {
    db.prepare(`
      DELETE FROM quick_sale_items
      WHERE qs_id IN (
        SELECT qs_id FROM quick_sales
        WHERE date(qs_date) < date('now', '-30 days')
      )
    `).run();

    const result = db.prepare(`
      DELETE FROM quick_sales
      WHERE date(qs_date) < date('now', '-30 days')
    `).run();

    return result.changes;
  });
  const count = cleanupTxn();

  if (count > 0) {
    console.log(`[Cleanup] Deleted ${count} quick sale(s) older than 30 days`);
  }

  db.prepare("INSERT OR REPLACE INTO app_state (key, value) VALUES ('last_qs_cleanup', ?)").run(today);
  return count;
}

/**
 * Job 2: Notification Scanner — creates reminders for overdue customer/supplier invoices.
 * Also cleans up resolved/orphaned notifications.
 * Returns { newCount } indicating how many new notifications were created.
 */
function runNotificationScanner() {
  const today = getToday();
  const lastScan = db.prepare("SELECT value FROM app_state WHERE key = 'last_notification_scan'").get();
  if (lastScan && lastScan.value === today) return { newCount: 0 }; // Already done today

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
      AND date(m.maal_date, '+' || c.reminder_days || ' days') <= date('now','localtime')
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
      AND date(m.maal_date, '+' || s.reminder_days || ' days') <= date('now','localtime')
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

  // 🟢 Clean up resolved notifications 🟢
  db.prepare(`
    DELETE FROM notifications
    WHERE id IN (
      SELECT n.id
      FROM notifications n
      JOIN customer_maal_account m ON n.reminder_key = 'customer:maal:' || m.id
      LEFT JOIN (
        SELECT linked_invoice_id, jama_remark, SUM(jama_amount) AS total
        FROM customer_jama_account
        GROUP BY linked_invoice_id, jama_remark
      ) j ON j.linked_invoice_id = n.invoice_no OR j.jama_remark = 'Invoice ' || n.invoice_no
      WHERE n.type = 'customer'
        AND COALESCE(j.total, 0) >= m.maal_amount
    )
  `).run();

  db.prepare(`
    DELETE FROM notifications
    WHERE id IN (
      SELECT n.id
      FROM notifications n
      JOIN supplier_maal_account m ON n.reminder_key = 'supplier:maal:' || m.id
      LEFT JOIN (
        SELECT jama_remark, SUM(jama_amount) AS total
        FROM supplier_jama_account
        GROUP BY jama_remark
      ) j ON j.jama_remark = 'Invoice ' || n.invoice_no
      WHERE n.type = 'supplier'
        AND COALESCE(j.total, 0) >= m.maal_amount
    )
  `).run();

  db.prepare(`
    DELETE FROM notifications
    WHERE id IN (
      SELECT n.id
      FROM notifications n
      LEFT JOIN invoices i ON i.invoice_id = n.invoice_no
      WHERE n.type = 'invoice_overdue'
        AND (n.invoice_no IS NULL OR i.status = 'paid' OR i.invoice_id IS NULL)
    )
  `).run();

  db.prepare("INSERT OR REPLACE INTO app_state (key, value) VALUES ('last_notification_scan', ?)").run(today);
  return { newCount };
}

/**
 * Job 3: Overdue Invoice Refresh — marks invoices as 'overdue' if past due date.
 * Returns the number of newly overdue invoices.
 */
function runOverdueRefresh() {
  const today = getToday();
  const lastOverdueScan = db.prepare("SELECT value FROM app_state WHERE key = 'last_overdue_scan'").get();
  if (lastOverdueScan && lastOverdueScan.value === today) return 0; // Already done today

  let overdueCount = 0;
  const nowISO = new Date().toISOString();

  // Find overdue invoices in a single query
  const overdueInvoices = db.prepare(`
    SELECT
      i.invoice_id,
      i.invoice_date,
      i.grand_total,
      i.customer_id,
      c.name AS customer_name,
      COALESCE(j.total_paid, 0) AS total_paid
    FROM invoices i
    JOIN customers c ON c.customer_id = i.customer_id
    LEFT JOIN (
      SELECT linked_invoice_id, SUM(jama_amount) AS total_paid
      FROM customer_jama_account
      GROUP BY linked_invoice_id
    ) j ON j.linked_invoice_id = i.invoice_id
    WHERE i.status IN ('awaiting_payment', 'partially_paid')
      AND c.reminder_enabled = 1
      AND i.payment_due_days > 0
      AND date('now', 'localtime') > date(i.invoice_date, '+' || i.payment_due_days || ' days')
      AND (i.grand_total - COALESCE(j.total_paid, 0)) > 0
  `).all();

  if (overdueInvoices.length > 0) {
    const insertNotif = db.prepare(`
      INSERT OR IGNORE INTO notifications
        (type, account_id, account_name, invoice_no, invoice_date,
         pending_amount, message, is_read, created_at, reminder_key)
      VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
    `);

    const updateStatus = db.prepare(`UPDATE invoices SET status = 'overdue' WHERE invoice_id = ?`);

    const processOverdue = db.transaction((rows) => {
      for (const inv of rows) {
        updateStatus.run(inv.invoice_id);
        const pendingAmount = inv.grand_total - inv.total_paid;
        const msg = `Invoice ${inv.invoice_id} for ${inv.customer_name}: ₹${Math.round(pendingAmount).toLocaleString('en-IN')} overdue`;
        insertNotif.run('invoice_overdue', inv.customer_id, inv.customer_name, inv.invoice_id,
          inv.invoice_date, pendingAmount, msg, nowISO, `overdue_invoice_${inv.invoice_id}`);
        overdueCount++;
      }
    });

    processOverdue(overdueInvoices);
  }

  db.prepare("INSERT OR REPLACE INTO app_state (key, value) VALUES ('last_overdue_scan', ?)").run(today);
  if (overdueCount > 0) console.log(`[Overdue] Marked ${overdueCount} invoice(s) as overdue`);
  return overdueCount;
}

/**
 * Sends updated unread notification count to the renderer window.
 */
function pushUnreadCount(win) {
  if (!win || win.isDestroyed() || !win.webContents || win.webContents.isDestroyed()) return;
  const unread = db.prepare('SELECT COUNT(*) AS count FROM notifications WHERE is_read = 0').get();
  if (win.webContents.isLoading()) {
    win.webContents.once('did-finish-load', () => {
      if (!win.isDestroyed() && win.webContents && !win.webContents.isDestroyed()) {
        win.webContents.send('notifications:countUpdate', unread.count);
      }
    });
  } else {
    win.webContents.send('notifications:countUpdate', unread.count);
  }
}

/**
 * Job 4: Batch Transliteration — transliterates products missing Marathi names.
 * Retries automatically on the hourly interval if products are still missing.
 * Returns the number of newly transliterated products.
 */
let _batchTransliterationInProgress = false;

async function runBatchTransliteration(win) {
  if (_batchTransliterationInProgress) {
    console.log('[Marathi] Batch already in progress — skipping');
    return 0;
  }
  _batchTransliterationInProgress = true;
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
    if (missing.length === 0) return 0;

    // Notify renderer that batch transliteration is starting
    if (win && !win.isDestroyed() && win.webContents && !win.webContents.isDestroyed()) {
      win.webContents.send('marathi:batchStart', { total: missing.length });
    }

    // Word-by-word transliteration using Google Input Tools
    async function transliterateWord(word) {
      if (/^[^a-zA-Z]+$/.test(word)) return word; // keep numbers/special chars
      const url = `https://inputtools.google.com/request?text=${encodeURIComponent(word)}&itc=mr-t-i0-und&num=1`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      try {
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeout);
        if (!res.ok) return word;
        const data = await res.json();
        if (data[0] === 'SUCCESS' && data[1] && data[1][0] && data[1][0][1] && data[1][0][1][0]) {
          return data[1][0][1][0];
        }
        return word;
      } catch {
        clearTimeout(timeout);
        throw new Error('Network unreachable');
      }
    }

    let translated = 0;
    let networkFailed = false;
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
        await new Promise(r => setTimeout(r, 100));
      } catch (e) {
        // If network fails, stop the batch early — will retry on next interval
        if (e.message === 'Network unreachable') {
          console.warn(`[Marathi] Network unreachable — stopping batch. ${translated}/${missing.length} done, will retry later.`);
          networkFailed = true;
          break;
        }
        console.error(`[Marathi] Failed for ${prod.code}:`, e.message);
      }
    }

    if (win && !win.isDestroyed() && win.webContents && !win.webContents.isDestroyed()) {
      win.webContents.send('marathi:batchComplete', { translated, total: missing.length, partial: networkFailed });
    }

    if (networkFailed) {
      console.log(`[Marathi] ${missing.length - translated} product(s) still missing — will retry on next hourly check`);
    }

    return translated;
  } catch (e) {
    console.error('[Marathi] Batch transliteration error:', e.message);
    return 0;
  } finally {
    _batchTransliterationInProgress = false;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// RUN DAILY JOBS ON STARTUP
// ═══════════════════════════════════════════════════════════════════════════

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

    if (printerName) {
      await NodePdfPrinter.printFiles([tempFile], printerName);
    } else {
      await NodePdfPrinter.printFiles([tempFile]);
    }

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

  // Remove default menu to prevent Chromium intercepting app shortcuts (Ctrl+F, etc.)
  Menu.setApplicationMenu(null);

  // Maximize the window and then show it
  mainWindow.maximize();
  mainWindow.show();

  // Load the bundled React build from the dist folder
  mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
}

app.whenReady().then(() => {
  createWindow();

  setTimeout(() => {
    try {
      const count = runQsCleanup();
      if (count > 0) {
        const sendCleanupMsg = () => {
          if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents && !mainWindow.webContents.isDestroyed()) {
            mainWindow.webContents.send('cleanup:quickSalesDeleted', { count });
          }
        };
        if (mainWindow.webContents.isLoading()) {
          mainWindow.webContents.once('did-finish-load', sendCleanupMsg);
        } else {
          sendCleanupMsg();
        }
      }
    } catch (e) {
      console.error('[Scheduler] Quick sales cleanup error:', e.message);
    }
  }, 1000);

  // Notify renderer about successful upgrade (version-based detection)
  const currentVersion = app.getVersion();
  const lastVersion = db.prepare("SELECT value FROM app_state WHERE key = 'last_app_version'").get();
  const isUpgraded = currentVersion && lastVersion && lastVersion.value && lastVersion.value !== currentVersion;

  if (isUpgraded && !db.dbError) {
    const sendUpgradeMsg = () => {
      if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents && !mainWindow.webContents.isDestroyed()) {
        mainWindow.webContents.send('app:upgraded', { from: lastVersion.value, to: currentVersion });
      }
    };
    if (mainWindow.webContents.isLoading()) {
      mainWindow.webContents.once('did-finish-load', sendUpgradeMsg);
    } else {
      sendUpgradeMsg();
    }
  }

  // Always persist the current version (first run or upgrade)
  db.prepare("INSERT OR REPLACE INTO app_state (key, value) VALUES ('last_app_version', ?)").run(currentVersion);

  // ─── Run daily notification scanner + overdue refresh ──────────────────
  try {
    const { newCount } = runNotificationScanner();
    if (newCount > 0) {
      if (Notification.isSupported()) {
        new Notification({
          title: 'AGS ERP — Payment Reminders',
          body: `${newCount} invoice${newCount > 1 ? 's' : ''} with pending payments need attention.`,
          silent: false
        }).show();
      }
      pushUnreadCount(mainWindow);
    }
  } catch (e) { console.error('[Notifications] Scanner error:', e.message); }

  // Overdue refresh (non-blocking, runs after 2s)
  setTimeout(() => {
    try {
      const overdueCount = runOverdueRefresh();
      if (overdueCount > 0) pushUnreadCount(mainWindow);
    } catch (err) {
      console.error('[Overdue] Invoice overdue refresh error:', err.message);
    }
  }, 2000);

  // Batch transliterate any products missing Marathi names (non-blocking)
  setTimeout(() => runBatchTransliteration(mainWindow), 3000);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// ─── Hourly Background Check ────────────────────────────────────
// Runs every hour. Two responsibilities:
// 1. Midnight rollover: re-runs daily jobs when the day changes.
// 2. Transliteration retry: retries products missing Marathi names
//    (e.g. if startup batch failed due to no internet).
let lastKnownDay = getToday();

setInterval(async () => {
  // ── Transliteration retry (every hour, regardless of day change) ──
  try {
    const missingCount = db.prepare(
      "SELECT COUNT(*) as cnt FROM products WHERE (marathi_name IS NULL OR marathi_name = '') AND (is_deleted = 0 OR is_deleted IS NULL)"
    ).get().cnt;
    if (missingCount > 0) {
      console.log(`[Hourly] ${missingCount} product(s) still missing Marathi names — retrying...`);
      const win = BrowserWindow.getAllWindows()[0];
      await runBatchTransliteration(win);
    }
  } catch (e) { console.error('[Hourly] Transliteration retry error:', e.message); }

  // ── Midnight rollover (only when day changes) ──
  const currentDay = getToday();
  if (currentDay === lastKnownDay) return;

  lastKnownDay = currentDay;
  console.log(`[Midnight] Day changed to ${currentDay} — re-running daily scans`);

  // Clear markers so the functions know to re-run
  try {
    db.prepare("DELETE FROM app_state WHERE key IN ('last_qs_cleanup', 'last_notification_scan', 'last_overdue_scan')").run();
  } catch (e) { console.error('[Midnight] Failed to clear markers:', e.message); }

  // Job 1: QS Cleanup
  try { runQsCleanup(); } catch (e) { console.error('[Midnight] QS cleanup error:', e.message); }

  // Job 2: Notification Scanner
  try {
    const { newCount } = runNotificationScanner();
    if (newCount > 0 && Notification.isSupported()) {
      new Notification({
        title: 'AGS ERP — Payment Reminders',
        body: `${newCount} invoice${newCount > 1 ? 's' : ''} with pending payments need attention.`,
        silent: false
      }).show();
    }
  } catch (e) { console.error('[Midnight] Notification scan error:', e.message); }

  // Job 3: Overdue Invoice Refresh
  try { runOverdueRefresh(); } catch (e) { console.error('[Midnight] Overdue scan error:', e.message); }

  // Push updated unread count to renderer
  try {
    const win = BrowserWindow.getAllWindows()[0];
    pushUnreadCount(win);
  } catch (e) { console.error('[Midnight] Unread count push error:', e.message); }
}, 60 * 60 * 1000); // Check every 1 hour
