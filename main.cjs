const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

// ─── Init SQLite (shared) ───────────────────────────────
const db = require('./db'); // uses better-sqlite3 instance
// Enforce foreign key constraints on every connection
if (db.pragma) db.pragma('foreign_keys = ON');

// ─── Weekly Cleanup Scheduler ───────────────────────────
// Run cleanup of soft-deleted products every 7 days (in milliseconds)
const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

// Run cleanup once on startup
if (db.cleanupSoftDeletedProducts) {
  console.log('[Scheduler] Running initial soft-deleted products cleanup...');
  db.cleanupSoftDeletedProducts();
}

// Schedule weekly cleanup
setInterval(() => {
  if (db.cleanupSoftDeletedProducts) {
    console.log('[Scheduler] Running scheduled weekly cleanup...');
    db.cleanupSoftDeletedProducts();
  }
}, ONE_WEEK_MS);

// ─── Register IPC handlers ─────────────────────────────
const registerIpcHandlers = require('./ipcHandlers');
registerIpcHandlers(ipcMain, db);

// ─── Create the window ─────────────────────────────────
let mainWindow;
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
        console.log('[Marathi] Reset old translations for re-transliteration');
      }

      const missing = db.prepare(
        "SELECT code, name FROM products WHERE (marathi_name IS NULL OR marathi_name = '') AND (is_deleted = 0 OR is_deleted IS NULL)"
      ).all();
      if (missing.length === 0) return;
      console.log(`[Marathi] Batch transliterating ${missing.length} products...`);
      // Notify renderer that batch transliteration is starting
      if (mainWindow && !mainWindow.isDestroyed()) {
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
      console.log(`[Marathi] Batch transliteration complete: ${translated}/${missing.length}`);
      // Notify renderer if window is available
      if (mainWindow && !mainWindow.isDestroyed()) {
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