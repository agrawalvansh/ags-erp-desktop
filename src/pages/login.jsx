import { useState } from 'react';
import { User, Lock, Eye, EyeOff, Store, ArrowRight } from 'lucide-react';
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
  const [showPassword, setShowPassword] = useState(false);
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
    <div className="min-h-screen bg-[#F7F9FB] flex flex-col items-center justify-center overflow-hidden relative">
      {/* Background Decoration */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-5%] w-[40%] h-[40%] bg-[#004AC6]/5 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[-5%] w-[40%] h-[40%] bg-[#004AC6]/5 rounded-full blur-[120px]"></div>
      </div>

      {/* Main Content */}
      <main className="relative z-10 w-full max-w-md px-6 flex-grow flex items-center justify-center">
        {/* Login Card */}
        <div className="w-full bg-white rounded-xl p-8 md:p-10 border border-[#C3C6D7]/10"
          style={{ boxShadow: '0px 20px 40px rgba(0, 52, 94, 0.06)' }}
        >
          {/* Branding Header */}
          <div className="flex flex-col items-center text-center mb-10">
            <div className="w-16 h-16 flex items-center justify-center rounded-full mb-6"
              style={{ background: 'linear-gradient(135deg, #004AC6 0%, #2563EB 100%)' }}
            >
              <Store size={28} className="text-white" />
            </div>
            <h1 className="text-[#191C1E] font-black text-xl tracking-tight leading-none mb-1">
              Amit General Stores
            </h1>
            <p className="text-[#434655] font-bold text-[0.65rem] uppercase tracking-[0.2em] mb-6 opacity-70">
              AGS ERP
            </p>
            <h2 className="text-[#191C1E] font-semibold text-2xl tracking-tight mb-1">
              Welcome Back
            </h2>
            <p className="text-[#434655] text-sm font-normal">
              Sign in to your account
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6" autoComplete="off">
            {/* Username Field */}
            <div className="space-y-2">
              <label
                className="block text-[0.75rem] font-bold uppercase tracking-[0.05em] text-[#434655]"
                htmlFor="username"
              >
                Username
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-[#434655]/40">
                  <User size={18} />
                </div>
                <input
                  type="text"
                  name="username"
                  id="username"
                  value={formData.username}
                  onChange={handleChange}
                  className="block w-full pl-12 pr-4 py-3 bg-[#E6E8EA] border-none rounded-lg text-[#191C1E] placeholder:text-[#434655]/40 text-sm focus:ring-2 focus:ring-[#004AC6]/20 focus:bg-white transition-all duration-200 outline-none"
                  placeholder="Enter your username"
                  required
                  autoComplete="off"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-2">
              <label
                className="block text-[0.75rem] font-bold uppercase tracking-[0.05em] text-[#434655]"
                htmlFor="password"
              >
                Password
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-[#434655]/40">
                  <Lock size={18} />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  id="password"
                  value={formData.password}
                  onChange={handleChange}
                  className="block w-full pl-12 pr-12 py-3 bg-[#E6E8EA] border-none rounded-lg text-[#191C1E] placeholder:text-[#434655]/40 text-sm focus:ring-2 focus:ring-[#004AC6]/20 focus:bg-white transition-all duration-200 outline-none"
                  placeholder="••••••••"
                  required
                  autoComplete="off"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-[#434655]/40 hover:text-[#004AC6] transition-colors cursor-pointer"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                <p className="text-[#BA1A1A] text-sm text-center font-medium">{error}</p>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              className="w-full flex justify-center items-center gap-2 py-4 px-4 rounded-lg text-sm font-bold text-white hover:opacity-90 active:scale-[0.98] transition-all duration-300 shadow-lg shadow-[#004AC6]/20 cursor-pointer"
              style={{ background: 'linear-gradient(135deg, #004AC6 0%, #2563EB 100%)' }}
            >
              <span>Sign In</span>
              <ArrowRight size={18} />
            </button>
          </form>

          {/* Secondary Help */}
          <div className="mt-8 pt-8 border-t border-[#ECEEF0] flex justify-center">
            <p className="text-xs text-[#434655]">
              Need help?{' '}
              <span className="text-[#004AC6] font-bold cursor-pointer hover:underline">
                Contact System Admin
              </span>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default LoginPage;