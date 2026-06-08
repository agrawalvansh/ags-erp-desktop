import { AlertTriangle } from 'lucide-react'

/**
 * Shared navigation warning modal for unsaved changes.
 * Works with react-router-dom useBlocker hook.
 *
 * @param {object} blocker - The blocker object from useBlocker()
 */
export default function NavigationWarningModal({ blocker }) {
  if (!blocker || blocker.state !== 'blocked') return null

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-[100] print:hidden"
      style={{ background: 'rgba(255, 255, 255, 0.7)', backdropFilter: 'blur(8px)' }}
      aria-modal="true"
      role="dialog"
      aria-labelledby="nav-warning-title"
    >
      <div
        className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full mx-4"
        style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.12)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Icon */}
        <div className="flex justify-center mb-5">
          <div className="w-14 h-14 rounded-full bg-amber-50 flex items-center justify-center">
            <AlertTriangle className="w-7 h-7 text-[#F59E0B]" />
          </div>
        </div>

        {/* Text */}
        <h2
          id="nav-warning-title"
          className="text-xl font-bold text-[#0F172A] text-center mb-2"
        >
          Unsaved Changes
        </h2>
        <p className="text-sm text-[#64748B] text-center mb-8 leading-relaxed">
          You have unsaved changes. Are you sure you want to leave? Your changes will be lost.
        </p>

        {/* Buttons */}
        <div className="flex flex-col gap-3">
          <button
            onClick={() => blocker.proceed()}
            className="w-full px-4 py-2.5 rounded-xl bg-[#DC2626] text-white font-semibold text-sm
                       hover:bg-red-700 active:scale-95 transition-all cursor-pointer"
          >
            Leave Anyway
          </button>
          <button
            onClick={() => blocker.reset()}
            className="w-full px-4 py-2.5 rounded-xl bg-[#E6E8EA] text-[#191C1E] font-semibold text-sm
                       hover:bg-[#E0E3E5] active:scale-95 transition-all cursor-pointer"
          >
            Stay on Page
          </button>
        </div>
      </div>
    </div>
  )
}
