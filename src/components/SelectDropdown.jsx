import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown } from 'lucide-react';

/**
 * SelectDropdown — custom styled dropdown (no native <select>).
 * Renders a clickable button that opens a floating list matching the
 * SearchableDropdown panel style exactly.
 *
 * Props:
 *   name          string   — field name (included in synthetic onChange event)
 *   label         string   — label text (optional)
 *   required      bool     — adds red * (optional)
 *   value         string   — controlled selected value
 *   onChange      fn(e)    — called with synthetic { target: { name, value } }
 *   options       array    — [{ value, label }] OR plain strings
 *   placeholder   string   — shown when nothing selected (optional)
 *   error         string   — validation error message (optional)
 *   disabled      bool     — disables the control (optional)
 *   className     string   — extra classes on the outer wrapper div (optional)
 *   selectClassName string — extra classes on the trigger button (optional)
 *   id            string   — id attr on the trigger button (optional)
 */
const SelectDropdown = ({
  name,
  label,
  required = false,
  value,
  onChange,
  options = [],
  placeholder,
  error,
  disabled = false,
  className = '',
  selectClassName = '',
  id,
  ...rest
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const wrapperRef = useRef(null);
  const listRef = useRef(null);

  const normaliseOptions = (opts) =>
    opts.map((o) =>
      typeof o === 'string' || typeof o === 'number'
        ? { value: String(o), label: String(o) }
        : { value: String(o.value), label: String(o.label) }
    );

  const normalised = normaliseOptions(options);
  const selected = normalised.find((o) => o.value === String(value ?? ''));
  const displayText = selected?.label ?? placeholder ?? '';
  const isPlaceholderShown = !selected && Boolean(placeholder);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setIsOpen(false);
        setHighlightedIndex(-1);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightedIndex >= 0 && listRef.current) {
      const el = listRef.current.querySelector(`[data-sd-index="${highlightedIndex}"]`);
      el?.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightedIndex]);

  const handleSelect = (opt) => {
    onChange?.({ target: { name: name ?? '', value: opt.value } });
    setIsOpen(false);
    setHighlightedIndex(-1);
  };

  const handleKeyDown = (e) => {
    if (disabled) return;
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        setIsOpen(true);
        // Highlight the currently selected item (or first)
        const idx = normalised.findIndex((o) => o.value === String(value ?? ''));
        setHighlightedIndex(idx >= 0 ? idx : 0);
      }
      return;
    }
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex((prev) => Math.min(prev + 1, normalised.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex((prev) => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && normalised[highlightedIndex]) {
          handleSelect(normalised[highlightedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        setHighlightedIndex(-1);
        break;
    }
  };

  const selectId = id || name;

  return (
    <div className={`${className}`} ref={wrapperRef}>
      {label && (
        <label
          htmlFor={selectId}
          className="block text-[10px] font-bold text-[#434655] uppercase mb-1.5 ml-1"
        >
          {label}
          {required && <span className="text-[#BA1A1A] ml-0.5">*</span>}
        </label>
      )}

      <div className="relative">
        {/* Trigger button */}
        <button
          id={selectId}
          type="button"
          disabled={disabled}
          onClick={() => {
            if (disabled) return;
            const opening = !isOpen;
            setIsOpen(opening);
            if (opening) {
              const idx = normalised.findIndex((o) => o.value === String(value ?? ''));
              setHighlightedIndex(idx >= 0 ? idx : 0);
            } else {
              setHighlightedIndex(-1);
            }
          }}
          onKeyDown={handleKeyDown}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-controls={selectId ? `${selectId}-list` : undefined}
          className={`w-full bg-[#F2F4F6] border-none rounded-lg px-3 py-2.5 pr-10
                      text-sm font-medium text-left
                      focus:bg-white focus:ring-2 focus:ring-[#004AC6]/15
                      cursor-pointer outline-none transition-all
                      disabled:opacity-50 disabled:cursor-not-allowed
                      ${isPlaceholderShown ? 'text-[#434655]/50' : 'text-[#191C1E]'}
                      ${error ? 'ring-2 ring-[#BA1A1A]/30' : ''}
                      ${selectClassName}`}
          {...rest}
        >
          {displayText}
        </button>

        {/* Chevron icon — rotates when open */}
        <ChevronDown
          size={16}
          className={`absolute right-3 top-1/2 -translate-y-1/2 text-[#434655] pointer-events-none transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        />

        {/* Floating list */}
        {isOpen && (
          <div
            id={selectId ? `${selectId}-list` : undefined}
            ref={listRef}
            role="listbox"
            className="absolute z-50 left-0 min-w-full w-max max-w-[22rem] mt-1 bg-white border border-[#C3C6D7]/30
                       rounded-lg shadow-lg max-h-60 overflow-y-auto"
          >
            {normalised.map((opt, idx) => {
              const isSelected = opt.value === String(value ?? '');
              const isHighlighted = highlightedIndex === idx;
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="option"
                  data-sd-index={idx}
                  aria-selected={isSelected}
                  className={`cursor-pointer w-full text-left px-4 py-3 transition-colors text-sm
                              flex items-center justify-between
                              ${isHighlighted
                                ? 'bg-[#EFF6FF]'
                                : isSelected
                                  ? 'bg-[#F0F7FF]'
                                  : 'hover:bg-[#F2F4F6]'}
                              ${idx === 0 ? 'rounded-t-lg' : ''}
                              ${idx === normalised.length - 1 ? 'rounded-b-lg' : ''}`}
                  onClick={() => handleSelect(opt)}
                  onMouseEnter={() => setHighlightedIndex(idx)}
                >
                  <span className={isSelected ? 'font-semibold text-[#004AC6]' : 'font-medium text-[#191C1E]'}>
                    {opt.label}
                  </span>
                  {isSelected && (
                    <span className="w-1.5 h-1.5 rounded-full bg-[#004AC6] flex-shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {error && (
        <p className="text-xs text-[#BA1A1A] ml-1">{error}</p>
      )}
    </div>
  );
};

export default SelectDropdown;
