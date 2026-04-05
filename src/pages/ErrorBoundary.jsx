import { useRouteError, useNavigate } from 'react-router-dom';
import { AlertTriangle, RefreshCw, ArrowLeft } from 'lucide-react';

const ErrorBoundary = () => {
  const error = useRouteError();
  const navigate = useNavigate();

  const isDev = import.meta.env.DEV; // Vite automatically exposes this based on environment
  const errorMessage = isDev ? (error?.message || error?.statusText || 'An unexpected error occurred') : 'An unexpected error occurred';
  const errorStack = isDev ? (error?.stack || '') : '';

  return (
    <div className="min-h-screen bg-[#F7F9FB] flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-xl border border-[#E2E8F0] p-10 max-w-lg w-full text-center">
        {/* Icon */}
        <div className="w-16 h-16 bg-red-100/50 rounded-full flex items-center justify-center mx-auto mb-6">
          <AlertTriangle size={32} className="text-[#DC2626]" />
        </div>

        {/* Heading */}
        <h1 className="text-2xl font-extrabold text-[#0F172A] tracking-tight mb-2">
          Something went wrong
        </h1>
        <p className="text-[#64748B] leading-relaxed mb-6">
          The application encountered an unexpected error. You can try refreshing or going back.
        </p>

        {/* Error details (collapsible) */}
        <details className="text-left bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-4 mb-8">
          <summary className="text-sm font-semibold text-[#0F172A] cursor-pointer select-none">
            Technical Details
          </summary>
          <pre className="mt-3 text-xs text-[#DC2626] font-mono whitespace-pre-wrap break-words max-h-40 overflow-y-auto">
            {errorMessage}
          </pre>
          {errorStack && (
            <pre className="mt-2 text-xs text-[#64748B] font-mono whitespace-pre-wrap break-words max-h-32 overflow-y-auto">
              {errorStack}
            </pre>
          )}
        </details>

        {/* Action buttons */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              if (window.history.length > 1) {
                navigate(-1);
              } else {
                navigate('/');
              }
            }}
            className="flex-1 px-6 py-3 bg-[#E6E8EA] text-[#191C1E] font-bold rounded-xl hover:bg-[#E0E3E5] transition-all text-sm flex items-center justify-center gap-2 cursor-pointer"
          >
            <ArrowLeft size={16} />
            Go Back
          </button>
          <button
            onClick={() => window.location.reload()}
            className="flex-1 px-6 py-3 bg-[#2563EB] text-white font-bold rounded-xl shadow-lg shadow-blue-600/20 hover:bg-[#1D4ED8] transition-all text-sm flex items-center justify-center gap-2 cursor-pointer"
          >
            <RefreshCw size={16} />
            Reload App
          </button>
        </div>
      </div>
    </div>
  );
};

export default ErrorBoundary;
