import { useState, useRef, useEffect, useCallback } from 'react';
import { X, Plus, Minus, Trash2, Calculator, Check } from 'lucide-react';

/**
 * WeightCalculator — A reusable multi-weight quantity calculator popup.
 *
 * Props:
 *   isOpen       — boolean, whether the popup is visible
 *   onClose      — callback to close the popup (cancel)
 *   onComplete   — callback(total: number) when user clicks Complete
 *   initialValue — optional number, pre-seed as first entry from Qty field
 */
const WeightCalculator = ({ isOpen, onClose, onComplete, initialValue }) => {
  const [entries, setEntries] = useState([]);
  const [currentValue, setCurrentValue] = useState('');
  const [error, setError] = useState('');
  const inputRef = useRef(null);
  const popupRef = useRef(null);

  // Focus input when popup opens; seed with initialValue if present
  useEffect(() => {
    if (isOpen) {
      const seed = parseFloat(initialValue);
      if (!isNaN(seed) && seed > 0) {
        setEntries([seed]);
      } else {
        setEntries([]);
      }
      setCurrentValue('');
      setError('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e) => {
      if (popupRef.current && !popupRef.current.contains(e.target)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const total = entries.reduce((sum, val) => sum + val, 0);

  const parseInput = () => {
    const trimmed = currentValue.trim();
    if (!trimmed) return null;
    const num = parseFloat(trimmed);
    if (isNaN(num)) { setError('Enter a valid number'); return null; }
    if (num <= 0) { setError('Value must be positive'); return null; }
    return num;
  };

  const handleAddEntry = useCallback(() => {
    const num = parseInput();
    if (num === null) return;
    setEntries(prev => [...prev, num]);
    setCurrentValue('');
    setError('');
    inputRef.current?.focus();
  }, [currentValue]);

  const handleSubtractEntry = useCallback(() => {
    const num = parseInput();
    if (num === null) return;
    setEntries(prev => [...prev, -num]);
    setCurrentValue('');
    setError('');
    inputRef.current?.focus();
  }, [currentValue]);

  const handleRemoveEntry = (index) => {
    setEntries(prev => prev.filter((_, i) => i !== index));
  };

  const handleComplete = () => {
    if (entries.length === 0) {
      setError('Add at least one weight');
      return;
    }
    const result = parseFloat(total.toFixed(3));
    onComplete(Math.max(0, result));
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) {
        handleSubtractEntry();
      } else {
        handleAddEntry();
      }
    }
  };

  const handleInputChange = (e) => {
    const val = e.target.value;
    if (val === '' || /^\d*\.?\d*$/.test(val)) {
      setCurrentValue(val);
      setError('');
    }
  };

  if (!isOpen) return null;

  return (
    <div
      ref={popupRef}
      className="absolute z-50 mt-1 bg-white rounded-xl shadow-xl border border-[#C3C6D7]/20 overflow-hidden"
      style={{ top: '100%', left: 0, width: '300px' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#F2F4F6]/70 border-b border-[#C3C6D7]/10">
        <div className="flex items-center gap-2">
          <Calculator size={13} className="text-[#004AC6]" />
          <span className="text-[11px] font-bold text-[#191C1E] uppercase tracking-wider">Weight Calculator</span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-full hover:bg-[#E6E8EA] transition-colors cursor-pointer"
        >
          <X size={13} className="text-[#434655]" />
        </button>
      </div>

      {/* Input row: input + [+] [−] side by side */}
      <div className="px-3 pt-3 pb-2">
        <div className="flex gap-1.5">
          <input
            ref={inputRef}
            type="text"
            inputMode="decimal"
            value={currentValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Enter weight..."
            className="flex-1 min-w-0 py-2 px-3 bg-[#F2F4F6] border-none rounded-lg text-sm focus:bg-white focus:ring-2 focus:ring-[#004AC6]/15 transition-all outline-none"
          />
          {/* Add button */}
          <button
            onClick={handleAddEntry}
            className="flex-shrink-0 w-9 h-9 bg-[#004AC6] text-white rounded-lg hover:bg-[#003EA8] active:scale-95 transition-all cursor-pointer flex items-center justify-center"
            title="Add weight (Enter)"
          >
            <Plus size={15} />
          </button>
          {/* Subtract button */}
          <button
            onClick={handleSubtractEntry}
            className="flex-shrink-0 w-9 h-9 bg-[#DC2626] text-white rounded-lg hover:bg-[#B91C1C] active:scale-95 transition-all cursor-pointer flex items-center justify-center"
            title="Subtract weight (Shift+Enter)"
          >
            <Minus size={15} />
          </button>
        </div>
        {/* Keyboard hints */}
        <p className="text-[9px] text-[#64748B] mt-1 ml-0.5">
          Enter → add &nbsp;|&nbsp; Shift+Enter → subtract
        </p>
        {error && (
          <p className="text-[10px] text-[#BA1A1A] mt-1 ml-0.5">{error}</p>
        )}
      </div>

      {/* Entries list */}
      <div className="px-3 max-h-36 overflow-y-auto">
        {entries.length === 0 ? (
          <p className="text-xs text-[#434655] text-center py-3 opacity-50">No weights added yet</p>
        ) : (
          <div className="space-y-0.5">
            {entries.map((val, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-[#F2F4F6]/60 group transition-colors"
              >
                <div className="flex items-center gap-2">
                  {/* Operation icon badge */}
                  <span
                    className={`flex items-center justify-center w-5 h-5 rounded-md flex-shrink-0 ${
                      val >= 0
                        ? 'bg-[#004AC6]/10 text-[#004AC6]'
                        : 'bg-[#DC2626]/10 text-[#DC2626]'
                    }`}
                  >
                    {val >= 0 ? <Plus size={10} /> : <Minus size={10} />}
                  </span>
                  <span
                    className={`text-sm font-semibold tabular-nums ${
                      val < 0 ? 'text-[#DC2626]' : 'text-[#191C1E]'
                    }`}
                  >
                    {Math.abs(val)}
                  </span>
                </div>
                <button
                  onClick={() => handleRemoveEntry(idx)}
                  className="p-1 rounded-full opacity-0 group-hover:opacity-100 hover:bg-red-50 text-[#434655] hover:text-red-600 transition-all cursor-pointer"
                >
                  <Trash2 size={11} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer: Total + Actions */}
      <div className="px-3 py-2.5 border-t border-[#C3C6D7]/10 bg-[#F2F4F6]/30">
        {/* Total */}
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-[10px] font-bold text-[#434655] uppercase tracking-wider">Total</span>
          <span className={`text-base font-black tabular-nums ${total < 0 ? 'text-[#DC2626]' : 'text-[#004AC6]'}`}>
            {total.toFixed(3)}
          </span>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-1.5 text-xs font-semibold text-[#434655] bg-[#E6E8EA] rounded-lg hover:bg-[#E0E3E5] transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleComplete}
            className="flex-1 py-1.5 text-xs font-semibold text-white bg-[#004AC6] rounded-lg hover:bg-[#003EA8] transition-colors cursor-pointer flex items-center justify-center gap-1"
          >
            <Check size={11} />
            Complete
          </button>
        </div>
      </div>
    </div>
  );
};

export default WeightCalculator;
