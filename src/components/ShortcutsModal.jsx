import React, { useRef, useEffect } from 'react';
import { Keyboard, X } from 'lucide-react';
import { SHORTCUT_GROUPS } from '../hooks/useGlobalShortcuts';

/**
 * Keyboard shortcuts cheat sheet modal (Ctrl+/).
 * Shows all available shortcuts grouped by category.
 */
export default function ShortcutsModal({ isOpen, onClose }) {
  const modalRef = useRef(null);

  useEffect(() => {
    if (isOpen) modalRef.current?.focus();
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-[100] print:hidden"
      style={{ background: 'rgba(255, 255, 255, 0.7)', backdropFilter: 'blur(8px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        ref={modalRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-title"
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 outline-none overflow-hidden"
        onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-[#EFF6FF] rounded-lg flex items-center justify-center">
              <Keyboard size={18} className="text-[#2563EB]" />
            </div>
            <h2 id="shortcuts-title" className="text-lg font-bold text-[#0F172A]">Keyboard Shortcuts</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[#F2F4F6] text-[#94A3B8] hover:text-[#434655] transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-6 max-h-[60vh] overflow-y-auto scrollbar-thin">
          {SHORTCUT_GROUPS.map((group) => (
            <div key={group.title}>
              <h3 className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider mb-3">
                {group.title}
              </h3>
              <div className="space-y-1.5">
                {group.shortcuts.map((shortcut) => (
                  <div
                    key={shortcut.label}
                    className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-[#F8FAFC] transition-colors"
                  >
                    <span className="text-sm text-[#434655] font-medium">{shortcut.label}</span>
                    <div className="flex items-center gap-1">
                      {shortcut.keys.map((k, i) => (
                        <span key={i}>
                          {i > 0 && <span className="text-[#C3C6D7] text-xs mx-0.5">+</span>}
                          <kbd className="inline-flex items-center justify-center min-w-[28px] h-7 px-2 bg-[#F2F4F6] border border-[#E2E8F0] rounded-md text-xs font-semibold text-[#434655] shadow-sm">
                            {k}
                          </kbd>
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-[#E2E8F0] bg-[#F8FAFC]">
          <p className="text-[11px] text-[#94A3B8] text-center">
            Press <kbd className="px-1.5 py-0.5 bg-white border border-[#E2E8F0] rounded text-[10px] font-semibold mx-0.5">Ctrl</kbd>
            <kbd className="px-1.5 py-0.5 bg-white border border-[#E2E8F0] rounded text-[10px] font-semibold mx-0.5">/</kbd>
            to toggle this panel
          </p>
        </div>
      </div>
    </div>
  );
}
