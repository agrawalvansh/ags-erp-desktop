import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { useAuth } from '../AuthContext';
import { 
  FileText, List, 
  User, 
  LogOut, Store, Package, ReceiptIndianRupee, ChevronDown, Bell
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
      <main className="flex-1 ml-[240px] print:ml-0">
        {children}
      </main>
    </div>
  );
};

const NavBar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuth();
  
  const [expandedDropdowns, setExpandedDropdowns] = useState({});
  const [unreadCount, setUnreadCount] = useState(0);

  // Fetch unread notification count on mount + listen for live updates
  useEffect(() => {
    const fetchCount = async () => {
      try {
        const data = await window.api.invoke('notifications:getUnreadCount');
        if (data && typeof data.count === 'number') setUnreadCount(data.count);
      } catch (e) { /* silent */ }
    };
    fetchCount();
    // Listen for updates from main process (startup scan)
    const cleanup = window.api.onNotificationCountUpdate?.((payload) => {
      const count = typeof payload === 'number' ? payload : (typeof payload?.count === 'number' ? payload.count : 0);
      setUnreadCount(count);
    });
    // Listen for local updates from NotificationsPage (mark read / delete)
    const handleLocalUpdate = (e) => setUnreadCount(e.detail ?? 0);
    window.addEventListener('notifications:localUpdate', handleLocalUpdate);
    return () => {
      if (cleanup) cleanup();
      window.removeEventListener('notifications:localUpdate', handleLocalUpdate);
    };
  }, []);

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

  // Paths that should trigger "new document" behavior when clicked while already on that page
  const forceNewPaths = ['/invoice', '/quick-sales/create'];

  const handleNavClick = (path) => {
    if (path === '/logout') {
      logout();
      navigate('/login');
      toast.success('Logged out successfully');
    } else if (forceNewPaths.includes(path) && location.pathname.startsWith(path)) {
      // Already on Invoice or Quick Sale create page — signal a "new document" request
      // The target component will check for unsaved changes before resetting
      navigate(path, { state: { forceNew: true, _ts: Date.now() }, replace: true });
    } else {
      navigate(path);
    }
  };

  return (
    <nav className="fixed top-0 left-0 h-screen w-[240px] bg-white border-r border-[#E2E8F0] flex flex-col z-40 print:hidden">
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

                      {/* Dropdown Items — CSS grid animation (no framer-motion) */}
                      <div className={`nav-dropdown ${expandedDropdowns[item.title] ? 'nav-dropdown-open' : ''}`}>
                        <div className="min-h-0">
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
                        </div>
                      </div>
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

      {/* Notifications + Logout Section — bottom */}
      <div className="border-t border-[#E2E8F0] p-3 flex-shrink-0 space-y-0.5">
        <button
          onClick={() => handleNavClick('/notifications')}
          className={`cursor-pointer w-full flex items-center px-3 py-2.5 rounded-lg transition-all duration-150 group ${
            isActive('/notifications')
              ? 'bg-[#EFF6FF] text-[#2563EB]'
              : 'text-[#334155] hover:bg-[#F1F5F9]'
          }`}
        >
          <span className={`w-5 h-5 mr-3 flex items-center justify-center ${
            isActive('/notifications') ? 'text-[#2563EB]' : 'text-[#94A3B8] group-hover:text-[#64748B]'
          }`}>
            <Bell size={20} />
          </span>
          <span className="flex-1 text-left text-[13px] font-medium">
            Notifications
          </span>
          {unreadCount > 0 && (
            <span className="min-w-[20px] h-5 flex items-center justify-center bg-[#DC2626] text-white text-[10px] font-bold rounded-full px-1.5">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>
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
    </nav>
  );
};

export { Layout };
export default NavBar;