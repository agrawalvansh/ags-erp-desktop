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
      let hasAlphaWords = false;  // tracks if there were words to transliterate
      let anyTranslated = false;  // tracks if at least one word was successfully transliterated
      for (const word of words) {
        // If the word is purely numeric or special chars, keep as-is
        if (/^[^a-zA-Z]+$/.test(word)) {
          result.push(word);
          continue;
        }
        hasAlphaWords = true;
        const url = `https://inputtools.google.com/request?text=${encodeURIComponent(word)}&itc=mr-t-i0-und&num=1`;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        try {
          const res = await fetch(url, { signal: controller.signal });
          clearTimeout(timeout);
          if (!res.ok) { result.push(word); continue; }
          const data = await res.json();
          // Response: ["SUCCESS",[["word",["transliterated",...]]]]
          if (data[0] === 'SUCCESS' && data[1] && data[1][0] && data[1][0][1] && data[1][0][1][0]) {
            result.push(data[1][0][1][0]);
            anyTranslated = true;
          } else {
            result.push(word); // fallback to original
          }
        } catch (fetchErr) {
          clearTimeout(timeout);
          // Network error / abort — signal offline failure
          result.push(word);
          // Don't continue silently — this is likely a connectivity issue
        }
      }
      // If there were words to transliterate but NONE succeeded, it means no internet
      if (hasAlphaWords && !anyTranslated) return null;
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
        ON CONFLICT(code) DO UPDATE SET
            name = excluded.name,
            size = excluded.size,
            packing_type = excluded.packing_type,
            cost_price = excluded.cost_price,
            selling_price = excluded.selling_price,
            is_deleted = 0,
            marathi_name = CASE WHEN products.name IS NOT excluded.name THEN NULL ELSE products.marathi_name END,
            marathi_status = CASE WHEN products.name IS NOT excluded.name THEN NULL ELSE products.marathi_status END
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

  ipcMain.handle('products:update', wrap(async (prod) => {
    const { code, name, size, packing_type, cost_price, selling_price } = prod;

    // Check if name changed to decide whether to re-transliterate
    const existing = db.prepare('SELECT name FROM products WHERE code = ?').get(code);
    const nameChanged = existing && existing.name !== name;

    const res = db.prepare(`
        UPDATE products SET name = ?, size = ?, packing_type = ?, cost_price = ?, selling_price = ? 
        WHERE code = ? AND (is_deleted = 0 OR is_deleted IS NULL)
      `).run(name, size, packing_type, cost_price, selling_price, code);

    if (res.changes && nameChanged) {
      // Name changed — re-transliterate marathi_name (non-blocking)
      try {
        const marathiName = await transliterateToMarathi(name);
        if (marathiName) {
          db.prepare("UPDATE products SET marathi_name = ?, marathi_status = 'transliterated' WHERE code = ?").run(marathiName, code);
        } else {
          db.prepare("UPDATE products SET marathi_name = NULL, marathi_status = NULL WHERE code = ?").run(code);
        }
      } catch (e) { console.error('Marathi re-transliterate failed (non-critical):', e.message); }
    }

    return res.changes ? { success: true } : { error: 'Product not found' };
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
    const { customer_id, name, address, mobile, reminder_enabled, reminder_days } = cust;
    const res = db.prepare('UPDATE customers SET name = ?, address = ?, mobile = ?, reminder_enabled = ?, reminder_days = ? WHERE customer_id = ?')
      .run(name, address, mobile, reminder_enabled ? 1 : 0, reminder_days || 0, customer_id);
    return res.changes ? { success: true } : { error: 'Customer not found' };
  }));

  ipcMain.handle('customers:checkDependencies', wrap((customer_id) => {
    if (!customer_id) return { error: 'Customer ID is required' };
    const maalCount = db.prepare('SELECT COUNT(*) AS cnt FROM customer_maal_account WHERE customer_id = ?').get(customer_id).cnt;
    const jamaCount = db.prepare('SELECT COUNT(*) AS cnt FROM customer_jama_account WHERE customer_id = ?').get(customer_id).cnt;
    const invoiceCount = db.prepare('SELECT COUNT(*) AS cnt FROM invoices WHERE customer_id = ?').get(customer_id).cnt;
    const orderCount = db.prepare('SELECT COUNT(*) AS cnt FROM customer_orders WHERE customer_id = ?').get(customer_id).cnt;
    return { maalCount, jamaCount, invoiceCount, orderCount, hasDependencies: maalCount > 0 || jamaCount > 0 || invoiceCount > 0 || orderCount > 0 };
  }));

  ipcMain.handle('customers:delete', wrap((customer_id) => {
    const res = db.prepare('DELETE FROM customers WHERE customer_id = ?').run(customer_id);
    return res.changes ? { success: true } : { error: 'Customer not found' };
  }));

  // Bulk delete filtered maal + jama entries for a customer
  ipcMain.handle('customers:bulkDeleteEntries', wrap((data) => {
    const { maalRows = [], jamaIds = [] } = data;
    // maalRows: [{ id (maal db id), invoiceId, isLinkedToInvoice }]
    // jamaIds: [transactionId]
    const run = db.transaction(() => {
      let count = 0;
      for (const row of maalRows) {
        if (row.isLinkedToInvoice && row.invoiceId) {
          // Cascade: remove invoice items, then the invoice, then the maal ledger row
          db.prepare('DELETE FROM invoice_items WHERE invoice_id = ?').run(row.invoiceId);
          db.prepare('DELETE FROM invoices WHERE invoice_id = ?').run(row.invoiceId);
        }
        // Delete the maal ledger row (identified by invoiceId for customer_maal_account)
        if (row.invoiceId) {
          const res = db.prepare('DELETE FROM customer_maal_account WHERE maal_invoice_no = ?').run(row.invoiceId);
          count += res.changes;
        } else if (row.id) {
          const res = db.prepare('DELETE FROM customer_maal_account WHERE id = ?').run(row.id);
          count += res.changes;
        }
      }
      for (const jId of jamaIds) {
        const res = db.prepare('DELETE FROM customer_jama_account WHERE id = ?').run(jId);
        count += res.changes;
      }
      return count;
    });
    const deleted = run();
    return { success: true, deletedCount: deleted };
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
  // Invoices
  // -----------------------


  // Helper to get next invoice id - ONLY PREVIEWS, does NOT consume the number
  ipcMain.handle('invoices:getNextId', wrap(() => {
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
        WHERE jama_remark = ?`
    ).get(paymentRemark);

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
      payment_amount = 0, payment_type = 'Cash', payment_date = null,
      invoice_time = null, is_private_note = 0 } = invoice;
    if (!invoice_id || !customer_id || !invoice_date || !Array.isArray(items) || items.length === 0) {
      return { error: 'Missing required fields' };
    }
    const updateTxn = db.transaction(() => {
      const itemsTotal = items.reduce((s, it) => s + it.quantity * it.selling_price, 0);
      const grandTotal = itemsTotal + parseFloat(packing) + parseFloat(freight) + parseFloat(riksha);
      db.prepare(`UPDATE invoices SET customer_id = ?, invoice_date = ?, remark = ?, packing = ?, freight = ?, riksha = ?, grand_total = ?, invoice_time = ?, is_private_note = ? WHERE invoice_id = ?`)
        .run(customer_id, invoice_date, remark, packing, freight, riksha, grandTotal, invoice_time, is_private_note ? 1 : 0, invoice_id);

      // Refresh items
      db.prepare('DELETE FROM invoice_items WHERE invoice_id = ?').run(invoice_id);
      const insertItem = db.prepare('INSERT INTO invoice_items (invoice_id, product_code, quantity, selling_price) VALUES (?, ?, ?, ?)');
      for (const it of items) {
        insertItem.run(invoice_id, it.product_code, it.quantity, it.selling_price);
      }

      // Keep maal mirror row in sync — hide remark if marked private
      const publicRemark = is_private_note ? '' : remark;
      db.prepare(`UPDATE customer_maal_account SET customer_id = ?, maal_date = ?, maal_amount = ?, maal_remark = ? WHERE maal_invoice_no = ?`)
        .run(customer_id, invoice_date, grandTotal, publicRemark, invoice_id);

      // Handle payment/advance (Jama entry management)
      const paymentRemark = `Invoice ${invoice_id}`;
      const existingPayment = db.prepare(
        `SELECT id FROM customer_jama_account WHERE jama_remark = ?`
      ).get(paymentRemark);

      const paymentAmt = parseFloat(payment_amount) || 0;

      if (paymentAmt > 0) {
        const payDate = payment_date || invoice_date;
        if (existingPayment) {
          // Update existing Jama entry
          db.prepare(`UPDATE customer_jama_account SET customer_id = ?, jama_date = ?, jama_txn_type = ?, jama_amount = ? WHERE id = ?`)
            .run(customer_id, payDate, payment_type, paymentAmt, existingPayment.id);
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
              COUNT(oi.id) AS item_count,
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
    // Preview next ID (sequence only)
    const seq = db.prepare("SELECT last_number FROM document_sequences WHERE doc_type = 'customer_order'").get();
    return { next_id: `O-C-${(seq ? seq.last_number : 0) + 1}` };
  }));

  ipcMain.handle('cusOrders:create', wrap((data) => {
    const { customer_id, order_date, remark = '', status = 'Received', items,
      payment_amount = 0, payment_type = 'Cash', payment_date = null } = data;
    if (!customer_id || !order_date || !Array.isArray(items) || items.length === 0) {
      return { error: 'Missing required fields' };
    }

    const ensureProduct = db.prepare('INSERT OR IGNORE INTO products (code, name) VALUES (?, ?)');
    const createTxn = db.transaction(() => {
      // Generate order ID: always increment sequence
      db.prepare("UPDATE document_sequences SET last_number = last_number + 1 WHERE doc_type = 'customer_order'").run();
      const seq = db.prepare("SELECT last_number FROM document_sequences WHERE doc_type = 'customer_order'").get();
      const orderNum = seq.last_number;
      const newOrderId = `O-C-${orderNum}`;

      db.prepare('INSERT INTO customer_orders (order_id, customer_id, order_date, remark, status) VALUES (?, ?, ?, ?, ?)')
        .run(newOrderId, customer_id, order_date, remark, status);

      const insertItem = db.prepare('INSERT INTO customer_order_items (order_id, product_code, product_name, product_size, packing_type, quantity, item_remark, is_temporary) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
      for (const it of items) {
        // Only ensureProduct for non-temporary (DB) products
        if (it.product_code && !it.is_temporary) {
          ensureProduct.run(it.product_code, it.product_code);
        }
        insertItem.run(
          newOrderId,
          it.product_code || null,
          it.product_name || '',
          it.product_size || '',
          it.packing_type || '',
          it.quantity,
          it.item_remark || '',
          it.is_temporary ? 1 : 0
        );
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

      return newOrderId;
    });
    const newOrderId = createTxn();
    return { success: true, order_id: newOrderId };
  }));

  ipcMain.handle('cusOrders:get', wrap((order_id) => {
    const header = db.prepare('SELECT * FROM customer_orders WHERE order_id = ?').get(order_id);
    if (!header) return { error: 'Order not found' };
    const items = db.prepare(`
      SELECT oi.*, p.name AS resolved_name, p.size AS resolved_size, p.packing_type AS resolved_packing_type
      FROM customer_order_items oi
      LEFT JOIN products p ON p.code = oi.product_code AND oi.is_temporary = 0
      WHERE oi.order_id = ?
    `).all(order_id);

    // Check for linked payment (Jama entry with remark "Order {order_id}")
    const paymentRemark = `Order ${order_id}`;
    const linkedPayment = db.prepare(
      `SELECT id, jama_date AS payment_date, jama_txn_type AS payment_type, jama_amount AS payment_amount
        FROM customer_jama_account 
        WHERE jama_remark = ?`
    ).get(paymentRemark);

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
    const orderId = id || order_id;
    if (!orderId || !customer_id || !order_date || !Array.isArray(items) || items.length === 0) {
      return { error: 'Missing required fields' };
    }
    const updateTxn = db.transaction(() => {
      db.prepare('UPDATE customer_orders SET customer_id = ?, order_date = ?, remark = ?, status = ? WHERE order_id = ?')
        .run(customer_id, order_date, remark, status, orderId);
      db.prepare('DELETE FROM customer_order_items WHERE order_id = ?').run(orderId);
      const insertItem = db.prepare('INSERT INTO customer_order_items (order_id, product_code, product_name, product_size, packing_type, quantity, item_remark, is_temporary) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
      const ensureProduct = db.prepare('INSERT OR IGNORE INTO products (code, name) VALUES (?, ?)');
      for (const it of items) {
        if (it.product_code && !it.is_temporary) {
          ensureProduct.run(it.product_code, it.product_code);
        }
        insertItem.run(
          orderId,
          it.product_code || null,
          it.product_name || '',
          it.product_size || '',
          it.packing_type || '',
          it.quantity,
          it.item_remark || '',
          it.is_temporary ? 1 : 0
        );
      }

      // Handle payment/advance (Jama entry management)
      const paymentRemark = `Order ${orderId}`;
      const existingPayment = db.prepare(
        `SELECT id FROM customer_jama_account WHERE jama_remark = ?`
      ).get(paymentRemark);

      const paymentAmt = parseFloat(payment_amount) || 0;

      if (paymentAmt > 0) {
        const payDate = payment_date || order_date;
        if (existingPayment) {
          db.prepare(`UPDATE customer_jama_account SET customer_id = ?, jama_date = ?, jama_txn_type = ?, jama_amount = ? WHERE id = ?`)
            .run(customer_id, payDate, payment_type, paymentAmt, existingPayment.id);
        } else {
          db.prepare(`INSERT INTO customer_jama_account (customer_id, jama_date, jama_txn_type, jama_amount, jama_remark)
                        VALUES (?, ?, ?, ?, ?)`)
            .run(customer_id, payDate, payment_type, paymentAmt, paymentRemark);
        }
      } else if (existingPayment) {
        db.prepare('DELETE FROM customer_jama_account WHERE id = ?').run(existingPayment.id);
      }
    });
    updateTxn();
    return { success: true, order_id: orderId };
  }));

  ipcMain.handle('cusOrders:delete', wrap((data) => {
    // Support both string (order_id) and object { order_id, deletePayment }
    const order_id = typeof data === 'string' ? data : data.order_id;
    const deletePayment = typeof data === 'object' ? !!data.deletePayment : false;

    const txn = db.transaction(() => {
      db.prepare('DELETE FROM customer_order_items WHERE order_id = ?').run(order_id);
      // Conditionally delete linked Jama entry (payment associated with this order)
      if (deletePayment) {
        const paymentRemark = `Order ${order_id}`;
        db.prepare('DELETE FROM customer_jama_account WHERE jama_remark = ?').run(paymentRemark);
      }
      // Delete the order header
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
      payment_amount = 0, payment_type = 'Cash', payment_date = null,
      invoice_time = null, is_private_note = 0 } = data;
    if (!customer_id || !invoice_date || !Array.isArray(items) || items.length === 0) {
      return { error: 'Missing required fields' };
    }

    const insertItemStmt = db.prepare('INSERT INTO invoice_items (invoice_id, product_code, quantity, selling_price) VALUES (?, ?, ?, ?)');
    const createTxn = db.transaction(() => {
      // Generate invoice_id: always last_number + 1
      db.prepare("UPDATE document_sequences SET last_number = last_number + 1 WHERE doc_type = 'invoice'").run();
      const seq = db.prepare("SELECT last_number FROM document_sequences WHERE doc_type = 'invoice'").get();
      const invoiceNum = seq.last_number;

      const invoice_id = `E-${invoiceNum}`;

      const itemsTotal = items.reduce((sum, it) => sum + (it.quantity * it.selling_price), 0);
      const grandTotal = itemsTotal + parseFloat(packing) + parseFloat(freight) + parseFloat(riksha);

      db.prepare(`
          INSERT INTO invoices (invoice_id, customer_id, invoice_date, remark, packing, freight, riksha, grand_total, invoice_time, is_private_note)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(invoice_id, customer_id, invoice_date, remark, packing, freight, riksha, grandTotal, invoice_time, is_private_note ? 1 : 0);

      for (const it of items) {
        insertItemStmt.run(invoice_id, it.product_code, it.quantity, it.selling_price);
      }

      // Create Maal entry — hide remark if marked private
      const publicRemark = is_private_note ? '' : remark;
      db.prepare(`INSERT INTO customer_maal_account (customer_id, maal_date, maal_invoice_no, maal_amount, maal_remark)
                    VALUES (?, ?, ?, ?, ?)`)
        .run(customer_id, invoice_date, invoice_id, grandTotal, publicRemark);

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



  // Hard delete invoice with all related data (invoice_items, customer_maal_account, optionally linked Jama entry)
  ipcMain.handle('invoices:delete', wrap((data) => {
    // Support both string (invoice_id) and object { invoice_id, deletePayment }
    const invoice_id = typeof data === 'string' ? data : data.invoice_id;
    const deletePayment = typeof data === 'object' ? !!data.deletePayment : true; // default true for backward compat
    if (!invoice_id) return { error: 'Invoice ID is required' };

    const deleteTxn = db.transaction(() => {
      // Step 1: Delete all invoice items
      db.prepare('DELETE FROM invoice_items WHERE invoice_id = ?').run(invoice_id);

      // Step 2: Delete related maal entry (matches by maal_invoice_no = invoice_id)
      db.prepare('DELETE FROM customer_maal_account WHERE maal_invoice_no = ?').run(invoice_id);

      // Step 3: Conditionally delete linked Jama entry (payment associated with this invoice)
      if (deletePayment) {
        const paymentRemark = `Invoice ${invoice_id}`;
        db.prepare('DELETE FROM customer_jama_account WHERE jama_remark = ?')
          .run(paymentRemark);
      }

      // Step 4: Delete the invoice header
      const res = db.prepare('DELETE FROM invoices WHERE invoice_id = ?').run(invoice_id);

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
    const seq = db.prepare("SELECT last_number FROM document_sequences WHERE doc_type = 'quick_sale'").get();
    return { next_id: `QS-${(seq.last_number || 0) + 1}` };
  }));

  // Create quick sale (consumes sequence or reusable)
  ipcMain.handle('quickSales:create', wrap((data) => {
    const { qs_date, remark = '', items, qs_time = null, is_private_note = 0 } = data;
    if (!qs_date || !Array.isArray(items) || items.length === 0) return { error: 'Missing required fields' };

    const insertItemStmt = db.prepare('INSERT INTO quick_sale_items (qs_id, product_code, product_name, product_size, packing_type, quantity, selling_price, is_temporary) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');

    const createTxn = db.transaction(() => {
      // Always increment sequence
      db.prepare("UPDATE document_sequences SET last_number = last_number + 1 WHERE doc_type = 'quick_sale'").run();
      const seq = db.prepare("SELECT last_number FROM document_sequences WHERE doc_type = 'quick_sale'").get();
      const num = seq.last_number;
      const qs_id = `QS-${num}`;

      const itemsTotal = items.reduce((s, it) => s + (it.quantity * it.selling_price), 0);
      const roundedTotal = Math.round(itemsTotal);
      db.prepare('INSERT INTO quick_sales (qs_id, qs_date, total, remark, qs_time, is_private_note) VALUES (?, ?, ?, ?, ?, ?)').run(qs_id, qs_date, roundedTotal, remark, qs_time, is_private_note ? 1 : 0);

      for (const it of items) {
        insertItemStmt.run(
          qs_id,
          it.product_code || null,
          it.product_name || '',
          it.product_size || '',
          it.packing_type || '',
          it.quantity,
          it.selling_price,
          it.is_temporary ? 1 : 0
        );
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
    const items = db.prepare(`
      SELECT qi.*, p.name AS resolved_name, p.size AS resolved_size, p.packing_type AS resolved_packing_type
      FROM quick_sale_items qi
      LEFT JOIN products p ON p.code = qi.product_code AND qi.is_temporary = 0
      WHERE qi.qs_id = ?
    `).all(qs_id);
    return { ...header, items };
  }));

  // Update quick sale (header + items)
  ipcMain.handle('quickSales:update', wrap((data) => {
    const { qs_id, qs_date, remark = '', items, qs_time = null, is_private_note = 0 } = data;
    if (!qs_id || !qs_date || !Array.isArray(items) || items.length === 0) return { error: 'Missing required fields' };

    const updateTxn = db.transaction(() => {
      const itemsTotal = items.reduce((s, it) => s + (it.quantity * it.selling_price), 0);
      const roundedTotal = Math.round(itemsTotal);
      const res = db.prepare('UPDATE quick_sales SET qs_date = ?, total = ?, remark = ?, qs_time = ?, is_private_note = ? WHERE qs_id = ?')
        .run(qs_date, roundedTotal, remark, qs_time, is_private_note ? 1 : 0, qs_id);

      if (!res.changes) return 0;

      db.prepare('DELETE FROM quick_sale_items WHERE qs_id = ?').run(qs_id);
      const insertItemStmt = db.prepare('INSERT INTO quick_sale_items (qs_id, product_code, product_name, product_size, packing_type, quantity, selling_price, is_temporary) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
      for (const it of items) {
        insertItemStmt.run(
          qs_id,
          it.product_code || null,
          it.product_name || '',
          it.product_size || '',
          it.packing_type || '',
          it.quantity,
          it.selling_price,
          it.is_temporary ? 1 : 0
        );
      }
      return 1;
    });

    const changed = updateTxn();
    return changed ? { success: true } : { error: 'Quick sale not found' };
  }));

  // Delete quick sale (hard delete items + header)
  ipcMain.handle('quickSales:delete', wrap((qs_id) => {
    if (!qs_id) return { error: 'QS id required' };
    const deleteTxn = db.transaction(() => {
      db.prepare('DELETE FROM quick_sale_items WHERE qs_id = ?').run(qs_id);
      const res = db.prepare('DELETE FROM quick_sales WHERE qs_id = ?').run(qs_id);
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
      db.prepare("UPDATE document_sequences SET last_number = last_number + 1 WHERE doc_type = 'invoice'").run();
      const seq = db.prepare("SELECT last_number FROM document_sequences WHERE doc_type = 'invoice'").get();
      newInvoiceId = `E-${seq.last_number}`;
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
    // Guard: block deletion only if the linked invoice or order still exists
    const row = db.prepare('SELECT jama_remark FROM customer_jama_account WHERE id = ?').get(id);
    if (row && row.jama_remark) {
      if (row.jama_remark.startsWith('Invoice ')) {
        const invoiceId = row.jama_remark.replace('Invoice ', '');
        const invoiceExists = db.prepare('SELECT 1 FROM invoices WHERE invoice_id = ?').get(invoiceId);
        if (invoiceExists) {
          return { success: false, error: 'Cannot delete: this payment is linked to an existing invoice. Delete the invoice first.' };
        }
      }
      if (row.jama_remark.startsWith('Order ')) {
        const orderId = row.jama_remark.replace('Order ', '');
        const orderExists = db.prepare('SELECT 1 FROM customer_orders WHERE order_id = ?').get(orderId);
        if (orderExists) {
          return { success: false, error: 'Cannot delete: this payment is linked to an existing order. Delete the order first.' };
        }
      }
    }
    const res = db.prepare('DELETE FROM customer_jama_account WHERE id = ?').run(id);
    return res.changes ? { success: true } : { error: 'Transaction not found' };
  }));


  // -----------------------
  // Supplier Orders
  // -----------------------
  ipcMain.handle('supOrders:getNextId', wrap(() => {
    // Preview next ID (sequence only)
    const seq = db.prepare("SELECT last_number FROM document_sequences WHERE doc_type = 'supplier_order'").get();
    return { next_id: `O-S-${(seq ? seq.last_number : 0) + 1}` };
  }));

  ipcMain.handle('supOrders:getAll', wrap(() => {
    const rows = db.prepare(`
        SELECT o.order_id,
              o.status,
              o.supplier_id,
              s.name        AS supplier_name,
              o.order_date,
              o.remark,
              COUNT(oi.id) AS item_count,
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

    const ensureProduct = db.prepare('INSERT OR IGNORE INTO products (code, name) VALUES (?, ?)');
    const createTxn = db.transaction(() => {
      // Generate order ID: always increment sequence
      db.prepare("UPDATE document_sequences SET last_number = last_number + 1 WHERE doc_type = 'supplier_order'").run();
      const seq = db.prepare("SELECT last_number FROM document_sequences WHERE doc_type = 'supplier_order'").get();
      const orderNum = seq.last_number;
      const newOrderId = `O-S-${orderNum}`;

      db.prepare('INSERT INTO supplier_orders (order_id, supplier_id, order_date, remark, status) VALUES (?, ?, ?, ?, ?)')
        .run(newOrderId, supplier_id, order_date, remark, status);

      const insertItem = db.prepare('INSERT INTO supplier_order_items (order_id, product_code, product_name, product_size, packing_type, quantity, item_remark, is_temporary) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
      for (const it of items) {
        if (it.product_code && !it.is_temporary) {
          ensureProduct.run(it.product_code, it.product_code);
        }
        insertItem.run(
          newOrderId,
          it.product_code || null,
          it.product_name || '',
          it.product_size || '',
          it.packing_type || '',
          it.quantity,
          it.item_remark || '',
          it.is_temporary ? 1 : 0
        );
      }

      const paymentAmt = parseFloat(payment_amount) || 0;
      if (paymentAmt > 0) {
        const payDate = payment_date || order_date;
        const paymentRemark = `Order ${newOrderId}`;
        db.prepare(`INSERT INTO supplier_jama_account (supplier_id, jama_date, jama_txn_type, jama_amount, jama_remark)
                      VALUES (?, ?, ?, ?, ?)`)
          .run(supplier_id, payDate, payment_type, paymentAmt, paymentRemark);
      }

      return newOrderId;
    });
    const newOrderId = createTxn();
    return { success: true, order_id: newOrderId };
  }));

  ipcMain.handle('supOrders:get', wrap((order_id) => {
    const header = db.prepare('SELECT * FROM supplier_orders WHERE order_id = ?').get(order_id);
    if (!header) return { error: 'Order not found' };
    const items = db.prepare(`
      SELECT oi.*, p.name AS resolved_name, p.size AS resolved_size, p.packing_type AS resolved_packing_type
      FROM supplier_order_items oi
      LEFT JOIN products p ON p.code = oi.product_code AND oi.is_temporary = 0
      WHERE oi.order_id = ?
    `).all(order_id);

    const paymentRemark = `Order ${order_id}`;
    const linkedPayment = db.prepare(
      `SELECT id, jama_date AS payment_date, jama_txn_type AS payment_type, jama_amount AS payment_amount
        FROM supplier_jama_account 
        WHERE jama_remark = ?`
    ).get(paymentRemark);

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
    const { id, order_id, supplier_id, order_date, remark = '', status = 'Placed', items,
      payment_amount = 0, payment_type = 'Cash', payment_date = null } = data;
    const orderId = id || order_id;
    if (!orderId || !supplier_id || !order_date || !Array.isArray(items) || items.length === 0) {
      return { error: 'Missing required fields' };
    }
    const updateTxn = db.transaction(() => {
      db.prepare('UPDATE supplier_orders SET supplier_id = ?, order_date = ?, remark = ?, status = ? WHERE order_id = ?')
        .run(supplier_id, order_date, remark, status, orderId);
      db.prepare('DELETE FROM supplier_order_items WHERE order_id = ?').run(orderId);
      const insertItem = db.prepare('INSERT INTO supplier_order_items (order_id, product_code, product_name, product_size, packing_type, quantity, item_remark, is_temporary) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
      const ensureProduct = db.prepare('INSERT OR IGNORE INTO products (code, name) VALUES (?, ?)');
      for (const it of items) {
        if (it.product_code && !it.is_temporary) {
          ensureProduct.run(it.product_code, it.product_code);
        }
        insertItem.run(
          orderId,
          it.product_code || null,
          it.product_name || '',
          it.product_size || '',
          it.packing_type || '',
          it.quantity,
          it.item_remark || '',
          it.is_temporary ? 1 : 0
        );
      }

      const paymentRemark = `Order ${orderId}`;
      const existingPayment = db.prepare(
        `SELECT id FROM supplier_jama_account WHERE jama_remark = ?`
      ).get(paymentRemark);

      const paymentAmt = parseFloat(payment_amount) || 0;
      if (paymentAmt > 0) {
        const payDate = payment_date || order_date;
        if (existingPayment) {
          db.prepare(`UPDATE supplier_jama_account SET supplier_id = ?, jama_date = ?, jama_txn_type = ?, jama_amount = ? WHERE id = ?`)
            .run(supplier_id, payDate, payment_type, paymentAmt, existingPayment.id);
        } else {
          db.prepare(`INSERT INTO supplier_jama_account (supplier_id, jama_date, jama_txn_type, jama_amount, jama_remark)
                        VALUES (?, ?, ?, ?, ?)`)
            .run(supplier_id, payDate, payment_type, paymentAmt, paymentRemark);
        }
      } else if (existingPayment) {
        db.prepare('DELETE FROM supplier_jama_account WHERE id = ?').run(existingPayment.id);
      }
    });
    updateTxn();
    return { success: true, order_id: orderId };
  }));

  ipcMain.handle('supOrders:delete', wrap((data) => {
    // Support both string (order_id) and object { order_id, deletePayment }
    const order_id = typeof data === 'string' ? data : data.order_id;
    const deletePayment = typeof data === 'object' ? !!data.deletePayment : false;

    const txn = db.transaction(() => {
      db.prepare('DELETE FROM supplier_order_items WHERE order_id = ?').run(order_id);
      // Conditionally delete linked Jama entry (payment associated with this order)
      if (deletePayment) {
        const paymentRemark = `Order ${order_id}`;
        db.prepare('DELETE FROM supplier_jama_account WHERE jama_remark = ?').run(paymentRemark);
      }
      // Delete the order header
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
    const { supplier_id, name, address, mobile, reminder_enabled, reminder_days } = sup;
    const res = db.prepare('UPDATE suppliers SET name = ?, address = ?, mobile = ?, reminder_enabled = ?, reminder_days = ? WHERE supplier_id = ?')
      .run(name, address, mobile, reminder_enabled ? 1 : 0, reminder_days || 0, supplier_id);
    return res.changes ? { success: true } : { error: 'Supplier not found' };
  }));

  ipcMain.handle('suppliers:checkDependencies', wrap((supplier_id) => {
    if (!supplier_id) return { error: 'Supplier ID is required' };
    const maalCount = db.prepare('SELECT COUNT(*) AS cnt FROM supplier_maal_account WHERE supplier_id = ?').get(supplier_id).cnt;
    const jamaCount = db.prepare('SELECT COUNT(*) AS cnt FROM supplier_jama_account WHERE supplier_id = ?').get(supplier_id).cnt;
    const orderCount = db.prepare('SELECT COUNT(*) AS cnt FROM supplier_orders WHERE supplier_id = ?').get(supplier_id).cnt;
    return { maalCount, jamaCount, orderCount, hasDependencies: maalCount > 0 || jamaCount > 0 || orderCount > 0 };
  }));

  ipcMain.handle('suppliers:delete', wrap((supplier_id) => {
    const res = db.prepare('DELETE FROM suppliers WHERE supplier_id = ?').run(supplier_id);
    return res.changes ? { success: true } : { error: 'Supplier not found' };
  }));

  // Bulk delete filtered maal + jama entries for a supplier
  ipcMain.handle('suppliers:bulkDeleteEntries', wrap((data) => {
    const { maalIds = [], maalInvoiceNos = [], jamaIds = [] } = data;
    // maalIds: array of supplier_maal_account.id values
    // maalInvoiceNos: array of supplier_maal_account.maal_invoice_no values (additional delete by invoice number)
    // jamaIds: array of supplier_jama_account.id values
    const run = db.transaction(() => {
      let count = 0;
      for (const id of maalIds) {
        const res = db.prepare('DELETE FROM supplier_maal_account WHERE id = ?').run(id);
        count += res.changes;
      }
      for (const invoiceNo of maalInvoiceNos) {
        const res = db.prepare('DELETE FROM supplier_maal_account WHERE maal_invoice_no = ?').run(invoiceNo);
        count += res.changes;
      }
      for (const id of jamaIds) {
        const res = db.prepare('DELETE FROM supplier_jama_account WHERE id = ?').run(id);
        count += res.changes;
      }
      return count;
    });
    const deleted = run();
    return { success: true, deletedCount: deleted };
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


  // -----------------------
  // Notifications CRUD
  // -----------------------
  ipcMain.handle('notifications:getAll', wrap(() => {
    return db.prepare('SELECT * FROM notifications ORDER BY created_at DESC').all();
  }));

  ipcMain.handle('notifications:getUnreadCount', wrap(() => {
    const row = db.prepare('SELECT COUNT(*) AS count FROM notifications WHERE is_read = 0').get();
    return { count: row.count };
  }));

  ipcMain.handle('notifications:markRead', wrap((id) => {
    const res = db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ?').run(id);
    if (res.changes === 0) {
      const exists = db.prepare('SELECT id FROM notifications WHERE id = ?').get(id);
      if (!exists) return { error: 'Notification not found' };
    }
    return { success: true };
  }));

  ipcMain.handle('notifications:markAllRead', wrap(() => {
    db.prepare('UPDATE notifications SET is_read = 1 WHERE is_read = 0').run();
    return { success: true };
  }));

  ipcMain.handle('notifications:delete', wrap((id) => {
    const res = db.prepare('DELETE FROM notifications WHERE id = ?').run(id);
    return res.changes ? { success: true } : { error: 'Notification not found' };
  }));

  ipcMain.handle('notifications:deleteAll', wrap(() => {
    db.prepare('DELETE FROM notifications').run();
    return { success: true };
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

  // Transliterate a raw product name string (no DB lookup — for ad-hoc/temporary items)
  ipcMain.handle('translate:nameToMarathi', wrap(async (name) => {
    if (!name || !name.trim()) return { error: 'Product name required' };
    const marathiName = await transliterateToMarathi(name.trim());
    if (!marathiName) return { error: 'Transliteration failed — check internet connection' };
    return { success: true, marathi_name: marathiName };
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
  // ── Authentication ──────────────────────────────────────

  ipcMain.handle('auth:login', (_, { username, password }) => {
    try {
      const crypto = require('crypto');
      const hash = crypto.createHash('sha256').update(password).digest('hex');
      const user = db.prepare(
        'SELECT id FROM users WHERE username = ? AND password_hash = ?'
      ).get(username, hash);
      return { success: !!user };
    } catch (err) {
      console.error('auth:login error:', err);
      return { success: false };
    }
  });
};
