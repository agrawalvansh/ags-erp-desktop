# AGS ERP — Invoice Status + Multi-Payment Implementation

> Work through phases 1–8 strictly in order.
> Complete each phase verification before moving to the next.
> DO NOT skip ahead. DO NOT change files outside the current phase scope.

---

## WHAT WE ARE BUILDING

1. Multiple payments per invoice (replacing single payment upsert)
2. Invoice status column: awaiting_payment → partially_paid → paid → overdue
3. Payment due days per invoice (defaulting from customer reminder_days)
4. Link to Invoice option in AddAccountEntry form
5. Status badges in Invoice list, Invoice top bar, and BuyerAccountDetail
6. Per-invoice overdue notifications (replacing total-balance notification)

---

## ARCHITECTURE DECISIONS — READ BEFORE STARTING

**Payments are now separate rows:**
Each payment for an invoice is an independent row in `customer_jama_account`
with `linked_invoice_id` set. There is no longer a single "the payment" for
an invoice. This means:
- Invoice page shows a list of payments, not one payment form
- Add / Edit / Delete per payment entry
- Status is always recalculated from SUM of all linked payments

**Status is stored, not calculated:**
`invoices.status` is a real column, updated every time a payment changes.
This allows fast filtering and sorting on the invoice list without joins.

**Overdue rule:**
Status = overdue ONLY when ALL of:
- Invoice is not paid (totalPaid < grand_total)
- customer.reminder_enabled = 1
- invoice.payment_due_days > 0
- today > invoice_date + payment_due_days days

If payment_due_days = 0, overdue never triggers regardless of reminder_enabled.

**Delete cascade:**
Deleting an invoice deletes ALL linked jama entries
WHERE linked_invoice_id = invoice_id (not by remark text anymore).

---

## STATUS VALUES (exact strings stored in DB)

| Value | Display | Badge colour |
|---|---|---|
| `awaiting_payment` | Awaiting Payment | blue-100 / blue-700 |
| `partially_paid` | Partially Paid | amber-100 / amber-700 |
| `paid` | Paid | emerald-100 / emerald-700 |
| `overdue` | Overdue | red-100 / text-[#BA1A1A] |

---

## PHASE 1 — Database Schema Changes (db.js only)

Open `db.js`. Find the migrations section (after the Users table, before module.exports).
Add the following migration block. These are idempotent — safe to run on every startup.

```js
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
// Extract the invoice ID and set linked_invoice_id
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
```

### PHASE 1 VERIFICATION

```bash
npm run dev
```

Check the startup logs for:
- `[Migration] Added invoices.status column`       (first run only)
- `[Migration] Added invoices.payment_due_days column`  (first run only)
- `[Migration] Added customer_jama_account.linked_invoice_id column`  (first run only)
- `[Migration] Backfilled linked_invoice_id for N jama entries`

On second run, none of these should print (migration already done).
App should launch normally with no errors.

---

## PHASE 2 — Add recalculateInvoiceStatus Helper (ipcHandlers.js)

Open `ipcHandlers.js`. At the TOP of the file, after all requires,
add this helper function BEFORE any ipcMain.handle calls.
This is a plain function, not a handler. It will be called by multiple handlers.

```js
// ─── Invoice Status Helper ────────────────────────────────────────────────
/**
 * Recalculates and saves the correct status for an invoice.
 * Called any time payments or invoice total change.
 * Returns the new status string.
 */
function recalculateInvoiceStatus(invoice_id) {
  const invoice = db.prepare(`
    SELECT i.grand_total, i.invoice_date, i.payment_due_days, i.customer_id,
           c.reminder_enabled
    FROM invoices i
    JOIN customers c ON c.customer_id = i.customer_id
    WHERE i.invoice_id = ?
  `).get(invoice_id)

  if (!invoice) return null

  const { total_paid } = db.prepare(`
    SELECT COALESCE(SUM(jama_amount), 0) AS total_paid
    FROM customer_jama_account
    WHERE linked_invoice_id = ?
  `).get(invoice_id)

  let status

  if (total_paid >= invoice.grand_total && invoice.grand_total > 0) {
    status = 'paid'
  } else if (total_paid > 0) {
    status = 'partially_paid'
  } else if (
    invoice.reminder_enabled === 1 &&
    invoice.payment_due_days > 0
  ) {
    const invoiceDate = new Date(invoice.invoice_date)
    const dueDate = new Date(invoiceDate)
    dueDate.setDate(dueDate.getDate() + invoice.payment_due_days)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    dueDate.setHours(0, 0, 0, 0)
    status = today > dueDate ? 'overdue' : 'awaiting_payment'
  } else {
    status = 'awaiting_payment'
  }

  db.prepare('UPDATE invoices SET status = ? WHERE invoice_id = ?')
    .run(status, invoice_id)

  return status
}
// ─────────────────────────────────────────────────────────────────────────
```

### PHASE 2 VERIFICATION

```bash
npm run dev
```

App launches normally. No verification beyond no errors — this function
is not yet called by anything.

---

## PHASE 3 — Update Existing Invoice Handlers (ipcHandlers.js)

Make the following changes to the three existing invoice handlers.

---

### 3A — invoices:create

Find the `ipcMain.handle('invoices:create', ...)` handler.

**Changes:**
1. Accept `payment_due_days = 0` in the destructured params
2. Add `payment_due_days` to the INSERT statement
3. Add `status = 'awaiting_payment'` to the INSERT
4. When creating a jama entry for initial payment, add `linked_invoice_id = invoice_id`
5. After transaction, call `recalculateInvoiceStatus(invoice_id)`

Replace the handler with:

```js
ipcMain.handle('invoices:create', wrap((data) => {
  const {
    customer_id, invoice_date, remark = '', packing = 0, freight = 0, riksha = 0,
    items, payment_amount = 0, payment_type = 'Cash', payment_date = null,
    invoice_time = null, is_private_note = 0, payment_due_days = 0
  } = data

  if (!customer_id || !invoice_date || !Array.isArray(items) || items.length === 0) {
    return { error: 'Missing required fields' }
  }

  const insertItemStmt = db.prepare(
    'INSERT INTO invoice_items (invoice_id, product_code, quantity, selling_price) VALUES (?, ?, ?, ?)'
  )

  const createTxn = db.transaction(() => {
    db.prepare("UPDATE document_sequences SET last_number = last_number + 1 WHERE doc_type = 'invoice'").run()
    const seq = db.prepare("SELECT last_number FROM document_sequences WHERE doc_type = 'invoice'").get()
    const invoice_id = `E-${seq.last_number}`

    const itemsTotal = items.reduce((sum, it) => sum + (it.quantity * it.selling_price), 0)
    const grandTotal = itemsTotal + parseFloat(packing) + parseFloat(freight) + parseFloat(riksha)

    db.prepare(`
      INSERT INTO invoices
        (invoice_id, customer_id, invoice_date, remark, packing, freight, riksha,
         grand_total, invoice_time, is_private_note, status, payment_due_days)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'awaiting_payment', ?)
    `).run(
      invoice_id, customer_id, invoice_date, remark, packing, freight, riksha,
      grandTotal, invoice_time, is_private_note ? 1 : 0, payment_due_days
    )

    for (const it of items) {
      insertItemStmt.run(invoice_id, it.product_code, it.quantity, it.selling_price)
    }

    const publicRemark = is_private_note ? '' : remark
    db.prepare(`
      INSERT INTO customer_maal_account
        (customer_id, maal_date, maal_invoice_no, maal_amount, maal_remark)
      VALUES (?, ?, ?, ?, ?)
    `).run(customer_id, invoice_date, invoice_id, grandTotal, publicRemark)

    // Initial payment — creates a linked jama entry
    const paymentAmt = parseFloat(payment_amount) || 0
    if (paymentAmt > 0) {
      const payDate = payment_date || invoice_date
      db.prepare(`
        INSERT INTO customer_jama_account
          (customer_id, jama_date, jama_txn_type, jama_amount, jama_remark, linked_invoice_id)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        customer_id, payDate, payment_type, paymentAmt,
        `Invoice ${invoice_id}`, invoice_id
      )
    }

    return invoice_id
  })

  const invoice_id = createTxn()
  // Recalculate status after creation (handles initial payment)
  recalculateInvoiceStatus(invoice_id)
  return { success: true, invoice_id }
}))
```

---

### 3B — invoices:get

Find the `ipcMain.handle('invoices:get', ...)` handler.

Replace it entirely. The key changes:
- Return ALL linked payments (not just one)
- Return status and payment_due_days
- Remove the single linkedPayment lookup

```js
ipcMain.handle('invoices:get', wrap((invoice_id) => {
  const header = db.prepare('SELECT * FROM invoices WHERE invoice_id = ?').get(invoice_id)
  if (!header) return { error: 'Invoice not found' }

  const items = db.prepare(`
    SELECT ii.invoice_id, ii.product_code, ii.quantity, ii.selling_price,
           p.name AS product_name, p.size AS size, p.packing_type AS packing_type
    FROM invoice_items ii
    LEFT JOIN products p ON p.code = ii.product_code
    WHERE ii.invoice_id = ?
  `).all(invoice_id)

  // Fetch ALL payments linked to this invoice
  const payments = db.prepare(`
    SELECT id, jama_date AS payment_date, jama_txn_type AS payment_type,
           jama_amount AS payment_amount, jama_remark AS remark
    FROM customer_jama_account
    WHERE linked_invoice_id = ?
    ORDER BY jama_date ASC
  `).all(invoice_id)

  const totalPaid = payments.reduce((sum, p) => sum + p.payment_amount, 0)

  return {
    ...header,
    payments,        // array of all payment entries
    total_paid: totalPaid,
    balance_due: Math.max(0, header.grand_total - totalPaid)
  }
}))
```

---

### 3C — invoices:update

Find the `ipcMain.handle('invoices:update', ...)` handler.

Key changes:
- Accept `payment_due_days` param
- Update `payment_due_days` in DB
- REMOVE all payment upsert/delete logic (payments managed separately now)
- Call `recalculateInvoiceStatus` after update (total may have changed)

```js
ipcMain.handle('invoices:update', wrap((invoice) => {
  const {
    id: invoice_id, customer_id, invoice_date, remark = '',
    packing = 0, freight = 0, riksha = 0, items,
    invoice_time = null, is_private_note = 0, payment_due_days = 0
  } = invoice

  if (!invoice_id || !customer_id || !invoice_date || !Array.isArray(items) || items.length === 0) {
    return { error: 'Missing required fields' }
  }

  const updateTxn = db.transaction(() => {
    const itemsTotal = items.reduce((s, it) => s + it.quantity * it.selling_price, 0)
    const grandTotal = itemsTotal + parseFloat(packing) + parseFloat(freight) + parseFloat(riksha)

    db.prepare(`
      UPDATE invoices
      SET customer_id = ?, invoice_date = ?, remark = ?, packing = ?, freight = ?,
          riksha = ?, grand_total = ?, invoice_time = ?, is_private_note = ?,
          payment_due_days = ?
      WHERE invoice_id = ?
    `).run(
      customer_id, invoice_date, remark, packing, freight, riksha,
      grandTotal, invoice_time, is_private_note ? 1 : 0,
      payment_due_days, invoice_id
    )

    db.prepare('DELETE FROM invoice_items WHERE invoice_id = ?').run(invoice_id)
    const insertItem = db.prepare(
      'INSERT INTO invoice_items (invoice_id, product_code, quantity, selling_price) VALUES (?, ?, ?, ?)'
    )
    for (const it of items) {
      insertItem.run(invoice_id, it.product_code, it.quantity, it.selling_price)
    }

    const publicRemark = is_private_note ? '' : remark
    db.prepare(`
      UPDATE customer_maal_account
      SET customer_id = ?, maal_date = ?, maal_amount = ?, maal_remark = ?
      WHERE maal_invoice_no = ?
    `).run(customer_id, invoice_date, grandTotal, publicRemark, invoice_id)
  })

  updateTxn()
  // Grand total may have changed — recalculate status
  recalculateInvoiceStatus(invoice_id)
  return { success: true }
}))
```

---

### 3D — invoices:delete

Find the `ipcMain.handle('invoices:delete', ...)` handler.

Change Step 3 to delete by `linked_invoice_id` instead of remark text:

```js
// Step 3: Delete ALL linked jama payment entries for this invoice
db.prepare('DELETE FROM customer_jama_account WHERE linked_invoice_id = ?').run(invoice_id)
```

Remove the old remark-based delete:
```js
// DELETE THIS old line:
// const paymentRemark = `Invoice ${invoice_id}`
// db.prepare('DELETE FROM customer_jama_account WHERE jama_remark = ?').run(paymentRemark)
```

Also remove the `deletePayment` conditional — always delete linked payments when invoice is deleted.
Keep Steps 1, 2, and 4 exactly as they are.

---

### PHASE 3 VERIFICATION

```bash
npm run dev
```

1. Open an existing invoice — it should load without error
2. Create a new invoice — it should save without error
3. Update an existing invoice — it should save without error
4. Check terminal — no SQL errors

---

## PHASE 4 — New Payment CRUD + Supporting Handlers (ipcHandlers.js)

Add these new handlers in ipcHandlers.js in a clearly marked section:

```js
// ════════════════════════════════════════════════════════════════════════════
// INVOICE PAYMENT HANDLERS
// ════════════════════════════════════════════════════════════════════════════

// Add a payment entry linked to an invoice
ipcMain.handle('invoices:addPayment', wrap((data) => {
  const { invoice_id, customer_id, payment_amount, payment_type, payment_date, remark } = data

  if (!invoice_id || !customer_id || !payment_amount || !payment_date) {
    return { error: 'Missing required payment fields' }
  }

  const amt = parseFloat(payment_amount)
  if (isNaN(amt) || amt <= 0) return { error: 'Invalid payment amount' }

  // Verify invoice exists and belongs to this customer
  const invoice = db.prepare(
    'SELECT invoice_id FROM invoices WHERE invoice_id = ? AND customer_id = ?'
  ).get(invoice_id, customer_id)
  if (!invoice) return { error: 'Invoice not found' }

  db.prepare(`
    INSERT INTO customer_jama_account
      (customer_id, jama_date, jama_txn_type, jama_amount, jama_remark, linked_invoice_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    customer_id, payment_date, payment_type, amt,
    remark || `Invoice ${invoice_id}`,
    invoice_id
  )

  const newStatus = recalculateInvoiceStatus(invoice_id)
  return { success: true, new_status: newStatus }
}))

// Update a specific payment entry
ipcMain.handle('invoices:updatePayment', wrap((data) => {
  const { payment_id, invoice_id, payment_amount, payment_type, payment_date, remark } = data

  if (!payment_id || !invoice_id) return { error: 'Missing payment_id or invoice_id' }

  const amt = parseFloat(payment_amount)
  if (isNaN(amt) || amt <= 0) return { error: 'Invalid payment amount' }

  const existing = db.prepare(
    'SELECT id, linked_invoice_id FROM customer_jama_account WHERE id = ?'
  ).get(payment_id)

  if (!existing) return { error: 'Payment not found' }
  if (existing.linked_invoice_id !== invoice_id) return { error: 'Payment does not belong to this invoice' }

  db.prepare(`
    UPDATE customer_jama_account
    SET jama_date = ?, jama_txn_type = ?, jama_amount = ?, jama_remark = ?
    WHERE id = ?
  `).run(payment_date, payment_type, amt, remark || `Invoice ${invoice_id}`, payment_id)

  const newStatus = recalculateInvoiceStatus(invoice_id)
  return { success: true, new_status: newStatus }
}))

// Delete a specific payment entry
ipcMain.handle('invoices:deletePayment', wrap((data) => {
  const { payment_id, invoice_id } = data

  if (!payment_id || !invoice_id) return { error: 'Missing payment_id or invoice_id' }

  const existing = db.prepare(
    'SELECT id, linked_invoice_id FROM customer_jama_account WHERE id = ?'
  ).get(payment_id)

  if (!existing) return { error: 'Payment not found' }
  if (existing.linked_invoice_id !== invoice_id) return { error: 'Payment does not belong to this invoice' }

  db.prepare('DELETE FROM customer_jama_account WHERE id = ?').run(payment_id)

  const newStatus = recalculateInvoiceStatus(invoice_id)
  return { success: true, new_status: newStatus }
}))

// Fetch unpaid/partially paid invoices for a customer (for AddAccountEntry dropdown)
ipcMain.handle('invoices:getUnpaidByCustomer', wrap((customer_id) => {
  if (!customer_id) return []
  return db.prepare(`
    SELECT invoice_id, invoice_date, grand_total, status,
           COALESCE(
             (SELECT SUM(jama_amount) FROM customer_jama_account
              WHERE linked_invoice_id = invoices.invoice_id),
             0
           ) AS total_paid
    FROM invoices
    WHERE customer_id = ?
    AND status IN ('awaiting_payment', 'partially_paid', 'overdue')
    ORDER BY invoice_date DESC
  `).all(customer_id)
}))

// Recalculate overdue status for all non-paid invoices (called on app startup)
ipcMain.handle('invoices:refreshOverdueStatuses', wrap(() => {
  const nonPaidInvoices = db.prepare(`
    SELECT invoice_id FROM invoices
    WHERE status IN ('awaiting_payment', 'partially_paid', 'overdue')
  `).all()

  let updatedCount = 0
  for (const inv of nonPaidInvoices) {
    const oldStatus = db.prepare('SELECT status FROM invoices WHERE invoice_id = ?')
      .get(inv.invoice_id)?.status
    const newStatus = recalculateInvoiceStatus(inv.invoice_id)
    if (newStatus !== oldStatus) updatedCount++
  }

  return { success: true, updated: updatedCount }
}))

// ════════════════════════════════════════════════════════════════════════════
```

---

## PHASE 5 — Update Account Transaction Handlers (ipcHandlers.js)

Find the existing `customers:txnCreate` and `customers:txnUpdate` and
`customers:txnDelete` handlers.

### 5A — customers:txnCreate

Add `linked_invoice_id = null` to the destructured params.
Add it to the INSERT statement.
After successful insert, if `linked_invoice_id` is not null, call
`recalculateInvoiceStatus(linked_invoice_id)`.

```js
// In customers:txnCreate, add to destructuring:
const { customer_id, jama_date, jama_txn_type, jama_amount, jama_remark,
        linked_invoice_id = null } = data

// In the INSERT statement, add linked_invoice_id column and value:
db.prepare(`
  INSERT INTO customer_jama_account
    (customer_id, jama_date, jama_txn_type, jama_amount, jama_remark, linked_invoice_id)
  VALUES (?, ?, ?, ?, ?, ?)
`).run(customer_id, jama_date, jama_txn_type, jama_amount, jama_remark, linked_invoice_id)

// After insert, recalculate if linked:
if (linked_invoice_id) {
  recalculateInvoiceStatus(linked_invoice_id)
}
```

### 5B — customers:txnUpdate

After updating the jama entry, if the entry has a `linked_invoice_id`,
call `recalculateInvoiceStatus`.

```js
// After the UPDATE statement, add:
const updated = db.prepare(
  'SELECT linked_invoice_id FROM customer_jama_account WHERE id = ?'
).get(id)
if (updated?.linked_invoice_id) {
  recalculateInvoiceStatus(updated.linked_invoice_id)
}
```

### 5C — customers:txnDelete

Before deleting, check if the entry has a `linked_invoice_id`.
After deleting, recalculate that invoice's status.

```js
// Before delete, get the linked invoice:
const toDelete = db.prepare(
  'SELECT linked_invoice_id FROM customer_jama_account WHERE id = ?'
).get(id)

// After delete:
if (toDelete?.linked_invoice_id) {
  recalculateInvoiceStatus(toDelete.linked_invoice_id)
}
```

---

## PHASE 6 — Preload + main.cjs

### 6A — preload.js

Add to the contextBridge.exposeInMainWorld object:

```js
// Invoice payment methods
invoiceAddPayment:      (data)        => ipcRenderer.invoke('invoices:addPayment', data),
invoiceUpdatePayment:   (data)        => ipcRenderer.invoke('invoices:updatePayment', data),
invoiceDeletePayment:   (data)        => ipcRenderer.invoke('invoices:deletePayment', data),
invoiceGetUnpaid:       (customer_id) => ipcRenderer.invoke('invoices:getUnpaidByCustomer', customer_id),
invoiceRefreshOverdue:  ()            => ipcRenderer.invoke('invoices:refreshOverdueStatuses'),
```

### 6B — main.cjs

Find the app startup section where `db.cleanupSoftDeletedProducts` was referenced
(or the notification scan section). Add this call on app ready, after the window is created:

```js
// Refresh overdue invoice statuses on every app launch
// Non-blocking — uses setTimeout so it doesn't delay window show
setTimeout(async () => {
  try {
    const result = await ipcHandlers // call directly via db since we're in main
    // Instead, call the function directly (it's in ipcHandlers scope):
    // Import the recalculate function or run the query directly here
    const nonPaid = db.prepare(`
      SELECT i.invoice_id, i.invoice_date, i.payment_due_days,
             i.grand_total, c.reminder_enabled
      FROM invoices i
      JOIN customers c ON c.customer_id = i.customer_id
      WHERE i.status IN ('awaiting_payment', 'partially_paid', 'overdue')
    `).all()

    for (const inv of nonPaid) {
      if (inv.reminder_enabled !== 1 || inv.payment_due_days <= 0) continue
      const dueDate = new Date(inv.invoice_date)
      dueDate.setDate(dueDate.getDate() + inv.payment_due_days)
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      dueDate.setHours(0, 0, 0, 0)
      if (today > dueDate) {
        db.prepare(`UPDATE invoices SET status = 'overdue' WHERE invoice_id = ?`)
          .run(inv.invoice_id)
      }
    }
  } catch (err) {
    console.error('Overdue status refresh error:', err)
  }
}, 2000)
```

### PHASE 6 VERIFICATION

```bash
npm run dev
```

In DevTools console:
```js
typeof window.api.invoiceAddPayment     // "function"
typeof window.api.invoiceGetUnpaid      // "function"
```

---

## PHASE 7 — Invoice.jsx UI Changes

### 7A — Add payment_due_days field

In the top bar / date area of Invoice.jsx, after the date input,
add a "Payment Due Days" field that:
- Shows when a customer is selected
- Auto-fills from `customer.reminder_days` when customer is selected
- Can be overridden by the user
- Sends `payment_due_days` in both create and update calls

Find where customer is selected (likely in a useEffect or handler that
fetches customer data). Add:
```js
setPaymentDueDays(customer.reminder_days || 0)
```

Add state: `const [paymentDueDays, setPaymentDueDays] = useState(0)`

Add to form:
```jsx
{selectedCustomer && (
  <div className="flex items-center gap-2">
    <label className="text-xs font-medium text-[#64748B] uppercase tracking-wider whitespace-nowrap">
      Due Days
    </label>
    <input
      type="number"
      min={0}
      value={paymentDueDays}
      onChange={e => setPaymentDueDays(parseInt(e.target.value) || 0)}
      className="w-16 text-sm font-semibold text-[#0F172A] border border-[#E2E8F0]
                 rounded-md px-2 py-1 text-center"
    />
  </div>
)}
```

### 7B — Status badge in top bar

After the invoice ID reference value in the top bar, show the status badge.
Load status from the invoice data when editing an existing invoice.

```jsx
{invoiceId && invoiceStatus && (
  <span className={`
    px-2.5 py-1 rounded-full text-xs font-bold
    ${invoiceStatus === 'paid'
      ? 'bg-emerald-100 text-emerald-700'
      : invoiceStatus === 'partially_paid'
      ? 'bg-amber-100 text-amber-700'
      : invoiceStatus === 'overdue'
      ? 'bg-red-100 text-[#BA1A1A]'
      : 'bg-blue-100 text-blue-700'}
  `}>
    {invoiceStatus === 'awaiting_payment' ? 'Awaiting Payment'
      : invoiceStatus === 'partially_paid' ? 'Partially Paid'
      : invoiceStatus === 'paid' ? 'Paid'
      : 'Overdue'}
  </span>
)}
```

### 7C — Replace Payment Details section

Find the existing "Payment Details" section in Invoice.jsx.
It currently has:
- One payment amount input
- Payment type selector (Cash/UPI/Transfer/RTGS)
- Pay date input

Replace the ENTIRE section with a multi-payment system:

**State to add:**
```js
const [payments, setPayments] = useState([])      // loaded payments
const [totalPaid, setTotalPaid] = useState(0)
const [balanceDue, setBalanceDue] = useState(0)
const [invoiceStatus, setInvoiceStatus] = useState('awaiting_payment')

// Payment form state (for add/edit)
const [showPaymentForm, setShowPaymentForm] = useState(false)
const [editingPayment, setEditingPayment] = useState(null) // null = add, object = edit
const [payForm, setPayForm] = useState({
  payment_amount: '',
  payment_type: 'Cash',
  payment_date: new Date().toISOString().split('T')[0],
  remark: ''
})
```

**When invoice loads (invoices:get response), populate:**
```js
setPayments(data.payments || [])
setTotalPaid(data.total_paid || 0)
setBalanceDue(data.balance_due || 0)
setInvoiceStatus(data.status || 'awaiting_payment')
setPaymentDueDays(data.payment_due_days || 0)
```

**Payment Details UI:**
```jsx
{/* Payment Details — only shown when editing an existing invoice */}
{invoiceId && (
  <section className="bg-white rounded-xl border border-[#C3C6D7]/10 shadow-sm overflow-hidden">
    {/* Header */}
    <div className="px-6 py-4 bg-[#F2F4F6]/50 border-b border-[#C3C6D7]/10
                    flex items-center justify-between">
      <div>
        <h3 className="text-sm font-bold text-[#191C1E]">Payment History</h3>
        <p className="text-xs text-[#64748B] mt-0.5">
          Paid: <strong className="text-[#0F172A]">₹{totalPaid.toFixed(2)}</strong>
          {' · '}
          Balance: <strong className={balanceDue > 0 ? 'text-[#BA1A1A]' : 'text-emerald-600'}>
            ₹{balanceDue.toFixed(2)}
          </strong>
        </p>
      </div>
      {invoiceStatus !== 'paid' && (
        <button
          type="button"
          onClick={() => {
            setEditingPayment(null)
            setPayForm({
              payment_amount: balanceDue > 0 ? balanceDue.toFixed(2) : '',
              payment_type: 'Cash',
              payment_date: new Date().toISOString().split('T')[0],
              remark: ''
            })
            setShowPaymentForm(true)
          }}
          className="px-4 py-2 bg-gradient-to-br from-[#004AC6] to-[#2563EB]
                     text-white text-xs font-bold rounded-lg
                     shadow-lg shadow-[#004AC6]/20 active:scale-95 transition-all"
        >
          + Add Payment
        </button>
      )}
    </div>

    {/* Payment list */}
    {payments.length === 0 ? (
      <div className="px-6 py-8 text-center">
        <p className="text-sm text-[#64748B]">No payments recorded yet</p>
      </div>
    ) : (
      <table className="w-full">
        <thead>
          <tr className="bg-[#F2F4F6]">
            <th className="py-3 px-6 text-left text-[10px] font-extrabold text-[#434655] uppercase tracking-wider">Date</th>
            <th className="py-3 px-6 text-left text-[10px] font-extrabold text-[#434655] uppercase tracking-wider">Type</th>
            <th className="py-3 px-6 text-right text-[10px] font-extrabold text-[#434655] uppercase tracking-wider">Amount</th>
            <th className="py-3 px-6 text-left text-[10px] font-extrabold text-[#434655] uppercase tracking-wider">Remark</th>
            <th className="py-3 px-6" />
          </tr>
        </thead>
        <tbody className="divide-y divide-[#ECEEF0]">
          {payments.map(pay => (
            <tr key={pay.id} className="hover:bg-[#F2F4F6]/50 transition-colors">
              <td className="py-3 px-6 text-sm text-[#64748B]">{pay.payment_date}</td>
              <td className="py-3 px-6">
                <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5
                                 rounded text-[10px] font-bold">
                  {pay.payment_type}
                </span>
              </td>
              <td className="py-3 px-6 text-right text-sm font-semibold text-[#2563EB]">
                ₹{pay.payment_amount.toFixed(2)}
              </td>
              <td className="py-3 px-6 text-sm text-[#64748B]">{pay.remark}</td>
              <td className="py-3 px-6">
                <div className="flex items-center justify-end gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingPayment(pay)
                      setPayForm({
                        payment_amount: pay.payment_amount.toString(),
                        payment_type: pay.payment_type,
                        payment_date: pay.payment_date,
                        remark: pay.remark || ''
                      })
                      setShowPaymentForm(true)
                    }}
                    className="p-2 rounded-full text-[#434655] hover:text-[#004AC6]
                               hover:bg-white hover:shadow-sm transition-all"
                  >
                    <SquarePen size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeletePayment(pay.id)}
                    className="p-2 rounded-full text-[#434655] hover:text-[#DC2626]
                               hover:bg-white hover:shadow-sm transition-all"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    )}

    {/* Add/Edit payment inline form */}
    {showPaymentForm && (
      <div className="px-6 py-4 bg-[#F8FAFC] border-t border-[#E2E8F0]">
        <p className="text-xs font-bold text-[#434655] uppercase tracking-wider mb-3">
          {editingPayment ? 'Edit Payment' : 'New Payment'}
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label className="text-[10px] font-bold text-[#434655] uppercase mb-1.5 ml-1 block">
              Amount
            </label>
            <input
              type="number"
              value={payForm.payment_amount}
              onChange={e => setPayForm(p => ({ ...p, payment_amount: e.target.value }))}
              className="w-full py-2.5 px-3 bg-[#F2F4F6] border-none rounded-lg text-sm
                         focus:bg-white focus:ring-2 focus:ring-[#004AC6]/15 transition-all"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-[#434655] uppercase mb-1.5 ml-1 block">
              Type
            </label>
            <select
              value={payForm.payment_type}
              onChange={e => setPayForm(p => ({ ...p, payment_type: e.target.value }))}
              className="w-full py-2.5 px-3 bg-[#F2F4F6] border-none rounded-lg text-sm
                         focus:bg-white focus:ring-2 focus:ring-[#004AC6]/15 transition-all"
            >
              <option>Cash</option>
              <option>UPI</option>
              <option>Transfer</option>
              <option>RTGS</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold text-[#434655] uppercase mb-1.5 ml-1 block">
              Date
            </label>
            <input
              type="date"
              value={payForm.payment_date}
              onChange={e => setPayForm(p => ({ ...p, payment_date: e.target.value }))}
              className="w-full py-2.5 px-3 bg-[#F2F4F6] border-none rounded-lg text-sm
                         focus:bg-white focus:ring-2 focus:ring-[#004AC6]/15 transition-all"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-[#434655] uppercase mb-1.5 ml-1 block">
              Remark
            </label>
            <input
              type="text"
              value={payForm.remark}
              onChange={e => setPayForm(p => ({ ...p, remark: e.target.value }))}
              placeholder="Optional"
              className="w-full py-2.5 px-3 bg-[#F2F4F6] border-none rounded-lg text-sm
                         focus:bg-white focus:ring-2 focus:ring-[#004AC6]/15 transition-all"
            />
          </div>
        </div>
        <div className="flex gap-2 mt-3">
          <button
            type="button"
            onClick={handleSavePayment}
            className="px-5 py-2 text-white font-bold text-xs rounded-lg
                       shadow-lg shadow-[#004AC6]/20 active:scale-95 transition-all"
            style={{ background: 'linear-gradient(135deg, #004AC6 0%, #2563EB 100%)' }}
          >
            {editingPayment ? 'Update Payment' : 'Save Payment'}
          </button>
          <button
            type="button"
            onClick={() => { setShowPaymentForm(false); setEditingPayment(null) }}
            className="px-5 py-2 bg-[#E6E8EA] text-[#191C1E] font-bold text-xs
                       rounded-lg hover:bg-[#E0E3E5] transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    )}
  </section>
)}
```

**Handler functions to add in Invoice.jsx:**
```js
async function handleSavePayment() {
  const amt = parseFloat(payForm.payment_amount)
  if (!amt || amt <= 0) { toast.error('Enter a valid amount'); return }

  if (editingPayment) {
    const res = await window.api.invoiceUpdatePayment({
      payment_id: editingPayment.id,
      invoice_id: invoiceId,
      ...payForm,
      payment_amount: amt
    })
    if (res.error) { toast.error(res.error); return }
    toast.success('Payment updated')
  } else {
    const res = await window.api.invoiceAddPayment({
      invoice_id: invoiceId,
      customer_id: selectedCustomer.customer_id,
      ...payForm,
      payment_amount: amt
    })
    if (res.error) { toast.error(res.error); return }
    toast.success('Payment saved')
  }

  setShowPaymentForm(false)
  setEditingPayment(null)
  // Reload invoice to refresh payment list and status
  await loadInvoice(invoiceId)
}

async function handleDeletePayment(payment_id) {
  const res = await window.api.invoiceDeletePayment({ payment_id, invoice_id: invoiceId })
  if (res.error) { toast.error(res.error); return }
  toast.success('Payment deleted')
  await loadInvoice(invoiceId)
}
```

IMPORTANT: Look at how the existing invoice is loaded in Invoice.jsx
(the function that calls `window.api.getInvoice(id)`). Make sure
`loadInvoice` or equivalent reloads and updates the payments state,
status state, totalPaid, and balanceDue from the new response format.

Also REMOVE these from the invoice save/update call since payments
are now managed separately:
- `payment_amount`
- `payment_type`
- `payment_date`

---

## PHASE 8 — AddAccountEntry.jsx + BuyerAccountDetail.jsx

### 8A — AddAccountEntry.jsx: Link to Invoice toggle

Add state:
```js
const [linkToInvoice, setLinkToInvoice] = useState(false)
const [unpaidInvoices, setUnpaidInvoices] = useState([])
const [linkedInvoiceId, setLinkedInvoiceId] = useState('')
```

When customer changes AND entry type is Jama (payment), fetch unpaid invoices:
```js
useEffect(() => {
  if (customerId && entryType === 'jama') {
    window.api.invoiceGetUnpaid(customerId).then(setUnpaidInvoices)
  } else {
    setUnpaidInvoices([])
    setLinkToInvoice(false)
    setLinkedInvoiceId('')
  }
}, [customerId, entryType])
```

Add UI after the payment type selector (only for jama entries):
```jsx
{entryType === 'jama' && unpaidInvoices.length > 0 && (
  <div>
    <div className="flex items-center gap-2 mb-2">
      <input
        type="checkbox"
        id="linkInvoice"
        checked={linkToInvoice}
        onChange={e => {
          setLinkToInvoice(e.target.checked)
          if (!e.target.checked) setLinkedInvoiceId('')
        }}
        className="w-4 h-4 accent-[#004AC6] cursor-pointer"
      />
      <label htmlFor="linkInvoice"
        className="text-[10px] font-bold text-[#434655] uppercase tracking-wider cursor-pointer">
        Link to Invoice
      </label>
    </div>

    {linkToInvoice && (
      <div>
        <label className="text-[10px] font-bold text-[#434655] uppercase mb-1.5 ml-1 block">
          Select Invoice
        </label>
        <select
          value={linkedInvoiceId}
          onChange={e => setLinkedInvoiceId(e.target.value)}
          className="w-full py-2.5 px-3 bg-[#F2F4F6] border-none rounded-lg text-sm
                     focus:bg-white focus:ring-2 focus:ring-[#004AC6]/15 transition-all"
        >
          <option value="">Select invoice...</option>
          {unpaidInvoices.map(inv => (
            <option key={inv.invoice_id} value={inv.invoice_id}>
              {inv.invoice_id} — ₹{(inv.grand_total - inv.total_paid).toFixed(2)} due
              ({inv.status === 'overdue' ? '⚠ Overdue' : inv.status === 'partially_paid' ? 'Partial' : 'Unpaid'})
            </option>
          ))}
        </select>
      </div>
    )}
  </div>
)}
```

When saving the jama entry, add `linked_invoice_id` to the payload:
```js
const payload = {
  // ... existing fields ...
  linked_invoice_id: linkToInvoice && linkedInvoiceId ? linkedInvoiceId : null
}
```

If `linked_invoice_id` is set, auto-fill the remark with `"Invoice ${linkedInvoiceId}"`
if the remark field is empty.

### 8B — BuyerAccountDetail.jsx: Status badge on maal entries

In the Maal Entries table, find where invoice IDs are rendered as blue links.
After the invoice ID link, add the status badge.

The maal entries query currently returns `maal_invoice_no`. You need to also
fetch the invoice status. Update the IPC handler for fetching maal entries
(in `ipcHandlers.js`, find `customers:maalGetAll` or similar) to JOIN invoices:

```sql
SELECT m.*,
       i.status AS invoice_status,
       i.grand_total AS invoice_total
FROM customer_maal_account m
LEFT JOIN invoices i ON i.invoice_id = m.maal_invoice_no
WHERE m.customer_id = ?
ORDER BY m.maal_date DESC
```

In the table row JSX, after the invoice ID link:
```jsx
{entry.invoice_status && (
  <span className={`
    ml-2 px-2 py-0.5 rounded-full text-[9px] font-bold
    ${entry.invoice_status === 'paid'
      ? 'bg-emerald-100 text-emerald-700'
      : entry.invoice_status === 'partially_paid'
      ? 'bg-amber-100 text-amber-700'
      : entry.invoice_status === 'overdue'
      ? 'bg-red-100 text-[#BA1A1A]'
      : 'bg-blue-100 text-blue-700'}
  `}>
    {entry.invoice_status === 'awaiting_payment' ? 'Awaiting'
      : entry.invoice_status === 'partially_paid' ? 'Partial'
      : entry.invoice_status === 'paid' ? 'Paid'
      : 'Overdue'}
  </span>
)}
```

---

## FULL FLOW VERIFICATION

After all 8 phases:

```bash
npm run dev
```

**Test 1 — New invoice, no payment:**
1. Create invoice for a customer with reminder_enabled = 1, reminder_days = 30
2. Payment due days should auto-fill to 30
3. Save invoice
4. Open it → Status badge shows "Awaiting Payment"
5. Payment History section shows "No payments recorded yet"

**Test 2 — Add payments in parts:**
1. Open the invoice from Test 1
2. Click "Add Payment" → enter 5000 → Save
3. Status badge changes to "Partially Paid"
4. Payment History shows 1 row
5. Add another payment → 3000
6. Payment History shows 2 rows, balance updates
7. Add final payment for remaining balance
8. Status badge changes to "Paid"
9. "Add Payment" button disappears (status = paid)

**Test 3 — Payment from account:**
1. Go to BuyerAccountDetail for same customer
2. Click "Add Jama Entry"
3. "Link to Invoice" checkbox appears (customer has unpaid invoices)
4. Check it → dropdown shows unpaid invoices
5. Select an invoice → save
6. Go back to that invoice → new payment appears in Payment History
7. Invoice status updated correctly

**Test 4 — BuyerAccountDetail badges:**
1. Open BuyerAccountDetail for a customer
2. Maal entries should show status badge next to each invoice ID
3. Paid invoices show green "Paid" badge
4. Unpaid show blue "Awaiting" badge

**Test 5 — Overdue:**
1. Create an invoice with payment_due_days = 1
2. Manually update invoice_date in DB to 3 days ago (or wait)
3. Restart app
4. Check invoice — status should be "Overdue"

---

## WHAT NOT TO TOUCH

- Do not change invoice PDF generation logic
- Do not change supplier accounts — this feature is customers only
- Do not change quick sales
- Do not change the maal (purchase) entry flow
- Do not change customer_maal_account schema
- The invoice ID format (E-N) must remain unchanged