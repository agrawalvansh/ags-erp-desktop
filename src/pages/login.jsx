import { useState } from 'react';
import { motion } from 'framer-motion';
import { FaUser, FaLock } from 'react-icons/fa';
import { FiArrowRight } from 'react-icons/fi';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { toast } from 'react-hot-toast';

const LoginPage = () => {
  const navigate = useNavigate();
  const { isAuthenticated, login } = useAuth();
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });
  const [error, setError] = useState('');
  const ENV_USERNAME = "amit_agrawal";
  const ENV_PASSWORD = "Amit@1234";

  const handleSubmit = (e) => {
    e.preventDefault();
    if (
      formData.username === ENV_USERNAME &&
      formData.password === ENV_PASSWORD
    ) {
      setError('');
      login();
      toast.success('Login Successful');
      navigate('/invoice');
    } else {
      setError('Wrong username or password');
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  if (isAuthenticated) {
    return <Navigate to="/invoice" replace />;
  }

  return (
    <div className="min-h-screen bg-[#caf0f8] flex items-center justify-center p-4">
      {/* Main Card */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative bg-white rounded-3xl shadow-lg flex w-full max-w-6xl overflow-hidden border border-[#05014A]/10"
      >
        {/* Left Side - Branding */}
        <div className="hidden md:flex md:w-1/2 flex-col items-center justify-center bg-gradient-to-br from-[#05014A] to-[#0a0a6c] relative overflow-hidden p-8">
          {/* Animated background elements */}
          <motion.div 
            className="absolute -top-20 -left-20 w-64 h-64 bg-[#caf0f8] rounded-full opacity-10"
            animate={{ rotate: 360 }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          />
          <motion.div 
            className="absolute -bottom-20 -right-20 w-64 h-64 bg-[#caf0f8] rounded-full opacity-10"
            animate={{ rotate: -360 }}
            transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
          />

          <div className="text-center px-8 z-10 space-y-8">
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-4xl font-bold text-[#caf0f8] mb-6"
            >
              Amit General Stores
            </motion.h1>
            
            {/* Feature list with improved accessibility */}
            <div className="flex flex-col gap-6 text-left">
              {[
                "Create Invoices",
                "Manage Price Lists",
                "Track Accounts"
              ].map((feature, index) => (
                <motion.div
                  key={feature}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="flex items-center gap-4"
                >
                  <div className="bg-[#caf0f8] p-2 rounded-full shrink-0">
                    <svg className="w-5 h-5 text-[#05014A]" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <span className="text-[#caf0f8]/90">{feature}</span>
                </motion.div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Side - Form */}
        <div className="flex-1 p-8 md:p-12 max-w-md mx-auto">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-8"
          >
            <div className="text-center">
              <h2 className="text-3xl font-bold text-[#05014A]">Welcome Back Amit</h2>
              <p className="mt-2 text-[#05014A]/80">Login to continue your business journey</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Username Field with label */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-[#05014A]/90">Username</label>
                <div className="group relative">
                  <FaUser className="absolute left-4 top-1/2 -translate-y-1/2 text-[#05014A]/50 transition-colors" />
                  <input
                    type="text"
                    name="username"
                    value={formData.username}
                    onChange={handleChange}
                    className="w-full pl-12 pr-4 py-3 rounded-lg border border-[#05014A]/20 focus:border-[#05014A]/50 focus:ring-2 focus:ring-[#05014A]/10 bg-white/50 transition-all placeholder:text-[#05014A]/40"
                    placeholder="Enter your username"
                    required
                    id="username"
                    autoComplete="off"
                  />
                </div>
              </div>

              {/* Password Field with label */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-[#05014A]/90">Password</label>
                <div className="group relative">
                  <FaLock className="absolute left-4 top-1/2 -translate-y-1/2 text-[#05014A]/50 transition-colors" />
                  <input
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    className="w-full pl-12 pr-4 py-3 rounded-lg border border-[#05014A]/20 focus:border-[#05014A]/50 focus:ring-2 focus:ring-[#05014A]/10 bg-white/50 transition-all placeholder:text-[#05014A]/40"
                    placeholder="Enter your password"
                    required
                    id="password"
                    autoComplete="off"
                    />
                </div>
              </div>

              {error && (
                <p className="text-red-600 text-sm text-center">{error}</p>
              )}
              {/* Submit Button with loading state */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                type="submit"
                className="w-full bg-[#05014A] hover:bg-[#05014A]/90 text-[#caf0f8] py-3 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <span>Login</span>
                <FiArrowRight className="w-5 h-5" />
              </motion.button>
            </form>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
};

export default LoginPage;