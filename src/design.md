# AGS ERP — Design System Reference

All pages MUST use these exact CSS tokens. Extracted from the canonical `Invoice.jsx`.

## Color Palette

| Token | Hex | Usage |
|-------|-----|-------|
| Primary | `#004AC6` | Icons, links, accents, grand total |
| Primary Container | `#2563EB` | Buttons, active states, QS ID badge |
| Background | `#F7F9FB` | Page background |
| Surface Lowest | `#FFFFFF` | Cards, table body, modals |
| Surface Container Low | `#F2F4F6` | Input backgrounds, table headers |
| Surface Container | `#ECEEF0` | Dividers, borders |
| Surface Container High | `#E6E8EA` | Secondary button bg |
| Surface Dim | `#F8FAFC` | Top bar bg, table header row bg (list pages) |
| On-Surface | `#191C1E` / `#0F172A` | Primary text — use `#191C1E` for headings, high-emphasis labels, and bold text; use `#0F172A` for body copy and lower-emphasis content |
| On-Surface Variant | `#434655` | Labels, secondary text |
| Muted Text | `#64748B` | Table cell text, descriptions |
| Outline Variant | `#C3C6D7` | Borders (at /10 or /20 opacity) |
| Border Soft | `#E2E8F0` | Card borders, header borders |
| Error | `#BA1A1A` / `#DC2626` | Delete actions, round-off — use `#BA1A1A` for inline validation text and required-field asterisks; use `#DC2626` for delete buttons, error icons, and active error states. Always verify contrast against your background tokens |
| Pill Background | `#D0E1FB` | Items pill background (light blue, used at /30 opacity) |
| Pill Text | `#54647A` | Items pill text (muted slate) |
| Secondary Hover | `#E0E3E5` | Secondary button hover state |

## Typography

| Element | Classes |
|---------|---------|
| Page title (list) | `text-3xl font-extrabold tracking-tight text-[#191C1E]` |
| Page subtitle | `text-sm font-medium text-[#434655]` |
| Section label | `text-xs font-bold text-[#434655] uppercase` |
| Input label | `text-[10px] font-bold text-[#434655] uppercase mb-1.5 ml-1` |
| Table header (list) | `text-[11px] font-bold text-[#434655] uppercase tracking-wider` |
| Table header (create) | `text-[10px] font-extrabold text-[#434655] uppercase tracking-wider` |
| Table body text | `text-sm text-[#64748B]` |
| Table body bold | `text-sm font-medium text-[#0F172A]` |
| Amount | `font-black text-[#0F172A]` (list), `font-semibold text-[#2563EB]` (create) |
| Grand Total | `text-2xl font-black text-[#004AC6]` |

## Form Inputs

```
bg-[#F2F4F6] border-none rounded-lg text-sm
py-2.5 px-3
focus:bg-white focus:ring-2 focus:ring-[#004AC6]/15 transition-all
```

## Table (List Pages)

```
Container: bg-white rounded-xl shadow-sm border border-[#C3C6D7]/10 overflow-hidden
Header row: bg-[#F2F4F6]/50
Header cell: py-4 px-6 text-[11px] font-bold text-[#434655] uppercase tracking-wider
Body: divide-y-0 (no visible dividers — hover row instead)
Body row: hover:bg-[#F2F4F6] transition-colors cursor-pointer
Body cell: py-5 px-6 text-sm
QS ID badge: bg-[#E6E8EA] px-2 py-1 rounded text-[10px] font-bold text-[#004AC6]
Items pill: bg-[#D0E1FB]/30 text-[#54647A] px-3 py-1 rounded-full text-[10px] font-bold
```

## Table (Create Pages)

```
Container: overflow-hidden rounded-xl border border-[#C3C6D7]/10 shadow-sm bg-white
Header: bg-[#F2F4F6] text-[10px] font-extrabold uppercase text-[#434655] tracking-wider
Header cell: py-4 px-6
Body: text-sm divide-y divide-[#ECEEF0]
Body row: hover:bg-[#F2F4F6]/50 transition-colors
```

## Buttons

| Type | Classes |
|------|---------|
| Primary (gradient) | `bg-gradient-to-br from-[#004AC6] to-[#2563EB] text-white font-bold text-xs uppercase rounded-xl shadow-lg shadow-[#004AC6]/20 hover:scale-[1.02] active:scale-95` |
| Primary (solid) | `bg-gradient-to-br from-[#004AC6] to-[#2563EB] text-white font-semibold rounded-lg shadow-lg shadow-[#004AC6]/20 active:scale-95` |
| Secondary | `bg-[#E6E8EA] text-[#191C1E] font-bold text-xs uppercase rounded-xl hover:bg-[#E0E3E5]` |
| Action icon | `p-2 rounded-full hover:bg-white text-[#434655] hover:text-[#004AC6] hover:shadow-sm` |
| Delete icon | `p-2 rounded-full hover:bg-white text-[#434655] hover:text-[#DC2626] hover:shadow-sm` |
| Pagination active | `w-9 h-9 rounded-lg bg-[#004AC6] text-white font-bold text-sm` |
| Pagination inactive | `w-9 h-9 rounded-lg hover:bg-white text-[#434655] font-bold text-sm` |

## Page Header (List Pages)

```
Container: flex items-end justify-between gap-6 mb-10
Title: text-3xl font-extrabold tracking-tight text-[#191C1E]
Subtitle: text-sm font-medium text-[#434655]
Search: w-72 bg-white border border-[#C3C6D7]/20 rounded-lg py-2.5 pl-10 pr-10 text-sm
  focus:border-[#004AC6] focus:ring-4 focus:ring-[#004AC6]/5
New button: bg-gradient-to-br from-[#004AC6] to-[#2563EB] text-white px-5 py-2.5 rounded-lg
  font-semibold shadow-lg shadow-[#004AC6]/20 active:scale-95
```

## Top Bar (Create Pages)

```
Container: px-4 sm:px-6 py-4 border-b border-[#E2E8F0] bg-[#F8FAFC]
Reference label: text-xs font-medium text-[#64748B] uppercase tracking-wider
Reference value: text-sm font-bold text-[#2563EB]
Title: text-xl sm:text-2xl font-bold text-[#0F172A] tracking-wide
Date input: text-sm font-semibold text-[#0F172A] border border-[#E2E8F0] rounded-md px-2 py-1
```

## Pagination Footer

```
Container: px-8 py-6 bg-[#F2F4F6]/30 border-t border-[#C3C6D7]/10
Text: text-sm text-[#434655]
Bold counts: font-bold text-[#191C1E]
Previous/Next: px-4 py-2 text-sm font-bold text-[#434655] hover:text-[#004AC6]
  hover:bg-white rounded-lg border border-transparent hover:border-[#C3C6D7]/20
```

## Modals

```
Overlay: fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[100]
Card: bg-white rounded-xl shadow-2xl p-6 max-w-md mx-4
Title: text-xl font-bold text-[#0F172A] text-center mb-2
Subtitle: text-[#64748B] text-center mb-6
Cancel btn: flex-1 px-4 py-2.5 rounded-lg border border-[#E2E8F0] text-[#64748B] font-medium
Confirm btn: flex-1 px-4 py-2.5 rounded-lg bg-[#2563EB] text-white font-medium (or bg-red-600 for delete)
```
