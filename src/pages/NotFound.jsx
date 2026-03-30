import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Search, Home } from 'lucide-react';

/**
 * 404 Not Found page – Stitch design system
 */
const NotFound = () => (
  <div className="min-h-screen bg-[#F7F9FB] flex flex-col">
    {/* Main Content */}
    <main className="flex-grow flex items-center justify-center px-6 py-24 relative overflow-hidden">
      {/* Background Grid Pattern */}
      <div className="absolute inset-0 z-0 pointer-events-none opacity-30">
        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice" viewBox="0 0 1000 1000">
          <defs>
            <linearGradient id="grad404" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style={{ stopColor: '#004AC6', stopOpacity: 0.05 }} />
              <stop offset="100%" style={{ stopColor: '#2563EB', stopOpacity: 0 }} />
            </linearGradient>
          </defs>
          <path d="M0,100 L1000,100 M0,300 L1000,300 M0,500 L1000,500 M0,700 L1000,700 M0,900 L1000,900" fill="none" stroke="#004AC6" strokeWidth="0.5" opacity="0.2" />
          <path d="M100,0 L100,1000 M300,0 L300,1000 M500,0 L500,1000 M700,0 L700,1000 M900,0 L900,1000" fill="none" stroke="#004AC6" strokeWidth="0.5" opacity="0.2" />
          <circle cx="500" cy="500" r="400" fill="url(#grad404)" />
          <path d="M200,200 L800,800 M800,200 L200,800" stroke="#004AC6" strokeWidth="0.2" opacity="0.1" />
        </svg>
      </div>

      <div className="max-w-2xl w-full text-center relative z-10 flex flex-col items-center">
        {/* 404 Number with gradient glow */}
        <div className="relative mb-8">
          <div className="absolute inset-0 bg-[#004AC6]/5 rounded-full blur-3xl scale-150"></div>
          <span
            className="relative text-8xl md:text-9xl font-extrabold tracking-tighter leading-none bg-clip-text text-transparent"
            style={{ backgroundImage: 'linear-gradient(135deg, #004AC6 0%, #2563EB 100%)' }}
          >
            404
          </span>
        </div>

        {/* Content */}
        <h1 className="text-[#434655] text-2xl md:text-3xl font-bold mb-4">
          Oops! Page not found.
        </h1>
        <p className="text-[#434655]/70 text-sm md:text-base max-w-md mb-10 leading-relaxed font-medium">
          The page you're looking for doesn't exist or has been moved. This ledger entry could not be located in our database.
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
          <Link
            to="/invoice"
            className="group inline-flex items-center justify-center gap-2 px-8 py-4 text-white font-bold rounded-xl shadow-lg shadow-[#004AC6]/20 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
            style={{ background: 'linear-gradient(135deg, #004AC6 0%, #2563EB 100%)' }}
          >
            <Home size={18} />
            <span>Go to Invoice Page</span>
            <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
          </Link>
        </div>
      </div>
    </main>
  </div>
);

export default NotFound;