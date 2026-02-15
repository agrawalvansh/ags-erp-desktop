// backend/db.js
// This file sets up the SQLite database and creates all required tables.
// Requires `better-sqlite3` (install via `npm install better-sqlite3`).

const Database = require('better-sqlite3');
const path = require('path');
const { app } = require('electron');

// Get the user data directory for the app
const userDataPath = app.getPath('userData');
const dbPath = path.join(userDataPath, 'erp.db');

// Open (or create) the SQLite database file in user data directory
// `verbose: console.log` logs all SQL statements for debugging.
const db = new Database(dbPath, { verbose: console.log });

// 1. Master Data

// Products table
db.prepare(`
  CREATE TABLE IF NOT EXISTS products (
    code           TEXT    PRIMARY KEY,
    name           TEXT    NOT NULL,
    size           TEXT,
    cost_price     REAL,
    selling_price  REAL,
    packing_type   TEXT,
    is_deleted     INTEGER DEFAULT 0
  )
`).run();

// Migration: Add is_deleted column if it doesn't exist
try {
  db.prepare('SELECT is_deleted FROM products LIMIT 1').get();
} catch (e) {
  // Column doesn't exist, add it
  db.prepare('ALTER TABLE products ADD COLUMN is_deleted INTEGER DEFAULT 0').run();
  console.log('Added is_deleted column to products table');
}

// Customers table
db.prepare(`
  CREATE TABLE IF NOT EXISTS customers (
    customer_id    TEXT    PRIMARY KEY,
    name           TEXT    NOT NULL,
    address        TEXT,
    mobile         TEXT
  )
`).run();

// Suppliers table
db.prepare(`
  CREATE TABLE IF NOT EXISTS suppliers (
    supplier_id    TEXT    PRIMARY KEY,
    name           TEXT    NOT NULL,
    address        TEXT,
    mobile         TEXT
  )
`).run();

// 2. Invoices

// Invoices header
db.prepare(`
  CREATE TABLE IF NOT EXISTS invoices (
    invoice_id     TEXT    PRIMARY KEY,
    customer_id    TEXT    NOT NULL,
    invoice_date   TEXT    NOT NULL,
    remark         TEXT,
    packing        REAL DEFAULT 0.0,
    freight        REAL DEFAULT 0.0,
    riksha         REAL DEFAULT 0.0,
    grand_total    REAL DEFAULT 0.0,
    FOREIGN KEY(customer_id) REFERENCES customers(customer_id)
  )
`).run();

// Invoice line items
db.prepare(`
  CREATE TABLE IF NOT EXISTS invoice_items (
    id              INTEGER   PRIMARY KEY AUTOINCREMENT,
    invoice_id      TEXT      NOT NULL,
    product_code    TEXT      NOT NULL,
    quantity        INTEGER   NOT NULL,
    selling_price   REAL      NOT NULL,
    FOREIGN KEY(invoice_id)   REFERENCES invoices(invoice_id),
    FOREIGN KEY(product_code) REFERENCES products(code)
  )
`).run();

// 3. Customer Orders

// Orders placed BY customers (you fulfill them)
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
    id             INTEGER   PRIMARY KEY AUTOINCREMENT,
    order_id       TEXT      NOT NULL,
    product_code   TEXT      NOT NULL,
    quantity       INTEGER   NOT NULL,
    FOREIGN KEY(order_id)     REFERENCES customer_orders(order_id),
    FOREIGN KEY(product_code) REFERENCES products(code)
  )
`).run();

// 4. Supplier Orders

// Orders placed TO suppliers (you’re the buyer)
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
    id             INTEGER   PRIMARY KEY AUTOINCREMENT,
    order_id       TEXT      NOT NULL,
    product_code   TEXT      NOT NULL,
    quantity       INTEGER   NOT NULL,
    FOREIGN KEY(order_id)     REFERENCES supplier_orders(order_id),
    FOREIGN KEY(product_code) REFERENCES products(code)
  )
`).run();


// 4. Customer Accounts

// Customer Maal (sales) account entries
db.prepare(`
  CREATE TABLE IF NOT EXISTS customer_maal_account (
    id               INTEGER   PRIMARY KEY AUTOINCREMENT,
    customer_id      TEXT      NOT NULL,
    maal_date        TEXT      NOT NULL,
    maal_invoice_no  TEXT,
    maal_amount      REAL      NOT NULL,
    maal_remark      TEXT,
    FOREIGN KEY(customer_id) REFERENCES customers(customer_id)
  )
`).run();

// Customer Jama (payments) account entries
db.prepare(`
  CREATE TABLE IF NOT EXISTS customer_jama_account (
    id               INTEGER   PRIMARY KEY AUTOINCREMENT,
    customer_id      TEXT      NOT NULL,
    jama_date        TEXT      NOT NULL,
    jama_txn_type    TEXT      NOT NULL,
    jama_amount      REAL      NOT NULL,
    jama_remark      TEXT,
    FOREIGN KEY(customer_id) REFERENCES customers(customer_id)
  )
`).run();

// 5. Supplier Accounts

// Supplier Maal (purchases) account entries
db.prepare(`
  CREATE TABLE IF NOT EXISTS supplier_maal_account (
    id                 INTEGER   PRIMARY KEY AUTOINCREMENT,
    supplier_id        TEXT      NOT NULL,
    maal_date          TEXT      NOT NULL,
    maal_invoice_no    TEXT,
    maal_amount        REAL      NOT NULL,
    maal_remark        TEXT,
    FOREIGN KEY(supplier_id) REFERENCES suppliers(supplier_id)
  )
`).run();

// Supplier Jama (payments) account entries
db.prepare(`
  CREATE TABLE IF NOT EXISTS supplier_jama_account (
    id                 INTEGER   PRIMARY KEY AUTOINCREMENT,
    supplier_id        TEXT      NOT NULL,
    jama_date          TEXT      NOT NULL,
    jama_txn_type      TEXT      NOT NULL,
    jama_amount        REAL      NOT NULL,
    jama_remark        TEXT,
    FOREIGN KEY(supplier_id) REFERENCES suppliers(supplier_id)
  )
`).run();

// Migration history table to track one-time migrations
db.prepare(`
  CREATE TABLE IF NOT EXISTS migration_history (
    id                 INTEGER   PRIMARY KEY AUTOINCREMENT,
    migration_name     TEXT      NOT NULL UNIQUE,
    executed_at        TEXT      NOT NULL
  )
`).run();

// Document sequences table - tracks the highest number ever created for each doc type
db.prepare(`
  CREATE TABLE IF NOT EXISTS document_sequences (
    doc_type    TEXT    PRIMARY KEY,
    last_number INTEGER NOT NULL
  )
`).run();

// Initialize sequence for invoices if not exists
db.prepare(`INSERT OR IGNORE INTO document_sequences (doc_type, last_number) VALUES ('invoice', 0)`).run();

// One-time migration: Reset sequence to match actual max invoice number
// This migration is GUARDED - runs only ONCE, tracked in migration_history
const SEQUENCE_FIX_MIGRATION = 'fix_invoice_sequence_v1';
const migrationExists = db.prepare(
  'SELECT 1 FROM migration_history WHERE migration_name = ?'
).get(SEQUENCE_FIX_MIGRATION);

if (!migrationExists) {
  // Run the one-time fix
  const maxExistingInvoice = db.prepare(`
    SELECT MAX(
      CASE 
        WHEN invoice_id LIKE 'E-%' THEN CAST(SUBSTR(invoice_id, 3) AS INTEGER)
        WHEN invoice_id LIKE 'AGS-I-%' THEN CAST(SUBSTR(invoice_id, 7) AS INTEGER)
        ELSE 0
      END
    ) AS max_num FROM invoices
  `).get();
  const actualMax = maxExistingInvoice && maxExistingInvoice.max_num ? maxExistingInvoice.max_num : 0;

  db.prepare(`UPDATE document_sequences SET last_number = ? WHERE doc_type = 'invoice'`).run(actualMax);

  // Record that this migration has run
  db.prepare(
    `INSERT INTO migration_history (migration_name, executed_at) VALUES (?, datetime('now'))`
  ).run(SEQUENCE_FIX_MIGRATION);

  console.log(`[Migration] ${SEQUENCE_FIX_MIGRATION}: Reset invoice sequence to ${actualMax}`);
}

// Reusable invoice numbers pool - stores freed numbers from deleted invoices
db.prepare(`
  CREATE TABLE IF NOT EXISTS reusable_invoice_numbers (
    invoice_number INTEGER PRIMARY KEY
  )
`).run();

// Export only the database connection
// Cleanup is now handled via admin:cleanupSoftDeletedProducts IPC handler (manual only)
module.exports = db;