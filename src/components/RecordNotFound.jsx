import { useNavigate } from 'react-router-dom';
import { ArrowLeft, FileSearch, AlertTriangle } from 'lucide-react';

/**
 * RecordNotFound — shown when an invoice, quick sale, or order cannot be loaded by ID.
 *
 * Props:
 *  @param {string} recordType   - e.g. 'Invoice' | 'Quick Sale' | 'Customer Order' | 'Supplier Order'
 *  @param {string} recordId     - The ID that was looked up (shown as a warning chip)
 *  @param {string} backPath     - Where the back button navigates
 *  @param {string} backLabel    - Label for the back button, e.g. 'Back to Invoices'
 */
const RecordNotFound = ({
  recordType = 'Record',
  recordId = '',
  backPath = '/',
  backLabel = 'Go Back',
}) => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#F7F9FB] flex flex-col">
      {/* Top Bar */}
      <header className="bg-[#F7F9FB] flex items-center gap-4 px-8 py-5 border-b border-[#ECEEF0]">
        <button
          onClick={() => navigate(backPath)}
          className="flex items-center gap-2 text-[#434655] hover:text-[#004AC6] transition-colors group cursor-pointer"
        >
          <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
          <span className="text-sm font-medium">{backLabel}</span>
        </button>
        <div className="bg-[#ECEEF0] h-6 w-[1px]" />
        <h1 className="text-lg font-bold text-[#191C1E]">{recordType} Not Found</h1>
      </header>

      {/* Main content */}
      <main className="flex-grow flex items-center justify-center px-6 py-24 relative overflow-hidden">
        {/* Background grid — matches design system */}
        <div className="absolute inset-0 z-0 pointer-events-none opacity-20">
          <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice" viewBox="0 0 1000 1000">
            <defs>
              <linearGradient id="gradRNF" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style={{ stopColor: '#004AC6', stopOpacity: 0.06 }} />
                <stop offset="100%" style={{ stopColor: '#2563EB', stopOpacity: 0 }} />
              </linearGradient>
            </defs>
            <path d="M0,100 L1000,100 M0,300 L1000,300 M0,500 L1000,500 M0,700 L1000,700 M0,900 L1000,900" fill="none" stroke="#004AC6" strokeWidth="0.5" opacity="0.2" />
            <path d="M100,0 L100,1000 M300,0 L300,1000 M500,0 L500,1000 M700,0 L700,1000 M900,0 L900,1000" fill="none" stroke="#004AC6" strokeWidth="0.5" opacity="0.2" />
            <circle cx="500" cy="500" r="400" fill="url(#gradRNF)" />
          </svg>
        </div>

        <div className="max-w-lg w-full text-center relative z-10 flex flex-col items-center">

          {/* Icon badge */}
          <div className="relative mb-8">
            <div className="absolute inset-0 bg-[#004AC6]/5 rounded-full blur-3xl scale-150" />
            <div className="relative w-24 h-24 rounded-full bg-white shadow-lg border border-[#C3C6D7]/20 flex items-center justify-center">
              <FileSearch size={40} className="text-[#2563EB]" strokeWidth={1.5} />
            </div>
          </div>

          {/* Status code */}
          <span
            className="text-7xl font-extrabold tracking-tighter leading-none bg-clip-text text-transparent mb-4 block"
            style={{ backgroundImage: 'linear-gradient(135deg, #004AC6 0%, #2563EB 100%)' }}
          >
            404
          </span>

          {/* Title */}
          <h1 className="text-2xl font-extrabold text-[#191C1E] mb-2">
            {recordType} Not Found
          </h1>

          {/* Description */}
          <p className="text-[#434655] text-sm max-w-sm mx-auto leading-relaxed mb-2">
            We couldn't find the {recordType.toLowerCase()} you're looking for. It may have been
            deleted or the link is incorrect.
          </p>

          {/* Attempted ID chip */}
          {recordId && (
            <div className="mt-3 mb-8 inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#FFF3CD] border border-[#FFC107]/30 rounded-lg">
              <AlertTriangle size={13} className="text-amber-600 flex-shrink-0" />
              <span className="text-xs font-semibold text-amber-800 font-mono">{recordId}</span>
            </div>
          )}

          {/* Back button */}
          <button
            onClick={() => navigate(backPath)}
            className="mt-6 cursor-pointer inline-flex items-center justify-center gap-2 px-8 py-3.5 text-white font-bold rounded-xl shadow-lg shadow-[#004AC6]/20 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
            style={{ background: 'linear-gradient(135deg, #004AC6 0%, #2563EB 100%)' }}
          >
            <ArrowLeft size={16} />
            {backLabel}
          </button>
        </div>
      </main>
    </div>
  );
};

export default RecordNotFound;
