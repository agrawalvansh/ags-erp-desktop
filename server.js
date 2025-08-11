// server.js (legacy Express API)
// ------------------------------------------------------------
// NOTE: This file is kept **only for reference / testing**.
// The application now communicates with the database via
// Electron IPC handlers defined in `ipcHandlers.js`.
// You can safely delete this file once you are comfortable
// that everything works over IPC.
// ------------------------------------------------------------
const express = require('express');
const cors    = require('cors');
const db      = require('./db.js');

// Ensure foreign keys are enforced (SQLite off by default per connection)
db.pragma('foreign_keys = ON');

// Prepared statements reused across routes
const ensureProductStmt = db.prepare('INSERT OR IGNORE INTO products (code, name) VALUES (?, ?)');

const app = express();
app.use(cors());              // allow requests from your React app
app.use(express.json());      // parse JSON bodies

// Example: create a new customer
app.post('/api/customers', (req, res) => {
  const { customer_id, name, address, mobile } = req.body;
  try {
    db.prepare(`
      INSERT INTO customers (customer_id, name, address, mobile)
      VALUES (?, ?, ?, ?)
    `).run(customer_id, name, address, mobile);
    res.status(201).json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Example: fetch all customers
app.get('/api/customers', (req, res) => {
  const customers = db.prepare(`SELECT * FROM customers`).all();
  res.json(customers);
});

// Fetch single customer by ID
app.get('/api/customers/:id', (req, res) => {
  const customer = db.prepare('SELECT * FROM customers WHERE customer_id = ?').get(req.params.id);
  if (!customer) {
    return res.status(404).json({ error: 'Customer not found' });
  }
  res.json(customer);
});

// Update customer details
app.put('/api/customers/:id', (req, res) => {
  const { name, address, mobile } = req.body;
  try {
    db.prepare('UPDATE customers SET name = ?, address = ?, mobile = ? WHERE customer_id = ?').run(
      name,
      address,
      mobile,
      req.params.id
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete customer
app.delete('/api/customers/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM customers WHERE customer_id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -----------------------
// Products routes
// -----------------------

// Create new product
app.post('/api/products', (req, res) => {
  const { code, name, size, packing_type, cost_price, selling_price } = req.body;
  if (!code || !name) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    db.prepare(`
      INSERT INTO products (code, name, size, packing_type, cost_price, selling_price)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(code, name, size, packing_type, cost_price, selling_price);
    res.status(201).json({ success: true });
  } catch (err) {
    // Unique constraint error when code already exists
    if (err.code === 'SQLITE_CONSTRAINT_PRIMARYKEY') {
      return res.status(400).json({ error: 'Product code already exists' });
    }
    console.error('Error creating product:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Fetch all products
app.get('/api/products', (req, res) => {
  const products = db.prepare('SELECT * FROM products').all();
  res.json(products);
});

// Fetch a single product by code
app.get('/api/products/:code', (req, res) => {
  const product = db.prepare('SELECT * FROM products WHERE code = ?').get(req.params.code);
  if (!product) {
    return res.status(404).json({ error: 'Product not found' });
  }
  res.json(product);
});

// Update an existing product
app.put('/api/products/:code', (req, res) => {
  const { name, size, packing_type, cost_price, selling_price } = req.body;
  try {
    const result = db.prepare(`UPDATE products SET name = ?, size = ?, packing_type = ?, cost_price = ?, selling_price = ? WHERE code = ?`).run(
      name,
      size,
      packing_type,
      cost_price,
      selling_price,
      req.params.code
    );
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Error updating product:', err);
    res.status(500).json({ error: err.message });
  }
});

// Delete a product
app.delete('/api/products/:code', (req, res) => {
  try {
    const result = db.prepare('DELETE FROM products WHERE code = ?').run(req.params.code);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting product:', err);
    res.status(500).json({ error: err.message });
  }
});

// -----------------------
// Invoices routes
// -----------------------

// Create a new invoice
app.post('/api/invoices', (req, res) => {
  const { customer_id, invoice_date, remark, packing = 0, freight = 0, riksha = 0, items } = req.body;
  if (!customer_id || !invoice_date || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const createInvoiceTxn = db.transaction(() => {
    const rowCount = db.prepare('SELECT COUNT(*) AS cnt FROM invoices').get().cnt;
    const invoice_id = `AGS-I-${rowCount + 1}`;

    // After processing items, compute grand total and insert header
    const itemsTotal = items.reduce((sum, it) => sum + (it.quantity * it.selling_price), 0);
    const grandTotal = itemsTotal + parseFloat(packing) + parseFloat(freight) + parseFloat(riksha);
    db.prepare(`INSERT INTO invoices (invoice_id, customer_id, invoice_date, remark, packing, freight, riksha, grand_total) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(invoice_id, customer_id, invoice_date, remark || '', packing, freight, riksha, grandTotal);

    const insertItemStmt = db.prepare(`INSERT INTO invoice_items (invoice_id, product_code, quantity, selling_price) VALUES (?, ?, ?, ?)`);
    const ensureProductStmt = db.prepare(`INSERT OR IGNORE INTO products (code, name) VALUES (?, ?)`);
    
    for (const it of items) {
      // Ensure product exists (at least minimal record) to satisfy FK
      ensureProductStmt.run(it.product_code, it.product_code);
      insertItemStmt.run(invoice_id, it.product_code, it.quantity, it.selling_price);
      
    }

    db.prepare(`INSERT INTO customer_maal_account (customer_id, maal_date, maal_invoice_no, maal_amount, maal_remark) VALUES (?, ?, ?, ?, ?)`)
      .run(customer_id, invoice_date, invoice_id, grandTotal, remark || '');

    return invoice_id;
  });

  try {
    const invoice_id = createInvoiceTxn();
    return res.status(201).json({ success: true, invoice_id });
  } catch (err) {
    console.error('Error creating invoice:', err);
    return res.status(500).json({ error: err.message });
  }
});

// Update an existing invoice
app.put('/api/invoices/:id', (req, res) => {
  const invoice_id = req.params.id;
  const { customer_id, invoice_date, remark, packing = 0, freight = 0, riksha = 0, items } = req.body;
  if (!customer_id || !invoice_date || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const updateTxn = db.transaction(() => {
    // Update header
    const itemsTotal = items.reduce((sum, it) => sum + (it.quantity * it.selling_price), 0);
    const grandTotal = itemsTotal + parseFloat(packing) + parseFloat(freight) + parseFloat(riksha);
    db.prepare(`UPDATE invoices SET customer_id = ?, invoice_date = ?, remark = ?, packing = ?, freight = ?, riksha = ?, grand_total = ? WHERE invoice_id = ?`)
      .run(customer_id, invoice_date, remark || '', packing, freight, riksha, grandTotal, invoice_id);

    // Refresh items
    db.prepare(`DELETE FROM invoice_items WHERE invoice_id = ?`).run(invoice_id);
    const insertItemStmt = db.prepare(`INSERT INTO invoice_items (invoice_id, product_code, quantity, selling_price) VALUES (?, ?, ?, ?)`);
    const ensureProductStmt = db.prepare(`INSERT OR IGNORE INTO products (code, name) VALUES (?, ?)`);
    
    for (const it of items) {
      ensureProductStmt.run(it.product_code, it.product_code);
      insertItemStmt.run(invoice_id, it.product_code, it.quantity, it.selling_price);
      
    }

    db.prepare(`UPDATE customer_maal_account SET maal_date = ?, maal_amount = ?, maal_remark = ? WHERE maal_invoice_no = ?`)
      .run(invoice_date, grandTotal, remark || '', invoice_id);
  });

  try {
    updateTxn();
    return res.json({ success: true });
  } catch (err) {
    console.error('Error updating invoice:', err);
    return res.status(500).json({ error: err.message });
  }
});

// Get next invoice id
app.get('/api/invoices/next-id', (req, res) => {
  const cnt = db.prepare('SELECT COUNT(*) AS cnt FROM invoices').get().cnt;
  res.json({ next_id: `AGS-I-${cnt + 1}` });
});

// Fetch single invoice (header + items)
app.get('/api/invoices/:id', (req, res) => {
  const invoice_id = req.params.id;
  const header = db.prepare('SELECT * FROM invoices WHERE invoice_id = ?').get(invoice_id);
  if (!header) return res.status(404).json({ error: 'Invoice not found' });
  const items = db.prepare(`
    SELECT ii.invoice_id, ii.product_code, ii.quantity, ii.selling_price,
           p.name        AS product_name,
           p.size        AS size,
           p.packing_type AS packing_type
      FROM invoice_items ii
      LEFT JOIN products p ON p.code = ii.product_code
     WHERE ii.invoice_id = ?
  `).all(invoice_id);
  res.json({ ...header, items });
});

// Get next invoice id
app.get('/api/invoices/next-id', (req, res) => {
  const cnt = db.prepare('SELECT COUNT(*) AS cnt FROM invoices').get().cnt;
  res.json({ next_id: `AGS-I-${cnt + 1}` });
});

// List invoices for a customer (for BuyerAccountDetail)
app.get('/api/customers/:id/invoices', (req, res) => {
  const customer_id = req.params.id;
  const rows = db.prepare(`
      SELECT * FROM (
        SELECT i.invoice_id     AS invoice_id,
               i.invoice_date   AS invoice_date,
               i.grand_total    AS grand_total,
               i.remark         AS remark
          FROM invoices i
         WHERE i.customer_id = ?
  
        UNION ALL
  
        SELECT m.maal_invoice_no AS invoice_id,
               m.maal_date       AS invoice_date,
               m.maal_amount     AS grand_total,
               m.maal_remark     AS remark
          FROM customer_maal_account m
         WHERE m.customer_id = ?
           AND NOT EXISTS (SELECT 1 FROM invoices i2 WHERE i2.invoice_id = m.maal_invoice_no)
      )
      ORDER BY invoice_date DESC
    `).all(customer_id, customer_id);
  res.json(rows);
});

// -----------------------
// Simple Maal creation + update routes
// -----------------------
/*
 * POST /api/maal
 * Body: { customer_id, invoice_number?, date, amount, remark }
 * - Creates a minimal invoice (header only, no line items)
 * - Inserts corresponding entry in customer_maal_account
 * Returns the created invoice header so the React UI can update immediately.
 */
// Retrieve single maal entry by invoice id
app.get('/api/maal/:invoiceId', (req, res) => {
  const invoice_id = req.params.invoiceId;
  try {
    const row = db.prepare(`SELECT id,
                                   customer_id,
                                   maal_date         AS date,
                                   maal_invoice_no   AS invoice_number,
                                   maal_amount       AS amount,
                                   maal_remark       AS remark
                              FROM customer_maal_account
                             WHERE maal_invoice_no = ?`).get(invoice_id);
    if (!row) {
      return res.status(404).json({ error: 'Entry not found' });
    }
    res.json(row);
  } catch (err) {
    console.error('Error fetching maal entry:', err);
    res.status(500).json({ error: err.message });
  }
});

// Update existing maal entry & its invoice
app.put('/api/maal/:invoiceId', (req, res) => {
  const invoice_id = req.params.invoiceId;
  const { date, amount, remark, invoice_number } = req.body;
  if (!date || amount == null) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  try {
    // Update invoice header (if exists) so remark/amount stay in sync
    db.prepare(`UPDATE invoices SET invoice_date = ?, grand_total = ?, remark = ? WHERE invoice_id = ?`) 
      .run(date, amount, remark || '', invoice_id);

    // Update maal account row

    // Update maal account row
    db.prepare(`UPDATE customer_maal_account 
                  SET maal_date = ?, maal_invoice_no = ?, maal_amount = ?, maal_remark = ?
                WHERE maal_invoice_no = ?`) 
      .run(date, invoice_number || invoice_id, amount, remark || '', invoice_id);

    res.json({ success: true });
  } catch (err) {
    console.error('Error updating maal entry:', err);
    res.status(500).json({ error: err.message });
  }
});

// Delete maal entry by invoice id
app.delete('/api/maal/:invoiceId', (req, res) => {
  const invoice_id = req.params.invoiceId;
  try {
    const result = db.prepare('DELETE FROM customer_maal_account WHERE maal_invoice_no = ?').run(invoice_id);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Entry not found' });
    }
    // Also remove any invoice header with same id
    db.prepare('DELETE FROM invoices WHERE invoice_id = ?').run(invoice_id);
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting maal entry:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/maal', (req, res) => {
  const { customer_id, invoice_number, date, amount, remark } = req.body;
  if (!customer_id || !date || amount == null) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // Determine invoice id: use provided number or generate next
    let newInvoiceId = invoice_number;
    if (!newInvoiceId) {
      const cnt = db.prepare('SELECT COUNT(*) AS cnt FROM invoices').get().cnt;
      newInvoiceId = `AGS-I-${cnt + 1}`;
    }

    // Insert maal entry
    db.prepare(`INSERT INTO customer_maal_account (customer_id, maal_date, maal_invoice_no, maal_amount, maal_remark)
                VALUES (?, ?, ?, ?, ?)`)
      .run(customer_id, date, newInvoiceId, amount, remark || '');

    const inserted = {
      invoice_id: newInvoiceId,
      customer_id,
      invoice_date: date,
      grand_total: amount,
      remark: remark || ''
    };

    return res.status(201).json(inserted);
  } catch (err) {
    console.error('Error creating simple invoice:', err);
    return res.status(500).json({ error: err.message });
  }
});

// -----------------------
// Customer Jama (payments) routes
// -----------------------

// Create a new customer payment (Jama) transaction
app.post('/api/transactions', (req, res) => {
  const { customer_id, date, txn_type, amount, remark } = req.body;
  if (!customer_id || !date || !txn_type || amount == null) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  try {
    const info = db.prepare(`
      INSERT INTO customer_jama_account (customer_id, jama_date, jama_txn_type, jama_amount, jama_remark)
      VALUES (?, ?, ?, ?, ?)
    `).run(customer_id, date, txn_type, amount, remark || '');

    const inserted = {
      transaction_id: info.lastInsertRowid,
      customer_id,
      date,
      txn_type,
      amount,
      remark: remark || ''
    };
    res.status(201).json(inserted);
  } catch (err) {
    console.error('Error creating transaction:', err);
    res.status(500).json({ error: err.message });
  }
});

// Update a jama transaction
// Retrieve single jama transaction
app.get('/api/transactions/:id', (req, res) => {
  const txn_id = req.params.id;
  try {
    const row = db.prepare(`SELECT id AS transaction_id,
                                  customer_id,
                                  jama_date  AS date,
                                  jama_txn_type AS txn_type,
                                  jama_amount AS amount,
                                  jama_remark AS remark
                             FROM customer_jama_account
                            WHERE id = ?`).get(txn_id);
    if (!row) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    res.json(row);
  } catch (err) {
    console.error('Error fetching transaction:', err);
    res.status(500).json({ error: err.message });
  }
});

// Update a jama transaction
app.put('/api/transactions/:id', (req, res) => {
  const txn_id = req.params.id;
  const { date, txn_type, amount, remark } = req.body;
  if (!date || !txn_type || amount == null) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  try {
    const result = db.prepare(`UPDATE customer_jama_account
                               SET jama_date = ?, jama_txn_type = ?, jama_amount = ?, jama_remark = ?
                             WHERE id = ?`).run(date, txn_type, amount, remark || '', txn_id);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Error updating transaction:', err);
    res.status(500).json({ error: err.message });
  }
});

// Delete jama transaction
app.delete('/api/transactions/:id', (req, res) => {
  const txn_id = req.params.id;
  try {
    const result = db.prepare('DELETE FROM customer_jama_account WHERE id = ?').run(txn_id);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting transaction:', err);
    res.status(500).json({ error: err.message });
  }
});

// List jama transactions for a customer
app.get('/api/customers/:id/transactions', (req, res) => {
  const customer_id = req.params.id;
  const rows = db.prepare(`
    SELECT id AS transaction_id,
           jama_date  AS date,
           jama_txn_type AS txn_type,
           jama_amount AS amount,
           jama_remark AS remark
      FROM customer_jama_account
     WHERE customer_id = ?
     ORDER BY jama_date DESC, id DESC
  `).all(customer_id);
  res.json(rows);
});

// -----------------------
// Customer Orders routes
// -----------------------

// List all customer orders (with basic totals)
app.get('/api/customer-orders', (req, res) => {
  const rows = db.prepare(`
    SELECT o.order_id,
           o.status,
           o.customer_id,
           c.name     AS customer_name,
           o.order_date,
           o.remark,
           IFNULL(SUM(oi.quantity), 0) AS total_quantity
      FROM customer_orders o
      LEFT JOIN customers c ON c.customer_id = o.customer_id
      LEFT JOIN customer_order_items oi ON oi.order_id = o.order_id
     GROUP BY o.order_id
     ORDER BY o.order_date DESC, o.order_id DESC
  `).all();
  res.json(rows);
});

// Helper to generate new order id (simple incremental prefix)
function generateCustomerOrderId() {
  const cnt = db.prepare('SELECT COUNT(*) AS cnt FROM customer_orders').get().cnt;
  return `AGS-C-O-${cnt + 1}`;
}

// Create new customer order
// Get next customer order id
app.get('/api/customer-orders/next-id', (req, res) => {
  const cnt = db.prepare('SELECT COUNT(*) AS cnt FROM customer_orders').get().cnt;
  res.json({ next_id: `AGS-C-O-${cnt + 1}` });
});

// Create new customer order
app.post('/api/customer-orders', (req, res) => {
  const { customer_id, order_date, remark = '', status = 'Received', items } = req.body;
  if (!customer_id || !order_date || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  const newOrderId = generateCustomerOrderId();

  const insertHeaderStmt = db.prepare(`INSERT INTO customer_orders (order_id, customer_id, order_date, remark, status) VALUES (?, ?, ?, ?, ?)`);
  const insertItemStmt   = db.prepare(`INSERT INTO customer_order_items (order_id, product_code, quantity) VALUES (?, ?, ?)`);
  const ensureProductStmt = db.prepare(`INSERT OR IGNORE INTO products (code, name) VALUES (?, ?)`);

  const createTxn = db.transaction(() => {
    insertHeaderStmt.run(newOrderId, customer_id, order_date, remark, status);
    for (const it of items) {
      ensureProductStmt.run(it.product_code, it.product_code);
      insertItemStmt.run(newOrderId, it.product_code, it.quantity);
    }
  });

  try {
    createTxn();
    res.status(201).json({ success: true, order_id: newOrderId });
  } catch (err) {
    console.error('Error creating customer order:', err);
    res.status(500).json({ error: err.message });
  }
});

// Fetch single customer order (header + items)
app.get('/api/customer-orders/:id', (req, res) => {
  const order_id = req.params.id;
  const header = db.prepare('SELECT * FROM customer_orders WHERE order_id = ?').get(order_id);
  if (!header) return res.status(404).json({ error: 'Order not found' });
  const items = db.prepare('SELECT * FROM customer_order_items WHERE order_id = ?').all(order_id);
  res.json({ ...header, items });
});

// Update existing customer order
app.put('/api/customer-orders/:id', (req, res) => {
  const order_id = req.params.id;
  const { customer_id, order_date, remark = '', status = 'Received', items } = req.body;
  if (!customer_id || !order_date || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const updateTxn = db.transaction(() => {
    db.prepare('UPDATE customer_orders SET customer_id = ?, order_date = ?, remark = ?, status = ? WHERE order_id = ?')
      .run(customer_id, order_date, remark, status, order_id);
    db.prepare('DELETE FROM customer_order_items WHERE order_id = ?').run(order_id);
    const insertItemStmt = db.prepare(`INSERT INTO customer_order_items (order_id, product_code, quantity) VALUES (?, ?, ?)`);
    const ensureProductStmt = db.prepare(`INSERT OR IGNORE INTO products (code, name) VALUES (?, ?)`);
    for (const it of items) {
      ensureProductStmt.run(it.product_code, it.product_code);
      insertItemStmt.run(order_id, it.product_code, it.quantity);
    }
  });

  try {
    updateTxn();
    res.json({ success: true });
  } catch (err) {
    console.error('Error updating customer order:', err);
    res.status(500).json({ error: err.message });
  }
});

// Delete customer order
app.delete('/api/customer-orders/:id', (req, res) => {
  const order_id = req.params.id;
  const txn = db.transaction(() => {
    db.prepare('DELETE FROM customer_order_items WHERE order_id = ?').run(order_id);
    db.prepare('DELETE FROM customer_orders WHERE order_id = ?').run(order_id);
  });
  try {
    txn();
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting customer order:', err);
    res.status(500).json({ error: err.message });
  }
});

// -----------------------
// Supplier Orders routes
// -----------------------

// Helper to generate new supplier order id
function generateSupplierOrderId() {
  const cnt = db.prepare('SELECT COUNT(*) AS cnt FROM supplier_orders').get().cnt;
  return `AGS-S-O-${cnt + 1}`;
}

// Get next supplier order id
app.get('/api/supplier-orders/next-id', (req, res) => {
  const cnt = db.prepare('SELECT COUNT(*) AS cnt FROM supplier_orders').get().cnt;
  res.json({ next_id: `AGS-S-O-${cnt + 1}` });
});

// List all supplier orders
app.get('/api/supplier-orders', (req, res) => {
  const rows = db.prepare(`
    SELECT o.order_id,
           o.status,
           o.supplier_id,
           s.name        AS supplier_name,
           o.order_date,
           o.remark,
           IFNULL(SUM(oi.quantity), 0) AS total_quantity
      FROM supplier_orders o
      LEFT JOIN suppliers s ON s.supplier_id = o.supplier_id
      LEFT JOIN supplier_order_items oi ON oi.order_id = o.order_id
     GROUP BY o.order_id
     ORDER BY o.order_date DESC, o.order_id DESC
  `).all();
  res.json(rows);
});

// Create new supplier order
app.post('/api/supplier-orders', (req, res) => {
  const { supplier_id, order_date, remark = '', status = 'Received', items } = req.body;
  if (!supplier_id || !order_date || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const newOrderId = generateSupplierOrderId();
  const insertHeader = db.prepare('INSERT INTO supplier_orders (order_id, supplier_id, order_date, remark, status) VALUES (?, ?, ?, ?, ?)');
  const insertItem   = db.prepare('INSERT INTO supplier_order_items (order_id, product_code, quantity) VALUES (?, ?, ?)');
  const ensureProduct = db.prepare('INSERT OR IGNORE INTO products (code, name) VALUES (?, ?)');

  const txn = db.transaction(() => {
    insertHeader.run(newOrderId, supplier_id, order_date, remark, status);
    for (const it of items) {
      ensureProduct.run(it.product_code, it.product_code);
      insertItem.run(newOrderId, it.product_code, it.quantity);
    }
  });

  try {
    txn();
    res.status(201).json({ success: true, order_id: newOrderId });
  } catch (err) {
    console.error('Error creating supplier order:', err);
    res.status(500).json({ error: err.message });
  }
});

// Fetch single supplier order
app.get('/api/supplier-orders/:id', (req, res) => {
  const order_id = req.params.id;
  const header = db.prepare('SELECT * FROM supplier_orders WHERE order_id = ?').get(order_id);
  if (!header) return res.status(404).json({ error: 'Order not found' });
  const items = db.prepare('SELECT * FROM supplier_order_items WHERE order_id = ?').all(order_id);
  res.json({ ...header, items });
});

// Update supplier order
app.put('/api/supplier-orders/:id', (req, res) => {
  const order_id = req.params.id;
  const { supplier_id, order_date, remark = '', status = 'Received', items } = req.body;
  if (!supplier_id || !order_date || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const ensureProduct = db.prepare('INSERT OR IGNORE INTO products (code, name) VALUES (?, ?)');
  const updateTxn = db.transaction(() => {
    db.prepare('UPDATE supplier_orders SET supplier_id = ?, order_date = ?, remark = ?, status = ? WHERE order_id = ?')
      .run(supplier_id, order_date, remark, status, order_id);
    db.prepare('DELETE FROM supplier_order_items WHERE order_id = ?').run(order_id);
    const insertItem = db.prepare('INSERT INTO supplier_order_items (order_id, product_code, quantity) VALUES (?, ?, ?)');
    for (const it of items) {
      ensureProduct.run(it.product_code, it.product_code);
      insertItem.run(order_id, it.product_code, it.quantity);
    }
  });

  try {
    updateTxn();
    res.json({ success: true });
  } catch (err) {
    console.error('Error updating supplier order:', err);
    res.status(500).json({ error: err.message });
  }
});

// Delete supplier order
app.delete('/api/supplier-orders/:id', (req, res) => {
  const order_id = req.params.id;
  const txn = db.transaction(() => {
    db.prepare('DELETE FROM supplier_order_items WHERE order_id = ?').run(order_id);
    db.prepare('DELETE FROM supplier_orders WHERE order_id = ?').run(order_id);
  });
  try {
    txn();
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting supplier order:', err);
    res.status(500).json({ error: err.message });
  }
});

// -----------------------
// Supplier Master routes
// -----------------------

// Create supplier
app.post('/api/suppliers', (req, res) => {
  const { supplier_id, name, address, mobile } = req.body;
  try {
    db.prepare(`INSERT INTO suppliers (supplier_id, name, address, mobile) VALUES (?, ?, ?, ?)`)
      .run(supplier_id, name, address, mobile);
    res.status(201).json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Read all suppliers
app.get('/api/suppliers', (req, res) => {
  const rows = db.prepare('SELECT * FROM suppliers').all();
  res.json(rows);
});

// Read single supplier
app.get('/api/suppliers/:id', (req, res) => {
  const sup = db.prepare('SELECT * FROM suppliers WHERE supplier_id = ?').get(req.params.id);
  if (!sup) return res.status(404).json({ error: 'Supplier not found' });
  res.json(sup);
});

// Update supplier
app.put('/api/suppliers/:id', (req, res) => {
  const { name, address, mobile } = req.body;
  try {
    const result = db.prepare('UPDATE suppliers SET name = ?, address = ?, mobile = ? WHERE supplier_id = ?')
      .run(name, address, mobile, req.params.id);
    if (result.changes === 0) return res.status(404).json({ error: 'Supplier not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete supplier
app.delete('/api/suppliers/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM suppliers WHERE supplier_id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -----------------------
// Supplier Maal (purchases) routes
// -----------------------

app.post('/api/supplier-maal', (req, res) => {
  const { supplier_id, invoice_number, date, amount, remark } = req.body;
  if (!supplier_id || !date || amount == null) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  try {
    const info = db.prepare(`INSERT INTO supplier_maal_account (supplier_id, maal_date, maal_invoice_no, maal_amount, maal_remark)
                             VALUES (?, ?, ?, ?, ?)`)
      .run(supplier_id, date, invoice_number || null, amount, remark || '');
    res.status(201).json({ id: info.lastInsertRowid, supplier_id, date, invoice_number, amount, remark });
  } catch (err) {
    console.error('Error creating supplier maal entry:', err);
    res.status(500).json({ error: err.message });
  }
});

// Update supplier maal entry
app.put('/api/supplier-maal/:id', (req, res) => {
  const maal_id = req.params.id;
  const { date, invoice_number, amount, remark } = req.body;
  if (!date || amount == null) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  try {
    const result = db.prepare(`UPDATE supplier_maal_account 
                               SET maal_date = ?, maal_invoice_no = ?, maal_amount = ?, maal_remark = ?
                             WHERE id = ?`).run(date, invoice_number || '', amount, remark || '', maal_id);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Maal entry not found' });
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Error updating supplier maal entry:', err);
    res.status(500).json({ error: err.message });
  }
});

// Delete supplier maal entry
app.delete('/api/supplier-maal/:id', (req, res) => {
  const maal_id = req.params.id;
  try {
    const result = db.prepare('DELETE FROM supplier_maal_account WHERE id = ?').run(maal_id);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Maal entry not found' });
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting supplier maal entry:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/suppliers/:id/maal', (req, res) => {
  const rows = db.prepare(`SELECT id, maal_date, maal_invoice_no, maal_amount, maal_remark FROM supplier_maal_account WHERE supplier_id = ? ORDER BY maal_date DESC, id DESC`).all(req.params.id);
  res.json(rows);
});

// -----------------------
// Supplier Jama (payment) routes
// -----------------------

// Update supplier jama transaction
app.put('/api/supplier-transactions/:id', (req, res) => {
  const txn_id = req.params.id;
  const { date, txn_type, amount, remark } = req.body;
  if (!date || !txn_type || amount == null) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  try {
    const result = db.prepare(`UPDATE supplier_jama_account 
                               SET jama_date = ?, jama_txn_type = ?, jama_amount = ?, jama_remark = ?
                             WHERE id = ?`).run(date, txn_type, amount, remark || '', txn_id);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Error updating supplier transaction:', err);
    res.status(500).json({ error: err.message });
  }
});

// Delete supplier jama transaction
app.delete('/api/supplier-transactions/:id', (req, res) => {
  const txn_id = req.params.id;
  try {
    const result = db.prepare('DELETE FROM supplier_jama_account WHERE id = ?').run(txn_id);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting supplier transaction:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/supplier-transactions', (req, res) => {
  const { supplier_id, date, txn_type, amount, remark } = req.body;
  if (!supplier_id || !date || !txn_type || amount == null) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  try {
    const info = db.prepare(`INSERT INTO supplier_jama_account (supplier_id, jama_date, jama_txn_type, jama_amount, jama_remark)
                             VALUES (?, ?, ?, ?, ?)`)
      .run(supplier_id, date, txn_type, amount, remark || '');
    res.status(201).json({ transaction_id: info.lastInsertRowid, supplier_id, date, txn_type, amount, remark });
  } catch (err) {
    console.error('Error creating supplier transaction:', err);
    res.status(500).json({ error: err.message });
  }
});

// List supplier jama
app.get('/api/suppliers/:id/transactions', (req, res) => {
  const rows = db.prepare(`SELECT id AS transaction_id, jama_date AS date, jama_txn_type AS txn_type, jama_amount AS amount, jama_remark AS remark FROM supplier_jama_account WHERE supplier_id = ? ORDER BY jama_date DESC, id DESC`).all(req.params.id);
  res.json(rows);
});

// -----------------------
// (end invoices routes)
// -----------------------

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`API server listening on http://localhost:${PORT}`);
});
