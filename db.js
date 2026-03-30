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

// Migration: add Marathi translation columns to products (safe to re-run)
try { db.prepare('ALTER TABLE products ADD COLUMN marathi_name TEXT DEFAULT NULL').run(); } catch (e) { /* column already exists */ }
try { db.prepare("ALTER TABLE products ADD COLUMN marathi_status TEXT DEFAULT 'missing'").run(); } catch (e) { /* column already exists */ }

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

// Migration: add reminder columns to customers (safe to re-run)
try { db.prepare('ALTER TABLE customers ADD COLUMN reminder_enabled INTEGER DEFAULT 0').run(); } catch (e) { /* column already exists */ }
try { db.prepare('ALTER TABLE customers ADD COLUMN reminder_days INTEGER DEFAULT 0').run(); } catch (e) { /* column already exists */ }

// Suppliers table
db.prepare(`
  CREATE TABLE IF NOT EXISTS suppliers (
    supplier_id    TEXT    PRIMARY KEY,
    name           TEXT    NOT NULL,
    address        TEXT,
    mobile         TEXT
  )
`).run();

// Migration: add reminder columns to suppliers (safe to re-run)
try { db.prepare('ALTER TABLE suppliers ADD COLUMN reminder_enabled INTEGER DEFAULT 0').run(); } catch (e) { /* column already exists */ }
try { db.prepare('ALTER TABLE suppliers ADD COLUMN reminder_days INTEGER DEFAULT 0').run(); } catch (e) { /* column already exists */ }

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
    product_code   TEXT,
    product_name   TEXT      DEFAULT '',
    product_size   TEXT      DEFAULT '',
    packing_type   TEXT      DEFAULT '',
    quantity       INTEGER   NOT NULL,
    item_remark    TEXT      DEFAULT '',
    is_temporary   INTEGER   DEFAULT 0,
    FOREIGN KEY(order_id)     REFERENCES customer_orders(order_id)
  )
`).run();

// 4. Supplier Orders

// Orders placed TO suppliers (you're the buyer)
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
    product_code   TEXT,
    product_name   TEXT      DEFAULT '',
    product_size   TEXT      DEFAULT '',
    packing_type   TEXT      DEFAULT '',
    quantity       INTEGER   NOT NULL,
    item_remark    TEXT      DEFAULT '',
    is_temporary   INTEGER   DEFAULT 0,
    FOREIGN KEY(order_id)     REFERENCES supplier_orders(order_id)
  )
`).run();

// Migration: remove FOREIGN KEY(product_code) from order item tables (SQLite requires recreation)
for (const tableName of ['customer_order_items', 'supplier_order_items']) {
  try {
    const tableInfo = db.prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name='${tableName}'`).get();
    if (tableInfo && tableInfo.sql && tableInfo.sql.includes('REFERENCES products')) {
      const parentTable = tableName === 'customer_order_items' ? 'customer_orders' : 'supplier_orders';
      db.transaction(() => {
        db.prepare(`
          CREATE TABLE ${tableName}_new (
            id             INTEGER   PRIMARY KEY AUTOINCREMENT,
            order_id       TEXT      NOT NULL,
            product_code   TEXT,
            product_name   TEXT      DEFAULT '',
            product_size   TEXT      DEFAULT '',
            packing_type   TEXT      DEFAULT '',
            quantity       INTEGER   NOT NULL,
            item_remark    TEXT      DEFAULT '',
            is_temporary   INTEGER   DEFAULT 0,
            FOREIGN KEY(order_id) REFERENCES ${parentTable}(order_id)
          )
        `).run();
        const cols = db.prepare(`PRAGMA table_info(${tableName})`).all().map(c => c.name);
        const hasRemark = cols.includes('item_remark');
        const hasName = cols.includes('product_name');
        const hasSize = cols.includes('product_size');
        const hasPacking = cols.includes('packing_type');
        const hasTemp = cols.includes('is_temporary');
        db.prepare(`
          INSERT INTO ${tableName}_new (id, order_id, product_code, product_name, product_size, packing_type, quantity, item_remark, is_temporary)
          SELECT id, order_id, product_code,
            ${hasName ? 'product_name' : "''"},
            ${hasSize ? 'product_size' : "''"},
            ${hasPacking ? 'packing_type' : "''"},
            quantity,
            ${hasRemark ? 'item_remark' : "''"},
            ${hasTemp ? 'is_temporary' : '0'}
          FROM ${tableName}
        `).run();
        db.prepare(`DROP TABLE ${tableName}`).run();
        db.prepare(`ALTER TABLE ${tableName}_new RENAME TO ${tableName}`).run();
      })();
    }
  } catch (e) { console.error(`Migration ${tableName} FK removal:`, e.message); }
}

// Migration: add columns to order item tables (safe to re-run)
try { db.prepare("ALTER TABLE customer_order_items ADD COLUMN item_remark TEXT DEFAULT ''").run(); } catch (e) { /* column already exists */ }
try { db.prepare("ALTER TABLE supplier_order_items ADD COLUMN item_remark TEXT DEFAULT ''").run(); } catch (e) { /* column already exists */ }
try { db.prepare("ALTER TABLE customer_order_items ADD COLUMN product_name TEXT DEFAULT ''").run(); } catch (e) { /* already exists */ }
try { db.prepare("ALTER TABLE customer_order_items ADD COLUMN product_size TEXT DEFAULT ''").run(); } catch (e) { /* already exists */ }
try { db.prepare("ALTER TABLE customer_order_items ADD COLUMN packing_type TEXT DEFAULT ''").run(); } catch (e) { /* already exists */ }
try { db.prepare("ALTER TABLE customer_order_items ADD COLUMN is_temporary INTEGER DEFAULT 0").run(); } catch (e) { /* already exists */ }
try { db.prepare("ALTER TABLE supplier_order_items ADD COLUMN product_name TEXT DEFAULT ''").run(); } catch (e) { /* already exists */ }
try { db.prepare("ALTER TABLE supplier_order_items ADD COLUMN product_size TEXT DEFAULT ''").run(); } catch (e) { /* already exists */ }
try { db.prepare("ALTER TABLE supplier_order_items ADD COLUMN packing_type TEXT DEFAULT ''").run(); } catch (e) { /* already exists */ }
try { db.prepare("ALTER TABLE supplier_order_items ADD COLUMN is_temporary INTEGER DEFAULT 0").run(); } catch (e) { /* already exists */ }

// Initialize sequences for orders
db.prepare(`INSERT OR IGNORE INTO document_sequences (doc_type, last_number) VALUES ('customer_order', 0)`).run();
db.prepare(`INSERT OR IGNORE INTO document_sequences (doc_type, last_number) VALUES ('supplier_order', 0)`).run();

// Reusable order numbers pools
db.prepare(`CREATE TABLE IF NOT EXISTS reusable_customer_order_numbers (order_number INTEGER PRIMARY KEY)`).run();
db.prepare(`CREATE TABLE IF NOT EXISTS reusable_supplier_order_numbers (order_number INTEGER PRIMARY KEY)`).run();

// One-time migration: sync order sequences with actual max order numbers
const ORDER_SEQ_MIGRATION = 'fix_order_sequences_v1';
const orderMigExists = db.prepare('SELECT 1 FROM migration_history WHERE migration_name = ?').get(ORDER_SEQ_MIGRATION);
if (!orderMigExists) {
  // Customer orders: O-C-<number>
  const maxCusOrder = db.prepare(`
    SELECT MAX(CAST(SUBSTR(order_id, 5) AS INTEGER)) AS max_num FROM customer_orders WHERE order_id LIKE 'O-C-%'
  `).get();
  const cusMax = maxCusOrder && maxCusOrder.max_num ? maxCusOrder.max_num : 0;
  db.prepare(`UPDATE document_sequences SET last_number = ? WHERE doc_type = 'customer_order'`).run(cusMax);

  // Supplier orders: O-S-<number>
  const maxSupOrder = db.prepare(`
    SELECT MAX(CAST(SUBSTR(order_id, 5) AS INTEGER)) AS max_num FROM supplier_orders WHERE order_id LIKE 'O-S-%'
  `).get();
  const supMax = maxSupOrder && maxSupOrder.max_num ? maxSupOrder.max_num : 0;
  db.prepare(`UPDATE document_sequences SET last_number = ? WHERE doc_type = 'supplier_order'`).run(supMax);

  db.prepare(`INSERT INTO migration_history (migration_name, executed_at) VALUES (?, datetime('now'))`).run(ORDER_SEQ_MIGRATION);
  console.log(`[Migration] ${ORDER_SEQ_MIGRATION}: customer_order=${cusMax}, supplier_order=${supMax}`);
}


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

// 6. Quick Sales

// Quick Sales header (simpler than invoices - no customer, no extras)
db.prepare(`
  CREATE TABLE IF NOT EXISTS quick_sales (
    qs_id      TEXT    PRIMARY KEY,
    qs_date    TEXT    NOT NULL,
    total      REAL    DEFAULT 0.0,
    remark     TEXT
  )
`).run();

// Quick Sale line items
db.prepare(`
  CREATE TABLE IF NOT EXISTS quick_sale_items (
    id            INTEGER   PRIMARY KEY AUTOINCREMENT,
    qs_id         TEXT      NOT NULL,
    product_code  TEXT,
    product_name  TEXT      DEFAULT '',
    product_size  TEXT      DEFAULT '',
    packing_type  TEXT      DEFAULT '',
    quantity      INTEGER   NOT NULL,
    selling_price REAL      NOT NULL,
    is_temporary  INTEGER   DEFAULT 0,
    FOREIGN KEY(qs_id)        REFERENCES quick_sales(qs_id)
  )
`).run();

// Migration: remove FOREIGN KEY(product_code) constraint (SQLite requires table recreation)
// Check if old FK exists by looking at table SQL; if it references products(code), recreate without it
try {
  const tableInfo = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='quick_sale_items'").get();
  if (tableInfo && tableInfo.sql && tableInfo.sql.includes('REFERENCES products')) {
    db.transaction(() => {
      db.prepare(`
        CREATE TABLE quick_sale_items_new (
          id            INTEGER   PRIMARY KEY AUTOINCREMENT,
          qs_id         TEXT      NOT NULL,
          product_code  TEXT,
          product_name  TEXT      DEFAULT '',
          product_size  TEXT      DEFAULT '',
          packing_type  TEXT      DEFAULT '',
          quantity      INTEGER   NOT NULL,
          selling_price REAL      NOT NULL,
          is_temporary  INTEGER   DEFAULT 0,
          FOREIGN KEY(qs_id) REFERENCES quick_sales(qs_id)
        )
      `).run();
      // Copy existing data — use COALESCE for columns that may not exist yet
      const cols = db.prepare("PRAGMA table_info(quick_sale_items)").all().map(c => c.name);
      const hasName = cols.includes('product_name');
      const hasSize = cols.includes('product_size');
      const hasPacking = cols.includes('packing_type');
      const hasTemp = cols.includes('is_temporary');
      db.prepare(`
        INSERT INTO quick_sale_items_new (id, qs_id, product_code, product_name, product_size, packing_type, quantity, selling_price, is_temporary)
        SELECT id, qs_id, product_code,
          ${hasName ? 'product_name' : "''"},
          ${hasSize ? 'product_size' : "''"},
          ${hasPacking ? 'packing_type' : "''"},
          quantity, selling_price,
          ${hasTemp ? 'is_temporary' : '0'}
        FROM quick_sale_items
      `).run();
      db.prepare('DROP TABLE quick_sale_items').run();
      db.prepare('ALTER TABLE quick_sale_items_new RENAME TO quick_sale_items').run();
    })();
  }
} catch (e) { console.error('Migration quick_sale_items FK removal:', e.message); }

// Migration: add ad-hoc item columns to quick_sale_items (safe to re-run)
try { db.prepare("ALTER TABLE quick_sale_items ADD COLUMN product_name TEXT DEFAULT ''").run(); } catch (e) { /* column already exists */ }
try { db.prepare("ALTER TABLE quick_sale_items ADD COLUMN product_size TEXT DEFAULT ''").run(); } catch (e) { /* column already exists */ }
try { db.prepare("ALTER TABLE quick_sale_items ADD COLUMN packing_type TEXT DEFAULT ''").run(); } catch (e) { /* column already exists */ }
try { db.prepare("ALTER TABLE quick_sale_items ADD COLUMN is_temporary INTEGER DEFAULT 0").run(); } catch (e) { /* column already exists */ }

// Init sequence for quick sales
db.prepare(`
  INSERT OR IGNORE INTO document_sequences (doc_type, last_number)
  VALUES ('quick_sale', 0)
`).run();

// Reusable quick sale numbers pool
db.prepare(`
  CREATE TABLE IF NOT EXISTS reusable_quick_sale_numbers (
    qs_number INTEGER PRIMARY KEY
  )
`).run();

// Export only the database connection
// Cleanup is now handled via admin:cleanupSoftDeletedProducts IPC handler (manual only)
module.exports = db;