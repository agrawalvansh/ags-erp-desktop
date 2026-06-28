// db.js
// Sets up the SQLite database, runs versioned migrations, and validates schema.
// Exports `db` (the database instance) and `dbError` (null if OK, string if error).
// -------------------------------------------------------------------
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { app } = require('electron');

const userDataPath = app.getPath('userData');
const dbPath = path.join(userDataPath, 'erp.db');
// `verbose: console.log` logs all SQL statements for debugging.
const db = new Database(dbPath, { verbose: console.log });
db.pragma('foreign_keys = ON');

// ─── Migration Utility ─────────────────────────────────────────────────────
// Safely adds a column to a table. If the column already exists, does nothing.
// This is idempotent — safe to call multiple times.
function safeAddColumn(db, table, col, definition) {
  try {
    db.prepare(`SELECT ${col} FROM ${table} LIMIT 1`).get();
  } catch {
    db.prepare(`ALTER TABLE ${table} ADD COLUMN ${col} ${definition}`).run();
  }
}

// ─── Versioned Migrations ───────────────────────────────────────────────────
// Each migration has a sequential version, a description, and an up() function.
// Rules:
//   - Versions must be sequential integers (1, 2, 3, ...)
//   - Each migration must be idempotent (safe to run twice)
//   - Never edit an existing migration — only add new ones at the end
//   - Use safeAddColumn() for ALTER TABLE operations
// See docs/migrations.md for the full guide.

const MIGRATIONS = [
  {
    version: 1,
    description: 'Baseline: add updated_at, status, payment_due_days, linked_invoice_id + backfill',
    up: (db) => {
      // Schema changes
      safeAddColumn(db, 'products', 'updated_at', 'TEXT DEFAULT NULL');
      safeAddColumn(db, 'invoices', 'status', "TEXT DEFAULT 'awaiting_payment'");
      safeAddColumn(db, 'invoices', 'payment_due_days', 'INTEGER DEFAULT 0');
      safeAddColumn(db, 'customer_jama_account', 'linked_invoice_id', 'TEXT DEFAULT NULL');

      // Index for fast payment lookups
      db.prepare(`
        CREATE INDEX IF NOT EXISTS idx_jama_linked_invoice
        ON customer_jama_account(linked_invoice_id)
      `).run();

      // Data backfill: link existing jama entries to their invoices
      // Existing entries have remark like "Invoice E-28" or "Invoice AGS-I-11"
      const needsBackfill = db.prepare(`
        SELECT id, jama_remark
        FROM customer_jama_account
        WHERE jama_remark LIKE 'Invoice %'
          AND linked_invoice_id IS NULL
      `).all();

      if (needsBackfill.length > 0) {
        const updateLink = db.prepare(
          'UPDATE customer_jama_account SET linked_invoice_id = ? WHERE id = ?'
        );
        const verifyInvoice = db.prepare(
          'SELECT invoice_id FROM invoices WHERE invoice_id = ?'
        );
        let backfilled = 0;
        for (const entry of needsBackfill) {
          const invoiceId = entry.jama_remark.replace(/^Invoice\s+/, '').trim();
          if (verifyInvoice.get(invoiceId)) {
            updateLink.run(invoiceId, entry.id);
            backfilled++;
          }
        }
        if (backfilled > 0) {
          console.log(`[Migration v1] Backfilled linked_invoice_id for ${backfilled} jama entries`);
        }
      }
    }
  },
  // ── Future migrations go here ──────────────────────────────────────────
  // {
  //   version: 2,
  //   description: 'Add discount column to invoices',
  //   up: (db) => {
  //     safeAddColumn(db, 'invoices', 'discount', 'REAL DEFAULT 0.0')
  //   }
  // },
];

// ─── Expected Schema ────────────────────────────────────────────────────────
// Source of truth for post-migration validation.
// Every table and column in the app must be listed here.
// After migrations run, validateSchema() checks the actual DB against this map.

const EXPECTED_SCHEMA = {
  products: ['code', 'name', 'size', 'cost_price', 'selling_price', 'packing_type', 'is_deleted', 'marathi_name', 'marathi_status', 'updated_at'],
  customers: ['customer_id', 'name', 'address', 'mobile', 'reminder_enabled', 'reminder_days'],
  suppliers: ['supplier_id', 'name', 'address', 'mobile', 'reminder_enabled', 'reminder_days'],
  invoices: ['invoice_id', 'customer_id', 'invoice_date', 'remark', 'packing', 'freight', 'riksha', 'grand_total', 'invoice_time', 'is_private_note', 'status', 'payment_due_days'],
  invoice_items: ['id', 'invoice_id', 'product_code', 'quantity', 'selling_price'],
  customer_orders: ['order_id', 'customer_id', 'order_date', 'remark', 'status'],
  customer_order_items: ['id', 'order_id', 'product_code', 'product_name', 'product_size', 'packing_type', 'quantity', 'item_remark', 'is_temporary'],
  supplier_orders: ['order_id', 'supplier_id', 'order_date', 'remark', 'status'],
  supplier_order_items: ['id', 'order_id', 'product_code', 'product_name', 'product_size', 'packing_type', 'quantity', 'item_remark', 'is_temporary'],
  customer_maal_account: ['id', 'customer_id', 'maal_date', 'maal_invoice_no', 'maal_amount', 'maal_remark'],
  customer_jama_account: ['id', 'customer_id', 'jama_date', 'jama_txn_type', 'jama_amount', 'jama_remark', 'linked_invoice_id'],
  supplier_maal_account: ['id', 'supplier_id', 'maal_date', 'maal_invoice_no', 'maal_amount', 'maal_remark'],
  supplier_jama_account: ['id', 'supplier_id', 'jama_date', 'jama_txn_type', 'jama_amount', 'jama_remark'],
  quick_sales: ['qs_id', 'qs_date', 'total', 'remark', 'qs_time', 'is_private_note'],
  quick_sale_items: ['id', 'qs_id', 'product_code', 'product_name', 'product_size', 'packing_type', 'quantity', 'selling_price', 'is_temporary'],
  notifications: ['id', 'type', 'account_id', 'account_name', 'invoice_no', 'invoice_date', 'pending_amount', 'message', 'is_read', 'created_at', 'reminder_key'],
  app_state: ['key', 'value'],
  document_sequences: ['doc_type', 'last_number'],
  users: ['id', 'username', 'password_hash'],
  schema_version: ['id', 'version'],
};

// ─── Schema Validator ───────────────────────────────────────────────────────
function validateSchema(db, expectedSchema) {
  const errors = [];

  for (const [table, expectedCols] of Object.entries(expectedSchema)) {
    let actualCols;
    try {
      actualCols = db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name);
    } catch {
      errors.push(`Table "${table}" does not exist`);
      continue;
    }
    if (actualCols.length === 0) {
      errors.push(`Table "${table}" does not exist`);
      continue;
    }
    for (const col of expectedCols) {
      if (!actualCols.includes(col)) {
        errors.push(`Column "${table}.${col}" is missing`);
      }
    }
  }

  return errors;
}

// ═══════════════════════════════════════════════════════════════════════════
// DATABASE INITIALIZATION
// ═══════════════════════════════════════════════════════════════════════════
let dbError = null;
let migratedFrom = null;

try {
  // ─── 1. Master Data ────────────────────────────────────────

  db.prepare(`
    CREATE TABLE IF NOT EXISTS products (
      code           TEXT    PRIMARY KEY,
      name           TEXT    NOT NULL,
      size           TEXT,
      cost_price     REAL,
      selling_price  REAL,
      packing_type   TEXT,
      is_deleted     INTEGER DEFAULT 0,
      marathi_name   TEXT    DEFAULT NULL,
      marathi_status TEXT    DEFAULT 'missing',
      updated_at     TEXT    DEFAULT NULL
    )
  `).run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS customers (
      customer_id      TEXT    PRIMARY KEY,
      name             TEXT    NOT NULL,
      address          TEXT,
      mobile           TEXT,
      reminder_enabled INTEGER DEFAULT 0,
      reminder_days    INTEGER DEFAULT 0
    )
  `).run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS suppliers (
      supplier_id      TEXT    PRIMARY KEY,
      name             TEXT    NOT NULL,
      address          TEXT,
      mobile           TEXT,
      reminder_enabled INTEGER DEFAULT 0,
      reminder_days    INTEGER DEFAULT 0
    )
  `).run();

  // ─── 2. Invoices ───────────────────────────────────────────

  db.prepare(`
    CREATE TABLE IF NOT EXISTS invoices (
      invoice_id     TEXT    PRIMARY KEY,
      customer_id    TEXT    NOT NULL,
      invoice_date   TEXT    NOT NULL,
      remark         TEXT,
      packing        REAL    DEFAULT 0.0,
      freight        REAL    DEFAULT 0.0,
      riksha         REAL    DEFAULT 0.0,
      grand_total    REAL    DEFAULT 0.0,
      invoice_time   TEXT    DEFAULT NULL,
      is_private_note INTEGER DEFAULT 0,
      status          TEXT   DEFAULT 'awaiting_payment',
      payment_due_days INTEGER DEFAULT 0,
      FOREIGN KEY(customer_id) REFERENCES customers(customer_id)
    )
  `).run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS invoice_items (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id      TEXT    NOT NULL,
      product_code    TEXT    NOT NULL,
      quantity        INTEGER NOT NULL,
      selling_price   REAL    NOT NULL,
      FOREIGN KEY(invoice_id)   REFERENCES invoices(invoice_id),
      FOREIGN KEY(product_code) REFERENCES products(code)
    )
  `).run();

  // ─── 3. Customer Orders ───────────────────────────────────

  db.prepare(`
    CREATE TABLE IF NOT EXISTS customer_orders (
      order_id       TEXT    PRIMARY KEY,
      customer_id    TEXT    NOT NULL,
      order_date     TEXT    NOT NULL,
      remark         TEXT,
      status         TEXT,
      FOREIGN KEY(customer_id) REFERENCES customers(customer_id)
    )
  `).run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS customer_order_items (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id       TEXT    NOT NULL,
      product_code   TEXT,
      product_name   TEXT    DEFAULT '',
      product_size   TEXT    DEFAULT '',
      packing_type   TEXT    DEFAULT '',
      quantity       INTEGER NOT NULL,
      item_remark    TEXT    DEFAULT '',
      is_temporary   INTEGER DEFAULT 0,
      FOREIGN KEY(order_id) REFERENCES customer_orders(order_id)
    )
  `).run();

  // ─── 4. Supplier Orders ──────────────────────────────────

  db.prepare(`
    CREATE TABLE IF NOT EXISTS supplier_orders (
      order_id       TEXT    PRIMARY KEY,
      supplier_id    TEXT    NOT NULL,
      order_date     TEXT    NOT NULL,
      remark         TEXT,
      status         TEXT,
      FOREIGN KEY(supplier_id) REFERENCES suppliers(supplier_id)
    )
  `).run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS supplier_order_items (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id       TEXT    NOT NULL,
      product_code   TEXT,
      product_name   TEXT    DEFAULT '',
      product_size   TEXT    DEFAULT '',
      packing_type   TEXT    DEFAULT '',
      quantity       INTEGER NOT NULL,
      item_remark    TEXT    DEFAULT '',
      is_temporary   INTEGER DEFAULT 0,
      FOREIGN KEY(order_id) REFERENCES supplier_orders(order_id)
    )
  `).run();

  // ─── 5. Customer Accounts ────────────────────────────────

  db.prepare(`
    CREATE TABLE IF NOT EXISTS customer_maal_account (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id      TEXT    NOT NULL,
      maal_date        TEXT    NOT NULL,
      maal_invoice_no  TEXT,
      maal_amount      REAL    NOT NULL,
      maal_remark      TEXT,
      FOREIGN KEY(customer_id) REFERENCES customers(customer_id)
    )
  `).run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS customer_jama_account (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id      TEXT    NOT NULL,
      jama_date        TEXT    NOT NULL,
      jama_txn_type    TEXT    NOT NULL,
      jama_amount      REAL    NOT NULL,
      jama_remark      TEXT,
      linked_invoice_id TEXT   DEFAULT NULL,
      FOREIGN KEY(customer_id) REFERENCES customers(customer_id)
    )
  `).run();

  // ─── 6. Supplier Accounts ────────────────────────────────

  db.prepare(`
    CREATE TABLE IF NOT EXISTS supplier_maal_account (
      id                 INTEGER PRIMARY KEY AUTOINCREMENT,
      supplier_id        TEXT    NOT NULL,
      maal_date          TEXT    NOT NULL,
      maal_invoice_no    TEXT,
      maal_amount        REAL    NOT NULL,
      maal_remark        TEXT,
      FOREIGN KEY(supplier_id) REFERENCES suppliers(supplier_id)
    )
  `).run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS supplier_jama_account (
      id                 INTEGER PRIMARY KEY AUTOINCREMENT,
      supplier_id        TEXT    NOT NULL,
      jama_date          TEXT    NOT NULL,
      jama_txn_type      TEXT    NOT NULL,
      jama_amount        REAL    NOT NULL,
      jama_remark        TEXT,
      FOREIGN KEY(supplier_id) REFERENCES suppliers(supplier_id)
    )
  `).run();

  // ─── 7. Quick Sales ──────────────────────────────────────

  db.prepare(`
    CREATE TABLE IF NOT EXISTS quick_sales (
      qs_id           TEXT    PRIMARY KEY,
      qs_date         TEXT    NOT NULL,
      total           REAL    DEFAULT 0.0,
      remark          TEXT,
      qs_time         TEXT    DEFAULT NULL,
      is_private_note INTEGER DEFAULT 0
    )
  `).run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS quick_sale_items (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      qs_id         TEXT    NOT NULL,
      product_code  TEXT,
      product_name  TEXT    DEFAULT '',
      product_size  TEXT    DEFAULT '',
      packing_type  TEXT    DEFAULT '',
      quantity      INTEGER NOT NULL,
      selling_price REAL    NOT NULL,
      is_temporary  INTEGER DEFAULT 0,
      FOREIGN KEY(qs_id) REFERENCES quick_sales(qs_id)
    )
  `).run();

  // ─── 8. Notifications ───────────────────────────────────

  db.prepare(`
    CREATE TABLE IF NOT EXISTS notifications (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      type            TEXT    NOT NULL,
      account_id      TEXT    NOT NULL,
      account_name    TEXT    NOT NULL,
      invoice_no      TEXT,
      invoice_date    TEXT,
      pending_amount  REAL    NOT NULL,
      message         TEXT    NOT NULL,
      is_read         INTEGER DEFAULT 0,
      created_at      TEXT    NOT NULL,
      reminder_key    TEXT    UNIQUE
    )
  `).run();

  // ─── 9. System Tables ───────────────────────────────────

  db.prepare(`
    CREATE TABLE IF NOT EXISTS app_state (
      key   TEXT PRIMARY KEY,
      value TEXT
    )
  `).run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS document_sequences (
      doc_type    TEXT    PRIMARY KEY,
      last_number INTEGER NOT NULL
    )
  `).run();

  // Initialize document sequences
  db.prepare(`INSERT OR IGNORE INTO document_sequences (doc_type, last_number) VALUES ('invoice', 0)`).run();
  db.prepare(`INSERT OR IGNORE INTO document_sequences (doc_type, last_number) VALUES ('customer_order', 0)`).run();
  db.prepare(`INSERT OR IGNORE INTO document_sequences (doc_type, last_number) VALUES ('supplier_order', 0)`).run();
  db.prepare(`INSERT OR IGNORE INTO document_sequences (doc_type, last_number) VALUES ('quick_sale', 0)`).run();

  // ─── 10. Schema Version (Migration Tracking) ────────────

  db.prepare(`
    CREATE TABLE IF NOT EXISTS schema_version (
      id      INTEGER PRIMARY KEY CHECK (id = 1),
      version INTEGER NOT NULL DEFAULT 0
    )
  `).run();
  db.prepare(`INSERT OR IGNORE INTO schema_version (id, version) VALUES (1, 0)`).run();

  // ─── 11. Users (Authentication) ──────────────────────────

  db.prepare(`
    CREATE TABLE IF NOT EXISTS users (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      username      TEXT    UNIQUE NOT NULL,
      password_hash TEXT    NOT NULL
    )
  `).run();

  // ═════════════════════════════════════════════════════════════════════════
  // RUN VERSIONED MIGRATIONS
  // ═════════════════════════════════════════════════════════════════════════

  const currentVersion = db.prepare('SELECT version FROM schema_version WHERE id = 1').get().version;
  const pending = MIGRATIONS.filter(m => m.version > currentVersion);

  let backupPath = null;

  if (pending.length > 0) {
    migratedFrom = currentVersion;
    console.log(`[Migration] Current DB version: ${currentVersion}. ${pending.length} migration(s) pending.`);

    // Backup before migrations — delete old backups, keep only today's
    try {
      // Remove any old backup files first
      const existingBackups = fs.readdirSync(userDataPath)
        .filter(f => f.startsWith('erp.db.backup-'));
      for (const old of existingBackups) {
        try { fs.unlinkSync(path.join(userDataPath, old)); } catch { /* ignore */ }
      }

      const today = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; })();
      backupPath = path.join(userDataPath, `erp.db.backup-${today}`);
      fs.copyFileSync(dbPath, backupPath);
      console.log(`[Migration] Backup created: ${backupPath}`);
    } catch (backupErr) {
      console.warn(`[Migration] Backup failed (continuing anyway): ${backupErr.message}`);
    }

    // Run each pending migration inside a transaction
    for (const migration of pending) {
      try {
        db.transaction(() => {
          migration.up(db);
          db.prepare('UPDATE schema_version SET version = ? WHERE id = 1').run(migration.version);
        })();
        console.log(`[Migration] ✓ v${migration.version}: ${migration.description}`);
      } catch (err) {
        throw new Error(`Migration v${migration.version} (${migration.description}) failed:\n${err.message}`);
      }
    }
  }

  // ═════════════════════════════════════════════════════════════════════════
  // POST-MIGRATION SCHEMA VALIDATION (only after upgrade, not every startup)
  // ═════════════════════════════════════════════════════════════════════════

  if (migratedFrom !== null) {
    const schemaErrors = validateSchema(db, EXPECTED_SCHEMA);
    if (schemaErrors.length > 0) {
      const finalVersion = db.prepare('SELECT version FROM schema_version WHERE id = 1').get().version;
      dbError = `Database schema validation failed:\n\n`
        + schemaErrors.join('\n')
        + `\n\nCurrent DB version: ${finalVersion}`
        + `\nExpected DB version: ${MIGRATIONS.length > 0 ? MIGRATIONS[MIGRATIONS.length - 1].version : 0}`;
    } else if (backupPath) {
      // Migrations ran and validation passed — backup is no longer needed
      try {
        fs.unlinkSync(backupPath);
        console.log(`[Migration] Backup deleted (schema validated successfully)`);
      } catch { /* ignore if already deleted */ }
    }
  }

  // ═════════════════════════════════════════════════════════════════════════
  // PERFORMANCE INDEXES (idempotent, run every startup)
  // ═════════════════════════════════════════════════════════════════════════

  db.prepare('CREATE INDEX IF NOT EXISTS idx_invoices_customer ON invoices(customer_id)').run();
  db.prepare('CREATE INDEX IF NOT EXISTS idx_invoices_date ON invoices(invoice_date)').run();
  db.prepare('CREATE INDEX IF NOT EXISTS idx_invoice_items ON invoice_items(invoice_id)').run();
  db.prepare('CREATE INDEX IF NOT EXISTS idx_cust_maal_customer ON customer_maal_account(customer_id)').run();
  db.prepare('CREATE INDEX IF NOT EXISTS idx_cust_maal_invoice ON customer_maal_account(maal_invoice_no)').run();
  db.prepare('CREATE INDEX IF NOT EXISTS idx_cust_jama_customer ON customer_jama_account(customer_id)').run();
  db.prepare('CREATE INDEX IF NOT EXISTS idx_sup_maal_supplier ON supplier_maal_account(supplier_id)').run();
  db.prepare('CREATE INDEX IF NOT EXISTS idx_sup_jama_supplier ON supplier_jama_account(supplier_id)').run();
  db.prepare('CREATE INDEX IF NOT EXISTS idx_cust_order_customer ON customer_orders(customer_id)').run();
  db.prepare('CREATE INDEX IF NOT EXISTS idx_sup_order_supplier ON supplier_orders(supplier_id)').run();
  db.prepare('CREATE INDEX IF NOT EXISTS idx_qs_items ON quick_sale_items(qs_id)').run();
  db.prepare('CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(is_read)').run();
  db.prepare('CREATE INDEX IF NOT EXISTS idx_jama_linked_invoice ON customer_jama_account(linked_invoice_id)').run();

  // ═════════════════════════════════════════════════════════════════════════
  // DATA SEEDING (not a migration — runs every startup, idempotent)
  // ═════════════════════════════════════════════════════════════════════════

  // Seed default user on first run only
  const crypto = require('crypto');
  const existingUser = db.prepare('SELECT id FROM users WHERE username = ?').get('amit_agrawal');
  if (!existingUser) {
    const hash = crypto.createHash('sha256').update('Amit@1234').digest('hex');
    db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run('amit_agrawal', hash);
  }

} catch (err) {
  console.error('[DB Init] Fatal error:', err.message);
  dbError = `Database initialization failed:\n\n${err.message}`;
}

// ─── Export ──────────────────────────────────────────────
module.exports = db;
module.exports.dbError = dbError;
module.exports.migratedFrom = migratedFrom;