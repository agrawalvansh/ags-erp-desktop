# AGS ERP Desktop — Complete Feature List

> **Version:** 2.3.0  
> **Platform:** Electron
> **Database:** SQLite (better-sqlite3)  
> **Last Updated:** June 2026

---

## 1. Authentication & Security

| # | Feature | Description |
|---|---------|-------------|
| 1.1 | Login Screen | Username/password login with hardcoded credentials. ⚠️ **Security note:** credentials are hardcoded in `login.jsx`. For multi-user or exposed deployments, replace with a user model + hashed passwords (bcrypt/argon2). |
| 1.2 | Auth Persistence | Session persists via `localStorage` (`isAuthenticated` flag) across reloads. ⚠️ **Security note:** `localStorage` is accessible to any renderer-side code. For higher security, consider Electron `safeStorage` for encrypted tokens or in-memory session state with short-lived tokens. Current approach is acceptable for a single-user, offline desktop ERP. |
| 1.3 | Auth Redirect | Unauthenticated users redirected to `/login` via `Layout.jsx` guard |
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
| 2.3 | Dropdown Menus | Expandable/collapsible sub-menus for Quick Sales, Accounts, Orders with CSS-based animation (grid-template-rows and opacity transitions, 0.2s easeInOut) |
| 2.4 | Active Route Highlighting | Current route highlighted with blue badge (`bg-[#2563EB] text-white`). Active dropdown parents get `bg-[#EFF6FF] text-[#2563EB]`. |
| 2.5 | Auto-Expand Dropdowns | Dropdown auto-expands when active route is inside it |
| 2.6 | Fixed Sidebar Layout | Fixed 240px left sidebar visible at all screen sizes |
| 2.7 | Print-Hidden Nav | Sidebar hidden during print (`print:hidden`) |
| 2.9 | Toast Notifications | Global toast system via `react-hot-toast` — dark background (`#0F172A`), positioned top-center, styled success (green) and error (red) icons |
| 2.10 | Notification Badge | NavBar shows unread notification count badge (`bg-[#DC2626]`), displays `99+` when exceeding 99. Links to `/notifications` |
| 2.11 | 404 Not Found Page | Fallback page for unmatched routes with "Go Back" button |
| 2.12 | Error Boundary | Global `ErrorBoundary` wrapping all routes — catches React render errors and shows recovery UI with "Reload Application" button |
| 2.13 | Route-Level Code Splitting | All module pages are lazy-loaded via `React.lazy()` with a `PageLoader` fallback — reduces initial bundle size |

---

## 3. Estimate / Invoice Module (`/invoice`)

| # | Feature | Description |
|---|---------|-------------|
| 3.1 | Create New Invoice | Auto-generates next invoice ID (`E-{N}`) |
| 3.2 | Customer Selection | Searchable autocomplete dropdown to pick customer with keyboard navigation (arrow keys, Enter, Escape) |
| 3.3 | Ad-hoc Customer | Type a new customer name without creating account |
| 3.4 | Auto-fill Customer Details | Address and mobile pre-filled from customer record |
| 3.5 | New Customer Detection | When a typed name doesn't match any DB customer, a modal prompts to create a new customer with name/address/mobile fields |
| 3.6 | Customer Update Detection | If customer mobile or address has changed from the saved profile, a confirmation modal offers to update the customer record |
| 3.7 | Invoice Date | Editable date field (defaults to today) |
| 3.8 | Product Search | Type-ahead search with dropdown (existing products) and keyboard navigation |
| 3.9 | Ad-hoc Products | Type a new product name — auto-creates in DB on add |
| 3.10 | Add Item to Invoice | Product name, size, qty, packing unit, rate → line item |
| 3.11 | Weight Calculator | Popup multi-weight quantity calculator for Kg products — enter multiple weights that sum into the Qty field |
| 3.12 | Edit Line Item | Click edit icon to load item back into the add form |
| 3.13 | Delete Line Item | Remove individual line items |
| 3.14 | Packing / Freight / Rikshaw | Additional charges added to invoice total |
| 3.15 | Grand Total Calculation | Auto-calculates subtotal + extras, rounds to nearest ₹1 |
| 3.16 | Round-off Display | Shows round-off amount applied |
| 3.17 | Payment/Advance Section (Create) | On new invoice: optional single payment form — amount, type (Cash/UPI/Transfer/RTGS), date. Payment is linked to the invoice via `linked_invoice_id` for status tracking. |
| 3.18 | Remark Field | Free-text remark for the invoice |
| 3.19 | Save Invoice | Saves header + items + creates maal account entry + optional jama entry for payment. After save, automatically refreshes payment/status state from DB. |
| 3.20 | Update Existing Invoice | Edit and re-save an existing invoice |
| 3.21 | Delete Invoice | Deletes invoice, items, linked maal entry, and all linked payments (cascade delete). Recycles the ID. |
| 3.22 | Unsaved Changes Detection | Tracks dirty state via `useMemo` comparison; warns before navigating away |
| 3.23 | Navigation Blocker | `useBlocker` + `NavigationWarningModal` + `beforeunload` listener when form is dirty |
| 3.24 | Force New Modal | When clicking "New" with unsaved changes, modal prompts: "Keep Editing" or "Discard & New" |
| 3.25 | Print Invoice | Print-optimized layout with system printer selection modal |
| 3.26 | Marathi Print Toggle | Checkbox to include Devanagari transliteration of product names on print output |
| 3.27 | PDF Download | Download invoice as PDF file to local filesystem |
| 3.28 | Printer Selection | Modal to select from available system printers before printing |
| 3.29 | Keyboard Navigation | Arrow keys, Enter, Escape in product/customer dropdowns |
| 3.30 | Tab-Order Logic | Tab from product name → qty (existing product) or → size (new product) |
| 3.31 | ID Recycling | Deleted invoice IDs are pooled and reused. A persistent UI notice is displayed when using a recycled ID. |
| 3.32 | Price Sync | Changing a price in an invoice prompts a confirmation opt-in toggle before modifying the master catalog. Controlled via global config. |
| 3.33 | Packing Type Selection | Dropdown with allowed types: Pc, Kg, Dz, Box, Kodi, Theli, Packet, Set |
| 3.34 | Load by URL | Navigate to `/invoice/{invoiceNo}` to load a specific invoice directly |
| 3.35 | Invoice Status Tracking | Each invoice tracks status: `awaiting_payment` → `partially_paid` → `paid` / `overdue`. Status auto-calculated from linked payments vs grand total. |
| 3.36 | Status Badge (Top Bar) | Colour-coded badge next to invoice reference: blue (Awaiting), amber (Partially Paid), green (Paid), red (Overdue) |
| 3.37 | Payment Due Days | Per-invoice `payment_due_days` field in top bar. Pre-fills from customer's `reminder_days` on selection. Fully editable regardless of customer reminder setting. |
| 3.38 | Multi-Payment History (Edit) | Edit flow shows full Payment History table — lists all linked payments with date, type, amount, remark. Add/edit/delete individual payments inline. |
| 3.39 | Add Payment | "+ Add Payment" button (hidden when fully paid). Pre-fills amount with remaining balance, defaults to Cash/today. |
| 3.40 | Edit Payment | Edit existing payment entry inline (amount, type, date, remark) |
| 3.41 | Delete Payment | Delete individual payment. Status auto-recalculates after each change. |
| 3.42 | Payment Summary in Totals | Below Grand Total: each payment shown as a negative line with remark/type on left. Shows "Pending" in red if balance > 0, or "Fully Paid ✓" in green. |
| 3.43 | Payment Summary in PDF | PDF print shows each payment entry with remark, date, and negative amount. Shows "Pending" or "PAID IN FULL" at bottom. |
| 3.44 | Overdue Detection | If `payment_due_days > 0` and invoice is not paid by that many days after `invoice_date`, status flips to `overdue` and a notification is created. |
| 3.45 | Status Auto-Recalculation | `recalculateInvoiceStatus()` runs after every payment add/edit/delete and on invoice update. Manages notification creation/deletion. |
| 3.46 | Private Note Toggle | Checkbox to mark remark as private (excluded from print) |

---

## 4. Price List / Product Catalog (`/price-list`)

| # | Feature | Description |
|---|---------|-------------|
| 4.1 | List All Products | Full scrollable table of all active products showing Name, Size, Code, Selling Price, and Date/Time (no pagination — all rows visible) |
| 4.2 | Search Products | Real-time search by name or code with clear button |
| 4.3 | Sort Products | Click column headers to sort asc/desc with chevron indicator |
| 4.4 | Smart Name+Size Sort | Products sorted by name alphabetically then by numeric size value |
| 4.5 | Cost Price Visibility Toggle | Show/Hide Cost Price column — hidden by default for screen sharing safety (Eye/EyeOff icon toggle) |
| 4.6 | Add New Product | Form: name, size, packing type, cost price, selling price |
| 4.7 | Auto-Generate Code | Product code generated from name + size |
| 4.8 | Edit Product | Modify name, size, prices, packing type |
| 4.9 | Edit with Code Change | Change name/size regenerates code, updates all references (invoices, orders) |
| 4.10 | Soft-Delete Product | Marks `is_deleted=1` (not hard-deleted) — FK protection |
| 4.11 | Delete Confirmation Modal | Glass overlay modal with keyboard accessibility (Escape, backdrop click) |
| 4.12 | Row Click Navigation | Click any row to navigate to edit page |
| 4.13 | Packing Type Normalization | Batch normalizes legacy packing types to allowed values |
| 4.14 | Marathi Name Column | Displays transliterated Marathi name (auto-generated) |
| 4.15 | Product Code Duplication Check | Prevents creating products with duplicate codes |
| 4.16 | Highlighted Row | Flash-highlight for newly navigated-to product after edit |
| 4.17 | Focus Next After Edit | After saving an edit, auto-scrolls to the next product in the list |
| 4.18 | Print / Download PDF | Generate a B&W PDF of the full product catalog (with optional cost price column). Uses printer selection modal for print or direct download. Exports the currently filtered/sorted view. |

---

## 5. Quick Sales (`/quick-sales`)

| # | Feature | Description |
|---|---------|-------------|
| 5.1 | Create Quick Sale | Simplified sale without customer — just items + total |
| 5.2 | Auto-Generate QS ID | Sequential ID (`QS-{N}`) with recycling |
| 5.3 | Product Search in Quick Sale | Same searchable product dropdown as invoices with keyboard navigation |
| 5.4 | Ad-hoc/Temporary Items | Add items not in the product database |
| 5.5 | Weight Calculator | Same multi-weight Qty popup as invoices for Kg products |
| 5.6 | Quick Sale Date | Editable date field |
| 5.7 | Remark | Free-text remark |
| 5.8 | Total Calculation | Auto-calculated from line items |
| 5.9 | Save Quick Sale | Saves header + items |
| 5.10 | Edit Quick Sale | Load existing QS, modify, and re-save |
| 5.11 | Delete Quick Sale | Delete with confirmation + ID recycling |
| 5.12 | Force New Modal | When clicking "New" with unsaved changes, modal prompts: "Keep Editing" or "Discard & New" |
| 5.13 | Print Quick Sale | Print-optimized output with Marathi toggle and printer selection |
| 5.14 | PDF Download | Download quick sale as PDF |
| 5.15 | List Quick Sales | Paginated list (`/quick-sales/list`) with search, sort, and per-row delete |
| 5.16 | Delete from List | Delete individual QS from the list view with glass overlay confirmation modal |
| 5.17 | Unsaved Changes Detection | `isDirty` tracking + `useBlocker` + `NavigationWarningModal` |
| 5.18 | Load by URL | Navigate to `/quick-sales/{qsId}` to load a specific quick sale |

---

## 6. Customer Accounts (`/accounts/customers`)

| # | Feature | Description |
|---|---------|-------------|
| 6.1 | List All Customers | Searchable table with outstanding balance column |
| 6.2 | Add Customer | Name (required), address, mobile — via dedicated form page |
| 6.3 | Auto-Generate Customer ID | Format: `AGS-C-{N}` |
| 6.4 | Edit Customer | Modify name, address, mobile via same form page |
| 6.5 | Delete Customer | With dependency check (maal/jama/invoices/orders) |
| 6.6 | Dependency Guard | Blocks deletion if customer has entries; shows count of dependent records |
| 6.7 | Customer Detail Page | Account detail view (`/accounts/customers/:slug`) with maal + jama ledger |
| 6.8 | Maal Entries (Sales) | List of credit entries (invoice_no, date, amount, remark) with running total |
| 6.9 | Jama Entries (Payments) | List of debit entries (txn_type, date, amount, remark) with running total |
| 6.10 | Add Maal Entry | Manual maal (sales) entry via dedicated form page |
| 6.11 | Add Jama Entry | Payment transaction (Cash/UPI/Transfer/RTGS) via dedicated form page |
| 6.12 | Inline Edit Maal | Edit date, invoice number, amount, remark directly in the table row |
| 6.13 | Inline Edit Jama | Edit date, type, amount, remark directly in the table row |
| 6.14 | Delete Entry | Delete with glass overlay confirmation modal |
| 6.15 | Cascade Delete | For invoice/order-linked entries: deleting the source document automatically cascade-deletes all linked payments |
| 6.16 | Linked Entry Detection | Entries linked to invoices show clickable invoice numbers — clicking navigates to the invoice. Linked entries cannot be inline-edited (edit button navigates to source document instead). |
| 6.17 | Bulk Delete Order Entries | When deleting an order-linked maal entry, offers to also delete all linked rows in one operation |
| 6.18 | Grand Total Balance | Calculates Maal Total − Jama Total = Outstanding balance |
| 6.19 | Filter by Type | Tabs to filter: Maal, Jama, or All entries |
| 6.20 | Sort Entries | Sort by date, amount, etc. |
| 6.21 | Search within Detail | Search maal/jama entries by invoice_no, remark, etc. |
| 6.22 | Print Ledger | Print account statement via system printer selection |
| 6.23 | PDF Download | Download account statement as PDF (via `jsPDF`) |
| 6.24 | Payment Reminder | Toggle-able reminder with configurable days (1–365), clamped input |
| 6.25 | Reminder Trigger | Generates a notification when an invoice's payment is overdue based on the configured days |
| 6.26 | Reminder Rollback | Failed save rolls back to last persisted value (via ref) |
| 6.27 | Invoice Status Badges | Maal entries table shows colour-coded status badges (Awaiting/Partial/Paid/Overdue) next to invoice numbers |
| 6.28 | Link to Invoice (Jama) | When adding a Jama entry, checkbox + dropdown to link payment to an unpaid invoice. Auto-fills remark, triggers status recalculation. |
| 6.29 | Unpaid Invoice Dropdown | Fetches invoices with status `awaiting_payment`, `partially_paid`, or `overdue` for the customer. Shows balance due and status indicator. |

---

## 7. Supplier Accounts (`/accounts/suppliers`)

| # | Feature | Description |
|---|---------|-------------|
| 7.1 | List All Suppliers | Searchable table with outstanding balance column |
| 7.2 | Add Supplier | Name (required), address, mobile — via dedicated form page |
| 7.3 | Auto-Generate Supplier ID | Format: `AGS-S-{N}` |
| 7.4 | Edit Supplier | Modify name, address, mobile |
| 7.5 | Delete Supplier | With dependency check (maal/jama/orders) |
| 7.6 | Dependency Guard | Blocks deletion if supplier has entries |
| 7.7 | Supplier Detail Page | Account detail view (`/accounts/suppliers/:slug`) with maal + jama ledger |
| 7.8 | Maal Entries (Purchases) | Credit entries for supplier with running total |
| 7.9 | Jama Entries (Payments) | Debit entries for supplier with running total |
| 7.10 | Add/Edit/Delete Maal | Full CRUD for supplier maal entries (inline edit + dedicated form) |
| 7.11 | Add/Edit/Delete Jama | Full CRUD for supplier jama entries (inline edit + dedicated form) |
| 7.12 | Cascade Delete | For order-linked entries: deleting the source document cascade-deletes all linked payments |
| 7.13 | Bulk Delete Order Entries | Same as customer (6.17) — delete all linked rows in one operation |
| 7.14 | Linked Entry Guard | Order-linked entries cannot be inline-edited; edit navigates to source order |
| 7.15 | Grand Total Balance | Outstanding balance calculation |
| 7.16 | Print Ledger | Print account statement via printer selection |
| 7.17 | PDF Download | Download account statement as PDF (via `jsPDF`) |
| 7.18 | Payment Reminder | Same as customer reminder (toggle, days, trigger, rollback) |

---

## 8. Customer Orders (`/orders/customers`)

| # | Feature | Description |
|---|---------|-------------|
| 8.1 | List All Customer Orders | Searchable table with status badges |
| 8.2 | Status Filter | Filter by All / Received / In Progress / Completed |
| 8.3 | Status Badges | Colour-coded pills: emerald (completed/delivered), amber (pending/received), rose (cancelled), grey (fallback) |
| 8.4 | Create Customer Order | Customer selection, date, items, remark, status — via dedicated form page |
| 8.5 | Product Search in Order | Same searchable product dropdown with keyboard navigation |
| 8.6 | Ad-hoc/Temporary Items | Add items not in product DB (`is_temporary` flag) |
| 8.7 | Item Remark | Per-item remark field |
| 8.8 | Packing Type per Item | Per-item packing type selection |
| 8.9 | Payment Section | Advance payment: amount, type (Cash/UPI/Transfer/RTGS), date |
| 8.10 | Auto-Generate Order ID | Format: `O-C-{N}` with recycling |
| 8.11 | Edit Customer Order | Full edit with item regeneration and payment update/creation/deletion |
| 8.12 | Delete Customer Order | Deletes order + items + cascade-deletes linked payments + recycles ID |
| 8.13 | Status Options | Received, In Progress, Completed |
| 8.14 | Linked Payment | Payment creates jama entry with "Order {ID}" remark in customer account |
| 8.15 | Unsaved Changes Detection | `isDirty` tracking with `useBlocker` + `NavigationWarningModal` |
| 8.16 | Print Order | Print-optimized order view with printer selection |
| 8.17 | PDF Download | Download order as PDF |
| 8.18 | Sort Orders | Sort by date, customer name, status |
| 8.19 | Delete from List | Delete individual order from list view with confirmation modal |
| 8.20 | Load by URL | Navigate to `/orders/customers/{orderId}` to load a specific order |

---

## 9. Supplier Orders (`/orders/suppliers`)

| # | Feature | Description |
|---|---------|-------------|
| 9.1 | List All Supplier Orders | Searchable table with status badges |
| 9.2 | Status Filter | Filter by All / Placed / In Progress / Completed |
| 9.3 | Status Badges | Same colour-coded pills as customer orders (amber uses "placed" instead of "received") |
| 9.4 | Create Supplier Order | Supplier selection, date, items, remark, status — via dedicated form page |
| 9.5 | Product Search in Order | Same searchable product dropdown |
| 9.6 | Ad-hoc/Temporary Items | Items not in product DB |
| 9.7 | Item Remark & Packing Type | Per-item details |
| 9.8 | Payment Section | Advance payment with jama entry creation |
| 9.9 | Auto-Generate Order ID | Format: `O-S-{N}` with recycling |
| 9.10 | Edit Supplier Order | Full edit with payment update/creation/deletion |
| 9.11 | Delete Supplier Order | Deletes order + items + cascade-deletes linked payments + recycles ID |
| 9.12 | Delete from List | Delete from list view with confirmation modal |
| 9.13 | Print Order | Print-optimized output with printer selection |
| 9.14 | PDF Download | Download order as PDF |
| 9.15 | Unsaved Changes Detection | `isDirty` + `useBlocker` + `NavigationWarningModal` |
| 9.16 | Load by URL | Navigate to `/orders/suppliers/{orderId}` to load a specific order |

---

## 10. Notifications (`/notifications`)

| # | Feature | Description |
|---|---------|-------------|
| 10.1 | Notifications Page | Full-page notification centre showing payment reminder alerts |
| 10.2 | Unread Indicator | Blue dot on unread notifications; unread count badge in NavBar |
| 10.3 | Mark as Read | Click a notification to mark it as read and navigate to the related account |
| 10.4 | Mark All Read | Bulk action button to mark all notifications as read |
| 10.5 | Delete Notification | Remove individual notifications (hover-reveal action) |
| 10.6 | Delete All | Bulk action button to delete all notifications |
| 10.7 | Rich Empty State | When no notifications exist, shows an icon + heading + description instead of blank page |
| 10.8 | Relative Time | Notifications show time ago (e.g. "5m ago", "2d ago") |
| 10.9 | Invoice & Type Badges | Each notification shows invoice number badge and customer/supplier type badge |
| 10.10 | Pending Amount Display | Shows outstanding ₹ amount on each notification |
| 10.11 | NavBar Live Count | Unread count syncs in real-time between NotificationsPage and NavBar via `CustomEvent` dispatch |
| 10.12 | Navigate to Account | Clicking a notification navigates to the related customer/supplier detail page |
| 10.13 | Overdue Invoice Notifications | Auto-generated when an invoice becomes overdue (past `payment_due_days`). Uses `reminder_key = overdue_invoice_{id}` for idempotency. Auto-cleared when status changes from overdue. |

---

## 11. Marathi Transliteration

| # | Feature | Description |
|---|---------|-------------|
| 11.1 | Auto-Batch at Startup | Transliterates all products missing Marathi names on app launch |
| 11.2 | Per-Product Transliteration | Transliterate individual product on demand |
| 11.3 | On-Create Transliteration | New product is auto-transliterated on creation |
| 11.4 | Google Input Tools API | Uses Google's transliteration (not translation) API |
| 11.5 | Toast Progress | Shows batch progress toast in UI ("Generating Marathi script for N products...") via Layout.jsx global listener |
| 11.6 | Print with Marathi Toggle | Invoice and Quick Sales print layout shows Marathi product names (opt-in via checkbox) |
| 11.7 | Old Translation Reset | One-time migration resets old `translated` status to re-transliterate |

---

## 12. Printing & PDF

| # | Feature | Description |
|---|---------|-------------|
| 12.1 | Printer Selection Modal | Reusable `PrinterSelectionModal` component — lists system printers, remembers last selection, glass overlay |
| 12.2 | Print from Invoice | Prints invoice with product table, Marathi names (optional), customer details, totals |
| 12.3 | Print from Quick Sale | Same print flow as invoices |
| 12.4 | Print from Orders | Customer and supplier orders printable with printer selection |
| 12.5 | Print Account Ledger | BuyerAccountDetail and SupplierAccountDetail can print via system printer (inline printer modal) |
| 12.6 | PDF Download — Invoice | Download invoice as PDF to local filesystem |
| 12.7 | PDF Download — Quick Sale | Download quick sale as PDF |
| 12.8 | PDF Download — Orders | Download customer/supplier orders as PDF (via `generateOrderPDF` utility) |
| 12.9 | PDF Download — Account Ledger | Download account statement as PDF (via `jsPDF` + `html2canvas`) |
| 12.10 | Print-Optimized CSS | `@media print` rules: A4 size, zero margins, hides buttons/nav/modals/toasts |
| 12.11 | Print-Hidden Elements | All interactive elements use `print:hidden` class to be excluded from print output |
| 12.12 | Loading Overlay During Print | `PageLoader` overlay variant blocks UI during Marathi translation before printing |
| 12.13 | Print / Download — Price List | Generate full product catalog PDF (via `generatePriceListPDF`). Includes optional cost price column. Exports currently filtered/sorted view. |

---

## 13. System / Backend Features

| # | Feature | Description |
|---|---------|-------------|
| 13.1 | SQLite Database | Persistent local database in user data directory via `better-sqlite3` |
| 13.2 | Electron IPC | All DB operations via secure IPC handlers (`window.api.invoke()`) |
| 13.3 | Preload Security | Context isolation + whitelisted API bridge (no direct Node.js access from renderer) |
| 13.4 | Legacy Fetch Shim | Redirects old HTTP fetch calls to IPC (backward compat) |
| 13.5 | Auto Migrations | Schema migrations run safely on startup |
| 13.6 | Document Sequences | Sequential ID generation with gap recycling for invoices, quick sales, and orders |
| 13.7 | Soft Delete for Products | Products marked `is_deleted=1`, not hard-deleted (FK protection) |
| 13.8 | Weekly Cleanup Scheduler | Auto-cleans soft-deleted products (weekly interval) |
| 13.9 | Admin Cleanup Handler | Manual trigger for soft-delete cleanup |
| 13.10 | Foreign Key Enforcement | `PRAGMA foreign_keys = ON` on every connection |
| 13.11 | Transaction Safety | All multi-table operations wrapped in transactions |
| 13.12 | Window Maximization | App starts maximized |
| 13.13 | Build System | Vite + Electron Builder (NSIS for Windows, DMG for macOS) |
| 13.14 | Notification Engine | Backend generates payment reminder notifications based on configured days — runs on app startup and periodically |
| 13.15 | Overdue Invoice Scanner | On app startup (2s delay), scans all non-paid invoices and flips to `overdue` if past due date. Creates notifications with `reminder_key` pattern. Pushes unread count to renderer. |

---

## 14. UI/UX & Accessibility

| # | Feature | Description |
|---|---------|-------------|
| 14.1 | Glass Overlay Modals | All modals use frosted glass backdrop (`rgba(255,255,255,0.7)` + `backdrop-filter: blur(8px)`) — never dark overlays |
| 14.2 | Modal Accessibility | `role="dialog"`, `aria-modal`, `aria-labelledby`, `tabIndex` |
| 14.3 | Escape to Close Modal | All modals dismiss on Escape key |
| 14.4 | Backdrop Click to Close | Click outside modal to dismiss |
| 14.5 | Auto-Focus on Modal Open | Modal receives focus automatically via `ref` |
| 14.6 | Keyboard Product/Customer Dropdown | Arrow keys + Enter + Escape in all searchable dropdowns |
| 14.7 | Toast Notifications | Styled dark toasts (`#0F172A` bg, `#fff` text) for success/error with consistent messaging conventions |
| 14.8 | Loading States — Buttons | Disabled buttons with "Saving…" / "Updating…" / "Deleting…" text — no spinner icons |
| 14.9 | Loading States — Pages | `PageLoader` component with 4 variants: `page`, `section`, `overlay`, `inline` |
| 14.10 | Empty State Messages | "No products found" / "No customers found" / etc. in empty tables. Rich empty state with icon in NotificationsPage. |
| 14.11 | Error Boundary | Global `ErrorBoundary` catches render errors and shows recovery UI |
| 14.12 | Print Stylesheets | `print:hidden` classes + `@media print` CSS rules to hide all UI controls |
| 14.13 | Fixed Sidebar Layout | Fixed 240px sidebar always visible; main content adjusts with left margin |
| 14.14 | Consistent Design System | Documented in `docs/design.md` — colour palette, typography, buttons, forms, tables, modals, status badges, toasts, loading states, print layout |
| 14.15 | Weight Calculator Popup | Positioned popup (`z-50`) below Qty input for entering multiple weights — used in Invoice and Quick Sales for Kg products |
| 14.16 | Active Press Feedback | All buttons use `active:scale-95` for tactile press feedback |
| 14.17 | CSS Animations | NavBar dropdown expand using grid-template-rows and opacity transitions |

---

## Route Map

| Route | Page | Module |
|-------|------|--------|
| `/login` | Login | Auth |
| `/invoice` | Invoice (create/edit) | Sales |
| `/invoice/:invoiceNo` | Invoice (load by ID) | Sales |
| `/price-list` | Product catalog list | Catalog |
| `/price-list/add` | Add new product | Catalog |
| `/price-list/edit/:code` | Edit product | Catalog |
| `/quick-sales/create` | Create quick sale | Sales |
| `/quick-sales/:qsId` | Edit quick sale | Sales |
| `/quick-sales/list` | List all quick sales | Sales |
| `/accounts/customers` | Customer list | Accounts |
| `/accounts/customers/add` | Add customer | Accounts |
| `/accounts/customers/edit/:id` | Edit customer | Accounts |
| `/accounts/customers/:slug` | Customer detail (ledger) | Accounts |
| `/accounts/customers/:slug/add/:type` | Add maal/jama entry | Accounts |
| `/accounts/customers/:slug/edit/:type/:id` | Edit maal/jama entry | Accounts |
| `/accounts/suppliers` | Supplier list | Accounts |
| `/accounts/suppliers/add` | Add supplier | Accounts |
| `/accounts/suppliers/edit/:id` | Edit supplier | Accounts |
| `/accounts/suppliers/:slug` | Supplier detail (ledger) | Accounts |
| `/accounts/suppliers/:slug/add/:type` | Add maal/jama entry | Accounts |
| `/accounts/suppliers/:slug/edit/:type/:id` | Edit maal/jama entry | Accounts |
| `/orders/customers` | Customer orders list | Orders |
| `/orders/customers/add` | Create customer order | Orders |
| `/orders/customers/:orderId` | Edit customer order | Orders |
| `/orders/suppliers` | Supplier orders list | Orders |
| `/orders/suppliers/add` | Create supplier order | Orders |
| `/orders/suppliers/:orderId` | Edit supplier order | Orders |
| `/notifications` | Notifications centre | System |
| `*` | 404 Not Found | System |
