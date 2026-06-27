import React from 'react';
import { Search, CircleX } from 'lucide-react';

/**
 * SearchableDropdown — universal autocomplete text-input + floating list.
 * Styled to be pixel-identical to the Invoice "Product Name" dropdown
 * (the gold standard reference).
 *
 * The PARENT owns all state (open/closed, highlighted index, filtered list,
 * keyboard navigation). This component owns only visual rendering.
 *
 * Props:
 *   inputRef          ref      — forwarded to the <input>
 *   wrapperRef        ref      — forwarded to the outer div (for click-outside)
 *   label             string   — label text (optional)
 *   required          bool     — adds red * to label (optional)
 *   value             string   — controlled text input value
 *   placeholder       string   — input placeholder
 *   error             string   — validation error message (optional)
 *
 *   onFocus           fn()     — called when input receives focus
 *   onChange          fn(val)  — called on input change (receives string value)
 *   onClear           fn()     — called when CircleX button is clicked
 *   onKeyDown         fn(e)    — key handler for ArrowUp/Down/Enter/Escape
 *   onBlur            fn(e)    — blur handler (optional)
 *
 *   isOpen            bool     — whether the dropdown panel is visible
 *   options           array    — items to show in the dropdown
 *   highlightedIndex  number   — index of the currently highlighted row
 *   onSelect          fn(item) — called when a row is clicked
 *   onMouseEnter      fn(idx)  — called on row mouse enter (sets highlight)
 *   renderOption      fn(item, index) → ReactNode — content inside each row
 *   emptyContent      ReactNode — shown when options is empty (optional)
 *
 *   inputClassName    string   — extra classes on the <input> (optional)
 *   wrapperClassName  string   — extra classes on the outer div (optional)
 *   id                string   — id on the input element (optional)
 *   aria-controls     string   — id of the listbox element
 */
const SearchableDropdown = ({
  inputRef,
  wrapperRef,
  label,
  required = false,
  value,
  placeholder = 'Search...',
  error,

  onFocus,
  onChange,
  onClear,
  onKeyDown,
  onBlur,

  isOpen,
  options = [],
  highlightedIndex = -1,
  onSelect,
  onMouseEnter,
  renderOption,
  emptyContent,

  inputClassName = '',
  wrapperClassName = '',

  'aria-controls': ariaControls,
  id,
  ...rest
}) => {
  return (
    <div className={`${wrapperClassName}`} ref={wrapperRef}>
      {label && (
        <label
          htmlFor={id}
          className="block text-[10px] font-bold text-[#434655] uppercase mb-1.5 ml-1"
        >
          {label}
          {required && <span className="text-[#BA1A1A] ml-0.5">*</span>}
        </label>
      )}

      {/* Input + icon wrapper — position:relative so the dropdown can be absolute */}
      <div className="relative">
        <input
          ref={inputRef}
          id={id}
          type="text"
          value={value}
          placeholder={placeholder}
          onFocus={onFocus}
          onChange={(e) => onChange?.(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={onBlur}
          autoComplete="off"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={isOpen}
          aria-controls={ariaControls}
          className={`w-full py-2.5 px-3 pr-10 bg-[#F2F4F6] border-none rounded-lg text-sm
                      focus:bg-white focus:ring-2 focus:ring-[#004AC6]/15
                      transition-all outline-none
                      ${error ? 'ring-2 ring-[#BA1A1A]/30' : ''}
                      ${inputClassName}`}
          {...rest}
        />

        {/* Right icon: CircleX when there is text, Search icon when empty */}
        {value ? (
          <button
            type="button"
            tabIndex={-1}
            onClick={onClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#434655] hover:text-red-500 cursor-pointer transition-colors"
            aria-label="Clear"
          >
            <CircleX size={16} />
          </button>
        ) : (
          <Search
            size={16}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#434655] pointer-events-none"
          />
        )}

        {/* Floating dropdown panel */}
        {isOpen && (options.length > 0 || emptyContent) && (
          <div
            id={ariaControls}
            role="listbox"
            className="absolute z-50 w-full mt-1 bg-white border border-[#C3C6D7]/30
                       rounded-lg shadow-lg max-h-60 overflow-y-auto"
          >
            {options.length > 0
              ? options.map((item, index) => (
                  <button
                    key={index}
                    type="button"
                    role="option"
                    aria-selected={highlightedIndex === index}
                    className={`cursor-pointer w-full text-left px-4 py-3 transition-colors
                                flex items-center justify-between text-sm
                                ${highlightedIndex === index ? 'bg-[#EFF6FF]' : 'hover:bg-[#F2F4F6]'}
                                ${index === 0 ? 'rounded-t-lg' : ''}
                                ${index === options.length - 1 ? 'rounded-b-lg' : ''}`}
                    onClick={() => onSelect?.(item)}
                    onMouseEnter={() => onMouseEnter?.(index)}
                  >
                    {renderOption?.(item, index)}
                  </button>
                ))
              : (
                <div className="px-4 py-3 text-sm text-center">
                  {emptyContent}
                </div>
              )
            }
          </div>
        )}
      </div>

      <div className="h-5">
        {error && (
          <p className="text-xs text-[#BA1A1A] flex items-center mt-1.5 ml-1">{error}</p>
        )}
      </div>
    </div>
  );
};

export default SearchableDropdown;
