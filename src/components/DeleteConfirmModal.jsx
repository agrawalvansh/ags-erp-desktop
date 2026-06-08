import { useEffect, useRef } from 'react'
import { Trash2 } from 'lucide-react'

/**
 * Shared delete confirmation modal.
 * Uses glass overlay consistent with the app's established pattern.
 *
 * @param {boolean}  isOpen        - Controls visibility
 * @param {Function} onConfirm     - Called when user confirms deletion
 * @param {Function} onCancel      - Called when user cancels
 * @param {string}   title         - Modal heading (e.g. "Delete Customer?")
 * @param {string}   message       - Subtext description
 * @param {string}   confirmLabel  - Confirm button text (default: "Delete")
 * @param {boolean}  isLoading     - Shows loading state on confirm button
 */
export default function DeleteConfirmModal({
  isOpen,
  onConfirm,
  onCancel,
  title = 'Confirm Delete',
  message = 'This action cannot be undone.',
  confirmLabel = 'Delete',
  isLoading = false,
}) {
  const modalRef = useRef(null)

  useEffect(() => {
    if (isOpen && modalRef.current) {
      modalRef.current.focus()
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onCancel])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-[100]"
      style={{ background: 'rgba(255, 255, 255, 0.7)', backdropFilter: 'blur(8px)' }}
      onClick={onCancel}
      aria-modal="true"
      role="dialog"
      aria-labelledby="delete-modal-title"
    >
      <div
        ref={modalRef}
        tabIndex={-1}
        className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full mx-4 outline-none"
        style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.12)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Icon */}
        <div className="flex justify-center mb-5">
          <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center">
            <Trash2 className="w-7 h-7 text-[#DC2626]" />
          </div>
        </div>

        {/* Text */}
        <h2
          id="delete-modal-title"
          className="text-xl font-bold text-[#0F172A] text-center mb-2"
        >
          {title}
        </h2>
        <p className="text-sm text-[#64748B] text-center mb-8 leading-relaxed">
          {message}
        </p>

        {/* Buttons */}
        <div className="flex flex-col gap-3">
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="w-full px-4 py-2.5 rounded-xl bg-[#DC2626] text-white font-semibold text-sm
                       hover:bg-red-700 active:scale-95 transition-all disabled:opacity-60 cursor-pointer"
          >
            {isLoading ? 'Deleting...' : confirmLabel}
          </button>
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="w-full px-4 py-2.5 rounded-xl bg-[#E6E8EA] text-[#191C1E] font-semibold text-sm
                       hover:bg-[#E0E3E5] active:scale-95 transition-all cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
