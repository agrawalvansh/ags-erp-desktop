import React from 'react';
import { Link } from 'react-router-dom';

function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 px-4">
      <h1 className="text-4xl font-bold text-[#05014A] mb-8 text-center">
        Amit General Stores
      </h1>

      <Link to="/login">
        <button className="bg-[#05014A] hover:bg-[#0A0A47] text-white py-3 px-6 rounded-md text-lg font-medium transition duration-300 cursor-pointer">
          Login
        </button>
      </Link>
    </div>
  );
}

export default Home;
