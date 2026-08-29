AGS ERP - Requirements Doc

------------------------------------------------------------------------------------------------------------------------------------------------------------
Invoice
prevent double click on all buttons
Can we remove the nav bar in unit price drop down or can we globally hide the nav bar in the project
New Payment -- in a invoice UI UX is broken we should re design it
Now see when i add a remark in invoice jama entry we can't edit it directly but can we make it editable and show the invoice connected to it (Eg see Vansh Agrawal Invoice -- E-1026)
See in printing Just Show the payment date not the comment and date in ()
See the payment reminder if i delete the number i can't yy and i can enable it over the account and on sepcla invoive too i want
when i click the edit button then too the back button should be visible

Test Acc and Amit Agrawal invoice should be over due check it now
there are two types of notification "Still pending" & Over due
If i add payment and then i add item then the payment should be to awaiting but now it is showing paid
swap leave and stay on the page
------------------------------------------------------------------------------------------------------------------------------------------------------------
Quick Sales

------------------------------------------------------------------------------------------------------------------------------------------------------------
Price List
See when i edit the product and save it, it will not go that product and scroll because it above 25 so it will not work so we need to fix this for all where every this bug is there in pagenation 
------------------------------------------------------------------------------------------------------------------------------------------------------------
Accounts
Customer Credit (Jama), Supplier Debit (Maal) here keep default as Cash, date of today
------------------------------------------------------------------------------------------------------------------------------------------------------------
Customer & Supplier Orders
Same here in orders too add a select customer or supplier, see implement the same thing like invoice page u need to replicate the whole funcailty or else best can u make a common function for all 3 pages and there we can check this.....
------------------------------------------------------------------------------------------------------------------------------------------------------------

See once the Highlight is working after that u should not show it again
See check 
Add GST Number for GST bill Add GST number to customers/suppliers, GST rate per product, CGST/SGST/IGST calculation on invoices. Essential if the business needs tax compliance.

Add stock


See performance issues


No input validation on IPC handlers — most handlers trust the renderer data blindly. SQL injection isn't possible (parameterized queries), but invalid data types could cause crashes.

verbose: console.log on the DB connection logs every SQL statement to console. Should be disabled in production builds.


-----------------------------------------------------------------

Verify each finding against current code. Fix only still-valid issues, skip the rest with a brief reason, keep changes minimal, and validate.

In @ipcHandlers.js around lines 969 - 989, Update the pass-2 clearOverdue logic to compute each matched invoice’s correct status instead of unconditionally assigning 'awaiting_payment'. Reuse the status rules from recalculateInvoiceStatus, including 'paid' when payments fully cover the invoice and 'partially_paid' when total_paid is positive but incomplete; only use 'awaiting_payment' for invoices with no payment. Keep the existing overdue qualification conditions intact.

Verify each finding against current code. Fix only still-valid issues, skip the rest with a brief reason, keep changes minimal, and validate.

In @src/modules/accounts/AddAccountEntry.jsx around lines 92 - 100, Update the confirmed-delete flow in AddAccountEntry, immediately before its navigate() call, to set savedRef.current = true. This must bypass the useBlocker and beforeunload protections after successful deletion while preserving the existing isDirty behavior for unsaved edits.


Verify each finding against current code. Fix only still-valid issues, skip the rest with a brief reason, keep changes minimal, and validate.

In @src/modules/accounts/AddBuyerAccount.jsx around lines 73 - 77, Update the create-mode branch of the isDirty useMemo in AddBuyerAccount to return true when name, address, or mobile contains input, while preserving the existing edit-mode comparison and dependency list.

Verify each finding against current code. Fix only still-valid issues, skip the rest with a brief reason, keep changes minimal, and validate.

In @src/modules/accounts/AddBuyerAccount.jsx around lines 79 - 88, Update the confirmed-deletion flow near the navigation call to assign savedRef.current = true before navigating, so the blocker and beforeunload handler allow navigation even when isDirty remains true. Keep the existing deletion confirmation and navigation behavior unchanged.

Verify each finding against current code. Fix only still-valid issues, skip the rest with a brief reason, keep changes minimal, and validate.

In @src/modules/accounts/AddSupplierAccount.jsx around lines 71 - 75, Update the create-mode branch of the isDirty useMemo to treat non-empty address or mobile values as dirty in addition to name. Preserve the existing edit-mode comparisons and the false result when originalValues is unavailable.


Verify each finding against current code. Fix only still-valid issues, skip the rest with a brief reason, keep changes minimal, and validate.

In @src/modules/accounts/AddSupplierAccount.jsx around lines 77 - 86, Update the successful delete flow in the supplier account component to set savedRef.current = true before performing the post-delete navigation. Ensure this terminal action bypasses both the useBlocker callback and beforeunload handler while preserving existing behavior for other edited-form navigation.


Verify each finding against current code. Fix only still-valid issues, skip the rest with a brief reason, keep changes minimal, and validate.

In @src/modules/accounts/AddSupplierAccountEntry.jsx around lines 95 - 103, Update the successful delete flow near the navigation at line 172 to set savedRef.current = true before triggering navigation. Ensure the useBlocker predicate and beforeunload handler recognize the deleted entry as saved and no longer block that navigation.


Verify each finding against current code. Fix only still-valid issues, skip the rest with a brief reason, keep changes minimal, and validate.

In @src/modules/invoice/Invoice.jsx around lines 398 - 399, Make the submission indicators reactive in Invoice by adding isAddingItem and isPaymentSubmitting state alongside the existing synchronous guard refs. Set each state value when its corresponding Add Item or payment IPC request starts and finishes, and use those state values to disable the controls and render “Adding...”/“Saving...” while requests are in flight; keep the refs for duplicate-submission protection.


Verify each finding against current code. Fix only still-valid issues, skip the rest with a brief reason, keep changes minimal, and validate.

In @src/modules/invoice/Invoice.jsx around lines 1300 - 1333, Add a catch handler to handleSavePayment around the invoiceAddPayment/invoiceUpdatePayment awaits, displaying the rejected error through toast.error. Keep the existing validation and success flow unchanged, and retain the finally block so isPaymentSubmittingRef is always released.


Verify each finding against current code. Fix only still-valid issues, skip the rest with a brief reason, keep changes minimal, and validate.

In @src/modules/orders/CustomerOrder.jsx around lines 114 - 140, Update the return-state handling in the auto-scroll effect to clear returnedFromOrder through the router/navigation API rather than window.history.replaceState, ensuring useLocation() receives the cleared state and the effect cannot replay after orders or processedOrders changes. Preserve the existing paging, scrolling, highlighting, and timer behavior.


Verify each finding against current code. Fix only still-valid issues, skip the rest with a brief reason, keep changes minimal, and validate.

In @src/modules/orders/SupplierOrder.jsx around lines 114 - 141, Update the return-state clearing in the useEffect handling location.state?.returnedFromOrder to use the router’s navigation API, such as navigate with replace, so useLocation() receives the cleared state. Preserve the existing pagination, scrolling, highlighting, and cleanup behavior while preventing the effect from replaying after refresh, filtering, sorting, or page-size changes.