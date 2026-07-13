import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Global keyboard shortcuts hook.
 * 
 * Handles navigation shortcuts directly (Alt+1/2/3).
 * For page-specific actions (Ctrl+N, Ctrl+P, Ctrl+F, Ctrl+D, F5),
 * dispatches CustomEvents that individual pages listen to.
 * 
 * Returns { showShortcutsModal, setShowShortcutsModal } for the Ctrl+/ cheat sheet.
 */
export function useGlobalShortcuts() {
  const navigate = useNavigate();
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);

  const handleKeyDown = useCallback((e) => {
    const ctrl = e.ctrlKey || e.metaKey;
    const alt = e.altKey;
    const key = e.key.toLowerCase();

    // ─── Escape: Close shortcuts modal ───
    if (e.key === 'Escape') {
      if (showShortcutsModal) {
        e.preventDefault();
        setShowShortcutsModal(false);
        return;
      }
      // Let existing modal handlers handle Escape
      return;
    }

    // ─── Ctrl+/ : Show shortcuts reference ───
    if (ctrl && (e.key === '/' || e.key === '?')) {
      e.preventDefault();
      setShowShortcutsModal(prev => !prev);
      return;
    }

    // ─── Ctrl+S is handled by individual form pages (don't override) ───
    if (ctrl && key === 's') return;

    // ─── Ctrl+F : Focus search ───
    if (ctrl && key === 'f') {
      e.preventDefault();
      window.dispatchEvent(new CustomEvent('shortcut:search'));
      return;
    }

    // ─── Ctrl+N : New record (context-sensitive) ───
    if (ctrl && key === 'n') {
      e.preventDefault();
      window.dispatchEvent(new CustomEvent('shortcut:new'));
      return;
    }

    // ─── Ctrl+P : Print / PDF ───
    if (ctrl && key === 'p') {
      e.preventDefault();
      window.dispatchEvent(new CustomEvent('shortcut:print'));
      return;
    }


    // ─── F5 : Refresh ───
    if (e.key === 'F5' && !ctrl && !alt) {
      e.preventDefault();
      window.dispatchEvent(new CustomEvent('shortcut:refresh'));
      return;
    }

    // ─── Alt+1 : Go to Estimate ───
    if (alt && e.key === '1') {
      e.preventDefault();
      navigate('/invoice');
      return;
    }

    // ─── Alt+2 : Go to Quick Sales ───
    if (alt && e.key === '2') {
      e.preventDefault();
      navigate('/quick-sales/create');
      return;
    }

    // ─── Alt+3 : Go to Price List ───
    if (alt && e.key === '3') {
      e.preventDefault();
      navigate('/price-list');
      return;
    }
  }, [navigate, showShortcutsModal]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return { showShortcutsModal, setShowShortcutsModal };
}

/**
 * Shortcut definitions for the cheat sheet modal.
 */
export const SHORTCUT_GROUPS = [
  {
    title: 'General',
    shortcuts: [
      { keys: ['Ctrl', 'S'], label: 'Save current form' },
      { keys: ['Ctrl', 'N'], label: 'New record (context-sensitive)' },
      { keys: ['Ctrl', 'P'], label: 'Print / PDF' },
      { keys: ['Ctrl', 'F'], label: 'Focus search bar' },
      { keys: ['Esc'], label: 'Close modal / Cancel' },
    ],
  },
  {
    title: 'Navigation',
    shortcuts: [
      { keys: ['Alt', '1'], label: 'Go to Estimate' },
      { keys: ['Alt', '2'], label: 'Go to Quick Sales' },
      { keys: ['Alt', '3'], label: 'Go to Price List' },
    ],
  },
];
