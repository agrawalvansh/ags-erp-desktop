# Invoice Page: Customer Flow Analysis
**File Analyzed**: `src/modules/invoice/Invoice.jsx`

This report details the exact flow and functionality of how the `Invoice.jsx` page handles customer search, creation of missing customers, and profile updates.

## 1. Customer Search & Selection
The customer search is an inline, controlled autocomplete field integrated directly into the invoice header.

- **Data Loading**: On component mount, the invoice page fetches the entire customer list (`window.api.getCustomers()`) into a local React state array (`customers`).
- **Typing & Filtering**: As the user types into the "Customer Search" input, the local `customers` array is filtered in real-time (`c.name.toLowerCase().includes(buyer.toLowerCase())`).
- **Dropdown Navigation**: The dropdown supports keyboard navigation (Arrow Up, Arrow Down, Enter, Escape). 
- **Selection**: When a customer is selected (via click or Enter), the `handleSelectCustomer` function executes. This sets the local `buyer`, `customerId`, `address`, and `mobileNo` states, auto-filling the fields on the invoice form. It also pre-fills the invoice's "Due Days" if the customer has a default `reminder_days` set.

## 2. Handling Missing Customers (Not Found in DB)
If a user types a customer name that does not exactly match an existing record, the app initiates a specialized creation flow.

- **The `onBlur` Trigger**: When the user clicks away from the search input (`handleCustomerBlur`), the app checks if text was entered but no `customerId` was resolved.
- **Fuzzy Word-Level Matching**: Before immediately prompting to create a new customer, the app splits the input into words and checks if *any* word matches *any* word in the existing customer database. 
- **"Customer Not Found" Modal (`showNewCustModal`)**: 
  - **"Did you mean?"**: If the fuzzy match finds similar names, it displays them in a list, allowing the user to quickly select an existing customer they might have misspelled.
  - **Creation Prompt**: If no similar names are found (or if the user rejects the suggestions), it presents a button to **"Add New Customer"**.
- **Auto-Creation (`handleCreateNewCustomer`)**: 
  - If the user clicks "Add New Customer", the app dynamically generates a new Customer ID (e.g., `AGS-C-123`) by finding the highest existing numeric suffix.
  - It immediately invokes `window.api.invoke('customers:create', ...)` using the typed name and whatever address/mobile was typed in the UI.
  - The local `customers` list is refreshed, the new `customerId` is selected, and a success toast is shown.

## 3. Inline Customer Profile Updates
The app smartly detects if the user edits customer details directly on the invoice form and prompts them to sync the changes back to the database.

- **Dirty Checking on Save**: When the user clicks "Save Invoice" (`handleSave`), the app compares the current `mobileNo` and `address` state against the original data stored in the local `customers` array for the selected `customerId`.
- **Interception (`showCustUpdateModal`)**: If a discrepancy is found (e.g., the user changed the mobile number), the invoice save process is paused. A modal appears asking: *"Customer mobile or address has changed. Save these changes to the customer profile?"*
- **User Choices**:
  - **Update (`handleCustUpdateConfirm`)**: Invokes `window.api.invoke('customers:update', ...)` to permanently save the new address/mobile to the customer's master record. It then resumes saving the invoice.
  - **Skip (`handleCustUpdateSkip`)**: Bypasses the profile update, allowing the new address/mobile to exist *only* on this specific invoice document. The invoice save is resumed.

## Summary of Mechanics
- **State Management**: Heavily relies on React refs (`custActionRef`, `pendingSaveRef`) to coordinate complex async flows (like pausing a save to show a modal, or distinguishing between a blur event and a dropdown click).
- **Backend Reliance**: Relies on a full client-side cache of all customers. While this makes the fuzzy search and dirty-checking extremely fast, it contributes to the unbounded query memory issues noted in the previous performance audit.
