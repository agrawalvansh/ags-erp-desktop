import React from 'react';
import { Link } from 'react-router-dom';

/**
 * 404 Not Found page – uses brand colors only (#05014A and #caf0f8)
 */
const NotFound = () => (
  <div className="min-h-screen flex flex-col items-center justify-center bg-[#caf0f8] text-center px-4">
    <h1 className="text-6xl md:text-8xl font-bold text-[#05014A] mb-6">404</h1>
    <p className="text-2xl md:text-3xl text-[#05014A]/80 mb-10">Oops! Page not found.</p>
    <Link
      to="/invoice"
      className="inline-block bg-[#05014A] hover:bg-[#05014A]/90 text-[#caf0f8] px-6 py-3 rounded-lg font-medium transition-colors"
    >
      Go to Invoices
    </Link>
  </div>
);

export default NotFound;
