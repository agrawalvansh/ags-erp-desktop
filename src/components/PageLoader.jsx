import { Loader2 } from 'lucide-react';

/**
 * Shared loader component — used across all pages.
 *
 * Variants:
 *   "page"     – Full-screen centered spinner (for page-level data loading)
 *   "section"  – Inline card-level loader (for embedded sections)
 *   "overlay"  – Full-screen frosted-glass overlay (for Marathi translation, etc.)
 *   "inline"   – Minimal spinner for Suspense fallback / lazy loading
 */
const PageLoader = ({ message, subtitle, variant = 'page' }) => {
  if (variant === 'overlay') {
    return (
      <div
        className="fixed inset-0 z-[200] flex flex-col items-center justify-center print:hidden"
        style={{ backdropFilter: 'blur(10px)', backgroundColor: 'rgba(255,255,255,0.85)' }}
      >
        <div className="flex flex-col items-center gap-6">
          <div className="relative w-16 h-16">
            <div className="absolute inset-0 rounded-full border-4 border-[#E2E8F0]" />
            <div className="absolute inset-0 rounded-full border-4 border-t-[#004AC6] animate-spin" />
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-[#0F172A] mb-1">{message || 'Processing...'}</p>
            {subtitle && <p className="text-sm text-[#64748B]">{subtitle}</p>}
          </div>
        </div>
      </div>
    );
  }

  if (variant === 'section') {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-[#C3C6D7]/10 px-8 py-16 text-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-[3px] border-[#E2E8F0] border-t-[#004AC6] rounded-full animate-spin" />
          <p className="text-sm text-[#64748B]">{message || 'Loading...'}</p>
        </div>
      </div>
    );
  }

  if (variant === 'inline') {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-[3px] border-[#E2E8F0] border-t-[#004AC6] rounded-full animate-spin" />
      </div>
    );
  }

  // Default: "page" — full-screen centered
  return (
    <div className="min-h-screen bg-[#F7F9FB] flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-4 border-[#004AC6] border-t-transparent rounded-full animate-spin" />
        <span className="text-sm font-semibold text-[#434655]">{message || 'Loading...'}</span>
      </div>
    </div>
  );
};

export default PageLoader;
