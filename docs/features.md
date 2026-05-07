# AGS ERP Desktop — Complete Feature List

> **Version:** 1.6.0  
> **Platform:** Electron (Windows / macOS)  
> **Database:** SQLite (better-sqlite3)

---

## 1. Authentication & Security

| # | Feature | Description |
|---|---------|-------------|
| 1.1 | Login Screen | Username/password login with hardcoded credentials. ⚠️ **Security note:** credentials are hardcoded in `login.jsx`. For multi-user or exposed deployments, replace with a user model + hashed passwords (bcrypt/argon2). |
| 1.2 | Auth Persistence | Session persists via `localStorage` (`isAuthenticated` flag) across reloads. ⚠️ **Security note:** `localStorage` is accessible to any renderer-side code. For higher security, consider Electron `safeStorage` for encrypted tokens or in-memory session state with short-lived tokens. Current approach is acceptable for a single-user, offline desktop ERP. |
| 1.3 | Auth Redirect | Unauthenticated users redirected to `/login` |
| 1.4 | Already Authenticated Redirect | Already logged-in users redirected from `/login` to `/invoice` |
| 1.5 | Show/Hide Password | Toggle password visibility on login form |
| 1.6 | Logout | Clears auth state & navigates to login |
| 1.7 | Error Feedback | Shows error message for wrong credentials |

---

## 2. Navigation & Layout

| # | Feature | Description |
|---|---------|-------------|
| 2.1 | Sidebar Navigation | Fixed left sidebar (240px) with section grouping |
| 2.2 | Navigation Sections | SALES, CATALOG, ACCOUNTS, ORDERS |
| 2.3 | Dropdown Menus | Expandable/collapsible sub-menus for Quick Sales, Accounts, Orders |
| 2.4 | Active Route Highlighting | Current route highlighted with blue badge |
| 2.5 | Auto-Expand Dropdowns | Dropdown auto-expands when active route is inside it |
| 2.6 | Mobile Responsive Nav | Hamburger menu + slide-in drawer on small screens |
| 2.7 | Mobile Swipe-to-Close | Draggable nav panel on mobile |
| 2.8 | Print-Hidden Nav | Sidebar hidden during print |
| 2.9 | Toast Notifications | Global toast system (success/error) via react-hot-toast |
| 2.10 | 404 Not Found Page | Fallback page for unmatched routes |

---

## 3. Estimate / Invoice Module (`/invoice`)

| # | Feature | Description |
|---|---------|-------------|
| 3.1 | Create New Invoice | Auto-generates next invoice ID (E-{N}) |
| 3.2 | Customer Selection | Searchable dropdown to pick customer |
| 3.3 | Ad-hoc Customer | Type a new customer name without creating account |
| 3.4 | Auto-fill Customer Details | Address and mobile pre-filled from customer record |
| 3.5 | Invoice Date | Editable date field (defaults to today) |
| 3.6 | Product Search | Type-ahead search with dropdown (existing products) |
| 3.7 | Ad-hoc Products | Type a new product name — auto-creates in DB on add |
| 3.8 | Add Item to Invoice | Product name, size, qty, packing unit, rate → line item |
| 3.9 | Edit Line Item | Click edit icon to load item back into the add form |
| 3.10 | Delete Line Item | Remove individual line items |
| 3.11 | Packing / Freight / Rikshaw | Additional charges added to invoice total |
| 3.12 | Grand Total Calculation | Auto-calculates subtotal + extras, rounds to nearest ₹1 |
| 3.13 | Round-off Display | Shows round-off amount applied |
| 3.14 | Payment/Advance Section | Optional: amount, type (Cash/UPI/Transfer/RTGS), date |
| 3.15 | Remark Field | Free-text remark for the invoice |
| 3.16 | Save Invoice | Saves header + items + creates maal account entry |
| 3.17 | Update Existing Invoice | Edit and re-save an existing invoice |
| 3.18 | Delete Invoice | Deletes invoice, items, and linked maal/jama entries; recycles ID |
| 3.19 | Unsaved Changes Detection | Tracks dirty state; warns before navigating away |
| 3.20 | Navigation Blocker | Browser-level blocker when there are unsaved changes |
| 3.21 | Print Invoice | Print-optimized layout with Marathi product names |
| 3.22 | Marathi Script in Print | Shows Devanagari transliteration of product names on print |
| 3.23 | Keyboard Navigation | Arrow keys, Enter, Escape in product dropdown |
| 3.24 | Tab-Order Logic | Tab from product name → qty (existing product) or → size (new product) |
| 3.25 | ID Recycling | Deleted invoice IDs are explicitly pooled and reused. A persistent UI notice is displayed when an invoice utilizes a recycled ID to ensure transparency. To establish robust audit-trail uniqueness, the system requires an explicit `document_version` field for distinguishing document states sharing the same ID. |
| 3.26 | Price Sync | Changing a price in an invoice prompts a confirmation opt-in toggle before modifying the master catalog. Controlled via global config to explicitly block silent price overwrites in the master list. |
| 3.27 | Packing Type Selection | Dropdown with allowed types: Pc, Kg, Dz, Box, Kodi, Theli, Packet, Set |
| 3.28 | New Invoice Button | "New" button resets form for a fresh invoice |

---

## 4. Price List / Product Catalog (`/price-list`)

| # | Feature | Description |
|---|---------|-------------|
| 4.1 | List All Products | Paginated table of all active products |
| 4.2 | Search Products | Real-time search by name or code |
| 4.3 | Sort Products | Click column headers to sort asc/desc |
| 4.4 | Smart Name+Size Sort | Products sorted by name then numeric size value |
| 4.5 | Add New Product | Form: name, size, packing type, cost price, selling price |
| 4.6 | Auto-Generate Code | Product code generated from name + size |
| 4.7 | Edit Product | Modify name, size, prices, packing type |
| 4.8 | Edit with Code Change | Change name/size regenerates code, updates all references |
| 4.9 | Soft-Delete Product | Marks `is_deleted=1` (not hard-deleted) |
| 4.10 | Delete Confirmation Modal | Modal with keyboard accessibility (Escape, backdrop click) |
| 4.11 | Row Click Navigation | Click any row to navigate to edit page |
| 4.12 | Packing Type Normalization | Batch normalizes legacy packing types to allowed values |
| 4.13 | Marathi Name Column | Displays transliterated Marathi name |
| 4.14 | Product Code Duplication Check | Prevents creating products with duplicate codes |
| 4.15 | Pagination | 10 items per page with page numbers + prev/next |
| 4.16 | Highlighted Row | Flash-highlight for newly navigated-to product |

---

## 5. Quick Sales (`/quick-sales`)

| # | Feature | Description |
|---|---------|-------------|
| 5.1 | Create Quick Sale | Simplified sale without customer — just items + total |
| 5.2 | Auto-Generate QS ID | Sequential ID (QS-{N}) with recycling. Same recycling design note as 3.25. |
| 5.3 | Product Search in Quick Sale | Same searchable product dropdown as invoices |
| 5.4 | Ad-hoc/Temporary Items | Add items not in the product database |
| 5.5 | Quick Sale Date | Editable date |
| 5.6 | Remark | Free-text remark |
| 5.7 | Total Calculation | Auto-calculated from line items |
| 5.8 | Save Quick Sale | Saves header + items |
| 5.9 | Edit Quick Sale | Load existing QS, modify, and re-save |
| 5.10 | Delete Quick Sale | Delete with confirmation + ID recycling |
| 5.11 | Print Quick Sale | Print-optimized output |
| 5.12 | List Quick Sales | Paginated list with search |
| 5.13 | Delete from List | Delete individual QS from the list view |
| 5.14 | Keyboard-Accessible QS ID | QS ID is a focusable button for keyboard navigation |
| 5.15 | Unsaved Changes Detection | Warns before navigating from unsaved QS |

---

## 6. Customer Accounts (`/accounts/customers`)

| # | Feature | Description |
|---|---------|-------------|
| 6.1 | List All Customers | Paginated, searchable table |
| 6.2 | Add Customer | Name (required), address, mobile |
| 6.3 | Auto-Generate Customer ID | Format: AGS-C-{N} |
| 6.4 | Edit Customer | Modify name, address, mobile |
| 6.5 | Delete Customer | With dependency check (maal/jama/invoices/orders) |
| 6.6 | Dependency Guard | Blocks deletion if customer has entries; shows count |
| 6.7 | Customer Detail Page | Account detail view with maal + jama ledger |
| 6.8 | Maal Entries (Sales) | List of credit entries (invoice_no, date, amount, remark) |
| 6.9 | Jama Entries (Payments) | List of debit entries (txn_type, date, amount, remark) |
| 6.10 | Add Maal Entry | Manual maal (sales) entry for a customer |
| 6.11 | Add Jama Entry | Payment transaction (Cash/UPI/Transfer/RTGS) |
| 6.12 | Edit Maal Entry | Modify date, amount, remark |
| 6.13 | Edit Jama Entry | Modify date, type, amount, remark |
| 6.14 | Delete Maal Entry | Delete with confirmation |
| 6.15 | Delete Jama Entry | Delete with guard (blocks if linked to invoice/order) |
| 6.16 | Grand Total Balance | Calculates Maal Total - Jama Total = Outstanding |
| 6.17 | Filter by Type | Filter entries by maal, jama, or all |
| 6.18 | Sort Entries | Sort by date, amount, etc. |
| 6.19 | Pagination | Paginated ledger entries |
| 6.20 | Linked Entry Detection | Shows lock icon for entries linked to invoices/orders |
| 6.21 | Inline Edit Guard | Blocks editing linked entries (invoice/order-generated) |
| 6.22 | Payment Reminder | Toggle-able reminder with configurable days (1–365) |
| 6.23 | Reminder Trigger | Alerts when balance reaches ₹0 or negative |
| 6.24 | Reminder Days Input | Clamped input (min 1, max 365) |
| 6.25 | Reminder Rollback | Failed save rolls back to last persisted value (via ref) |
| 6.26 | Search within Detail | Search maal/jama entries by invoice_no, remark, etc. |

---

## 7. Supplier Accounts (`/accounts/suppliers`)

| # | Feature | Description |
|---|---------|-------------|
| 7.1 | List All Suppliers | Paginated, searchable table |
| 7.2 | Add Supplier | Name (required), address, mobile |
| 7.3 | Auto-Generate Supplier ID | Format: AGS-S-{N} |
| 7.4 | Edit Supplier | Modify name, address, mobile |
| 7.5 | Delete Supplier | With dependency check (maal/jama/orders) |
| 7.6 | Dependency Guard | Blocks deletion if supplier has entries |
| 7.7 | Supplier Detail Page | Account detail view with maal + jama ledger |
| 7.8 | Maal Entries (Purchases) | Credit entries for supplier |
| 7.9 | Jama Entries (Payments) | Debit entries for supplier |
| 7.10 | Add/Edit/Delete Maal | Full CRUD for supplier maal entries |
| 7.11 | Add/Edit/Delete Jama | Full CRUD for supplier jama entries |
| 7.12 | Linked Entry Guard | Blocks delete of order-linked jama entries |
| 7.13 | Grand Total Balance | Outstanding balance calculation |
| 7.14 | Payment Reminder | Same as customer reminder (toggle, days, trigger) |
| 7.15 | Reminder Rollback | Proper ref-based rollback on save failure |

---

## 8. Customer Orders (`/orders/customers`)

| # | Feature | Description |
|---|---------|-------------|
| 8.1 | List All Customer Orders | Paginated, searchable table |
| 8.2 | Status Filter | Filter by All/Received/In Progress/Completed |
| 8.3 | Create Customer Order | Customer selection, date, items, remark, status |
| 8.4 | Product Search in Order | Same searchable product dropdown |
| 8.5 | Ad-hoc/Temporary Items | Add items not in product DB (is_temporary flag) |
| 8.6 | Item Remark | Per-item remark field |
| 8.7 | Packing Type per Item | Per-item packing type |
| 8.8 | Payment Section | Advance payment: amount, type, date |
| 8.9 | Auto-Generate Order ID | Format: O-C-{N} with recycling. Same recycling design note as 3.25. |
| 8.10 | Edit Customer Order | Full edit with item re-generation |
| 8.11 | Delete Customer Order | Deletes order + items + recycles ID. **Advance payment (jama entry) is intentionally preserved** per accounting rules — money already received is not reversed. |
| 8.12 | Status Options | Received, In Progress, Completed |
| 8.13 | Linked Payment | Payment creates jama entry with "Order" remark |
| 8.14 | Unsaved Changes Detection | isDirty tracking with navigation blocker |
| 8.15 | Print Order | Print-optimized order view |
| 8.16 | Sort Orders | Sort by date, name, status |
| 8.17 | Delete from List | Delete individual order from list view |

---

## 9. Supplier Orders (`/orders/suppliers`)

| # | Feature | Description |
|---|---------|-------------|
| 9.1 | List All Supplier Orders | Paginated, searchable table |
| 9.2 | Status Filter | Filter by All/Placed/In Progress/Completed |
| 9.3 | Create Supplier Order | Supplier selection, date, items, remark, status |
| 9.4 | Product Search in Order | Same searchable product dropdown |
| 9.5 | Ad-hoc/Temporary Items | Items not in product DB |
| 9.6 | Item Remark & Packing Type | Per-item details |
| 9.7 | Payment Section | Advance payment with jama entry |
| 9.8 | Auto-Generate Order ID | Format: O-S-{N} with recycling. Same recycling design note as 3.25. |
| 9.9 | Edit Supplier Order | Full edit with payment update/creation/deletion |
| 9.10 | Delete Supplier Order | Deletes order + items + recycles ID. **Advance payment (jama entry) is intentionally preserved** per accounting rules — money already paid is not reversed. This behavior is **consistent** with customer order deletion (8.11). |
| 9.11 | Delete from List | Delete from list view |
| 9.12 | Print Order | Print-optimized output |
| 9.13 | Unsaved Changes Detection | isDirty + navigation blocker |

---

## 10. Marathi Transliteration

| # | Feature | Description |
|---|---------|-------------|
| 10.1 | Auto-Batch at Startup | Transliterates all products missing Marathi names on app launch |
| 10.2 | Per-Product Transliteration | Transliterate individual product on demand |
| 10.3 | On-Create Transliteration | New product is auto-transliterated on creation |
| 10.4 | Google Input Tools API | Uses Google's transliteration (not translation) API |
| 10.5 | Toast Progress | Shows batch progress toast in UI |
| 10.6 | Print with Marathi | Invoice print layout shows Marathi names |
| 10.7 | Old Translation Reset | One-time migration resets old `translated` status to re-transliterate |

---

## 11. System / Backend Features

| # | Feature | Description |
|---|---------|-------------|
| 11.1 | SQLite Database | Persistent local database in user data directory |
| 11.2 | Electron IPC | All DB operations via secure IPC handlers |
| 11.3 | Preload Security | Context isolation + whitelisted API bridge |
| 11.4 | Legacy Fetch Shim | Redirects old HTTP fetch calls to IPC (backward compat) |
| 11.5 | Auto Migrations | Schema migrations run safely on startup |
| 11.6 | Document Sequences | Sequential ID generation with gap recycling |
| 11.7 | Soft Delete for Products | Products marked deleted, not removed (FK protection) |
| 11.8 | Weekly Cleanup Scheduler | Auto-cleans soft-deleted products (weekly interval) |
| 11.9 | Admin Cleanup Handler | Manual trigger for soft-delete cleanup |
| 11.10 | Foreign Key Enforcement | `PRAGMA foreign_keys = ON` on every connection |
| 11.11 | Transaction Safety | All multi-table operations wrapped in transactions |
| 11.12 | Window Maximization | App starts maximized |
| 11.13 | Build System | Vite + Electron Builder (NSIS for Windows, DMG for macOS) |

---

## 12. UI/UX & Accessibility

| # | Feature | Description |
|---|---------|-------------|
| 12.1 | Stitch Glass Modals | Blur-backdrop delete confirmation modals |
| 12.2 | Modal Accessibility | `role="dialog"`, `aria-modal`, `aria-labelledby`, `tabIndex` |
| 12.3 | Escape to Close Modal | All modals dismiss on Escape key |
| 12.4 | Backdrop Click to Close | Click outside modal to dismiss |
| 12.5 | Auto-Focus on Modal Open | Modal receives focus automatically |
| 12.6 | Keyboard Product Dropdown | Arrow keys + Enter + Escape in product search |
| 12.7 | Toast Notifications | Styled dark toasts for success/error |
| 12.8 | Loading States | Disabled buttons with "Saving…" / "Deleting…" text |
| 12.9 | Empty State Messages | "No products found" in empty dropdowns |
| 12.10 | Error Boundary Messages | Graceful error messages for API failures |
| 12.11 | Print Stylesheets | `print:hidden` classes to hide UI controls |
| 12.12 | Responsive Design | Mobile-first with md: breakpoints |
