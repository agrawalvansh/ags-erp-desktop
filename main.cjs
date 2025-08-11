const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

// ─── Init SQLite (shared) ───────────────────────────────
const db = require('./db'); // uses better-sqlite3 instance
// Enforce foreign key constraints on every connection
if (db.pragma) db.pragma('foreign_keys = ON');

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
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});