import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { useAuth } from '../AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FileText, List, 
  User, 
  LogOut, Menu, X, Store, Package 
} from 'lucide-react';

// Navigation items array
const navItems = [
  { title: 'Estimate', path: '/invoice', icon: <FileText />, color: '#bb86fc' },
  { title: 'Price List', path: '/price-list', icon: <List />, color: '#03dac6' },
  {
    title: 'Accounts',
    icon: <User />,
    color: '#03dac6',
    dropdown: [
      { title: 'Customers', path: '/accounts/customers' },
      { title: 'Suppliers', path: '/accounts/suppliers' }
    ]
  },
  {
    title: 'Orders',
    icon: <Package  />,
    color: '#cf6679',
    dropdown: [
      { title: 'Customers', path: '/orders/customers' },
      { title: 'Suppliers', path: '/orders/suppliers' },
    ]
  },
];

const Layout = ({ children }) => {
  return (
    <div className="flex min-h-screen overflow-x-hidden">
      <NavBar />
      <main className="flex-1 ml-0 md:ml-[280px] print:ml-0">
        {children}
      </main>
    </div>
  );
};

const NavBar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuth();
  
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [activeHover, setActiveHover] = useState(null);
  const [isMobile, setIsMobile] = useState(false);

  // Highlight link when current path matches exactly or is a sub-route of given path
  const isActive = (path) =>
    location.pathname === path || location.pathname.startsWith(`${path}/`);
  const isParentActive = (dropdown) => dropdown?.some(item => isActive(item.path));

  const handleNavClick = (path) => {
    if (path === '/logout') {
      logout();
      navigate('/login');
      toast.success('Logged out successfully');
    } else {
      navigate(path);
    }
    if (isMobile) {
      setIsMobileOpen(false);
    }
  };

  useEffect(() => {
    const checkMobile = () => window.innerWidth < 768;
    setIsMobile(checkMobile());

    const handleResize = () => {
      const mobile = checkMobile();
      setIsMobile(mobile);
      if (!mobile && isMobileOpen) {
        setIsMobileOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isMobileOpen]);

  const itemVariants = {
    rest: { scale: 1, x: 0 },
    hover: {
      scale: 1.02,
      x: 4,
      transition: { duration: 0.2, ease: "easeInOut" }
    }
  };

  const iconVariants = {
    rest: { rotate: 0, scale: 1 },
    hover: {
      rotate: 5,
      scale: 1.1,
      transition: { duration: 0.2, ease: "easeInOut" }
    }
  };

  const mobileNavVariants = {
    closed: { 
      x: '-100%',
      transition: { duration: 0.3, ease: "easeInOut" }
    },
    open: { 
      x: 0,
      transition: { duration: 0.3, ease: "easeInOut" }
    }
  };

  return (
    <>
      {/* Mobile Menu Button */}
      <motion.button
        className="md:hidden fixed top-4 left-4 z-50 p-3 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-lg print:hidden h-100"
        onClick={() => setIsMobileOpen(!isMobileOpen)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        {isMobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </motion.button>

      {/* Mobile Backdrop */}
      <AnimatePresence>
        {isMobileOpen && (
          <motion.div
            className="fixed inset-0 bg-black/50 z-30 md:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsMobileOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Navigation Panel */}
      <motion.nav
        className={`fixed top-0 left-0 h-screen w-[280px] bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 text-white shadow-2xl border-r border-slate-700 flex flex-col z-40 print:hidden ${
          isMobile ? '' : 'block'
        }`}
        variants={isMobile ? mobileNavVariants : {}}
        animate={isMobile ? (isMobileOpen ? 'open' : 'closed') : {}}
        initial={isMobile ? 'closed' : {}}
        drag={isMobile ? "x" : false}
        dragConstraints={{ left: -280, right: 0 }}
        dragElastic={0.1}
      >
        {/* Logo Section */}
        <motion.div 
          className="flex flex-col items-center py-6 border-b border-slate-700 bg-gradient-to-r from-purple-600/20 to-blue-600/20 flex-shrink-0"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <motion.div 
            className="w-12 h-12 rounded-full overflow-hidden mb-3 ring-2 ring-purple-400 ring-offset-2 ring-offset-slate-800 bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center"
            whileHover={{ scale: 1.1, rotate: 360 }}
            transition={{ duration: 0.5 }}
          >
            <Store className="w-6 h-6 text-white cursor-pointer" />
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-center"
          >
            <h1 className="text-lg font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
              Amit General Stores
            </h1>
            <p className="text-xs text-slate-400 mt-1">AGS ERP</p>
          </motion.div>
        </motion.div>

        {/* Navigation Items - Scrollable */}
        <div className="py-4 flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-slate-800">
          <motion.ul 
            className="space-y-1 px-3"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2, staggerChildren: 0.05 }}
          >
            {navItems.map((item, index) => (
              <motion.li 
                key={index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 * index }}
              >
                {item.dropdown ? (
                  <div className="relative">
                    <motion.button
                      className={`w-full flex items-center px-3 py-3 rounded-xl transition-all duration-200 group relative overflow-hidden ${
                        isParentActive(item.dropdown) 
                          ? 'bg-gradient-to-r from-purple-600 to-blue-600 shadow-lg' 
                          : 'hover:bg-slate-700/50'
                      }`}
                      variants={itemVariants}
                      initial="rest"
                      whileHover="hover"
                      onHoverStart={() => setActiveHover(item.title)}
                      onHoverEnd={() => setActiveHover(null)}
                    >
                      <motion.span 
                        className={`w-6 h-6 mr-4 flex items-center justify-center ${
                          isParentActive(item.dropdown) ? 'text-white' : 'text-slate-300'
                        }`}
                        variants={iconVariants}
                        style={{ color: activeHover === item.title ? item.color : undefined }}
                      >
                        {item.icon}
                      </motion.span>
                      
                      <span className="flex-1 text-left font-medium">
                        {item.title}
                      </span>
                    </motion.button>

                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3 }}
                      className="mt-2 ml-6 space-y-1 border-l-2 border-slate-600 pl-4"
                    >
                      {item.dropdown.map((dropItem, dropIndex) => (
                        <motion.div
                          key={dropIndex}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: dropIndex * 0.05 }}
                        >
                          <button
                            onClick={() => handleNavClick(dropItem.path)}
                            className={`cursor-pointer block w-full text-left px-3 py-2 rounded-lg text-sm transition-all duration-200 ${
                              isActive(dropItem.path)
                                ? 'bg-gradient-to-r from-purple-600/50 to-blue-600/50 text-white'
                                : 'text-slate-300 hover:bg-slate-700/30 hover:text-white'
                            }`}
                          >
                            {dropItem.title}
                          </button>
                        </motion.div>
                      ))}
                    </motion.div>
                  </div>
                ) : (
                  <motion.div
                    variants={itemVariants}
                    initial="rest"
                    whileHover="hover"
                    onHoverStart={() => setActiveHover(item.title)}
                    onHoverEnd={() => setActiveHover(null)}
                  >
                    <button
                      onClick={() => handleNavClick(item.path)}
                      className={`cursor-pointer w-full flex items-center px-3 py-3 rounded-xl transition-all duration-200 group relative overflow-hidden ${
                        isActive(item.path)
                          ? 'bg-gradient-to-r from-purple-600 to-blue-600 shadow-lg'
                          : 'hover:bg-slate-700/50'
                      }`}
                    >
                      <motion.span 
                        className={`w-6 h-6 mr-4 flex items-center justify-center ${
                          isActive(item.path) ? 'text-white' : 'text-slate-300'
                        }`}
                        variants={iconVariants}
                        style={{ color: activeHover === item.title ? item.color : undefined }}
                      >
                        {item.icon}
                      </motion.span>
                      
                      <span className="font-medium">
                        {item.title}
                      </span>
                    </button>
                  </motion.div>
                )}
              </motion.li>
            ))}
          </motion.ul>
        </div>

        {/* Logout Section */}
        <motion.div 
          className="border-t border-slate-700 p-3 flex-shrink-0"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <motion.div
            variants={itemVariants}
            initial="rest"
            whileHover="hover"
          >
            <button
              onClick={() => handleNavClick('/logout')}
              className="cursor-pointer w-full flex items-center px-3 py-3 rounded-xl text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-all duration-200"
            >
              <motion.span 
                className="w-6 h-6 mr-4 flex items-center justify-center"
                variants={iconVariants}
              >
                <LogOut />
              </motion.span>
              
              <span className="font-medium">
                Logout
              </span>
            </button>
          </motion.div>
        </motion.div>
      </motion.nav>
    </>
  );
};

export { Layout };
export default NavBar;