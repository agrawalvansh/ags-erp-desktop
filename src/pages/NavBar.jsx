import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { useAuth } from '../AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FileText, List, 
  User, 
  LogOut, Menu, X, Store, Package, ReceiptIndianRupee, ChevronDown
} from 'lucide-react';

// Navigation items grouped by section
const navSections = [
  {
    label: 'SALES',
    items: [
      { title: 'Estimate', path: '/invoice', icon: <FileText size={20} /> },
      {
        title: 'Quick Sales',
        icon: <ReceiptIndianRupee size={20} />,
        dropdown: [
          { title: 'New Quick Sale', path: '/quick-sales/create' },
          { title: 'View Quick Sales', path: '/quick-sales/list' }
        ]
      },
    ]
  },
  {
    label: 'CATALOG',
    items: [
      { title: 'Price List', path: '/price-list', icon: <List size={20} /> },
    ]
  },
  {
    label: 'ACCOUNTS',
    items: [
      {
        title: 'Accounts',
        icon: <User size={20} />,
        dropdown: [
          { title: 'Customers', path: '/accounts/customers' },
          { title: 'Suppliers', path: '/accounts/suppliers' }
        ]
      },
    ]
  },
  {
    label: 'ORDERS',
    items: [
      {
        title: 'Orders',
        icon: <Package size={20} />,
        dropdown: [
          { title: 'Customer Orders', path: '/orders/customers' },
          { title: 'Supplier Orders', path: '/orders/suppliers' },
        ]
      },
    ]
  }
];

const Layout = ({ children }) => {
  return (
    <div className="flex min-h-screen overflow-x-hidden">
      <NavBar />
      <main className="flex-1 ml-0 md:ml-[240px] print:ml-0">
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
  const [isMobile, setIsMobile] = useState(false);
  const [expandedDropdowns, setExpandedDropdowns] = useState({});

  // Highlight link when current path matches exactly or is a sub-route
  const isActive = (path) =>
    location.pathname === path || location.pathname.startsWith(`${path}/`);
  const isParentActive = (dropdown) => dropdown?.some(item => isActive(item.path));

  // Auto-expand dropdowns that contain the active path
  useEffect(() => {
    const expanded = {};
    navSections.forEach(section => {
      section.items.forEach(item => {
        if (item.dropdown && isParentActive(item.dropdown)) {
          expanded[item.title] = true;
        }
      });
    });
    setExpandedDropdowns(prev => ({ ...prev, ...expanded }));
  }, [location.pathname]);

  const toggleDropdown = (title) => {
    setExpandedDropdowns(prev => ({ ...prev, [title]: !prev[title] }));
  };

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
        className="md:hidden fixed top-4 left-4 z-50 p-2.5 rounded-xl bg-[#2563EB] text-white shadow-lg print:hidden"
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
            className="fixed inset-0 bg-black/30 backdrop-blur-sm z-30 md:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsMobileOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Navigation Panel — Light Theme */}
      <motion.nav
        className={`fixed top-0 left-0 h-screen w-[240px] bg-white border-r border-[#E2E8F0] flex flex-col z-40 print:hidden ${
          isMobile ? '' : 'block'
        }`}
        variants={isMobile ? mobileNavVariants : {}}
        animate={isMobile ? (isMobileOpen ? 'open' : 'closed') : {}}
        initial={isMobile ? 'closed' : {}}
        drag={isMobile ? "x" : false}
        dragConstraints={{ left: -240, right: 0 }}
        dragElastic={0.1}
      >
        {/* Logo Section */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-[#E2E8F0] flex-shrink-0">
          <div className="w-10 h-10 rounded-xl bg-[#2563EB] flex items-center justify-center flex-shrink-0 shadow-sm">
            <Store className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm font-bold text-[#0F172A] truncate leading-tight">
              Amit General Stores
            </h1>
            <p className="text-xs text-[#64748B] mt-0.5">AGS ERP</p>
          </div>
        </div>

        {/* Navigation Items - Scrollable */}
        <div className="py-3 flex-1 overflow-y-auto scrollbar-thin">
          {navSections.map((section, sIdx) => (
            <div key={sIdx} className="mb-1">
              {/* Section Label */}
              <p className="px-5 pt-4 pb-2 text-[10px] font-semibold tracking-wider text-[#94A3B8] uppercase select-none">
                {section.label}
              </p>

              <ul className="space-y-0.5 px-3">
                {section.items.map((item, iIdx) => (
                  <li key={iIdx}>
                    {item.dropdown ? (
                      <div>
                        {/* Dropdown Parent */}
                        <button
                          onClick={() => toggleDropdown(item.title)}
                          className={`cursor-pointer w-full flex items-center px-3 py-2.5 rounded-lg transition-all duration-150 group ${
                            isParentActive(item.dropdown)
                              ? 'bg-[#EFF6FF] text-[#2563EB]'
                              : 'text-[#334155] hover:bg-[#F1F5F9]'
                          }`}
                        >
                          <span className={`w-5 h-5 mr-3 flex items-center justify-center ${
                            isParentActive(item.dropdown) ? 'text-[#2563EB]' : 'text-[#94A3B8] group-hover:text-[#64748B]'
                          }`}>
                            {item.icon}
                          </span>
                          <span className="flex-1 text-left text-[13px] font-medium">
                            {item.title}
                          </span>
                          <ChevronDown 
                            size={14} 
                            className={`text-[#94A3B8] transition-transform duration-200 ${
                              expandedDropdowns[item.title] ? 'rotate-180' : ''
                            }`}
                          />
                        </button>

                        {/* Dropdown Items */}
                        <AnimatePresence initial={false}>
                          {expandedDropdowns[item.title] && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2, ease: 'easeInOut' }}
                              className="overflow-hidden"
                            >
                              <div className="ml-5 mt-0.5 space-y-0.5 border-l-2 border-[#E2E8F0] pl-3">
                                {item.dropdown.map((dropItem, dIdx) => (
                                  <button
                                    key={dIdx}
                                    onClick={() => handleNavClick(dropItem.path)}
                                    className={`cursor-pointer block w-full text-left px-3 py-2 rounded-md text-[13px] transition-all duration-150 ${
                                      isActive(dropItem.path)
                                        ? 'bg-[#2563EB] text-white font-medium shadow-sm'
                                        : 'text-[#64748B] hover:bg-[#F1F5F9] hover:text-[#0F172A]'
                                    }`}
                                  >
                                    {dropItem.title}
                                  </button>
                                ))}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    ) : (
                      /* Regular Nav Item */
                      <button
                        onClick={() => handleNavClick(item.path)}
                        className={`cursor-pointer w-full flex items-center px-3 py-2.5 rounded-lg transition-all duration-150 group ${
                          isActive(item.path)
                            ? 'bg-[#2563EB] text-white shadow-sm'
                            : 'text-[#334155] hover:bg-[#F1F5F9]'
                        }`}
                      >
                        <span className={`w-5 h-5 mr-3 flex items-center justify-center ${
                          isActive(item.path) ? 'text-white' : 'text-[#94A3B8] group-hover:text-[#64748B]'
                        }`}>
                          {item.icon}
                        </span>
                        <span className="text-[13px] font-medium">
                          {item.title}
                        </span>
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Logout Section — bottom */}
        <div className="border-t border-[#E2E8F0] p-3 flex-shrink-0">
          <button
            onClick={() => handleNavClick('/logout')}
            className="cursor-pointer w-full flex items-center px-3 py-2.5 rounded-lg text-[#DC2626] hover:bg-red-50 transition-all duration-150"
          >
            <span className="w-5 h-5 mr-3 flex items-center justify-center">
              <LogOut size={20} />
            </span>
            <span className="text-[13px] font-medium">
              Logout
            </span>
          </button>
        </div>
      </motion.nav>
    </>
  );
};

export { Layout };
export default NavBar;