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
    // Only return non-deleted products
    const rows = db.prepare('SELECT * FROM products WHERE is_deleted = 0 OR is_deleted IS NULL').all();
    // Convert Row objects to plain JSON-friendly objects
    return rows.map(r => ({ ...r }));
  }));

  // Google Input Tools transliteration helper (English script → Devanagari script)
  // NOT translation — "Sugar" → "शुगर" (not "साखर")
  async function transliterateToMarathi(text) {
    try {
      if (!text || !text.trim()) return null;
      // Split into words, transliterate alphabetic words, keep numbers/special chars
      const words = text.split(/\s+/);
      const result = [];
      for (const word of words) {
        // If the word is purely numeric or special chars, keep as-is
        if (/^[^a-zA-Z]+$/.test(word)) {
          result.push(word);
          continue;
        }
        const url = `https://inputtools.google.com/request?text=${encodeURIComponent(word)}&itc=mr-t-i0-und&num=1`;
        const res = await fetch(url);
        if (!res.ok) { result.push(word); continue; }
        const data = await res.json();
        // Response: ["SUCCESS",[["word",["transliterated",...]]]]
        if (data[0] === 'SUCCESS' && data[1] && data[1][0] && data[1][0][1] && data[1][0][1][0]) {
          result.push(data[1][0][1][0]);
        } else {
          result.push(word); // fallback to original
        }
      }
      return result.join(' ');
    } catch (err) {
      console.error('Transliteration error:', err.message);
      return null;
    }
  }

  ipcMain.handle('products:create', wrap(async (prod) => {
    const { code, name, size, packing_type, cost_price, selling_price } = prod;
    if (!code || !name) return { error: 'Missing required fields' };
    db.prepare(`
        INSERT INTO products (code, name, size, packing_type, cost_price, selling_price, is_deleted)
        VALUES (?, ?, ?, ?, ?, ?, 0)
      `).run(code, name, size, packing_type, cost_price, selling_price);

    // Auto-transliterate to Marathi (non-blocking, never fails product creation)
    try {
      const marathiName = await transliterateToMarathi(name);
      if (marathiName) {
        db.prepare("UPDATE products SET marathi_name = ?, marathi_status = 'transliterated' WHERE code = ?").run(marathiName, code);
      }
    } catch (e) { console.error('Marathi auto-transliterate failed (non-critical):', e.message); }

    return { success: true };
  }));

  ipcMain.handle('products:get', wrap((code) => {
    const row = db.prepare('SELECT * FROM products WHERE code = ? AND (is_deleted = 0 OR is_deleted IS NULL)').get(code);
    return row || { error: 'Product not found' };
  }));

  ipcMain.handle('products:update', wrap((prod) => {
    const { code, name, size, packing_type, cost_price, selling_price } = prod;
    const res = db.prepare(`
        UPDATE products SET name = ?, size = ?, packing_type = ?, cost_price = ?, selling_price = ? 
        WHERE code = ? AND (is_deleted = 0 OR is_deleted IS NULL)
      `).run(name, size, packing_type, cost_price, selling_price, code);
    return res.changes ? { success: true } : { error: 'Product not found' };
  }));

  // Update product including code change (for normalizing legacy products)
  ipcMain.handle('products:updateWithCodeChange', wrap((prod) => {
    const { originalCode, newCode, name, size, packing_type, cost_price, selling_price } = prod;

    if (!originalCode) return { error: 'Original code is required' };
    if (!newCode || !name) return { error: 'New code and name are required' };

    // Check if newCode already exists (and it's not the same product)
    if (originalCode !== newCode) {
      const existing = db.prepare(
        'SELECT code FROM products WHERE code = ? AND (is_deleted = 0 OR is_deleted IS NULL)'
      ).get(newCode);

      if (existing) {
        return { error: 'A product with this code already exists' };
      }
    }

    // Use transaction to ensure data integrity
    const updateProduct = db.transaction(() => {
      // First update all invoice_items references to the new code
      if (originalCode !== newCode) {
        db.prepare(
          'UPDATE invoice_items SET product_code = ? WHERE product_code = ?'
        ).run(newCode, originalCode);

        // Update customer_order_items
        db.prepare(
          'UPDATE customer_order_items SET product_code = ? WHERE product_code = ?'
        ).run(newCode, originalCode);

        // Update supplier_order_items
        db.prepare(
          'UPDATE supplier_order_items SET product_code = ? WHERE product_code = ?'
        ).run(newCode, originalCode);
      }

      // Now update the product itself (including the code)
      const res = db.prepare(`
          UPDATE products 
          SET code = ?, name = ?, size = ?, packing_type = ?, cost_price = ?, selling_price = ?
          WHERE code = ? AND (is_deleted = 0 OR is_deleted IS NULL)
        `).run(newCode, name, size, packing_type, cost_price, selling_price, originalCode);

      return res.changes;
    });

    const changes = updateProduct();
    return changes ? { success: true } : { error: 'Product not found' };
  }));

  // Soft delete product (mark as deleted instead of removing)
  ipcMain.handle('products:delete', wrap((code) => {
    // Handle soft deletion of products with empty/blank codes
    if (!code || code.trim() === '') {
      // Soft delete products where code is empty or null
      const res = db.prepare(`
          UPDATE products SET is_deleted = 1 
          WHERE code IS NULL OR code = '' OR TRIM(code) = ''
        `).run();
      return res.changes ? { success: true, deleted: res.changes } : { error: 'No blank products found' };
    }
    // Soft delete by code
    const res = db.prepare('UPDATE products SET is_deleted = 1 WHERE code = ?').run(code);
    return res.changes ? { success: true } : { error: 'Product not found' };
  }));

  // Soft delete product by rowid (for products with problematic codes)
  ipcMain.handle('products:deleteByRowid', wrap((rowid) => {
    if (!rowid) return { error: 'Rowid is required' };
    const res = db.prepare('UPDATE products SET is_deleted = 1 WHERE rowid = ?').run(rowid);
    return res.changes ? { success: true } : { error: 'Product not found' };
  }));

  // One-time migration: normalize packing types
  ipcMain.handle('products:normalizePacking', wrap(() => {
    const mappings = [
      { from: ['PC', 'PCS', 'pc', 'pcs'], to: 'Pc' },
      { from: ['KG', 'KGS', 'kg', 'kgs'], to: 'Kg' },
      { from: ['DZ', 'DOZ', 'DOZEN', 'dz', 'doz', 'dozen'], to: 'Dz' },
      { from: ['BOX', 'BOXES', 'box', 'boxes', 'Box'], to: 'Box' },
      { from: ['KODI', 'kodi'], to: 'Kodi' },
      { from: ['THELI', 'theli', 'Theli'], to: 'Theli' },
      { from: ['PACKET', 'packet', 'Packet'], to: 'Packet' },
      { from: ['SET', 'set', 'Set'], to: 'Set' },
    ];

    let totalUpdated = 0;

    for (const mapping of mappings) {
      for (const fromValue of mapping.from) {
        const res = db.prepare(`
            UPDATE products SET packing_type = ? WHERE packing_type = ?
          `).run(mapping.to, fromValue);
        totalUpdated += res.changes;
      }
    }

    return { success: true, updated: totalUpdated };
  }));

  // Hard delete all soft-deleted products (cleanup)
  ipcMain.handle('products:cleanupDeleted', wrap(() => {
    const res = db.prepare('DELETE FROM products WHERE is_deleted = 1').run();
    return { success: true, deleted: res.changes };
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
                i.remark         AS remark,
                'invoice'        AS source
            FROM invoices i
          WHERE i.customer_id = ?

          UNION ALL

          SELECT m.maal_invoice_no AS invoice_id,
                m.maal_date       AS invoice_date,
                m.maal_amount     AS grand_total,
                m.maal_remark     AS remark,
                'maal_only'      AS source
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
                i.remark         AS remark,
                'invoice'        AS source
            FROM invoices i
          WHERE i.customer_id = ?
          UNION ALL
          SELECT m.maal_invoice_no AS invoice_id,
                m.maal_date       AS invoice_date,
                m.maal_amount     AS grand_total,
                m.maal_remark     AS remark,
                'maal_only'      AS source
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
    const { id, transaction_id, date, txn_type, amount, remark } = txn;
    const entryId = id || transaction_id; // Accept both id and transaction_id
    const res = db.prepare(`UPDATE customer_jama_account
                                SET jama_date = ?, jama_txn_type = ?, jama_amount = ?, jama_remark = ?
                              WHERE id = ?`).run(date, txn_type, amount, remark || '', entryId);
    return res.changes ? { success: true } : { error: 'Transaction not found' };
  }));

  ipcMain.handle('transactions:delete', wrap((transaction_id) => {
    const res = db.prepare('DELETE FROM customer_jama_account WHERE id = ?').run(transaction_id);
    return res.changes ? { success: true } : { error: 'Transaction not found' };
  }));

  // -----------------------
  // Invoices
  // -----------------------


  // Helper to get next invoice id - ONLY PREVIEWS, does NOT consume the number
  // The actual number consumption happens in invoices:create
  ipcMain.handle('invoices:getNextId', wrap(() => {
    // Step 1: Check if there's a reusable number (just peek, don't remove)
    const reusable = db.prepare('SELECT invoice_number FROM reusable_invoice_numbers ORDER BY invoice_number ASC LIMIT 1').get();

    if (reusable) {
      // Preview this number (will be consumed in invoices:create)
      return { next_id: `E-${reusable.invoice_number}` };
    }

    // Step 2: No reusable number - preview next sequence number (don't increment yet)
    const seq = db.prepare("SELECT last_number FROM document_sequences WHERE doc_type = 'invoice'").get();
    return { next_id: `E-${(seq.last_number || 0) + 1}` };
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

    // Check for linked payment (Jama entry with remark "Invoice {invoice_id}" or starting with it)
    const paymentRemark = `Invoice ${invoice_id}`;
    const linkedPayment = db.prepare(
      `SELECT id, jama_date AS payment_date, jama_txn_type AS payment_type, jama_amount AS payment_amount
        FROM customer_jama_account 
        WHERE jama_remark = ? OR jama_remark LIKE ?`
    ).get(paymentRemark, `${paymentRemark}%`);

    return {
      ...header,
      items,
      payment_amount: linkedPayment ? linkedPayment.payment_amount : 0,
      payment_type: linkedPayment ? linkedPayment.payment_type : 'Cash',
      payment_date: linkedPayment ? linkedPayment.payment_date : null,
      payment_id: linkedPayment ? linkedPayment.id : null
    };
  }));

  ipcMain.handle('invoices:update', wrap((invoice) => {
    const { id: invoice_id, customer_id, invoice_date, remark = '', packing = 0, freight = 0, riksha = 0, items,
      payment_amount = 0, payment_type = 'Cash', payment_date = null } = invoice;
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

      // Handle payment/advance (Jama entry management)
      const paymentRemark = `Invoice ${invoice_id}`;
      const existingPayment = db.prepare(
        `SELECT id FROM customer_jama_account WHERE jama_remark LIKE ? OR jama_remark = ?`
      ).get(`${paymentRemark}%`, paymentRemark);

      const paymentAmt = parseFloat(payment_amount) || 0;

      if (paymentAmt > 0) {
        const payDate = payment_date || invoice_date;
        if (existingPayment) {
          // Update existing Jama entry
          db.prepare(`UPDATE customer_jama_account SET jama_date = ?, jama_txn_type = ?, jama_amount = ? WHERE id = ?`)
            .run(payDate, payment_type, paymentAmt, existingPayment.id);
        } else {
          // Create new Jama entry
          db.prepare(`INSERT INTO customer_jama_account (customer_id, jama_date, jama_txn_type, jama_amount, jama_remark) VALUES (?, ?, ?, ?, ?)`)
            .run(customer_id, payDate, payment_type, paymentAmt, paymentRemark);
        }
      } else if (existingPayment) {
        // Payment amount is 0/empty - delete existing Jama entry
        db.prepare('DELETE FROM customer_jama_account WHERE id = ?').run(existingPayment.id);
      }
    });
    updateTxn();
    return { success: true };
  }));

  // -----------------------
  // Maal (simple invoice header) routes
  // -----------------------
  ipcMain.handle('maal:get', wrap((identifier) => {
    // Support lookup by id (numeric) or invoice_id (string)
    let row;
    if (typeof identifier === 'number' || !isNaN(Number(identifier))) {
      row = db.prepare(`SELECT id, customer_id, maal_date AS date, maal_invoice_no AS invoice_number,
                                maal_amount AS amount, maal_remark AS remark
                            FROM customer_maal_account WHERE id = ?`).get(Number(identifier));
    }
    if (!row) {
      row = db.prepare(`SELECT id, customer_id, maal_date AS date, maal_invoice_no AS invoice_number,
                                maal_amount AS amount, maal_remark AS remark
                            FROM customer_maal_account WHERE maal_invoice_no = ?`).get(identifier);
    }
    return row || { error: 'Entry not found' };
  }));

  ipcMain.handle('maal:update', wrap((data) => {
    const { id, invoice_id, date, amount, remark, invoice_number } = data;
    let changes = 0;
    // Update by id (direct maal entry) or invoice_id (linked to invoice)
    if (id) {
      const res = db.prepare(`UPDATE customer_maal_account SET maal_date = ?, maal_invoice_no = ?, maal_amount = ?, maal_remark = ? WHERE id = ?`)
        .run(date, invoice_number || '', amount, remark || '', id);
      changes = res.changes;
    } else if (invoice_id) {
      db.prepare(`UPDATE invoices SET invoice_date = ?, grand_total = ?, remark = ? WHERE invoice_id = ?`).run(date, amount, remark || '', invoice_id);
      const res = db.prepare(`UPDATE customer_maal_account SET maal_date = ?, maal_invoice_no = ?, maal_amount = ?, maal_remark = ? WHERE maal_invoice_no = ?`)
        .run(date, invoice_number || invoice_id, amount, remark || '', invoice_id);
      changes = res.changes;
    }
    return changes ? { success: true } : { error: 'Entry not found' };
  }));

  ipcMain.handle('maal:delete', wrap((identifier) => {
    // Support delete by id (numeric) or invoice_id (string)
    let invoiceIdToRecycle = null;

    if (typeof identifier === 'number' || !isNaN(Number(identifier))) {
      // Delete by id - first get the maal_invoice_no for recycling
      const entry = db.prepare('SELECT maal_invoice_no FROM customer_maal_account WHERE id = ?').get(Number(identifier));
      if (entry) invoiceIdToRecycle = entry.maal_invoice_no;
      const res = db.prepare('DELETE FROM customer_maal_account WHERE id = ?').run(Number(identifier));
      if (res.changes) {
        // Add number to reusable pool
        if (invoiceIdToRecycle) {
          let invoiceNum = null;
          if (invoiceIdToRecycle.startsWith('E-')) {
            invoiceNum = parseInt(invoiceIdToRecycle.substring(2), 10);
          } else if (invoiceIdToRecycle.startsWith('AGS-I-')) {
            invoiceNum = parseInt(invoiceIdToRecycle.substring(6), 10);
          }
          if (invoiceNum && !isNaN(invoiceNum)) {
            db.prepare('INSERT OR IGNORE INTO reusable_invoice_numbers (invoice_number) VALUES (?)').run(invoiceNum);
          }
        }
        return { success: true };
      }
    }
    // Fallback: delete by invoice_id (also cleans up invoice_items and invoices)
    invoiceIdToRecycle = identifier;
    const txn = db.transaction(() => {
      db.prepare('DELETE FROM invoice_items WHERE invoice_id = ?').run(identifier);
      const res1 = db.prepare('DELETE FROM customer_maal_account WHERE maal_invoice_no = ?').run(identifier);
      db.prepare('DELETE FROM invoices WHERE invoice_id = ?').run(identifier);

      // Add number to reusable pool
      let invoiceNum = null;
      if (identifier.startsWith && identifier.startsWith('E-')) {
        invoiceNum = parseInt(identifier.substring(2), 10);
      } else if (identifier.startsWith && identifier.startsWith('AGS-I-')) {
        invoiceNum = parseInt(identifier.substring(6), 10);
      }
      if (invoiceNum && !isNaN(invoiceNum)) {
        db.prepare('INSERT OR IGNORE INTO reusable_invoice_numbers (invoice_number) VALUES (?)').run(invoiceNum);
      }

      return res1.changes;
    });
    const changes = txn();
    return changes ? { success: true } : { error: 'Entry not found' };
  }));

  ipcMain.handle('maal:create', wrap((data) => {
    const { customer_id, invoice_number, date, amount, remark } = data;
    let newInvoiceId = invoice_number;
    if (!newInvoiceId) {
      // Step 1: Try to reuse a deleted number from the pool
      const reusable = db.prepare('SELECT invoice_number FROM reusable_invoice_numbers ORDER BY invoice_number ASC LIMIT 1').get();

      if (reusable) {
        // Use this number and remove it from the pool
        db.prepare('DELETE FROM reusable_invoice_numbers WHERE invoice_number = ?').run(reusable.invoice_number);
        newInvoiceId = `E-${reusable.invoice_number}`;
      } else {
        // Step 2: No reusable number - increment sequence counter
        db.prepare("UPDATE document_sequences SET last_number = last_number + 1 WHERE doc_type = 'invoice'").run();
        const seq = db.prepare("SELECT last_number FROM document_sequences WHERE doc_type = 'invoice'").get();
        newInvoiceId = `E-${seq.last_number}`;
      }
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
    return { next_id: `O-C-${cnt + 1}` };
  }));

  ipcMain.handle('cusOrders:create', wrap((data) => {
    const { customer_id, order_date, remark = '', status = 'Received', items,
      payment_amount = 0, payment_type = 'Cash', payment_date = null } = data;
    if (!customer_id || !order_date || !Array.isArray(items) || items.length === 0) {
      return { error: 'Missing required fields' };
    }
    const newOrderId = `O-C-${db.prepare('SELECT COUNT(*) AS cnt FROM customer_orders').get().cnt + 1}`;
    const insertHeader = db.prepare(`INSERT INTO customer_orders (order_id, customer_id, order_date, remark, status) VALUES (?, ?, ?, ?, ?)`);
    const insertItem = db.prepare(`INSERT INTO customer_order_items (order_id, product_code, quantity) VALUES (?, ?, ?)`);
    const ensureProduct = db.prepare('INSERT OR IGNORE INTO products (code, name) VALUES (?, ?)');
    const txn = db.transaction(() => {
      insertHeader.run(newOrderId, customer_id, order_date, remark, status);
      for (const it of items) {
        ensureProduct.run(it.product_code, it.product_code);
        insertItem.run(newOrderId, it.product_code, it.quantity);
      }
      // Create Jama entry if payment amount > 0
      const paymentAmt = parseFloat(payment_amount) || 0;
      if (paymentAmt > 0) {
        const payDate = payment_date || order_date;
        const paymentRemark = `Order ${newOrderId}`;
        db.prepare(`INSERT INTO customer_jama_account (customer_id, jama_date, jama_txn_type, jama_amount, jama_remark)
                      VALUES (?, ?, ?, ?, ?)`)
          .run(customer_id, payDate, payment_type, paymentAmt, paymentRemark);
      }
    });
    txn();
    return { success: true, order_id: newOrderId };
  }));

  ipcMain.handle('cusOrders:get', wrap((order_id) => {
    const header = db.prepare('SELECT * FROM customer_orders WHERE order_id = ?').get(order_id);
    if (!header) return { error: 'Order not found' };
    const items = db.prepare('SELECT * FROM customer_order_items WHERE order_id = ?').all(order_id);

    // Check for linked payment (Jama entry with remark "Order {order_id}")
    const paymentRemark = `Order ${order_id}`;
    const linkedPayment = db.prepare(
      `SELECT id, jama_date AS payment_date, jama_txn_type AS payment_type, jama_amount AS payment_amount
        FROM customer_jama_account 
        WHERE jama_remark = ? OR jama_remark LIKE ?`
    ).get(paymentRemark, `${paymentRemark}%`);

    return {
      ...header,
      items,
      payment_amount: linkedPayment ? linkedPayment.payment_amount : 0,
      payment_type: linkedPayment ? linkedPayment.payment_type : 'Cash',
      payment_date: linkedPayment ? linkedPayment.payment_date : null,
      payment_id: linkedPayment ? linkedPayment.id : null
    };
  }));

  ipcMain.handle('cusOrders:update', wrap((data) => {
    const { id, order_id, customer_id, order_date, remark = '', status = 'Received', items,
      payment_amount = 0, payment_type = 'Cash', payment_date = null } = data;
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

      // Handle payment/advance (Jama entry management)
      const paymentRemark = `Order ${orderId}`;
      const existingPayment = db.prepare(
        `SELECT id FROM customer_jama_account WHERE jama_remark = ? OR jama_remark LIKE ?`
      ).get(paymentRemark, `${paymentRemark}%`);

      const paymentAmt = parseFloat(payment_amount) || 0;

      if (paymentAmt > 0) {
        const payDate = payment_date || order_date;
        if (existingPayment) {
          // Update existing Jama entry
          db.prepare(`UPDATE customer_jama_account SET jama_date = ?, jama_txn_type = ?, jama_amount = ? WHERE id = ?`)
            .run(payDate, payment_type, paymentAmt, existingPayment.id);
        } else {
          // Create new Jama entry
          db.prepare(`INSERT INTO customer_jama_account (customer_id, jama_date, jama_txn_type, jama_amount, jama_remark)
                        VALUES (?, ?, ?, ?, ?)`)
            .run(customer_id, payDate, payment_type, paymentAmt, paymentRemark);
        }
      } else if (existingPayment) {
        // Payment amount is 0/empty - delete existing Jama entry
        db.prepare('DELETE FROM customer_jama_account WHERE id = ?').run(existingPayment.id);
      }
    });
    updateTxn();
    return { success: true };
  }));

  ipcMain.handle('cusOrders:delete', wrap((order_id) => {
    const txn = db.transaction(() => {
      db.prepare('DELETE FROM customer_order_items WHERE order_id = ?').run(order_id);
      // NOTE: Do NOT delete Jama entry - advance payment must remain in books per accounting rules
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
    const { customer_id, invoice_date, remark = '', packing = 0, freight = 0, riksha = 0, items,
      payment_amount = 0, payment_type = 'Cash', payment_date = null } = data;
    if (!customer_id || !invoice_date || !Array.isArray(items) || items.length === 0) {
      return { error: 'Missing required fields' };
    }

    const ensureProductStmt = db.prepare('INSERT OR IGNORE INTO products (code, name) VALUES (?, ?)');
    const insertItemStmt = db.prepare('INSERT INTO invoice_items (invoice_id, product_code, quantity, selling_price) VALUES (?, ?, ?, ?)');
    const createTxn = db.transaction(() => {
      // Generate invoice_id using sequence table with reusable pool
      // Step 1: Try to consume a deleted number from the pool
      const reusable = db.prepare('SELECT invoice_number FROM reusable_invoice_numbers ORDER BY invoice_number ASC LIMIT 1').get();
      let invoiceNum;

      if (reusable) {
        // Consume this number (remove from pool)
        db.prepare('DELETE FROM reusable_invoice_numbers WHERE invoice_number = ?').run(reusable.invoice_number);
        invoiceNum = reusable.invoice_number;
      } else {
        // Step 2: No reusable number - increment sequence counter and use it
        db.prepare("UPDATE document_sequences SET last_number = last_number + 1 WHERE doc_type = 'invoice'").run();
        const seq = db.prepare("SELECT last_number FROM document_sequences WHERE doc_type = 'invoice'").get();
        invoiceNum = seq.last_number;
      }

      const invoice_id = `E-${invoiceNum}`;

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

      // Create Maal entry (existing behavior)
      db.prepare(`INSERT INTO customer_maal_account (customer_id, maal_date, maal_invoice_no, maal_amount, maal_remark)
                    VALUES (?, ?, ?, ?, ?)`)
        .run(customer_id, invoice_date, invoice_id, grandTotal, remark);

      // Create Jama entry if payment amount > 0
      const paymentAmt = parseFloat(payment_amount) || 0;
      if (paymentAmt > 0) {
        const payDate = payment_date || invoice_date;
        const paymentRemark = `Invoice ${invoice_id}`;
        db.prepare(`INSERT INTO customer_jama_account (customer_id, jama_date, jama_txn_type, jama_amount, jama_remark)
                      VALUES (?, ?, ?, ?, ?)`)
          .run(customer_id, payDate, payment_type, paymentAmt, paymentRemark);
      }

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
                  i.remark         AS remark,
                  'invoice'        AS source
              FROM invoices i
            WHERE i.customer_id = ?

            UNION ALL

            SELECT m.maal_invoice_no AS invoice_id,
                  m.maal_date       AS invoice_date,
                  m.maal_amount     AS grand_total,
                  m.maal_remark     AS remark,
                  'maal_only'      AS source
              FROM customer_maal_account m
            WHERE m.customer_id = ?
              AND NOT EXISTS (SELECT 1 FROM invoices i2 WHERE i2.invoice_id = m.maal_invoice_no)
          )
          ORDER BY invoice_date DESC
      `).all(customer_id, customer_id);
    return rows;
  }));

  // Hard delete invoice with all related data (invoice_items, customer_maal_account, linked Jama entry)
  // Also adds the invoice number to the reusable pool for future reuse
  ipcMain.handle('invoices:delete', wrap((invoice_id) => {
    if (!invoice_id) return { error: 'Invoice ID is required' };

    const deleteTxn = db.transaction(() => {
      // Step 1: Delete all invoice items
      db.prepare('DELETE FROM invoice_items WHERE invoice_id = ?').run(invoice_id);

      // Step 2: Delete related maal entry (matches by maal_invoice_no = invoice_id)
      db.prepare('DELETE FROM customer_maal_account WHERE maal_invoice_no = ?').run(invoice_id);

      // Step 3: Delete linked Jama entry (payment associated with this invoice)
      const paymentRemark = `Invoice ${invoice_id}`;
      db.prepare('DELETE FROM customer_jama_account WHERE jama_remark LIKE ? OR jama_remark = ?')
        .run(`${paymentRemark}%`, paymentRemark);

      // Step 4: Delete the invoice header
      const res = db.prepare('DELETE FROM invoices WHERE invoice_id = ?').run(invoice_id);

      // Step 5: Extract number and add to reusable pool
      // Supports formats: E-15, AGS-I-15
      let invoiceNum = null;
      if (invoice_id.startsWith('E-')) {
        invoiceNum = parseInt(invoice_id.substring(2), 10);
      } else if (invoice_id.startsWith('AGS-I-')) {
        invoiceNum = parseInt(invoice_id.substring(6), 10);
      }
      if (invoiceNum && !isNaN(invoiceNum)) {
        db.prepare('INSERT OR IGNORE INTO reusable_invoice_numbers (invoice_number) VALUES (?)').run(invoiceNum);
      }

      return res.changes;
    });

    const changes = deleteTxn();
    return changes ? { success: true } : { error: 'Invoice not found' };
  }));

  // -----------------------
  // Quick Sales
  // -----------------------

  // Preview next quick sale id (does not consume)
  ipcMain.handle('quickSales:getNextId', wrap(() => {
    const reusable = db.prepare('SELECT qs_number FROM reusable_quick_sale_numbers ORDER BY qs_number ASC LIMIT 1').get();
    if (reusable) return { next_id: `QS-${reusable.qs_number}` };
    const seq = db.prepare("SELECT last_number FROM document_sequences WHERE doc_type = 'quick_sale'").get();
    return { next_id: `QS-${(seq.last_number || 0) + 1}` };
  }));

  // Create quick sale (consumes sequence or reusable)
  ipcMain.handle('quickSales:create', wrap((data) => {
    const { qs_date, remark = '', items } = data;
    if (!qs_date || !Array.isArray(items) || items.length === 0) return { error: 'Missing required fields' };

    const ensureProductStmt = db.prepare('INSERT OR IGNORE INTO products (code, name) VALUES (?, ?)');
    const insertItemStmt = db.prepare('INSERT INTO quick_sale_items (qs_id, product_code, quantity, selling_price) VALUES (?, ?, ?, ?)');

    const createTxn = db.transaction(() => {
      // consume reusable number or increment sequence
      const reusable = db.prepare('SELECT qs_number FROM reusable_quick_sale_numbers ORDER BY qs_number ASC LIMIT 1').get();
      let num;
      if (reusable) {
        db.prepare('DELETE FROM reusable_quick_sale_numbers WHERE qs_number = ?').run(reusable.qs_number);
        num = reusable.qs_number;
      } else {
        db.prepare("UPDATE document_sequences SET last_number = last_number + 1 WHERE doc_type = 'quick_sale'").run();
        const seq = db.prepare("SELECT last_number FROM document_sequences WHERE doc_type = 'quick_sale'").get();
        num = seq.last_number;
      }
      const qs_id = `QS-${num}`;

      const itemsTotal = items.reduce((s, it) => s + (it.quantity * it.selling_price), 0);
      const roundedTotal = Math.round(itemsTotal);
      db.prepare('INSERT INTO quick_sales (qs_id, qs_date, total, remark) VALUES (?, ?, ?, ?)').run(qs_id, qs_date, roundedTotal, remark);

      for (const it of items) {
        ensureProductStmt.run(it.product_code, it.product_code);
        insertItemStmt.run(qs_id, it.product_code, it.quantity, it.selling_price);
      }

      return qs_id;
    });

    const qs_id = createTxn();
    return { success: true, qs_id };
  }));

  // List quick sales with basic totals
  ipcMain.handle('quickSales:getAll', wrap(() => {
    const rows = db.prepare(`
      SELECT qs_id, qs_date, total, remark
      FROM quick_sales
      ORDER BY qs_date DESC, qs_id DESC
    `).all();
    return rows;
  }));

  // Get single quick sale (header + items)
  ipcMain.handle('quickSales:get', wrap((qs_id) => {
    const header = db.prepare('SELECT * FROM quick_sales WHERE qs_id = ?').get(qs_id);
    if (!header) return { success: false, error: 'Quick sale not found' };
    const items = db.prepare('SELECT * FROM quick_sale_items WHERE qs_id = ?').all(qs_id);
    return { ...header, items };
  }));

  // Update quick sale (header + items)
  ipcMain.handle('quickSales:update', wrap((data) => {
    const { qs_id, qs_date, remark = '', items } = data;
    if (!qs_id || !qs_date || !Array.isArray(items) || items.length === 0) return { error: 'Missing required fields' };

    const updateTxn = db.transaction(() => {
      const itemsTotal = items.reduce((s, it) => s + (it.quantity * it.selling_price), 0);
      const roundedTotal = Math.round(itemsTotal);
      const res = db.prepare('UPDATE quick_sales SET qs_date = ?, total = ?, remark = ? WHERE qs_id = ?')
        .run(qs_date, roundedTotal, remark, qs_id);

      if (!res.changes) return 0;

      db.prepare('DELETE FROM quick_sale_items WHERE qs_id = ?').run(qs_id);
      const insertItemStmt = db.prepare('INSERT INTO quick_sale_items (qs_id, product_code, quantity, selling_price) VALUES (?, ?, ?, ?)');
      const ensureProductStmt = db.prepare('INSERT OR IGNORE INTO products (code, name) VALUES (?, ?)');
      for (const it of items) {
        ensureProductStmt.run(it.product_code, it.product_code);
        insertItemStmt.run(qs_id, it.product_code, it.quantity, it.selling_price);
      }
      return 1;
    });

    const changed = updateTxn();
    return changed ? { success: true } : { error: 'Quick sale not found' };
  }));

  // Delete quick sale (hard delete items + header), add number to reusable pool
  ipcMain.handle('quickSales:delete', wrap((qs_id) => {
    if (!qs_id) return { error: 'QS id required' };
    const deleteTxn = db.transaction(() => {
      db.prepare('DELETE FROM quick_sale_items WHERE qs_id = ?').run(qs_id);
      const res = db.prepare('DELETE FROM quick_sales WHERE qs_id = ?').run(qs_id);

      // extract numeric part and add to reusable pool
      let num = null;
      if (qs_id && qs_id.startsWith('QS-')) {
        num = parseInt(qs_id.substring(3), 10);
      }
      if (num && !isNaN(num)) {
        db.prepare('INSERT OR IGNORE INTO reusable_quick_sale_numbers (qs_number) VALUES (?)').run(num);
      }
      return res.changes;
    });

    const changes = deleteTxn();
    return changes ? { success: true } : { error: 'Quick sale not found' };
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
      newInvoiceId = `E-${cnt + 1}`;
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
    // Guard: block deletion if linked to an invoice
    const linkedInvoice = db.prepare('SELECT 1 FROM invoices WHERE invoice_id = ?').get(invoice_id);
    if (linkedInvoice) {
      return { success: false, error: 'Cannot delete: this entry is linked to an invoice. Delete the invoice instead.' };
    }
    const txn = db.transaction(() => {
      // Delete standalone maal entry (no linked invoice)
      db.prepare('DELETE FROM invoice_items WHERE invoice_id = ?').run(invoice_id);
      const res = db.prepare('DELETE FROM customer_maal_account WHERE maal_invoice_no = ?').run(invoice_id);
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
    // Guard: block deletion if linked to an invoice or order payment
    const row = db.prepare('SELECT jama_remark FROM customer_jama_account WHERE id = ?').get(id);
    if (row && row.jama_remark) {
      if (row.jama_remark.startsWith('Invoice ')) {
        return { success: false, error: 'Cannot delete: this payment is linked to an invoice.' };
      }
      if (row.jama_remark.startsWith('Order ')) {
        return { success: false, error: 'Cannot delete: this payment is linked to an order.' };
      }
    }
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

  // NOTE: customerOrders:* duplicate handler family has been removed.
  // All frontend code uses cusOrders:* handlers (lines above).

  // -----------------------
  // Supplier Orders
  // -----------------------
  ipcMain.handle('supOrders:getNextId', wrap(() => {
    const cnt = db.prepare('SELECT COUNT(*) AS cnt FROM supplier_orders').get().cnt;
    return { next_id: `O-S-${cnt + 1}` };
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
    const { supplier_id, order_date, remark = '', status = 'Placed', items,
      payment_amount = 0, payment_type = 'Cash', payment_date = null } = data;
    if (!supplier_id || !order_date || !Array.isArray(items) || items.length === 0) {
      return { error: 'Missing required fields' };
    }
    const newOrderId = `O-S-${db.prepare('SELECT COUNT(*) AS cnt FROM supplier_orders').get().cnt + 1}`;
    const insertHeader = db.prepare('INSERT INTO supplier_orders (order_id, supplier_id, order_date, remark, status) VALUES (?, ?, ?, ?, ?)');
    const insertItem = db.prepare('INSERT INTO supplier_order_items (order_id, product_code, quantity) VALUES (?, ?, ?)');
    const ensureProduct = db.prepare('INSERT OR IGNORE INTO products (code, name) VALUES (?, ?)');
    const txn = db.transaction(() => {
      insertHeader.run(newOrderId, supplier_id, order_date, remark, status);
      for (const it of items) {
        ensureProduct.run(it.product_code, it.product_code);
        insertItem.run(newOrderId, it.product_code, it.quantity);
      }
      // Create Jama entry if payment amount > 0
      const paymentAmt = parseFloat(payment_amount) || 0;
      if (paymentAmt > 0) {
        const payDate = payment_date || order_date;
        const paymentRemark = `Order ${newOrderId}`;
        db.prepare(`INSERT INTO supplier_jama_account (supplier_id, jama_date, jama_txn_type, jama_amount, jama_remark)
                      VALUES (?, ?, ?, ?, ?)`)
          .run(supplier_id, payDate, payment_type, paymentAmt, paymentRemark);
      }
    });
    txn();
    return { success: true, order_id: newOrderId };
  }));

  ipcMain.handle('supOrders:get', wrap((order_id) => {
    const header = db.prepare('SELECT * FROM supplier_orders WHERE order_id = ?').get(order_id);
    if (!header) return { error: 'Order not found' };
    const items = db.prepare('SELECT * FROM supplier_order_items WHERE order_id = ?').all(order_id);

    // Check for linked payment (Jama entry with remark "Order {order_id}")
    const paymentRemark = `Order ${order_id}`;
    const linkedPayment = db.prepare(
      `SELECT id, jama_date AS payment_date, jama_txn_type AS payment_type, jama_amount AS payment_amount
        FROM supplier_jama_account 
        WHERE jama_remark = ? OR jama_remark LIKE ?`
    ).get(paymentRemark, `${paymentRemark}%`);

    return {
      ...header,
      items,
      payment_amount: linkedPayment ? linkedPayment.payment_amount : 0,
      payment_type: linkedPayment ? linkedPayment.payment_type : 'Cash',
      payment_date: linkedPayment ? linkedPayment.payment_date : null,
      payment_id: linkedPayment ? linkedPayment.id : null
    };
  }));

  ipcMain.handle('supOrders:update', wrap((data) => {
    const { id, order_id, supplier_id, order_date, remark = '', status = 'Received', items,
      payment_amount = 0, payment_type = 'Cash', payment_date = null } = data;
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

      // Handle payment/advance (Jama entry management)
      const paymentRemark = `Order ${orderId}`;
      const existingPayment = db.prepare(
        `SELECT id FROM supplier_jama_account WHERE jama_remark = ? OR jama_remark LIKE ?`
      ).get(paymentRemark, `${paymentRemark}%`);

      const paymentAmt = parseFloat(payment_amount) || 0;

      if (paymentAmt > 0) {
        const payDate = payment_date || order_date;
        if (existingPayment) {
          // Update existing Jama entry
          db.prepare(`UPDATE supplier_jama_account SET jama_date = ?, jama_txn_type = ?, jama_amount = ? WHERE id = ?`)
            .run(payDate, payment_type, paymentAmt, existingPayment.id);
        } else {
          // Create new Jama entry
          db.prepare(`INSERT INTO supplier_jama_account (supplier_id, jama_date, jama_txn_type, jama_amount, jama_remark)
                        VALUES (?, ?, ?, ?, ?)`)
            .run(supplier_id, payDate, payment_type, paymentAmt, paymentRemark);
        }
      } else if (existingPayment) {
        // Payment amount is 0/empty - delete existing Jama entry
        db.prepare('DELETE FROM supplier_jama_account WHERE id = ?').run(existingPayment.id);
      }
    });
    updateTxn();
    return { success: true };
  }));

  ipcMain.handle('supOrders:delete', wrap((order_id) => {
    const txn = db.transaction(() => {
      db.prepare('DELETE FROM supplier_order_items WHERE order_id = ?').run(order_id);
      // NOTE: Do NOT delete Jama entry - advance payment must remain in books per accounting rules
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

  ipcMain.handle('suppliersMaal:get', wrap((id) => {
    const row = db.prepare(`SELECT id, supplier_id, maal_date AS date, maal_invoice_no AS invoiceNumber,
                                    maal_amount AS amount, maal_remark AS remark
                                FROM supplier_maal_account WHERE id = ?`).get(id);
    return row || { error: 'Maal entry not found' };
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

  ipcMain.handle('supplierTransactions:get', wrap((id) => {
    const row = db.prepare(`SELECT id, supplier_id, jama_date AS date, jama_txn_type AS txnType,
                                    jama_amount AS amount, jama_remark AS remark
                                FROM supplier_jama_account WHERE id = ?`).get(id);
    return row || { error: 'Transaction not found' };
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
    // Guard: block deletion if linked to an order payment
    const row = db.prepare('SELECT jama_remark FROM supplier_jama_account WHERE id = ?').get(id);
    if (row && row.jama_remark) {
      if (row.jama_remark.startsWith('Order ')) {
        return { success: false, error: 'Cannot delete: this payment is linked to an order.' };
      }
    }
    const res = db.prepare('DELETE FROM supplier_jama_account WHERE id = ?').run(id);
    return res.changes ? { success: true } : { error: 'Transaction not found' };
  }));

  ipcMain.handle('suppliers:txnList', wrap((supplier_id) => {
    const rows = db.prepare(`SELECT id AS transaction_id, jama_date AS date, jama_txn_type AS txn_type, jama_amount AS amount, jama_remark AS remark FROM supplier_jama_account WHERE supplier_id = ? ORDER BY jama_date DESC, id DESC`).all(supplier_id);
    return rows;
  }));

  // -----------------------
  // Admin-Only Maintenance
  // -----------------------
  // Manual cleanup of soft-deleted products - ONLY triggered by admin action
  // This handler is NOT called automatically on startup
  ipcMain.handle('admin:cleanupSoftDeletedProducts', wrap(() => {
    console.log('[Admin] Starting manual cleanup of soft-deleted products...');

    // Get all soft-deleted products
    const deletedProducts = db.prepare(
      'SELECT code FROM products WHERE is_deleted = 1'
    ).all();

    let deletedCount = 0;
    let skippedCount = 0;

    for (const product of deletedProducts) {
      try {
        // Attempt to hard delete this product
        const result = db.prepare('DELETE FROM products WHERE code = ?').run(product.code);

        if (result.changes > 0) {
          deletedCount++;
          console.log(`[Admin] Deleted product: ${product.code}`);
        }
      } catch (err) {
        // Check if this is a foreign key constraint error
        if (err.code === 'SQLITE_CONSTRAINT_FOREIGNKEY' ||
          err.message.includes('FOREIGN KEY constraint failed')) {
          // Product is referenced in invoices or orders - skip it
          skippedCount++;
          console.log(`[Admin] Skipped product (referenced elsewhere): ${product.code}`);
        } else {
          // Log other errors but continue processing
          skippedCount++;
          console.error(`[Admin] Error deleting product ${product.code}:`, err.message);
        }
        // Continue to next product regardless of error
      }
    }

    console.log(`[Admin] Completed. Deleted: ${deletedCount}, Skipped: ${skippedCount}`);

    return {
      success: true,
      data: {
        deleted: deletedCount,
        skipped: skippedCount,
        total: deletedProducts.length
      }
    };
  }));

  // -----------------------
  // Marathi Transliteration
  // -----------------------

  // Transliterate a single product by code
  ipcMain.handle('translate:toMarathi', wrap(async (code) => {
    if (!code) return { error: 'Product code required' };
    const prod = db.prepare('SELECT code, name, marathi_name FROM products WHERE code = ?').get(code);
    if (!prod) return { error: 'Product not found' };
    if (prod.marathi_name) return { success: true, marathi_name: prod.marathi_name };
    const marathiName = await transliterateToMarathi(prod.name);
    if (!marathiName) return { error: 'Transliteration failed — check internet connection' };
    db.prepare("UPDATE products SET marathi_name = ?, marathi_status = 'transliterated' WHERE code = ?").run(marathiName, code);
    return { success: true, marathi_name: marathiName };
  }));

  // Batch transliterate all products with missing Marathi names
  ipcMain.handle('translate:batchMissing', wrap(async () => {
    const missing = db.prepare(
      "SELECT code, name FROM products WHERE (marathi_name IS NULL OR marathi_name = '') AND (is_deleted = 0 OR is_deleted IS NULL)"
    ).all();
    if (missing.length === 0) return { success: true, translated: 0, total: 0 };
    let translated = 0;
    for (const prod of missing) {
      try {
        const marathiName = await transliterateToMarathi(prod.name);
        if (marathiName) {
          db.prepare("UPDATE products SET marathi_name = ?, marathi_status = 'transliterated' WHERE code = ?").run(marathiName, prod.code);
          translated++;
        }
        // Small delay to avoid rate limiting
        await new Promise(r => setTimeout(r, 100));
      } catch (e) { console.error(`Batch transliterate failed for ${prod.code}:`, e.message); }
    }
    return { success: true, translated, total: missing.length };
  }));

  // Check which product codes are missing Marathi names
  ipcMain.handle('translate:checkMissing', wrap((codes) => {
    if (!Array.isArray(codes) || codes.length === 0) return { missing: [] };
    const placeholders = codes.map(() => '?').join(',');
    const rows = db.prepare(
      `SELECT code FROM products WHERE code IN (${placeholders}) AND (marathi_name IS NULL OR marathi_name = '')`
    ).all(...codes);
    return { missing: rows.map(r => r.code) };
  }));

  // Get Marathi names for a list of product codes
  ipcMain.handle('translate:getMarathiNames', wrap((codes) => {
    if (!Array.isArray(codes) || codes.length === 0) return { names: {} };
    const placeholders = codes.map(() => '?').join(',');
    const rows = db.prepare(
      `SELECT code, marathi_name FROM products WHERE code IN (${placeholders}) AND marathi_name IS NOT NULL AND marathi_name != ''`
    ).all(...codes);
    const names = {};
    for (const r of rows) names[r.code] = r.marathi_name;
    return { names };
  }));
};
