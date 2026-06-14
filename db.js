// db.js
// Sets up the SQLite database and creates all required tables.
// -------------------------------------------------------------------
const Database = require('better-sqlite3');
const path = require('path');
const { app } = require('electron');

const userDataPath = app.getPath('userData');
const dbPath = path.join(userDataPath, 'erp.db');
// `verbose: console.log` logs all SQL statements for debugging.
const db = new Database(dbPath, { verbose: console.log });
db.pragma('foreign_keys = ON');

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

// Migration: add updated_at column if it doesn't exist yet
try {
  db.prepare("SELECT updated_at FROM products LIMIT 1").get();
} catch (e) {
  db.prepare("ALTER TABLE products ADD COLUMN updated_at TEXT DEFAULT NULL").run();
}


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

// Initialize all document sequences
db.prepare(`INSERT OR IGNORE INTO document_sequences (doc_type, last_number) VALUES ('invoice', 0)`).run();
db.prepare(`INSERT OR IGNORE INTO document_sequences (doc_type, last_number) VALUES ('customer_order', 0)`).run();
db.prepare(`INSERT OR IGNORE INTO document_sequences (doc_type, last_number) VALUES ('supplier_order', 0)`).run();
db.prepare(`INSERT OR IGNORE INTO document_sequences (doc_type, last_number) VALUES ('quick_sale', 0)`).run();

// ─── Performance Indexes ─────────────────────────────────

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

// ─── 10. Users (Authentication) ─────────────────────────

db.prepare(`
  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT    UNIQUE NOT NULL,
    password_hash TEXT    NOT NULL
  )
`).run();

// Seed default user on first run only
const crypto = require('crypto');
const existingUser = db.prepare('SELECT id FROM users WHERE username = ?').get('amit_agrawal');
if (!existingUser) {
  const hash = crypto.createHash('sha256').update('Amit@1234').digest('hex');
  db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run('amit_agrawal', hash);
}

// ─── MIGRATION: Invoice Status + Payment Linking ─────────────────────────

// 1. Add status column to invoices
try {
  db.prepare('SELECT status FROM invoices LIMIT 1').get()
} catch (e) {
  db.prepare(`ALTER TABLE invoices ADD COLUMN status TEXT DEFAULT 'awaiting_payment'`).run()
  console.log('[Migration] Added invoices.status column')
}

// 2. Add payment_due_days column to invoices
try {
  db.prepare('SELECT payment_due_days FROM invoices LIMIT 1').get()
} catch (e) {
  db.prepare('ALTER TABLE invoices ADD COLUMN payment_due_days INTEGER DEFAULT 0').run()
  console.log('[Migration] Added invoices.payment_due_days column')
}

// 3. Add linked_invoice_id column to customer_jama_account
try {
  db.prepare('SELECT linked_invoice_id FROM customer_jama_account LIMIT 1').get()
} catch (e) {
  db.prepare('ALTER TABLE customer_jama_account ADD COLUMN linked_invoice_id TEXT DEFAULT NULL').run()
  console.log('[Migration] Added customer_jama_account.linked_invoice_id column')
}

// 4. Add index on linked_invoice_id for fast payment lookups
db.prepare(`
  CREATE INDEX IF NOT EXISTS idx_jama_linked_invoice
  ON customer_jama_account(linked_invoice_id)
`).run()

// 5. Backfill linked_invoice_id from existing remark text
// Existing entries have remark like "Invoice E-28" or "Invoice AGS-I-11"
const needsBackfill = db.prepare(`
  SELECT id, jama_remark
  FROM customer_jama_account
  WHERE jama_remark LIKE 'Invoice %'
  AND linked_invoice_id IS NULL
`).all()

if (needsBackfill.length > 0) {
  const updateLink = db.prepare(
    'UPDATE customer_jama_account SET linked_invoice_id = ? WHERE id = ?'
  )
  const verifyInvoice = db.prepare(
    'SELECT invoice_id FROM invoices WHERE invoice_id = ?'
  )
  let backfilled = 0
  for (const entry of needsBackfill) {
    const invoiceId = entry.jama_remark.replace(/^Invoice\s+/, '').trim()
    if (verifyInvoice.get(invoiceId)) {
      updateLink.run(invoiceId, entry.id)
      backfilled++
    }
  }
  console.log(`[Migration] Backfilled linked_invoice_id for ${backfilled} jama entries`)
}

// ─── END MIGRATION ────────────────────────────────────────────────────────

// ─── Export ──────────────────────────────────────────────

module.exports = db;