# AGS ERP Desktop — Production Testing Plan

> **Reference:** [features.md](./features.md)  
> **How to use:** Work through each section in order. For each test case, mark ✅ PASS / ❌ FAIL. If FAIL, note the case number and attach a screenshot.

---

## Legend

| Symbol | Meaning |
|--------|---------|
| ✅ | Test passed |
| ❌ | Test failed — note case number and screenshot |
| ⚠️ | Edge case — pay extra attention |
| 🔄 | Requires app restart to verify |

---

## Section 1: Authentication & Login

### 1A. Login — Happy Path

| Case | Steps | Expected Result | Status |
|------|-------|-----------------|--------|
| 1A.1 | Open app (fresh launch) | Login page shown, no auto-redirect |✓|
| 1A.2 | Enter correct username + password → click "Sign In" | Toast "Login Successful", redirected to `/invoice` |✓|
| 1A.3 | Close app and reopen | Should still be logged in (localStorage persistence) |✓|
| 1A.4 | Click Logout in sidebar | Toast "Logged out successfully", redirected to `/login` |✓|
| 1A.5 | After logout, try navigating to `/invoice` via URL | Redirected back to `/login` |✓|

### 1B. Login — Error & Edge Cases

| Case | Steps | Expected Result | Status |
|------|-------|-----------------|--------|
| 1B.1 | Enter wrong username, correct password → Sign In | Error "Wrong username or password" shown |✓|
| 1B.2 | Enter correct username, wrong password → Sign In | Error "Wrong username or password" shown |✓|
| 1B.3 | Leave both fields empty → Sign In | Browser native required field validation |✓|
| 1B.4 | Leave username empty, fill password → Sign In | Browser validation blocks submit |✓|
| 1B.5 | Leave password empty, fill username → Sign In | Browser validation blocks submit |✓|
| 1B.6 | ⚠️ Paste username/password with trailing spaces | Should still work (if credentials match after trim, otherwise fail) |✓|
| 1B.7 | Toggle show/hide password icon | Password field toggles between text/password type |✓|
| 1B.8 | When already logged in, navigate to `/login` | Should redirect to `/invoice` automatically |✓|

---

## Section 2: Navigation & Layout

### 2A. Sidebar Navigation

| Case | Steps | Expected Result | Status |
|------|-------|-----------------|--------|
| 2A.1 | Click "Estimate" in SALES section | Navigates to `/invoice`, item highlighted blue |✓|
| 2A.2 | Click "Quick Sales" dropdown → "New Quick Sale" | Navigates to `/quick-sales/create` |✓|
| 2A.3 | Click "Quick Sales" dropdown → "View Quick Sales" | Navigates to `/quick-sales/list` |✓|
| 2A.4 | Click "Price List" | Navigates to `/price-list` |✓|
| 2A.5 | Click "Accounts" dropdown → "Customers" | Navigates to `/accounts/customers` |✓|
| 2A.6 | Click "Accounts" dropdown → "Suppliers" | Navigates to `/accounts/suppliers` |✓|
| 2A.7 | Click "Orders" dropdown → "Customer Orders" | Navigates to `/orders/customers` |✓|
| 2A.8 | Click "Orders" dropdown → "Supplier Orders" | Navigates to `/orders/suppliers` |✓|
| 2A.9 | Click "Logout" at bottom | Logs out, redirects to login |✓|
| 2A.10 | Navigate to a sub-route (e.g. customer detail) | Parent dropdown auto-expands, sub-item highlighted | |
| 2A.11 | Navigate to non-existent route (e.g. `/xyz`) | 404 Not Found page shown |✓|

### 2B. Mobile Responsiveness

| Case | Steps | Expected Result | Status |
|------|-------|-----------------|--------|
| 2B.1 | Resize window to < 768px width | Sidebar collapses, hamburger menu appears |✓|
| 2B.2 | Click hamburger menu | Sidebar slides in from left with backdrop |✓|
| 2B.3 | Click backdrop | Sidebar closes |✓|
| 2B.4 | Navigate via mobile sidebar | Sidebar closes after navigation |✓|
| 2B.5 | Resize window back to > 768px | Sidebar reappears in fixed position |✓|

---

## Section 3: Estimate / Invoice Module

### 3A. Create Invoice — Happy Path

| Case | Steps | Expected Result | Status |
|------|-------|-----------------|--------|
| 3A.1 | Navigate to `/invoice` | Blank form, auto-generated invoice ID (E-{N}) | |
| 3A.2 | Type customer name in buyer field | Dropdown shows matching customers | |
| 3A.3 | Select a customer from dropdown | Name, address, mobile auto-filled | |
| 3A.4 | Search a product in "Add New Item" | Dropdown shows matching products with prices | |
| 3A.5 | Select product from dropdown | Product name, size, rate auto-filled | |
| 3A.6 | Enter quantity (e.g., 5) → click "Add Item" | Item added to table, total calculated | |
| 3A.7 | Add 2–3 more items | All items in table, running total updates | |
| 3A.8 | Enter packing=50, freight=100, riksha=50 | Grand total = items_total + 200, round-off shown | |
| 3A.9 | Enter payment amount, select type, set date | Payment section populated | |
| 3A.10 | Enter a remark | Remark field populated | |
| 3A.11 | Click "Save" | Toast "Invoice saved", save button → "Print" button | |
| 3A.12 | Click "Print" after save | Print dialog opens, invoice layout clean | |
| 3A.13 | Click "New" button | Form resets, new invoice ID generated | |

### 3B. Edit Invoice

| Case | Steps | Expected Result | Status |
|------|-------|-----------------|--------|
| 3B.1 | Navigate to `/invoice/{existing_id}` | Existing invoice loaded with all fields | |
| 3B.2 | Modify a line item quantity | Total recalculates, "Save" button appears | |
| 3B.3 | Delete a line item | Item removed, total updates | |
| 3B.4 | Click edit icon on a line item | Item loaded into "Add New Item" form for editing | |
| 3B.5 | Change the price in edit form → Add | Item updated, price synced to price list (toast) | |
| 3B.6 | Add new items to existing invoice | Items appended, total updates | |
| 3B.7 | Change packing/freight/riksha values | Grand total updates | |
| 3B.8 | Click "Save" after modifications | Toast "Updated", data persisted | |
| 3B.9 | Navigate away without saving (with changes) | Navigation blocker dialog appears | |
| 3B.10 | Click "Stay" on blocker | Remains on invoice page | |
| 3B.11 | Click "Leave" on blocker | Navigates away, changes lost | |

### 3C. Delete Invoice

| Case | Steps | Expected Result | Status |
|------|-------|-----------------|--------|
| 3C.1 | Open existing invoice → click "Delete" | Confirmation modal appears | |
| 3C.2 | Click "Cancel" on delete modal | Modal closes, invoice intact | |
| 3C.3 | Press Escape on delete modal | Modal closes | |
| 3C.4 | Click backdrop of delete modal | Modal closes | |
| 3C.5 | Click "Confirm Delete" | Invoice deleted, navigated to blank form, toast shown | |
| 3C.6 | Create new invoice after deletion | Should reuse the deleted invoice number | |

### 3D. Invoice — Edge Cases ⚠️

| Case | Steps | Expected Result | Status |
|------|-------|-----------------|--------|
| 3D.1 | Try saving invoice without selecting customer | Validation error / toast | |
| 3D.2 | Try saving invoice with 0 line items | Validation error | |
| 3D.3 | Try adding item with empty product name | Form validation: "Product is required" | |
| 3D.4 | Try adding item with quantity = 0 | Error toast: "valid quantity" | |
| 3D.5 | Try adding item with negative quantity | Error toast | |
| 3D.6 | Try adding item with price = 0 | Error toast: "valid selling price" | |
| 3D.7 | Enter decimal quantity (e.g., 2.5) | Accepted, stored as 2.500 | |
| 3D.8 | Enter very large quantity (e.g., 999999) | Should save correctly | |
| 3D.9 | Type a product name NOT in the database | "No products found — will create new" message shown | |
| 3D.10 | Add that new product with full details | Product created in DB + added to invoice (toast) | |
| 3D.11 | ⚠️ Select existing product, then modify name | Treated as new product, new code generated | |
| 3D.12 | ⚠️ Select product, change price, add | Price synced to Price List (toast: "Price updated") | |
| 3D.13 | Type customer name not in DB | Should allow typing but not create account | |
| 3D.14 | ⚠️ Try submitting form while payment amount is 0 | Save should work, no jama entry created | |
| 3D.15 | ⚠️ Enter payment amount = -500 in the payment field, fill all other required fields, click Save | **Expected:** The system should show a validation error (toast: "Payment amount must be positive") and prevent saving. **Current behavior:** The code uses `parseFloat(payment_amount) || 0` and checks `> 0`, so -500 passes the parseFloat but fails `> 0` — no jama entry is created, but the negative value is stored on the invoice header. **Acceptance:** Either (a) clamp/reject negative input at the UI level, or (b) block save with an explicit error. Verify that no jama entry is created for negative amounts and that the stored `payment_amount` is never negative. | |
| 3D.16 | ⚠️ Check print layout has Marathi product names | If transliteration exists, shown on print | |
| 3D.17 | Verify clear button (X) on product name input | Clears product name, code, size, price fields | |
| 3D.18 | Navigate between product name → qty via Tab | Tab lands on qty (for existing product) | |
| 3D.19 | Navigate product name → size via Tab (new product) | Tab lands on size (for ad-hoc product) | |
| 3D.20 | Use Arrow keys in product dropdown | Highlights items up/down | |
| 3D.21 | Press Enter on highlighted dropdown item | Selects the item | |
| 3D.22 | Press Escape in product dropdown | Dropdown closes | |

---

## Section 4: Price List / Product Catalog

### 4A. Product List View

| Case | Steps | Expected Result | Status |
|------|-------|-----------------|--------|
| 4A.1 | Navigate to `/price-list` | Paginated product list shown | |
| 4A.2 | Type in search box | Table filters in real-time by name/code | |
| 4A.3 | Clear search | All products shown again | |
| 4A.4 | Click a column header (e.g., Name) | Table sorts ascending | |
| 4A.5 | Click same header again | Table sorts descending | |
| 4A.6 | Navigate pagination (next, prev, page numbers) | Correct page shown | |
| 4A.7 | Click on a product row | Navigates to edit page for that product | |

### 4B. Add Product

| Case | Steps | Expected Result | Status |
|------|-------|-----------------|--------|
| 4B.1 | Navigate to `/price-list/add` | Blank product form | |
| 4B.2 | Fill in: Name="Test Product", Size="500g", Cost=10, Sell=20 | Fields populated | |
| 4B.3 | Click Save | Product created, toast shown, redirected to list | |
| 4B.4 | Verify product appears in list | Product visible with correct details | |
| 4B.5 | Verify product code auto-generated | Code = "test-product-500g" (slugified) | |

### 4C. Edit Product

| Case | Steps | Expected Result | Status |
|------|-------|-----------------|--------|
| 4C.1 | Click edit on a product (or click row) | Edit form loaded with existing data | |
| 4C.2 | Change selling price → Save | Price updated, toast shown | |
| 4C.3 | Change product name → Save | Name + code updated, references updated | |
| 4C.4 | Change size → Save | Size + code updated | |
| 4C.5 | Change packing type → Save | Packing type updated | |

### 4D. Delete Product

| Case | Steps | Expected Result | Status |
|------|-------|-----------------|--------|
| 4D.1 | Click delete icon on a product | Delete confirmation modal | |
| 4D.2 | Press Escape | Modal closes, product intact | |
| 4D.3 | Click backdrop | Modal closes | |
| 4D.4 | Click "Delete" in modal | Product soft-deleted, removed from list | |
| 4D.5 | ⚠️ Try deleting product used in an invoice | Should soft-delete (is_deleted=1) without FK error | |

### 4E. Product Edge Cases ⚠️

| Case | Steps | Expected Result | Status |
|------|-------|-----------------|--------|
| 4E.1 | Try creating product without name | Validation error | |
| 4E.2 | ⚠️ Create product with duplicate name+size | Error: "Product code already exists" | |
| 4E.3 | Create product with cost_price but no selling_price | Should save (selling_price = 0) | |
| 4E.4 | Create product with no size | Code = slugified name only | |
| 4E.5 | ⚠️ Create product with special characters in name | Code properly slugified | |
| 4E.6 | Search for product by product code | Should match | |
| 4E.7 | Verify Marathi name column shows transliteration | Present if auto-transliteration ran | |

---

## Section 5: Quick Sales

### 5A. Create Quick Sale

| Case | Steps | Expected Result | Status |
|------|-------|-----------------|--------|
| 5A.1 | Navigate to `/quick-sales/create` | Blank QS form, auto-generated QS ID | |
| 5A.2 | Search and add products | Items appear in table | |
| 5A.3 | Change date | Date field updated | |
| 5A.4 | Enter remark | Remark populated | |
| 5A.5 | Click Save | QS saved, toast shown | |
| 5A.6 | Click Print | Print-optimized view | |

### 5B. Edit Quick Sale

| Case | Steps | Expected Result | Status |
|------|-------|-----------------|--------|
| 5B.1 | Navigate to `/quick-sales/{qs_id}` | Existing QS loaded | |
| 5B.2 | Add more items | Total updates | |
| 5B.3 | Delete items | Total updates | |
| 5B.4 | Click Save | Updated successfully | |
| 5B.5 | Navigate away with unsaved changes | Navigation blocker appears | |

### 5C. List & Delete Quick Sales

| Case | Steps | Expected Result | Status |
|------|-------|-----------------|--------|
| 5C.1 | Navigate to `/quick-sales/list` | Paginated list of QS | |
| 5C.2 | Search by QS ID | List filters | |
| 5C.3 | Click delete on a QS row | Delete modal appears | |
| 5C.4 | Confirm delete | QS deleted, removed from list, ID recycled | |
| 5C.5 | ⚠️ Click QS ID to navigate to detail | Opens edit form | |

### 5D. Quick Sales Edge Cases ⚠️

| Case | Steps | Expected Result | Status |
|------|-------|-----------------|--------|
| 5D.1 | Try saving QS with 0 items | Validation error | |
| 5D.2 | Add ad-hoc/temporary item not in DB | Item saved with `is_temporary=1` | |
| 5D.3 | Delete a QS, then create a new one | New QS should reuse deleted ID | |
| 5D.4 | Press Escape on delete modal | Modal closes | |
| 5D.5 | Click backdrop on delete modal | Modal closes | |

---

## Section 6: Customer Accounts

### 6A. Customer List

| Case | Steps | Expected Result | Status |
|------|-------|-----------------|--------|
| 6A.1 | Navigate to `/accounts/customers` | Paginated customer list | |
| 6A.2 | Search by customer name | List filters | |
| 6A.3 | Click "Add Customer" button | Navigates to add form | |
| 6A.4 | Click a customer's name | Navigates to detail page | |

### 6B. Add Customer

| Case | Steps | Expected Result | Status |
|------|-------|-----------------|--------|
| 6B.1 | Fill name → Save | Customer created with auto-ID | |
| 6B.2 | Fill name + address + mobile → Save | All fields persisted | |
| 6B.3 | ⚠️ Try saving with empty name | Validation error | |
| 6B.4 | ⚠️ Create customer with duplicate name | Should succeed (names don't have to be unique) | |

### 6C. Edit Customer

| Case | Steps | Expected Result | Status |
|------|-------|-----------------|--------|
| 6C.1 | Navigate to edit page for existing customer | Form pre-filled | |
| 6C.2 | Change name → Save | Name updated | |
| 6C.3 | Change address, mobile → Save | Fields updated | |

### 6D. Delete Customer

| Case | Steps | Expected Result | Status |
|------|-------|-----------------|--------|
| 6D.1 | Delete customer with NO dependencies | Successfully deleted | |
| 6D.2 | ⚠️ Delete customer WITH maal entries | Blocked: error shows "X maal entries" | |
| 6D.3 | ⚠️ Delete customer WITH jama entries | Blocked: error shows "X jama entries" | |
| 6D.4 | ⚠️ Delete customer WITH orders | Blocked: error shows "X orders" | |
| 6D.5 | ⚠️ Delete customer with deps, all counts=0 but flag=true | Fallback message: "existing dependencies" | |
| 6D.6 | Press Escape on delete modal | Modal closes | |
| 6D.7 | Click backdrop on delete modal | Modal closes | |

### 6E. Customer Account Detail Page

| Case | Steps | Expected Result | Status |
|------|-------|-----------------|--------|
| 6E.1 | Navigate to customer detail page | Header shows name, address, mobile | |
| 6E.2 | Maal entries table shows all credit entries | Dates, invoice numbers, amounts, remarks visible | |
| 6E.3 | Jama entries table shows all payment entries | Dates, types, amounts, remarks visible | |
| 6E.4 | Grand total calculation shown | Maal Total - Jama Total = Outstanding | |
| 6E.5 | Filter entries by "Maal" | Only maal entries shown | |
| 6E.6 | Filter entries by "Jama" | Only jama entries shown | |
| 6E.7 | Filter entries by "All" | Both types shown | |
| 6E.8 | Pagination works | Can navigate between pages | |
| 6E.9 | Search within entries | Filters by remark/invoice no | |

### 6F. Maal Entry CRUD

| Case | Steps | Expected Result | Status |
|------|-------|-----------------|--------|
| 6F.1 | Click "Add Maal" → fill date, invoice_no, amount, remark → Save | Entry created, table refreshes | |
| 6F.2 | Click edit on a maal entry → modify → Save | Entry updated | |
| 6F.3 | Click delete on a maal entry → Confirm | Entry deleted | |
| 6F.4 | ⚠️ Try editing maal entry linked to an invoice | Should be blocked (lock icon, edit guard) | |
| 6F.5 | ⚠️ Try deleting maal entry linked to an invoice | Should be blocked | |
| 6F.6 | ⚠️ Add maal with amount = 0 | Should be handled (error or allow) | |
| 6F.7 | ⚠️ Add maal without date | Validation error | |

### 6G. Jama Entry CRUD

| Case | Steps | Expected Result | Status |
|------|-------|-----------------|--------|
| 6G.1 | Click "Add Jama" → fill date, type=Cash, amount, remark → Save | Entry created | |
| 6G.2 | Change payment type to UPI → Save | Type updated | |
| 6G.3 | Change to Transfer type → Save | Type updated | |
| 6G.4 | Change to RTGS type → Save | Type updated | |
| 6G.5 | Click edit on jama entry → modify → Save | Entry updated | |
| 6G.6 | Click delete on regular jama entry → Confirm | Entry deleted | |
| 6G.7 | ⚠️ Try deleting jama entry linked to an invoice | Blocked: "linked to an invoice" | |
| 6G.8 | ⚠️ Try deleting jama entry linked to an order | Blocked: "linked to an order" | |
| 6G.9 | ⚠️ Add jama with amount = 0 | Should handle gracefully | |

### 6H. Payment Reminder

| Case | Steps | Expected Result | Status |
|------|-------|-----------------|--------|
| 6H.1 | Enable reminder toggle | Reminder activated | |
| 6H.2 | Set reminder days = 30 | Value persisted | |
| 6H.3 | ⚠️ Try setting reminder days = 0 | Should clamp to 1 | |
| 6H.4 | ⚠️ Try setting reminder days = 400 | Should clamp to 365 | |
| 6H.5 | ⚠️ Paste non-numeric value into days | Should default to 1 | |
| 6H.6 | Disable reminder toggle | Reminder deactivated | |
| 6H.7 | ⚠️ Simulate save failure on reminder | Days should rollback to last saved value | |

---

## Section 7: Supplier Accounts

### 7A. Supplier List

| Case | Steps | Expected Result | Status |
|------|-------|-----------------|--------|
| 7A.1 | Navigate to `/accounts/suppliers` | Paginated supplier list | |
| 7A.2 | Search by supplier name | List filters | |
| 7A.3 | Click "Add Supplier" | Navigates to add form | |
| 7A.4 | Click a supplier's name | Navigates to detail page | |

### 7B. Add/Edit/Delete Supplier

| Case | Steps | Expected Result | Status |
|------|-------|-----------------|--------|
| 7B.1 | Fill name → Save | Supplier created with auto-ID | |
| 7B.2 | Fill all fields → Save | All persisted | |
| 7B.3 | ⚠️ Save with empty name | Validation error | |
| 7B.4 | Edit existing supplier → Save | Updates persisted | |
| 7B.5 | Delete supplier with NO dependencies | Deleted | |
| 7B.6 | ⚠️ Delete supplier WITH maal/jama/orders | Blocked with dependency count | |
| 7B.7 | ⚠️ Delete supplier with deps but zero counts | Fallback "existing dependencies" message | |

### 7C. Supplier Account Detail

| Case | Steps | Expected Result | Status |
|------|-------|-----------------|--------|
| 7C.1 | View maal (purchase) entries | All entries visible | |
| 7C.2 | View jama (payment) entries | All entries visible | |
| 7C.3 | Grand total shows outstanding | Correct calculation | |
| 7C.4 | Add maal entry → Save | Created successfully | |
| 7C.5 | Edit maal entry → Save | Updated | |
| 7C.6 | Delete maal entry | Deleted | |
| 7C.7 | Add jama entry → Save | Created | |
| 7C.8 | Edit jama entry → Save | Updated | |
| 7C.9 | Delete regular jama entry | Deleted | |
| 7C.10 | ⚠️ Delete jama entry linked to supplier order | Blocked: "linked to an order" | |
| 7C.11 | Payment reminder (same tests as 6H) | Same behavior as customer | |

---

## Section 8: Customer Orders

### 8A. List Customer Orders

| Case | Steps | Expected Result | Status |
|------|-------|-----------------|--------|
| 8A.1 | Navigate to `/orders/customers` | Paginated order list | |
| 8A.2 | Search by order ID or customer name | List filters | |
| 8A.3 | Filter by status "Received" | Only received orders shown | |
| 8A.4 | Filter by status "In Progress" | Only in-progress shown | |
| 8A.5 | Filter by status "Completed" | Only completed shown | |
| 8A.6 | Filter by "All" | All orders shown | |
| 8A.7 | Sort by date | Orders sorted | |

### 8B. Create Customer Order

| Case | Steps | Expected Result | Status |
|------|-------|-----------------|--------|
| 8B.1 | Navigate to `/orders/customers/add` | Blank form, auto-ID | |
| 8B.2 | Select customer, set date, set status | Fields populated | |
| 8B.3 | Search and add product items | Items in table | |
| 8B.4 | Add item remark to a line item | Remark saved | |
| 8B.5 | Add payment: amount=1000, type=Cash | Payment fields populated | |
| 8B.6 | Click Save | Order created, toast shown | |
| 8B.7 | Verify customer jama entry created (if payment > 0) | Jama entry with remark "Order O-C-{N}" | |

### 8C. Edit Customer Order

| Case | Steps | Expected Result | Status |
|------|-------|-----------------|--------|
| 8C.1 | Navigate to `/orders/customers/{id}` | Order loaded | |
| 8C.2 | Add new items | Table updates | |
| 8C.3 | Remove items | Table updates | |
| 8C.4 | Change status | Status field updated | |
| 8C.5 | Modify payment amount | Payment updated | |
| 8C.6 | Click Save | Updated, toast shown | |
| 8C.7 | Navigate away with unsaved changes | Blocker appears | |

### 8D. Delete Customer Order

| Case | Steps | Expected Result | Status |
|------|-------|-----------------|--------|
| 8D.1 | Click delete on order from list | Confirmation modal | |
| 8D.2 | Confirm delete | Order + items deleted, ID recycled | |
| 8D.3 | Press Escape on modal | Modal closes | |
| 8D.4 | Click backdrop | Modal closes | |
| 8D.5 | Create new order after delete | Should reuse deleted ID | |

### 8E. Customer Order Edge Cases ⚠️

| Case | Steps | Expected Result | Status |
|------|-------|-----------------|--------|
| 8E.1 | Try saving order without customer | Validation error | |
| 8E.2 | Try saving order with 0 items | Validation error | |
| 8E.3 | Add ad-hoc (temporary) item not in product DB | Item saved with is_temporary=1 | |
| 8E.4 | Set payment amount=0 | No jama entry created | |
| 8E.5 | Change customer after adding items | Customer ID updates | |
| 8E.6 | Print order | Clean print layout | |
| 8E.7 | ⚠️ Edit order, change payment from 500 to 0 | Existing jama entry should be deleted | |
| 8E.8 | ⚠️ Edit order, add payment where none existed | New jama entry created | |

---

## Section 9: Supplier Orders

### 9A. List Supplier Orders

| Case | Steps | Expected Result | Status |
|------|-------|-----------------|--------|
| 9A.1 | Navigate to `/orders/suppliers` | Paginated order list | |
| 9A.2 | Search orders | Filters work | |
| 9A.3 | Status filter | Filters by Placed/In Progress/Completed | |
| 9A.4 | Sort by date | Orders sorted | |

### 9B. Create Supplier Order

| Case | Steps | Expected Result | Status |
|------|-------|-----------------|--------|
| 9B.1 | Navigate to `/orders/suppliers/add` | Blank form, auto-ID | |
| 9B.2 | Select supplier, set date, status | Fields populated | |
| 9B.3 | Add product items | Items in table | |
| 9B.4 | Add payment: amount=2000, type=UPI | Payment fields populated | |
| 9B.5 | Click Save | Order created | |
| 9B.6 | Verify supplier jama entry created | Jama entry with "Order O-S-{N}" remark | |

### 9C. Edit Supplier Order

| Case | Steps | Expected Result | Status |
|------|-------|-----------------|--------|
| 9C.1 | Load existing order | All fields populated including payment | |
| 9C.2 | Modify items + payment → Save | Updated | |
| 9C.3 | ⚠️ Change payment from 2000 to 0 → Save | Existing jama entry deleted | |
| 9C.4 | ⚠️ Add payment where none existed → Save | New jama entry created | |
| 9C.5 | Navigate away with changes | Blocker appears | |

### 9D. Delete Supplier Order

| Case | Steps | Expected Result | Status |
|------|-------|-----------------|--------|
| 9D.1 | Delete from list → Confirm | Order + items deleted, ID recycled | |
| 9D.2 | Verify payment jama entry is NOT deleted | Advance payment stays in books | |
| 9D.3 | Create new order | Reuses deleted ID | |

### 9E. Supplier Order Edge Cases ⚠️

| Case | Steps | Expected Result | Status |
|------|-------|-----------------|--------|
| 9E.1 | Save without supplier | Validation error | |
| 9E.2 | Save with 0 items | Validation error | |
| 9E.3 | Ad-hoc/temporary items | Saved correctly | |
| 9E.4 | Print supplier order | Clean layout | |
| 9E.5 | ⚠️ Delete order, verify linked payment survives | Jama entry remains | |

---

## Section 10: Marathi Transliteration

| Case | Steps | Expected Result | Status |
|------|-------|-----------------|--------|
| 10.1 | 🔄 Start app with internet connection | Batch transliteration runs for products missing Marathi | |
| 10.2 | Create a new product | Marathi name auto-generated | |
| 10.3 | Check Marathi column in price list | Transliterated names visible | |
| 10.4 | Print an invoice with products | Print shows English + Marathi names | |
| 10.5 | ⚠️ Start app without internet | Transliteration fails gracefully, app works normally | |
| 10.6 | Product with numbers in name (e.g., "Sami 1 No") | Numbers kept as-is, words transliterated | |

---

## Section 11: Data Integrity & System

### 11A. ID Recycling

| Case | Steps | Expected Result | Status |
|------|-------|-----------------|--------|
| 11A.1 | Create invoice E-5, delete it, create new | New invoice gets E-5 | |
| 11A.2 | Create customer order O-C-3, delete it, create new | New order gets O-C-3 | |
| 11A.3 | Create supplier order O-S-3, delete it, create new | New order gets O-S-3 | |
| 11A.4 | Create QS-4, delete it, create new | New QS gets QS-4 | |

### 11B. Foreign Key Constraints

| Case | Steps | Expected Result | Status |
|------|-------|-----------------|--------|
| 11B.1 | Delete customer with invoices | Blocked by dependency check | |
| 11B.2 | Delete customer with orders | Blocked | |
| 11B.3 | Delete supplier with orders | Blocked | |
| 11B.4 | Soft-delete product used in invoices | OK (soft-delete, not hard-delete) | |

### 11C. Transaction Safety

| Case | Steps | Expected Result | Status |
|------|-------|-----------------|--------|
| 11C.1 | Create invoice with 5 items | All 5 items saved atomically | |
| 11C.2 | ⚠️ Simulate failure mid-save (hard to test) | Entire operation should rollback | |

---

## Section 12: Accessibility & UX

### 12A. Modal Accessibility

| Case | Steps | Expected Result | Status |
|------|-------|-----------------|--------|
| 12A.1 | Open any delete modal | Focus moves to modal | |
| 12A.2 | Press Escape | Modal closes | |
| 12A.3 | Click backdrop | Modal closes | |
| 12A.4 | Tab through modal buttons | Focus stays within modal | |
| 12A.5 | Check `role="dialog"` and `aria-modal="true"` | Present in DOM | |
| 12A.6 | Check `aria-labelledby` | Points to modal heading | |

### 12B. Keyboard Navigation

| Case | Steps | Expected Result | Status |
|------|-------|-----------------|--------|
| 12B.1 | Product dropdown: Arrow Down | Moves highlight down | |
| 12B.2 | Product dropdown: Arrow Up | Moves highlight up | |
| 12B.3 | Product dropdown: Enter | Selects highlighted item | |
| 12B.4 | Product dropdown: Escape | Closes dropdown | |
| 12B.5 | Quick Sales list: QS ID focusable via Tab | Can be reached by keyboard | |
| 12B.6 | Press Enter on QS ID | Navigates to QS detail | |

### 12C. Print

| Case | Steps | Expected Result | Status |
|------|-------|-----------------|--------|
| 12C.1 | Print invoice | Sidebar hidden, clean layout | |
| 12C.2 | Print customer order | Clean layout | |
| 12C.3 | Print supplier order | Clean layout | |
| 12C.4 | Print quick sale | Clean layout | |

---

## Section 13: Files to Review for Cleanup

The following files should be reviewed and potentially deleted before production:

| # | File | Reason | Action |
|---|------|--------|--------|
| 13.1 | `server.js` | Legacy Express API — replaced by Electron IPC (`ipcHandlers.js`). Header says "kept for reference/testing only" | **DELETE** |
| 13.2 | `erpApi.js` | Thin wrapper over `window.api` — incomplete (only products + customers), not imported by any component | **DELETE** |
| 13.3 | `src/pages/Home.jsx` | Not used in any route (app redirects `/` to `/invoice`). Dead component. | **DELETE** |
| 13.4 | `src/design.md` | Internal design documentation file — not needed in production bundle | **DELETE** (or move to docs/) |
| 13.5 | `.venv/` | Python virtual environment folder — not related to the Electron/React app | **DELETE** |
| 13.6 | `erp.db` (root) | Referenced in `extraResources` in package.json — only used as template. Verify if this file exists at root | **VERIFY** |

### Dependencies to Review

| # | Package | Reason | Action |
|---|---------|--------|--------|
| 13.7 | `react-icons` | Not imported anywhere (using `lucide-react` instead) | **REMOVE** from devDependencies |
| 13.8 | `reactjs-popup` | Not imported anywhere (custom modals used) | **REMOVE** from devDependencies |
| 13.9 | `lightswind` | Not imported anywhere | **VERIFY** usage, likely **REMOVE** |
| 13.10 | `express`, `cors` | Only used by `server.js` (legacy). If server.js deleted, not needed | **VERIFY** — may not be in deps (only in server.js requires) |

---

## Test Completion Checklist

| Section | # of Cases | Passed | Failed | Notes |
|---------|-----------|--------|--------|-------|
| 1. Auth & Login | 13 | | | |
| 2. Navigation | 16 | | | |
| 3. Invoice | 52 | | | |
| 4. Price List | 29 | | | |
| 5. Quick Sales | 21 | | | |
| 6. Customer Accounts | 50 | | | |
| 7. Supplier Accounts | 22 | | | |
| 8. Customer Orders | 34 | | | |
| 9. Supplier Orders | 23 | | | |
| 10. Marathi | 6 | | | |
| 11. Data Integrity | 10 | | | |
| 12. Accessibility | 16 | | | |
| **TOTAL** | **292** | | | |
