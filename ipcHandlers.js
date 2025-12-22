// backend/ipcHandlers.js
// Registers ipcMain handlers that mirror the old Express REST API.
// This lets the renderer communicate with the DB via `window.electron.invoke(channel, payload)`
// Channel naming convention: <entity>:<action>
// E.g.  "products:getAll", "customers:update", "invoices:create" etc.
// Each handler returns either `{ success: true, ... }` or `{ error: "msg" }`.
// -------------------------------------------------------------------

module.exports = function registerIpcHandlers(ipcMain, db) {
  if (!ipcMain || !db) throw new Error('ipcHandlers: ipcMain & db are required');

  // Utility ----------------------------------------------------------
  const wrap = fn => {
    return async (event, ...args) => {
      try {
        return await fn(...args);
      } catch (err) {
        console.error('IPC handler error:', err);
        return { error: err.message };
      }
    };
  };

  // -----------------------
  // Products CRUD
  // -----------------------
  ipcMain.handle('products:getAll', wrap(() => {
    const rows = db.prepare('SELECT * FROM products').all();
    // Convert Row objects to plain JSON-friendly objects
    return rows.map(r => ({ ...r }));
  }));

  ipcMain.handle('products:create', wrap((prod) => {
    const { code, name, size, packing_type, cost_price, selling_price } = prod;
    if (!code || !name) return { error: 'Missing required fields' };
    db.prepare(`
      INSERT INTO products (code, name, size, packing_type, cost_price, selling_price)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(code, name, size, packing_type, cost_price, selling_price);
    return { success: true };
  }));

  ipcMain.handle('products:get', wrap((code) => {
    const row = db.prepare('SELECT * FROM products WHERE code = ?').get(code);
    return row || { error: 'Product not found' };
  }));

  ipcMain.handle('products:update', wrap((prod) => {
    const { code, name, size, packing_type, cost_price, selling_price } = prod;
    const res = db.prepare(`
      UPDATE products SET name = ?, size = ?, packing_type = ?, cost_price = ?, selling_price = ? WHERE code = ?
    `).run(name, size, packing_type, cost_price, selling_price, code);
    return res.changes ? { success: true } : { error: 'Product not found' };
  }));

  ipcMain.handle('products:delete', wrap((code) => {
    const res = db.prepare('DELETE FROM products WHERE code = ?').run(code);
    return res.changes ? { success: true } : { error: 'Product not found' };
  }));

  // -----------------------
  // Customers CRUD
  // -----------------------
  ipcMain.handle('customers:getAll', wrap(() => {
    return db.prepare('SELECT * FROM customers').all();
  }));

  ipcMain.handle('customers:get', wrap((customer_id) => {
    const row = db.prepare('SELECT * FROM customers WHERE customer_id = ?').get(customer_id);
    return row || { error: 'Customer not found' };
  }));

  ipcMain.handle('customers:create', wrap((cust) => {
    const { customer_id, name, address, mobile } = cust;
    db.prepare(`INSERT INTO customers (customer_id, name, address, mobile) VALUES (?, ?, ?, ?)`)
      .run(customer_id, name, address, mobile);
    return { success: true };
  }));

  ipcMain.handle('customers:update', wrap((cust) => {
    const { customer_id, name, address, mobile } = cust;
    const res = db.prepare('UPDATE customers SET name = ?, address = ?, mobile = ? WHERE customer_id = ?')
      .run(name, address, mobile, customer_id);
    return res.changes ? { success: true } : { error: 'Customer not found' };
  }));

  ipcMain.handle('customers:delete', wrap((customer_id) => {
    const res = db.prepare('DELETE FROM customers WHERE customer_id = ?').run(customer_id);
    return res.changes ? { success: true } : { error: 'Customer not found' };
  }));

  // Additional: list invoices / transactions for a customer ---------
  ipcMain.handle('customers:listInvoices', wrap((customer_id) => {
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
    return rows;
  }));

  ipcMain.handle('customers:listTransactions', wrap((customer_id) => {
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
    return rows;
  }));

  // Legacy aliases for BuyerAccountDetail -----------------------
  ipcMain.handle('invoices:getByCustomer', wrap((customer_id) => {
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
    return rows;
  }));

  ipcMain.handle('transactions:getByCustomer', wrap((customer_id) => {
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
    return rows;
  }));

  // -----------------------
  // Customer Jama Transactions
  // -----------------------
  ipcMain.handle('transactions:create', wrap((txn) => {
    const { customer_id, date, txn_type, amount, remark } = txn;
    const info = db.prepare(`
      INSERT INTO customer_jama_account (customer_id, jama_date, jama_txn_type, jama_amount, jama_remark)
      VALUES (?, ?, ?, ?, ?)
    `).run(customer_id, date, txn_type, amount, remark || '');
    return {
      transaction_id: info.lastInsertRowid,
      customer_id,
      date,
      txn_type,
      amount,
      remark: remark || ''
    };
  }));

  ipcMain.handle('transactions:get', wrap((txn_id) => {
    const row = db.prepare(`SELECT id AS transaction_id,
                                   customer_id,
                                   jama_date  AS date,
                                   jama_txn_type AS txn_type,
                                   jama_amount AS amount,
                                   jama_remark AS remark
                              FROM customer_jama_account
                             WHERE id = ?`).get(txn_id);
    return row || { error: 'Transaction not found' };
  }));

  ipcMain.handle('transactions:update', wrap((txn) => {
    const { transaction_id, date, txn_type, amount, remark } = txn;
    const res = db.prepare(`UPDATE customer_jama_account
                               SET jama_date = ?, jama_txn_type = ?, jama_amount = ?, jama_remark = ?
                             WHERE id = ?`).run(date, txn_type, amount, remark || '', transaction_id);
    return res.changes ? { success: true } : { error: 'Transaction not found' };
  }));

  ipcMain.handle('transactions:delete', wrap((transaction_id) => {
    const res = db.prepare('DELETE FROM customer_jama_account WHERE id = ?').run(transaction_id);
    return res.changes ? { success: true } : { error: 'Transaction not found' };
  }));

  // -----------------------
  // Invoices
  // -----------------------


  // Helper to get next invoice id
  ipcMain.handle('invoices:getNextId', wrap(() => {
    const cnt = db.prepare('SELECT COUNT(*) AS cnt FROM invoices').get().cnt;
    return { next_id: `AGS-E-${cnt + 1}` };
  }));

  ipcMain.handle('invoices:get', wrap((invoice_id) => {
    const header = db.prepare('SELECT * FROM invoices WHERE invoice_id = ?').get(invoice_id);
    if (!header) return { error: 'Invoice not found' };
    const items = db.prepare(`
      SELECT ii.invoice_id, ii.product_code, ii.quantity, ii.selling_price,
             p.name AS product_name, p.size AS size, p.packing_type AS packing_type
        FROM invoice_items ii
        LEFT JOIN products p ON p.code = ii.product_code
       WHERE ii.invoice_id = ?
    `).all(invoice_id);
    return { ...header, items };
  }));

  ipcMain.handle('invoices:update', wrap((invoice) => {
    const { id: invoice_id, customer_id, invoice_date, remark = '', packing = 0, freight = 0, riksha = 0, items } = invoice;
    if (!invoice_id || !customer_id || !invoice_date || !Array.isArray(items) || items.length === 0) {
      return { error: 'Missing required fields' };
    }
    const updateTxn = db.transaction(() => {
      const itemsTotal = items.reduce((s, it) => s + it.quantity * it.selling_price, 0);
      const grandTotal = itemsTotal + parseFloat(packing) + parseFloat(freight) + parseFloat(riksha);
      db.prepare(`UPDATE invoices SET customer_id = ?, invoice_date = ?, remark = ?, packing = ?, freight = ?, riksha = ?, grand_total = ? WHERE invoice_id = ?`)
        .run(customer_id, invoice_date, remark, packing, freight, riksha, grandTotal, invoice_id);

      // Refresh items
      db.prepare('DELETE FROM invoice_items WHERE invoice_id = ?').run(invoice_id);
      const insertItem = db.prepare('INSERT INTO invoice_items (invoice_id, product_code, quantity, selling_price) VALUES (?, ?, ?, ?)');
      const ensureProduct = db.prepare('INSERT OR IGNORE INTO products (code, name) VALUES (?, ?)');
      for (const it of items) {
        ensureProduct.run(it.product_code, it.product_code);
        insertItem.run(invoice_id, it.product_code, it.quantity, it.selling_price);
      }

      // Keep maal mirror row in sync
      db.prepare(`UPDATE customer_maal_account SET maal_date = ?, maal_amount = ?, maal_remark = ? WHERE maal_invoice_no = ?`)
        .run(invoice_date, grandTotal, remark, invoice_id);
    });
    updateTxn();
    return { success: true };
  }));

  // -----------------------
  // Maal (simple invoice header) routes
  // -----------------------
  ipcMain.handle('maal:get', wrap((invoice_id) => {
    const row = db.prepare(`SELECT id,
                                   customer_id,
                                   maal_date         AS date,
                                   maal_invoice_no   AS invoice_number,
                                   maal_amount       AS amount,
                                   maal_remark       AS remark
                              FROM customer_maal_account
                             WHERE maal_invoice_no = ?`).get(invoice_id);
    return row || { error: 'Entry not found' };
  }));

  ipcMain.handle('maal:update', wrap((data) => {
    const { invoice_id, date, amount, remark, invoice_number } = data;
    const res1 = db.prepare(`UPDATE invoices SET invoice_date = ?, grand_total = ?, remark = ? WHERE invoice_id = ?`).run(date, amount, remark || '', invoice_id);
    const res2 = db.prepare(`UPDATE customer_maal_account SET maal_date = ?, maal_invoice_no = ?, maal_amount = ?, maal_remark = ? WHERE maal_invoice_no = ?`).run(date, invoice_number || invoice_id, amount, remark || '', invoice_id);
    if (res1.changes === 0 && res2.changes === 0) return { error: 'Entry not found' };
    return { success: true };
  }));

  ipcMain.handle('maal:delete', wrap((invoice_id) => {
    const txn = db.transaction(() => {
      const res1 = db.prepare('DELETE FROM customer_maal_account WHERE maal_invoice_no = ?').run(invoice_id);
      db.prepare('DELETE FROM invoices WHERE invoice_id = ?').run(invoice_id);
      return res1.changes;
    });
    const changes = txn();
    return changes ? { success: true } : { error: 'Entry not found' };
  }));

  ipcMain.handle('maal:create', wrap((data) => {
    const { customer_id, invoice_number, date, amount, remark } = data;
    let newInvoiceId = invoice_number;
    if (!newInvoiceId) {
      const cnt = db.prepare('SELECT COUNT(*) AS cnt FROM invoices').get().cnt;
      newInvoiceId = `AGS-I-${cnt + 1}`;
    }
    db.prepare(`INSERT INTO customer_maal_account (customer_id, maal_date, maal_invoice_no, maal_amount, maal_remark)
                VALUES (?, ?, ?, ?, ?)`).run(customer_id, date, newInvoiceId, amount, remark || '');
    return {
      invoice_id: newInvoiceId,
      customer_id,
      invoice_date: date,
      grand_total: amount,
      remark: remark || ''
    };
  }));

  // -----------------------
  // Customer Orders
  // -----------------------
  ipcMain.handle('cusOrders:getAll', wrap(() => {
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
    return rows;
  }));

  ipcMain.handle('cusOrders:getNextId', wrap(() => {
    const cnt = db.prepare('SELECT COUNT(*) AS cnt FROM customer_orders').get().cnt;
    return { next_id: `AGS-C-O-${cnt + 1}` };
  }));

  ipcMain.handle('cusOrders:create', wrap((data) => {
    const { customer_id, order_date, remark = '', status = 'Received', items } = data;
    if (!customer_id || !order_date || !Array.isArray(items) || items.length === 0) {
      return { error: 'Missing required fields' };
    }
    const newOrderId = `AGS-C-O-${db.prepare('SELECT COUNT(*) AS cnt FROM customer_orders').get().cnt + 1}`;
    const insertHeader = db.prepare(`INSERT INTO customer_orders (order_id, customer_id, order_date, remark, status) VALUES (?, ?, ?, ?, ?)`);
    const insertItem = db.prepare(`INSERT INTO customer_order_items (order_id, product_code, quantity) VALUES (?, ?, ?)`);
    const ensureProduct = db.prepare('INSERT OR IGNORE INTO products (code, name) VALUES (?, ?)');
    const txn = db.transaction(() => {
      insertHeader.run(newOrderId, customer_id, order_date, remark, status);
      for (const it of items) {
        ensureProduct.run(it.product_code, it.product_code);
        insertItem.run(newOrderId, it.product_code, it.quantity);
      }
    });
    txn();
    return { success: true, order_id: newOrderId };
  }));

  ipcMain.handle('cusOrders:get', wrap((order_id) => {
    const header = db.prepare('SELECT * FROM customer_orders WHERE order_id = ?').get(order_id);
    if (!header) return { error: 'Order not found' };
    const items = db.prepare('SELECT * FROM customer_order_items WHERE order_id = ?').all(order_id);
    return { ...header, items };
  }));

  ipcMain.handle('cusOrders:update', wrap((data) => {
    const { id, order_id, customer_id, order_date, remark = '', status = 'Received', items } = data;
    const orderId = id || order_id; // Accept both 'id' and 'order_id'
    if (!orderId || !customer_id || !order_date || !Array.isArray(items) || items.length === 0) {
      return { error: 'Missing required fields' };
    }
    const updateTxn = db.transaction(() => {
      db.prepare('UPDATE customer_orders SET customer_id = ?, order_date = ?, remark = ?, status = ? WHERE order_id = ?')
        .run(customer_id, order_date, remark, status, orderId);
      db.prepare('DELETE FROM customer_order_items WHERE order_id = ?').run(orderId);
      const insertItem = db.prepare(`INSERT INTO customer_order_items (order_id, product_code, quantity) VALUES (?, ?, ?)`);
      const ensureProduct = db.prepare('INSERT OR IGNORE INTO products (code, name) VALUES (?, ?)');
      for (const it of items) {
        ensureProduct.run(it.product_code, it.product_code);
        insertItem.run(orderId, it.product_code, it.quantity);
      }
    });
    updateTxn();
    return { success: true };
  }));

  ipcMain.handle('cusOrders:delete', wrap((order_id) => {
    const txn = db.transaction(() => {
      db.prepare('DELETE FROM customer_order_items WHERE order_id = ?').run(order_id);
      const res = db.prepare('DELETE FROM customer_orders WHERE order_id = ?').run(order_id);
      return res.changes;
    });
    const changes = txn();
    return changes ? { success: true } : { error: 'Order not found' };
  }));

  // -----------------------
  // Invoices
  // -----------------------


  ipcMain.handle('invoices:create', wrap((data) => {
    const { customer_id, invoice_date, remark = '', packing = 0, freight = 0, riksha = 0, items } = data;
    if (!customer_id || !invoice_date || !Array.isArray(items) || items.length === 0) {
      return { error: 'Missing required fields' };
    }

    const ensureProductStmt = db.prepare('INSERT OR IGNORE INTO products (code, name) VALUES (?, ?)');
    const insertItemStmt   = db.prepare('INSERT INTO invoice_items (invoice_id, product_code, quantity, selling_price) VALUES (?, ?, ?, ?)');
    const createTxn = db.transaction(() => {
      const rowCount = db.prepare('SELECT COUNT(*) AS cnt FROM invoices').get().cnt;
      const invoice_id = `AGS-I-${rowCount + 1}`;

      const itemsTotal = items.reduce((sum, it) => sum + (it.quantity * it.selling_price), 0);
      const grandTotal = itemsTotal + parseFloat(packing) + parseFloat(freight) + parseFloat(riksha);

      db.prepare(`
        INSERT INTO invoices (invoice_id, customer_id, invoice_date, remark, packing, freight, riksha, grand_total)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(invoice_id, customer_id, invoice_date, remark, packing, freight, riksha, grandTotal);

      for (const it of items) {
        ensureProductStmt.run(it.product_code, it.product_code);
        insertItemStmt.run(invoice_id, it.product_code, it.quantity, it.selling_price);
      }

      db.prepare(`INSERT INTO customer_maal_account (customer_id, maal_date, maal_invoice_no, maal_amount, maal_remark)
                  VALUES (?, ?, ?, ?, ?)`)
        .run(customer_id, invoice_date, invoice_id, grandTotal, remark);

      return invoice_id;
    });

    const invoice_id = createTxn();
    return { success: true, invoice_id };
  }));

  ipcMain.handle('invoices:listByCustomer', wrap((customer_id) => {
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
    return rows;
  }));

  // -----------------------
  // Customer Maal (simple invoice entries)
  // -----------------------
  ipcMain.handle('customers:maalGet', wrap((invoice_id) => {
    const row = db.prepare(`SELECT id,
                                  customer_id,
                                  maal_date       AS date,
                                  maal_invoice_no AS invoice_number,
                                  maal_amount     AS amount,
                                  maal_remark     AS remark
                             FROM customer_maal_account
                            WHERE maal_invoice_no = ?`).get(invoice_id);
    return row || { error: 'Entry not found' };
  }));

  ipcMain.handle('customers:maalCreate', wrap((data) => {
    const { customer_id, invoice_number, date, amount, remark } = data;
    if (!customer_id || !date || amount == null) {
      return { error: 'Missing required fields' };
    }
    let newInvoiceId = invoice_number;
    if (!newInvoiceId) {
      const cnt = db.prepare('SELECT COUNT(*) AS cnt FROM invoices').get().cnt;
      newInvoiceId = `AGS-I-${cnt + 1}`;
    }
    db.prepare(`INSERT INTO customer_maal_account (customer_id, maal_date, maal_invoice_no, maal_amount, maal_remark)
                VALUES (?, ?, ?, ?, ?)`)
      .run(customer_id, date, newInvoiceId, amount, remark || '');
    return {
      invoice_id: newInvoiceId,
      customer_id,
      invoice_date: date,
      grand_total: amount,
      remark: remark || ''
    };
  }));

  ipcMain.handle('customers:maalUpdate', wrap((data) => {
    const { invoice_id, date, amount, remark, invoice_number } = data;
    if (!invoice_id || !date || amount == null) {
      return { error: 'Missing required fields' };
    }
    // Update linked invoice header (if exists)
    db.prepare('UPDATE invoices SET invoice_date = ?, grand_total = ?, remark = ? WHERE invoice_id = ?')
      .run(date, amount, remark || '', invoice_id);
    const res = db.prepare(`UPDATE customer_maal_account 
                             SET maal_date = ?, maal_invoice_no = ?, maal_amount = ?, maal_remark = ?
                           WHERE maal_invoice_no = ?`)
      .run(date, invoice_number || invoice_id, amount, remark || '', invoice_id);
    return res.changes ? { success: true } : { error: 'Entry not found' };
  }));

  ipcMain.handle('customers:maalDelete', wrap((invoice_id) => {
    const txn = db.transaction(() => {
      const res = db.prepare('DELETE FROM customer_maal_account WHERE maal_invoice_no = ?').run(invoice_id);
      db.prepare('DELETE FROM invoices WHERE invoice_id = ?').run(invoice_id);
      return res.changes;
    });
    const changes = txn();
    return changes ? { success: true } : { error: 'Entry not found' };
  }));

  // -----------------------
  // Customer Jama (payment) Transactions
  // -----------------------
  ipcMain.handle('customers:txnGet', wrap((txn_id) => {
    const row = db.prepare(`SELECT id AS transaction_id,
                                   customer_id,
                                   jama_date   AS date,
                                   jama_txn_type AS txn_type,
                                   jama_amount AS amount,
                                   jama_remark AS remark
                              FROM customer_jama_account
                             WHERE id = ?`).get(txn_id);
    return row || { error: 'Transaction not found' };
  }));

  ipcMain.handle('customers:txnCreate', wrap((data) => {
    const { customer_id, date, txn_type, amount, remark } = data;
    if (!customer_id || !date || !txn_type || amount == null) {
      return { error: 'Missing required fields' };
    }
    const info = db.prepare(`INSERT INTO customer_jama_account (customer_id, jama_date, jama_txn_type, jama_amount, jama_remark)
                             VALUES (?, ?, ?, ?, ?)`)
      .run(customer_id, date, txn_type, amount, remark || '');
    return {
      transaction_id: info.lastInsertRowid,
      customer_id,
      date,
      txn_type,
      amount,
      remark: remark || ''
    };
  }));

  ipcMain.handle('customers:txnUpdate', wrap((data) => {
    const { id, date, txn_type, amount, remark } = data;
    if (!id || !date || !txn_type || amount == null) {
      return { error: 'Missing required fields' };
    }
    const res = db.prepare(`UPDATE customer_jama_account 
                            SET jama_date = ?, jama_txn_type = ?, jama_amount = ?, jama_remark = ?
                          WHERE id = ?`).run(date, txn_type, amount, remark || '', id);
    return res.changes ? { success: true } : { error: 'Transaction not found' };
  }));

  ipcMain.handle('customers:txnDelete', wrap((id) => {
    const res = db.prepare('DELETE FROM customer_jama_account WHERE id = ?').run(id);
    return res.changes ? { success: true } : { error: 'Transaction not found' };
  }));

  ipcMain.handle('customers:txnList', wrap((customer_id) => {
    const rows = db.prepare(`SELECT id AS transaction_id,
                                    jama_date   AS date,
                                    jama_txn_type AS txn_type,
                                    jama_amount AS amount,
                                    jama_remark AS remark
                               FROM customer_jama_account
                              WHERE customer_id = ?
                              ORDER BY jama_date DESC, id DESC`).all(customer_id);
    return rows;
  }));

  // -----------------------
  // Customer Orders
  // -----------------------
  // Generate next customer order id (simple increment)
  ipcMain.handle('customerOrders:getNextId', wrap(() => {
    // You may want to implement a smarter ID scheme if needed
    const cnt = db.prepare('SELECT COUNT(*) AS cnt FROM customer_orders').get().cnt;
    return { next_id: `AGS-C-O-${cnt + 1}` };
  }));

  // Create new customer order
  ipcMain.handle('customerOrders:create', wrap((data) => {
    const { customer_id, order_date, remark = '', status = 'Received', items } = data;
    if (!customer_id || !order_date || !Array.isArray(items) || items.length === 0) {
      return { error: 'Missing required fields' };
    }
    const cnt = db.prepare('SELECT COUNT(*) AS cnt FROM customer_orders').get().cnt;
    const newOrderId = `AGS-C-O-${cnt + 1}`;
    const insertHeaderStmt = db.prepare('INSERT INTO customer_orders (order_id, customer_id, order_date, remark, status) VALUES (?, ?, ?, ?, ?)');
    const insertItemStmt   = db.prepare('INSERT INTO customer_order_items (order_id, product_code, quantity) VALUES (?, ?, ?)');
    const ensureProductStmt = db.prepare('INSERT OR IGNORE INTO products (code, name) VALUES (?, ?)');
    const createTxn = db.transaction(() => {
      insertHeaderStmt.run(newOrderId, customer_id, order_date, remark, status);
      for (const it of items) {
        ensureProductStmt.run(it.product_code, it.product_code);
        insertItemStmt.run(newOrderId, it.product_code, it.quantity);
      }
    });
    createTxn();
    return { success: true, order_id: newOrderId };
  }));

  // Fetch single customer order (header + items)
  ipcMain.handle('customerOrders:get', wrap((order_id) => {
    const header = db.prepare('SELECT * FROM customer_orders WHERE order_id = ?').get(order_id);
    if (!header) return { error: 'Order not found' };
    const items = db.prepare('SELECT * FROM customer_order_items WHERE order_id = ?').all(order_id);
    return { ...header, items };
  }));

  // Update existing customer order
  ipcMain.handle('customerOrders:update', wrap((data) => {
    const { order_id, customer_id, order_date, remark = '', status = 'Received', items } = data;
    if (!order_id || !customer_id || !order_date || !Array.isArray(items) || items.length === 0) {
      return { error: 'Missing required fields' };
    }
    const updateTxn = db.transaction(() => {
      db.prepare('UPDATE customer_orders SET customer_id = ?, order_date = ?, remark = ?, status = ? WHERE order_id = ?')
        .run(customer_id, order_date, remark, status, order_id);
      db.prepare('DELETE FROM customer_order_items WHERE order_id = ?').run(order_id);
      const insertItemStmt = db.prepare('INSERT INTO customer_order_items (order_id, product_code, quantity) VALUES (?, ?, ?)');
      const ensureProductStmt = db.prepare('INSERT OR IGNORE INTO products (code, name) VALUES (?, ?)');
      for (const it of items) {
        ensureProductStmt.run(it.product_code, it.product_code);
        insertItemStmt.run(order_id, it.product_code, it.quantity);
      }
    });
    updateTxn();
    return { success: true };
  }));

  // Delete customer order
  ipcMain.handle('customerOrders:delete', wrap((order_id) => {
    const txn = db.transaction(() => {
      db.prepare('DELETE FROM customer_order_items WHERE order_id = ?').run(order_id);
      const res = db.prepare('DELETE FROM customer_orders WHERE order_id = ?').run(order_id);
      return res.changes;
    });
    const changes = txn();
    return changes ? { success: true } : { error: 'Order not found' };
  }));

  // List all customer orders (with basic totals)
  ipcMain.handle('customerOrders:getAll', wrap(() => {
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
    return rows;
  }));

  // -----------------------
  // Supplier Orders
  // -----------------------
  ipcMain.handle('supOrders:getNextId', wrap(() => {
    const cnt = db.prepare('SELECT COUNT(*) AS cnt FROM supplier_orders').get().cnt;
    return { next_id: `AGS-S-O-${cnt + 1}` };
  }));

  ipcMain.handle('supOrders:getAll', wrap(() => {
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
    return rows;
  }));

  ipcMain.handle('supOrders:create', wrap((data) => {
    const { supplier_id, order_date, remark = '', status = 'Received', items } = data;
    if (!supplier_id || !order_date || !Array.isArray(items) || items.length === 0) {
      return { error: 'Missing required fields' };
    }
    const newOrderId = `AGS-S-O-${db.prepare('SELECT COUNT(*) AS cnt FROM supplier_orders').get().cnt + 1}`;
    const insertHeader = db.prepare('INSERT INTO supplier_orders (order_id, supplier_id, order_date, remark, status) VALUES (?, ?, ?, ?, ?)');
    const insertItem = db.prepare('INSERT INTO supplier_order_items (order_id, product_code, quantity) VALUES (?, ?, ?)');
    const ensureProduct = db.prepare('INSERT OR IGNORE INTO products (code, name) VALUES (?, ?)');
    const txn = db.transaction(() => {
      insertHeader.run(newOrderId, supplier_id, order_date, remark, status);
      for (const it of items) {
        ensureProduct.run(it.product_code, it.product_code);
        insertItem.run(newOrderId, it.product_code, it.quantity);
      }
    });
    txn();
    return { success: true, order_id: newOrderId };
  }));

  ipcMain.handle('supOrders:get', wrap((order_id) => {
    const header = db.prepare('SELECT * FROM supplier_orders WHERE order_id = ?').get(order_id);
    if (!header) return { error: 'Order not found' };
    const items = db.prepare('SELECT * FROM supplier_order_items WHERE order_id = ?').all(order_id);
    return { ...header, items };
  }));

  ipcMain.handle('supOrders:update', wrap((data) => {
    const { id, order_id, supplier_id, order_date, remark = '', status = 'Received', items } = data;
    const orderId = id || order_id;
    if (!orderId || !supplier_id || !order_date || !Array.isArray(items) || items.length === 0) {
      return { error: 'Missing required fields' };
    }
    const ensureProduct = db.prepare('INSERT OR IGNORE INTO products (code, name) VALUES (?, ?)');
    const updateTxn = db.transaction(() => {
      db.prepare('UPDATE supplier_orders SET supplier_id = ?, order_date = ?, remark = ?, status = ? WHERE order_id = ?')
        .run(supplier_id, order_date, remark, status, orderId);
      db.prepare('DELETE FROM supplier_order_items WHERE order_id = ?').run(orderId);
      const insertItem = db.prepare('INSERT INTO supplier_order_items (order_id, product_code, quantity) VALUES (?, ?, ?)');
      for (const it of items) {
        ensureProduct.run(it.product_code, it.product_code);
        insertItem.run(orderId, it.product_code, it.quantity);
      }
    });
    updateTxn();
    return { success: true };
  }));

  ipcMain.handle('supOrders:delete', wrap((order_id) => {
    const txn = db.transaction(() => {
      db.prepare('DELETE FROM supplier_order_items WHERE order_id = ?').run(order_id);
      const res = db.prepare('DELETE FROM supplier_orders WHERE order_id = ?').run(order_id);
      return res.changes;
    });
    const changes = txn();
    return changes ? { success: true } : { error: 'Order not found' };
  }));

  // -----------------------
  // Suppliers CRUD
  // -----------------------
  ipcMain.handle('suppliers:create', wrap((sup) => {
    const { supplier_id, name, address, mobile } = sup;
    db.prepare('INSERT INTO suppliers (supplier_id, name, address, mobile) VALUES (?, ?, ?, ?)')
      .run(supplier_id, name, address, mobile);
    return { success: true };
  }));

  ipcMain.handle('suppliers:getAll', wrap(() => {
    return db.prepare('SELECT * FROM suppliers').all();
  }));

  ipcMain.handle('suppliers:get', wrap((supplier_id) => {
    const row = db.prepare('SELECT * FROM suppliers WHERE supplier_id = ?').get(supplier_id);
    return row || { error: 'Supplier not found' };
  }));

  ipcMain.handle('suppliers:update', wrap((sup) => {
    const { supplier_id, name, address, mobile } = sup;
    const res = db.prepare('UPDATE suppliers SET name = ?, address = ?, mobile = ? WHERE supplier_id = ?')
      .run(name, address, mobile, supplier_id);
    return res.changes ? { success: true } : { error: 'Supplier not found' };
  }));

  ipcMain.handle('suppliers:delete', wrap((supplier_id) => {
    const res = db.prepare('DELETE FROM suppliers WHERE supplier_id = ?').run(supplier_id);
    return res.changes ? { success: true } : { error: 'Supplier not found' };
  }));

  // Aliases expected by renderer ------------------------------------
  ipcMain.handle('suppliersMaal:getBySupplier', wrap((supplier_id) => {
    // delegate to existing query
    const rows = db.prepare(`SELECT id, maal_date, maal_invoice_no, maal_amount, maal_remark FROM supplier_maal_account WHERE supplier_id = ? ORDER BY maal_date DESC, id DESC`).all(supplier_id);
    return rows;
  }));

  // --- Suppliers Maal aliases (create/update/delete) ------------
  ipcMain.handle('suppliersMaal:create', wrap((data) => {
    // reuse suppliers:maalCreate logic
    const { supplier_id, invoice_number, date, amount, remark } = data;
    const info = db.prepare(`INSERT INTO supplier_maal_account (supplier_id, maal_date, maal_invoice_no, maal_amount, maal_remark) VALUES (?, ?, ?, ?, ?)`)
      .run(supplier_id, date, invoice_number || null, amount, remark || '');
    return { id: info.lastInsertRowid, supplier_id, date, invoice_number, amount, remark };
  }));

  ipcMain.handle('suppliersMaal:update', wrap((data) => {
    const { id, date, invoice_number, amount, remark } = data;
    const res = db.prepare(`UPDATE supplier_maal_account SET maal_date = ?, maal_invoice_no = ?, maal_amount = ?, maal_remark = ? WHERE id = ?`)
      .run(date, invoice_number || '', amount, remark || '', id);
    return res.changes ? { success: true } : { error: 'Maal entry not found' };
  }));

  ipcMain.handle('suppliersMaal:delete', wrap((id) => {
    const res = db.prepare('DELETE FROM supplier_maal_account WHERE id = ?').run(id);
    return res.changes ? { success: true } : { error: 'Maal entry not found' };
  }));

  // --- Supplier Transactions aliases (create/update/delete) ----
  ipcMain.handle('supplierTransactions:create', wrap((data) => {
    const { supplier_id, date, txn_type, amount, remark } = data;
    const info = db.prepare(`INSERT INTO supplier_jama_account (supplier_id, jama_date, jama_txn_type, jama_amount, jama_remark) VALUES (?, ?, ?, ?, ?)`)
      .run(supplier_id, date, txn_type, amount, remark || '');
    return { transaction_id: info.lastInsertRowid, supplier_id, date, txn_type, amount, remark };
  }));

  ipcMain.handle('supplierTransactions:update', wrap((data) => {
    const { id, date, txn_type, amount, remark } = data;
    const res = db.prepare(`UPDATE supplier_jama_account SET jama_date = ?, jama_txn_type = ?, jama_amount = ?, jama_remark = ? WHERE id = ?`)
      .run(date, txn_type, amount, remark || '', id);
    return res.changes ? { success: true } : { error: 'Transaction not found' };
  }));

  ipcMain.handle('supplierTransactions:delete', wrap((id) => {
    const res = db.prepare('DELETE FROM supplier_jama_account WHERE id = ?').run(id);
    return res.changes ? { success: true } : { error: 'Transaction not found' };
  }));

  ipcMain.handle('supplierTransactions:getBySupplier', wrap((supplier_id) => {
    const rows = db.prepare(`SELECT id AS transaction_id, jama_date AS date, jama_txn_type AS txn_type, jama_amount AS amount, jama_remark AS remark FROM supplier_jama_account WHERE supplier_id = ? ORDER BY jama_date DESC, id DESC`).all(supplier_id);
    return rows;
  }));

  // Supplier Maal ----------------------------------------------------
  ipcMain.handle('suppliers:maalList', wrap((supplier_id) => {
    const rows = db.prepare(`SELECT id, maal_date, maal_invoice_no, maal_amount, maal_remark FROM supplier_maal_account WHERE supplier_id = ? ORDER BY maal_date DESC, id DESC`).all(supplier_id);
    return rows;
  }));

  ipcMain.handle('suppliers:maalCreate', wrap((data) => {
    const { supplier_id, invoice_number, date, amount, remark } = data;
    const info = db.prepare(`INSERT INTO supplier_maal_account (supplier_id, maal_date, maal_invoice_no, maal_amount, maal_remark) VALUES (?, ?, ?, ?, ?)`)                                           
      .run(supplier_id, date, invoice_number || null, amount, remark || '');
    return { id: info.lastInsertRowid, supplier_id, date, invoice_number, amount, remark };
  }));

  ipcMain.handle('suppliers:maalUpdate', wrap((data) => {
    const { id, date, invoice_number, amount, remark } = data;
    const res = db.prepare(`UPDATE supplier_maal_account SET maal_date = ?, maal_invoice_no = ?, maal_amount = ?, maal_remark = ? WHERE id = ?`).run(date, invoice_number || '', amount, remark || '', id);
    return res.changes ? { success: true } : { error: 'Maal entry not found' };
  }));

  ipcMain.handle('suppliers:maalDelete', wrap((id) => {
    const res = db.prepare('DELETE FROM supplier_maal_account WHERE id = ?').run(id);
    return res.changes ? { success: true } : { error: 'Maal entry not found' };
  }));

  // Supplier Jama transactions --------------------------------------
  ipcMain.handle('suppliers:txnCreate', wrap((data) => {
    const { supplier_id, date, txn_type, amount, remark } = data;
    const info = db.prepare(`INSERT INTO supplier_jama_account (supplier_id, jama_date, jama_txn_type, jama_amount, jama_remark) VALUES (?, ?, ?, ?, ?)`)                                           
      .run(supplier_id, date, txn_type, amount, remark || '');
    return { transaction_id: info.lastInsertRowid, supplier_id, date, txn_type, amount, remark };
  }));

  ipcMain.handle('suppliers:txnUpdate', wrap((data) => {
    const { id, date, txn_type, amount, remark } = data;
    const res = db.prepare(`UPDATE supplier_jama_account SET jama_date = ?, jama_txn_type = ?, jama_amount = ?, jama_remark = ? WHERE id = ?`).run(date, txn_type, amount, remark || '', id);
    return res.changes ? { success: true } : { error: 'Transaction not found' };
  }));

  ipcMain.handle('suppliers:txnDelete', wrap((id) => {
    const res = db.prepare('DELETE FROM supplier_jama_account WHERE id = ?').run(id);
    return res.changes ? { success: true } : { error: 'Transaction not found' };
  }));

  ipcMain.handle('suppliers:txnList', wrap((supplier_id) => {
    const rows = db.prepare(`SELECT id AS transaction_id, jama_date AS date, jama_txn_type AS txn_type, jama_amount AS amount, jama_remark AS remark FROM supplier_jama_account WHERE supplier_id = ? ORDER BY jama_date DESC, id DESC`).all(supplier_id);
    return rows;
  }));
};
