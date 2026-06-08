# AGS ERP — Design System Reference

> **Who is this for?** Any developer (or AI assistant) maintaining or extending this app.  
> All UI must follow these exact tokens. When in doubt, open `Invoice.jsx` — it is the canonical reference page.

---

## Quick Rules

- **Never** hardcode a colour that isn't in the palette below.  
- **Never** use a Tailwind generic colour (`blue-600`, `gray-500`, `red-500`, etc.) — always use the explicit hex tokens.  
- **Never** add a dark overlay modal (`bg-black/40`) — the app uses glass overlays everywhere.  
- **Always** use the shared modal components. Do not copy-paste modal JSX into a new file.

---

## 1 — Colour Palette

| Token Name | Hex | Where to use |
|---|---|---|
| **Primary** | `#004AC6` | Icons, links, accents, grand total text |
| **Primary Container** | `#2563EB` | Buttons, active states, QS ID badge |
| **Background** | `#F7F9FB` | Page background |
| **Surface Lowest** | `#FFFFFF` | Cards, table body, modals |
| **Surface Container Low** | `#F2F4F6` | Input backgrounds, table header rows |
| **Surface Container** | `#ECEEF0` | Dividers, horizontal rules |
| **Surface Container High** | `#E6E8EA` | Secondary button background |
| **Surface Dim** | `#F8FAFC` | Top bar background, list-page header row |
| **On-Surface (heading)** | `#191C1E` | Headings, high-emphasis labels, bold text |
| **On-Surface (body)** | `#0F172A` | Body copy, lower-emphasis content |
| **On-Surface Variant** | `#434655` | Input labels, secondary text |
| **Muted Text** | `#64748B` | Table cell text, helper descriptions |
| **Outline Variant** | `#C3C6D7` | Borders — always add `/10` or `/20` opacity |
| **Border Soft** | `#E2E8F0` | Card borders, header borders |
| **Error (text)** | `#BA1A1A` | Inline validation messages, required asterisks |
| **Error (action)** | `#DC2626` | Delete buttons, error icons, active error states |
| **Pill Background** | `#D0E1FB` | Item count pill background — use at `/30` opacity |
| **Pill Text** | `#54647A` | Item count pill text |
| **Secondary Hover** | `#E0E3E5` | Secondary button hover state |
| **Dropdown Highlight** | `#EFF6FF` | Active / highlighted dropdown row |

> **Implementation note:** All colour tokens are also defined as CSS custom
> properties in `index.css` `:root {}`. However, code uses Tailwind arbitrary
> values (`text-[#004AC6]`) directly — the CSS variables are not actively consumed.
> They exist for reference and potential future use.

---

## 2 — Typography

Every text element has a fixed class combination. Do not mix and match.

| Element | Tailwind Classes |
|---|---|
| Page title (list pages) | `text-3xl font-extrabold tracking-tight text-[#191C1E]` |
| Page subtitle | `text-sm font-medium text-[#434655]` |
| Section label | `text-xs font-bold text-[#434655] uppercase` |
| Input label | `text-[10px] font-bold text-[#434655] uppercase mb-1.5 ml-1` |
| Table header — list | `text-[11px] font-bold text-[#434655] uppercase tracking-wider` |
| Table header — create | `text-[10px] font-extrabold text-[#434655] uppercase tracking-wider` |
| Table body text | `text-sm text-[#64748B]` |
| Table body bold | `text-sm font-medium text-[#0F172A]` |
| Amount — list page | `font-black text-[#0F172A]` |
| Amount — create page | `font-semibold text-[#2563EB]` |
| Grand total | `text-2xl font-black text-[#004AC6]` |

---

## 3 — Form Inputs

All `<input>`, `<select>`, and `<textarea>` elements use this base:

```
bg-[#F2F4F6] border-none rounded-lg text-sm
py-2.5 px-3
focus:bg-white focus:ring-2 focus:ring-[#004AC6]/15 transition-all
```

**Error state** — add these classes on top when validation fails:

```
ring-2 ring-[#BA1A1A]/30
```

**Read-only / disabled** — use:

```
bg-[#ECEEF0] cursor-not-allowed
```

---

## 4 — Buttons

### Primary — gradient (main CTA, e.g. Save, Add)

```
bg-gradient-to-br from-[#004AC6] to-[#2563EB]
text-white font-bold text-sm rounded-xl
shadow-lg shadow-[#004AC6]/20
hover:opacity-90 active:scale-95 transition-all
disabled:opacity-50
```

Always use `style={{ background: 'linear-gradient(135deg, #004AC6 0%, #2563EB 100%)' }}` if the gradient class doesn't render correctly in Tailwind v4.  
Always include `<Save size={16} />` icon before the label. Wrap with `flex items-center gap-2`.

### Delete

```
bg-[#DC2626] text-white font-bold text-sm rounded-xl
hover:bg-red-700 active:scale-95 transition-colors
disabled:opacity-50
```

Always include `<Trash2 size={16} />` icon before the label.

### Secondary / Cancel

```
bg-[#E6E8EA] text-[#191C1E] font-bold text-sm rounded-xl
hover:bg-[#E0E3E5] transition-colors
```

No icon. Text only.

### Action icon (edit, view)

```
p-2 rounded-full
text-[#434655] hover:text-[#004AC6]
hover:bg-white hover:shadow-sm transition-all
```

### Delete icon (inline row delete)

```
p-2 rounded-full
text-[#434655] hover:text-[#DC2626]
hover:bg-white hover:shadow-sm transition-all
```

### Pagination — active page

```
w-9 h-9 rounded-lg bg-[#004AC6] text-white font-bold text-sm
```

### Pagination — inactive page

```
w-9 h-9 rounded-lg text-[#434655] font-bold text-sm
hover:bg-white transition-colors
```

---

## 5 — Page Layouts

### List pages (BuyerAccount, PriceList, CustomerOrder, etc.)

```
Page background:  bg-[#F7F9FB]

Header block:
  flex items-end justify-between gap-6 mb-10

  Title:        text-3xl font-extrabold tracking-tight text-[#191C1E]
  Subtitle:     text-sm font-medium text-[#434655]
  Search input: w-72 bg-white border border-[#C3C6D7]/20 rounded-lg
                py-2.5 pl-10 pr-10 text-sm
                focus:border-[#004AC6] focus:ring-4 focus:ring-[#004AC6]/5
  New button:   bg-gradient-to-br from-[#004AC6] to-[#2563EB]
                text-white font-semibold px-5 py-2.5 rounded-lg
                shadow-lg shadow-[#004AC6]/20 active:scale-95
```

### Simple create / edit form pages (AddBuyerAccount, AddPriceListProduct, etc.)

```jsx
<header className="bg-[#F7F9FB] flex items-center gap-4 px-8 py-5">
  <button className="flex items-center gap-2 text-[#434655] hover:text-[#004AC6]
    transition-colors group cursor-pointer">
    <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
    <span className="text-sm font-medium">Back to [Parent Page Name]</span>
  </button>
  <div className="bg-[#ECEEF0] h-6 w-[1px]" />
  <h1 className="text-lg font-bold text-[#191C1E]">[Page Title]</h1>
</header>

<main className="flex flex-col items-center px-4 py-8 md:py-12">
  {/* content */}
</main>
```

### Full-width editor pages (Invoice, AddCustomerOrder, AddSupplierOrder, CreateQuickSales)

```
Top bar container:  px-4 sm:px-6 py-4 border-b border-[#E2E8F0] bg-[#F8FAFC]

  Reference label:  text-xs font-medium text-[#64748B] uppercase tracking-wider
  Reference value:  text-sm font-bold text-[#2563EB]
  Page title:       text-xl sm:text-2xl font-bold text-[#0F172A] tracking-wide
  Date input:       text-sm font-semibold text-[#0F172A]
                    border border-[#E2E8F0] rounded-md px-2 py-1
```

> These pages intentionally use a different top-bar pattern from simple form pages.
> Do not try to unify them.

---

## 6 — Tables

### List page table

```
Container:   bg-white rounded-xl shadow-sm border border-[#C3C6D7]/10 overflow-hidden

Header row:  bg-[#F2F4F6]/50
Header cell: py-4 px-6  text-[11px] font-bold text-[#434655] uppercase tracking-wider

Body:        divide-y-0   ← no row dividers; use hover highlight instead
Body row:    hover:bg-[#F2F4F6] transition-colors cursor-pointer
Body cell:   py-5 px-6 text-sm

ID badge:    bg-[#E6E8EA] px-2 py-1 rounded
             text-[10px] font-bold text-[#004AC6]

Items pill:  bg-[#D0E1FB]/30 text-[#54647A]
             px-3 py-1 rounded-full text-[10px] font-bold
```

### Create page table (line items)

```
Container:   overflow-hidden rounded-xl border border-[#C3C6D7]/10 shadow-sm bg-white

Header:      bg-[#F2F4F6]
Header cell: py-4 px-6  text-[10px] font-extrabold uppercase text-[#434655] tracking-wider

Body:        divide-y divide-[#ECEEF0]
Body row:    hover:bg-[#F2F4F6]/50 transition-colors
```

---

## 7 — Add Item Form Container

Used inside Invoice, CreateQuickSales, AddCustomerOrder, AddSupplierOrder.

```
bg-white p-6 rounded-xl
border border-[#2563EB]/20
shadow-[0_8px_30px_rgb(37,99,235,0.04)]
```

---

## 8 — Pagination Footer

```
Container:     px-8 py-6 bg-[#F2F4F6]/30 border-t border-[#C3C6D7]/10
Text:          text-sm text-[#434655]
Count numbers: font-bold text-[#191C1E]
Prev / Next:   px-4 py-2 text-sm font-bold text-[#434655]
               hover:text-[#004AC6] hover:bg-white rounded-lg
               border border-transparent hover:border-[#C3C6D7]/20
```

---

## 9 — Modals

> **App standard — glass overlay, always.**  
> Do NOT use dark overlays (`bg-black/40`).

```
Overlay:
  fixed inset-0 z-[100]
  flex items-center justify-center
  style: background rgba(255,255,255,0.7); backdrop-filter blur(8px)

Card:
  bg-white rounded-2xl p-8
  max-w-sm w-full mx-4
  style: box-shadow 0 20px 60px rgba(0,0,0,0.12)

Icon block:     w-14 h-14 rounded-full  (red bg for delete, amber for warning)
Title:          text-xl font-bold text-[#0F172A] text-center mb-2
Subtitle:       text-sm text-[#64748B] text-center mb-8 leading-relaxed

Confirm button: w-full px-4 py-2.5 rounded-xl text-white font-semibold text-sm
                bg-[#DC2626] for destructive   bg-[#2563EB] for non-destructive
Cancel button:  w-full px-4 py-2.5 rounded-xl
                bg-[#E6E8EA] text-[#191C1E] font-semibold text-sm
```

### Shared modal components

**Always use these. Do not write new modal JSX inline.**

| Component | File | Required props |
|---|---|---|
| `<DeleteConfirmModal>` | `src/components/DeleteConfirmModal.jsx` | `isOpen` `onConfirm` `onCancel` `title` `message` `confirmLabel` `isLoading` |
| `<NavigationWarningModal>` | `src/components/NavigationWarningModal.jsx` | `blocker` (from `useBlocker()`) |
| `<PrinterSelectionModal>` | `src/components/PrinterSelectionModal.jsx` | `isOpen` `onClose` `printers` `selectedPrinter` `onSelectPrinter` `onPrint` `onDownload` `isPrinting` `title` `subtitle` |

---

## 10 — Entry Form Accent Bar

Account entry forms (AddAccountEntry, AddSupplierAccountEntry) have a coloured bar at the top of the card. It must be the first child inside the card `div`:

```jsx
<div
  className="h-1.5 rounded-t-xl"
  style={{ background: 'linear-gradient(135deg, #004AC6 0%, #2563EB 100%)' }}
/>
```

---

## 11 — Dropdowns (search / autocomplete)

```
List container:  absolute z-50 w-full bg-white border border-[#C3C6D7]/20
                 rounded-xl shadow-lg overflow-hidden mt-1

Row:             px-4 py-3 text-sm cursor-pointer transition-colors
                 hover:bg-[#F2F4F6]

Highlighted row: bg-[#EFF6FF]   ← keyboard navigation highlight

Empty state:     px-4 py-3 text-sm text-[#64748B] italic
```

---

## 12 — Z-Index Hierarchy

| Layer | Value | Used for |
|---|---|---|
| Dropdowns | `z-50` | Autocomplete lists, absolute-positioned menus |
| NavBar | `z-40` | Side navigation panel |
| Modals | `z-[100]` | All glass overlay modals |
| Full-screen loaders | `z-[200]` | PageLoader overlay variant |

> Modals must always be `z-[100]`. If a delete modal is inside a page that also has a dropdown (`z-50`), the modal will correctly sit on top.

---

## 13 — Error States

```
Validation text:   text-[#BA1A1A] text-xs mt-1 ml-1
Required asterisk: text-[#BA1A1A]
Input error ring:  ring-2 ring-[#BA1A1A]/30   (added to the input, not a wrapper)
Delete button:     bg-[#DC2626]  (never bg-red-600 or bg-red-700 as base colour)
```

---

## 14 — Shared Components Reference

| Component | File | Purpose |
|---|---|---|
| `<PageLoader>` | `src/components/PageLoader.jsx` | Full-page and section loading states |
| `<DeleteConfirmModal>` | `src/components/DeleteConfirmModal.jsx` | All delete confirmations |
| `<NavigationWarningModal>` | `src/components/NavigationWarningModal.jsx` | Unsaved-changes navigation block |
| `<PrinterSelectionModal>` | `src/components/PrinterSelectionModal.jsx` | Printer picker before PDF print |
| `<VoiceInput>` | `src/components/VoiceInput.jsx` | Mic button + voice-to-form on add-item forms |

---

## 15 — Do / Don't Cheat Sheet

| ✅ Do | ❌ Don't |
|---|---|
| Use `text-[#434655]` for labels | Use `text-gray-500` or `text-slate-500` |
| Use `border-[#C3C6D7]/10` for card borders | Use `border-gray-200` |
| Use `rounded-xl` for cards and buttons | Mix `rounded-lg` and `rounded-xl` randomly |
| Use `shadow-sm` for cards | Use `shadow` or `shadow-md` |
| Use glass overlay for modals | Use `bg-black/40` overlay |
| Use `<DeleteConfirmModal>` | Inline delete modal JSX |
| Use `py-2.5 px-3` for inputs | Use `py-3 px-4` |
| Use `text-[10px]` for input labels | Use `text-xs` (12px — too large) |
| Use `font-bold` on all button text | Use `font-medium` on buttons |
| Add `active:scale-95` on all buttons | Leave out press feedback |

---

## 16 — Toast Notifications

Library: `react-hot-toast`. Configured once in `Layout.jsx`.

```
Position:    top-center
Background:  #0F172A (On-Surface body)
Text:        #fff
Border:      rounded-lg (8px)
Success:     green icon (#4ade80)
Error:       red icon (#ef4444)
```

### Message format conventions

| Action | Success message | Error message |
|---|---|---|
| Create entity | `"[Entity] added successfully"` | `"Failed to [verb] [entity]"` |
| Update entity | `"[Entity] updated successfully"` | `error.message` or `"Failed to update [entity]"` |
| Delete entity | `"[Entity] deleted successfully"` | `"Failed to delete [entity]"` |
| Save document | `"[Doc type] saved successfully (ID: [id])"` | `"An error occurred while saving."` |
| Add line item | `"Item added successfully"` | `"Please enter valid [field]"` |
| Delete line item | `"Item deleted successfully"` | — |
| Print | `"Print job sent successfully"` | `"Failed to print"` or `"Print failed: [message]"` |
| Download | `"PDF downloaded"` | `"Failed to generate PDF: [message]"` |

> Do **not** omit "successfully" on create/update/delete. Do **not** add exclamation marks.
> Error messages should start with "Failed to" or relay the server error verbatim.

---

## 17 — Order Status Badges

Used on CustomerOrder and SupplierOrder list pages.

```
Base:  inline-flex items-center px-2.5 py-1 rounded-full
       text-[10px] font-black uppercase tracking-wider border
```

| Status value | Colour classes | Used in |
|---|---|---|
| `completed` / `delivered` | `bg-emerald-100 text-emerald-700 border-emerald-200/50` | Both |
| `cancelled` | `bg-rose-100 text-rose-700 border-rose-200/50` | Both |
| `pending` / `received` | `bg-amber-100 text-amber-700 border-amber-200/50` | CustomerOrder |
| `pending` / `placed` | `bg-amber-100 text-amber-700 border-amber-200/50` | SupplierOrder |
| Unknown / fallback | `bg-[#E6E8EA] text-[#434655] border-[#C3C6D7]/20` | Both |

> These intentionally use Tailwind semantic colours (emerald, amber, rose) for
> at-a-glance status recognition. This is the **only** place generic Tailwind
> colours are permitted in the app.

---

## 18 — Empty States

### List pages (table)

When a list has zero results, show a single `<tr>` spanning all columns:

```jsx
<td colSpan="[N]" className="px-6 py-12 text-center text-[#434655] text-sm">
  [message]
</td>
```

Standard messages:
- `"No customers found."` / `"No suppliers found."` / `"No quick sales found."`
- `"No orders found matching your criteria."` (when a filter is active)
- During loading: `"Loading..."`

### Rich empty state (NotificationsPage)

```
Container:  bg-white rounded-xl shadow-sm border border-[#C3C6D7]/10 px-8 py-16 text-center
Icon:       w-16 h-16 rounded-full bg-[#F2F4F6]  (icon inside, text-[#94A3B8])
Heading:    text-lg font-bold text-[#191C1E] mb-1
Body:       text-sm text-[#64748B] max-w-sm mx-auto
```

---

## 19 — Loading States

### PageLoader variants

| Variant | When to use | Visual |
|---|---|---|
| `page` (default) | Full-screen data loading | Centered spinner on `bg-[#F7F9FB]` |
| `section` | Card-level loading | White card with small spinner |
| `overlay` | Blocking operation (Marathi translation) | Fixed frosted-glass overlay, `z-[200]` |
| `inline` | Suspense / lazy-load fallback | Centered spinner, no text |

### Button loading text

All form submit buttons show loading text while saving/deleting:

```
Submit:  "Saving..." / "Updating..." / "Deleting..."
         (button is disabled, opacity-50)
```

This is consistent across all form pages. Never show a spinner icon inside buttons — text change only.

---

## 20 — Unsaved Changes (Dirty State)

Pages that track `isDirty`:
- Invoice, CreateQuickSales, AddCustomerOrder, AddSupplierOrder

Pattern:
1. `isDirty` is computed via `useMemo` comparing current state to original data
2. `useBlocker()` blocks navigation when dirty
3. `<NavigationWarningModal blocker={blocker} />` is rendered
4. The save button label changes when dirty (e.g. "Save Invoice" → "Update Invoice")
5. `window.beforeunload` listener is attached when dirty

> Simple form pages (AddBuyerAccount, AddAccountEntry, etc.) do **not** track
> dirty state. They have no `useBlocker` or navigation warning.

---

## 21 — Payment Reminder Toggle

Used on BuyerAccountDetail and SupplierAccountDetail.

### Toggle switch

```
Track:  relative inline-flex h-6 w-11 items-center rounded-full
        transition-colors cursor-pointer
  On:   bg-[#004AC6]
  Off:  bg-[#C3C6D7]

Thumb:  inline-block h-4 w-4 transform rounded-full bg-white
        shadow-md transition-transform
  On:   translate-x-6
  Off:  translate-x-1
```

### Days input

```
w-20 py-1.5 px-3 bg-[#F2F4F6] border-none rounded-lg text-sm text-center
focus:bg-white focus:ring-2 focus:ring-[#004AC6]/15
```

Both files use identical classes.

---

## 22 — Notification Badge

### NavBar unread count

```
min-w-[20px] h-5 flex items-center justify-center
bg-[#DC2626] text-white text-[10px] font-bold rounded-full px-1.5
```

Displays `99+` when count exceeds 99. Only shown when `unreadCount > 0`.

> Always use `bg-[#DC2626]`, never `bg-red-500` or `bg-red-600`.

---

## 23 — Print Layout

### CSS print rules (index.css)

```css
@page { size: A4; margin: 0; }
body  { margin: 0; padding: 0; background: white; }
input, textarea, select { border: none; background: transparent; }
button { display: none; }
```

### Hiding elements

- Use `print:hidden` Tailwind class on any element that should not print
- NavBar, overlays, modals, form sections, action columns all use `print:hidden`
- `index.css` also defines `.print-hide` as a fallback class
- Toast notifications are hidden via `[data-sonner-toaster]` selector

### Printable pages

Invoice, CreateQuickSales, AddCustomerOrder, AddSupplierOrder — these render
print-optimized content by hiding interactive elements with `print:hidden`.
BuyerAccountDetail, SupplierAccountDetail, and PriceList generate PDFs via
`jsPDF` (no browser print).