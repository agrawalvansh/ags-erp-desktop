import { Printer, Save } from 'lucide-react'

/**
 * Shared printer selection modal.
 * Extracts the identical modal currently duplicated in Invoice, CreateQuickSales,
 * AddCustomerOrder, and AddSupplierOrder.
 *
 * @param {boolean}  isOpen           - Controls visibility
 * @param {Function} onClose          - Called on close/cancel
 * @param {Array}    printers         - List of available printer name strings
 * @param {string}   selectedPrinter  - Currently selected printer name
 * @param {Function} onSelectPrinter  - Called with printer name when selected
 * @param {Function} onPrint          - Called when Print button clicked
 * @param {Function} onDownload       - Called when Download PDF button clicked (optional)
 * @param {boolean}  isPrinting       - Loading state for print button
 * @param {string}   title            - Title text (e.g. "Print Invoice")
 * @param {string}   subtitle         - Subtitle / filename text
 */
export default function PrinterSelectionModal({
  isOpen,
  onClose,
  printers = [],
  selectedPrinter,
  onSelectPrinter,
  onPrint,
  onDownload,
  isPrinting = false,
  title = 'Print',
  subtitle = '',
}) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 flex items-center justify-center z-[100] print:hidden" style={{ background: 'rgba(255, 255, 255, 0.7)', backdropFilter: 'blur(8px)' }}>
      <div className="bg-white rounded-xl shadow-2xl p-6 max-w-md mx-4 w-full">
        <div className="flex items-center justify-center mb-4">
          <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center">
            <Printer className="text-[#2563EB]" size={24} />
          </div>
        </div>
        <h2 className="text-xl font-bold text-[#0F172A] text-center mb-2">
          {title}
        </h2>
        {subtitle && (
          <p className="text-[#64748B] text-center mb-4 text-sm">
            {subtitle}
          </p>
        )}

        {/* Printer Selection */}
        <div className="mb-6">
          <label className="block text-xs font-bold text-[#434655] uppercase mb-2">Select Printer</label>
          <select
            value={selectedPrinter}
            onChange={(e) => onSelectPrinter(e.target.value)}
            className="w-full py-3 px-4 bg-[#F2F4F6] border border-[#E2E8F0] rounded-lg text-sm font-medium appearance-none cursor-pointer focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB]"
          >
            <option value="">Default Printer</option>
            {printers.map((printer, idx) => (
              <option key={idx} value={printer}>{printer}</option>
            ))}
          </select>
          {printers.length === 0 && (
            <p className="text-xs text-[#64748B] mt-1">Using system default printer</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onPrint}
            disabled={isPrinting}
            className={`flex-1 px-4 py-2.5 rounded-lg bg-[#2563EB] text-white font-medium hover:bg-[#1D4ED8] transition-colors cursor-pointer flex items-center justify-center gap-2 ${isPrinting ? 'opacity-50' : ''}`}
          >
            <Printer size={16} />
            {isPrinting ? 'Printing...' : 'Print'}
          </button>
          {onDownload && (
            <button
              onClick={onDownload}
              className="flex-1 px-4 py-2.5 rounded-lg border border-[#E2E8F0] text-[#434655] font-medium hover:bg-[#F1F5F9] transition-colors cursor-pointer flex items-center justify-center gap-2"
            >
              <Save size={16} />
              Download PDF
            </button>
          )}
        </div>

        {/* Cancel */}
        <button
          onClick={onClose}
          className="w-full mt-3 py-2 text-sm text-[#64748B] hover:text-[#0F172A] transition-colors cursor-pointer"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
