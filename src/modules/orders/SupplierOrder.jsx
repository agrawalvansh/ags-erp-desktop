import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Search, ChevronDown, Plus, Edit, Trash2, X, CalendarDays, SlidersHorizontal } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useNavigate, useLocation } from 'react-router-dom';
import { naturalCompare } from '../../utils/productUtils';

const SupplierOrder = () => {
  const navigate = useNavigate();

  const [searchTerm, setSearchTerm] = useState('');
  const searchInputRef = useRef(null);
  const [orders, setOrders] = useState([]);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const deleteModalRef = useRef(null);
  const [statusFilter, setStatusFilter] = useState('All');
  const [highlightedId, setHighlightedId] = useState(null);
  const rowRefs = useRef({});
  const location = useLocation();
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const ROWS_OPTIONS = [25, 50, 100, 'All'];
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const hasActiveFilters = statusFilter !== 'All' || fromDate || toDate;

  // Focus the delete modal when it opens
  useEffect(() => {
    if (deleteTarget !== null) deleteModalRef.current?.focus();
  }, [deleteTarget]);

  const fetchOrders = async () => {
    try {
      const data = await window.api.invoke('supOrders:getAll');
      setOrders(data || []);
    } catch (err) {
      console.error(err);
      toast.error('Failed to fetch orders');
    }
  };

  useEffect(() => { fetchOrders(); }, []);

  // Global shortcut listeners (Ctrl+N, Ctrl+F, F5)
  useEffect(() => {
    const onNew = () => navigate('/orders/suppliers/add');
    const onSearch = () => searchInputRef.current?.focus();
    const onRefresh = () => fetchOrders();
    window.addEventListener('shortcut:new', onNew);
    window.addEventListener('shortcut:search', onSearch);
    window.addEventListener('shortcut:refresh', onRefresh);
    return () => {
      window.removeEventListener('shortcut:new', onNew);
      window.removeEventListener('shortcut:search', onSearch);
      window.removeEventListener('shortcut:refresh', onRefresh);
    };
  }, []);

  // Auto-scroll and highlight when returning from order detail
  useEffect(() => {
    let scrollTimer, fadeTimer;
    if (location.state?.returnedFromOrder && orders.length > 0) {
      const returnedId = location.state.returnedFromOrder;
      setHighlightedId(returnedId);

      scrollTimer = setTimeout(() => {
        const rowElement = rowRefs.current[returnedId];
        if (rowElement) {
          rowElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        fadeTimer = setTimeout(() => setHighlightedId(null), 2000);
      }, 150);

      window.history.replaceState({}, document.title);
    }
    return () => { clearTimeout(scrollTimer); clearTimeout(fadeTimer); };
  }, [location.state, orders]);

  const [sortConfig, setSortConfig] = useState({ key: 'orderNo', direction: 'desc' });

  const processedOrders = useMemo(() => {
    let merged = orders.map(o => ({
      ...o,
      name: o.supplier_name || o.name || o.supplier_id,
      status: o.status || 'Placed',
      orderNo: o.order_id || o.orderNo,
      date: o.order_date || o.date,
    }));

    // Status filter
    if (statusFilter !== 'All') {
      merged = merged.filter(o => o.status === statusFilter);
    }

    // Search filter
    let filtered = merged.filter(
      (o) =>
        (o.orderNo || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (o.name || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Date range filter
    if (fromDate) {
      const from = new Date(fromDate);
      filtered = filtered.filter(o => {
        const d = new Date(o.date);
        return !isNaN(d.getTime()) && d >= from;
      });
    }
    if (toDate) {
      const to = new Date(toDate);
      to.setHours(23, 59, 59);
      filtered = filtered.filter(o => {
        const d = new Date(o.date);
        return !isNaN(d.getTime()) && d <= to;
      });
    }

    if (sortConfig.key) {
      filtered.sort((a, b) => {
        const dir = sortConfig.direction === 'asc' ? 1 : -1;
        if (sortConfig.key === 'orderNo') return dir * naturalCompare(a.orderNo, b.orderNo);
        if (a[sortConfig.key] < b[sortConfig.key]) return -dir;
        if (a[sortConfig.key] > b[sortConfig.key]) return dir;
        return 0;
      });
    }

    return filtered;
  }, [searchTerm, sortConfig, orders, statusFilter, fromDate, toDate]);

  const filteredCount = processedOrders.length;
  const effectivePerPage = itemsPerPage === 'All' ? filteredCount || 1 : itemsPerPage;
  const totalPages = Math.ceil(filteredCount / effectivePerPage);

  useEffect(() => { setCurrentPage(1); }, [searchTerm, statusFilter, fromDate, toDate]);
  useEffect(() => {
    if (totalPages > 0 && currentPage > totalPages) setCurrentPage(totalPages);
  }, [totalPages, currentPage]);

  const paginatedOrders = useMemo(() => {
    if (itemsPerPage === 'All') return processedOrders;
    const start = (currentPage - 1) * itemsPerPage;
    return processedOrders.slice(start, start + itemsPerPage);
  }, [processedOrders, currentPage, itemsPerPage]);

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  };

  const handleRowClick = (orderNo) => {
    navigate(`/orders/suppliers/${orderNo}`);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const result = await window.api.invoke('supOrders:delete', deleteTarget);
      if (result && result.success) {
        toast.success('Order deleted successfully');
        fetchOrders();
      } else {
        toast.error(result?.error || 'Failed to delete order');
      }
    } catch (err) {
      console.error(err);
      toast.error('Error deleting order');
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
    }
  };

  // Format date
  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  // Status badge styles
  const getStatusStyle = (status) => {
    const s = (status || '').toLowerCase();
    if (s === 'completed' || s === 'delivered') return 'bg-emerald-100 text-emerald-700 border-emerald-200/50';
    if (s === 'cancelled') return 'bg-rose-100 text-rose-700 border-rose-200/50';
    if (s === 'pending' || s === 'placed') return 'bg-amber-100 text-amber-700 border-amber-200/50';
    return 'bg-[#E6E8EA] text-[#434655] border-[#C3C6D7]/20';
  };

  // Sort icon
  const SortIcon = ({ column }) => (
    <ChevronDown
      size={14}
      className={`ml-0.5 transition-transform ${sortConfig.key === column && sortConfig.direction === 'desc' ? 'rotate-180' : ''} ${sortConfig.key === column ? 'text-[#004AC6]' : ''}`}
    />
  );

  // Unique statuses for filter tabs
  const statusTabs = useMemo(() => {
    const statuses = [...new Set(orders.map(o => o.status || 'Placed'))];
    return ['All', ...statuses];
  }, [orders]);

  return (
    <div className="flex flex-col h-screen bg-[#F7F9FB] overflow-hidden">
      {/* ─── Page Header ─── */}
      <div className="flex-shrink-0 px-4 md:px-8 pt-6 pb-2">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-6">
            <div>
              <h2 className="text-3xl font-extrabold tracking-tight text-[#191C1E] mb-1">Supplier Orders</h2>
              <p className="text-[#434655] text-sm font-medium">Orders sent to suppliers</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#434655]" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search orders..."
                  className="w-72 bg-white border border-[#C3C6D7]/20 rounded-lg py-2.5 pl-10 pr-10 text-sm focus:border-[#004AC6] focus:ring-4 focus:ring-[#004AC6]/5 transition-all outline-none"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                {searchTerm && (
                  <button
                    onClick={() => { setSearchTerm(''); searchInputRef.current?.focus(); }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#434655] hover:text-[#191C1E] cursor-pointer"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
              <button
                onClick={() => setShowFilters(f => !f)}
                className={`relative p-2.5 rounded-lg transition-all cursor-pointer border ${
                  showFilters
                    ? 'bg-[#004AC6] text-white border-[#004AC6] shadow-sm'
                    : 'bg-white text-[#434655] border-[#C3C6D7]/20 hover:bg-[#F2F4F6]'
                }`}
                title="Toggle filters"
              >
                <SlidersHorizontal size={18} />
                {hasActiveFilters && !showFilters && (
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-[#004AC6] rounded-full border-2 border-white" />
                )}
              </button>
              <button
                onClick={() => navigate('/orders/suppliers/add')}
                className="flex items-center gap-2 text-white px-5 py-2.5 rounded-lg font-semibold shadow-lg shadow-[#004AC6]/20 active:scale-95 transition-transform cursor-pointer"
                style={{ background: 'linear-gradient(135deg, #004AC6 0%, #2563EB 100%)' }}
              >
                <Plus size={18} />
                <span>New Order</span>
              </button>
            </div>
          </div>

          {/* ─── Collapsible Filter Bar ─── */}
          {showFilters && (
            <div className="mb-4 bg-white rounded-xl border border-[#C3C6D7]/10 px-5 py-3 flex flex-wrap items-center gap-4">
              {/* Status Tabs */}
              <div className="flex items-center gap-1.5">
                {statusTabs.map(tab => (
                  <button
                    key={tab}
                    onClick={() => setStatusFilter(tab)}
                    className={`px-4 py-1.5 rounded-full text-xs font-bold transition-colors cursor-pointer ${statusFilter === tab
                      ? 'bg-[#004AC6] text-white shadow-sm'
                      : 'text-[#434655] hover:bg-[#F2F4F6]'
                      }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {/* Divider */}
              <div className="w-px h-6 bg-[#E2E8F0]" />

              {/* Date Range */}
              <div className="flex items-center gap-3">
                <CalendarDays size={14} className="text-[#434655]" />
                <div className="flex items-center gap-1.5">
                  <label className="text-[10px] font-bold text-[#434655] uppercase">From</label>
                  <input type="date" className="px-2.5 py-1 bg-[#F2F4F6] border-none rounded-lg text-xs focus:bg-white focus:ring-2 focus:ring-[#004AC6]/15 outline-none transition-all" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
                </div>
                <div className="flex items-center gap-1.5">
                  <label className="text-[10px] font-bold text-[#434655] uppercase">To</label>
                  <input type="date" className="px-2.5 py-1 bg-[#F2F4F6] border-none rounded-lg text-xs focus:bg-white focus:ring-2 focus:ring-[#004AC6]/15 outline-none transition-all" value={toDate} onChange={(e) => setToDate(e.target.value)} />
                </div>
                {(fromDate || toDate) && (
                  <button onClick={() => { setFromDate(''); setToDate(''); }} className="px-2.5 py-1 text-[10px] font-bold text-[#DC2626] bg-red-50 rounded-lg hover:bg-red-100 transition cursor-pointer uppercase tracking-wider">Clear</button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ─── Data Table ─── */}
      <div className="flex-1 flex flex-col min-h-0 px-4 md:px-8 pb-4">
        <div className="flex-1 max-w-7xl mx-auto w-full bg-white rounded-xl overflow-auto shadow-sm border border-[#C3C6D7]/5">

            <table className="w-full text-left border-collapse">
              <thead className="bg-[#F2F4F6] sticky top-0 z-10">
                <tr>
                  <th className="py-4 px-6 text-[11px] font-bold text-[#434655] uppercase tracking-wider">No.</th>
                  <th
                    className="py-4 px-6 text-[11px] font-bold text-[#434655] uppercase tracking-wider cursor-pointer hover:text-[#004AC6] transition-colors"
                    onClick={() => handleSort('orderNo')}
                  >
                    <div className="flex items-center">
                      Order ID <SortIcon column="orderNo" />
                    </div>
                  </th>
                  <th
                    className="py-4 px-6 text-[11px] font-bold text-[#434655] uppercase tracking-wider cursor-pointer hover:text-[#004AC6] transition-colors"
                    onClick={() => handleSort('name')}
                  >
                    <div className="flex items-center">
                      Supplier Name <SortIcon column="name" />
                    </div>
                  </th>
                  <th
                    className="py-4 px-6 text-[11px] font-bold text-[#434655] uppercase tracking-wider cursor-pointer hover:text-[#004AC6] transition-colors"
                    onClick={() => handleSort('date')}
                  >
                    <div className="flex items-center">
                      Date <SortIcon column="date" />
                    </div>
                  </th>
                  <th
                    className="py-4 px-6 text-[11px] font-bold text-[#434655] uppercase tracking-wider text-center cursor-pointer hover:text-[#004AC6] transition-colors"
                    onClick={() => handleSort('status')}
                  >
                    <div className="flex items-center justify-center">
                      Status <SortIcon column="status" />
                    </div>
                  </th>
                  <th className="py-4 px-6 text-[11px] font-bold text-[#434655] uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedOrders.length > 0 ? (
                  paginatedOrders.map((order, index) => (
                    <tr
                      key={order.orderNo || index}
                      ref={el => rowRefs.current[order.orderNo] = el}
                      className={`transition-colors duration-500 cursor-pointer ${highlightedId === order.orderNo ? 'bg-yellow-50' : 'hover:bg-[#F2F4F6]'}`}
                      onClick={() => handleRowClick(order.orderNo)}
                    >
                      <td className="py-5 px-6 text-sm text-[#434655]">{(itemsPerPage === 'All' ? index : (currentPage - 1) * itemsPerPage + index) + 1}</td>
                      <td className="py-5 px-6">
                        <span className="bg-[#E6E8EA] px-2 py-1 rounded text-[10px] font-bold text-[#004AC6]">{order.orderNo}</span>
                      </td>
                      <td className="py-5 px-6 font-bold text-[#191C1E] text-sm">{order.name}</td>
                      <td className="py-5 px-6 text-sm text-[#434655]">{formatDate(order.date)}</td>
                      <td className="py-5 px-6 text-center">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${getStatusStyle(order.status)}`}>
                          {order.status}
                        </span>
                      </td>
                      <td className="py-5 px-6 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => navigate(`/orders/suppliers/${order.orderNo}`)}
                            className="p-2 rounded-full hover:bg-white text-[#434655] hover:text-[#004AC6] transition-all hover:shadow-sm cursor-pointer"
                          >
                            <Edit size={16} />
                          </button>
                          <button
                            onClick={() => setDeleteTarget(order.orderNo)}
                            className="p-2 rounded-full hover:bg-white text-[#434655] hover:text-[#DC2626] transition-all hover:shadow-sm cursor-pointer"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="6" className="py-12 text-center text-[#434655] text-sm">
                      No orders found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

          {/* Pagination Footer */}
          <div className="px-8 py-5 flex items-center justify-between bg-[#F2F4F6]/30 border-t border-[#C3C6D7]/10">
            <div className="flex items-center gap-4">
              <p className="text-sm text-[#434655]">
                Showing <span className="font-bold text-[#191C1E]">{itemsPerPage === 'All' ? 1 : (currentPage - 1) * itemsPerPage + 1}</span> to{' '}
                <span className="font-bold text-[#191C1E]">
                  {itemsPerPage === 'All' ? filteredCount : Math.min(currentPage * itemsPerPage, filteredCount)}
                </span>{' '}
                of <span className="font-bold text-[#191C1E]">{filteredCount}</span> orders
              </p>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-[#434655] uppercase">Rows</span>
                <div className="flex items-center bg-white rounded-lg border border-[#C3C6D7]/20 overflow-hidden">
                  {ROWS_OPTIONS.map(opt => (
                    <button
                      key={opt}
                      onClick={() => { setItemsPerPage(opt); setCurrentPage(1); }}
                      className={`px-3 py-1.5 text-xs font-bold transition-colors cursor-pointer ${
                        itemsPerPage === opt
                          ? 'bg-[#004AC6] text-white'
                          : 'text-[#434655] hover:bg-[#F2F4F6]'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            {totalPages > 1 && itemsPerPage !== 'All' && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className={`flex items-center gap-1 px-4 py-2 text-sm font-bold rounded-lg transition-all border border-transparent ${currentPage === 1 ? 'text-[#C3C6D7] cursor-not-allowed opacity-50' : 'text-[#434655] hover:text-[#004AC6] hover:bg-white hover:border-[#C3C6D7]/20 cursor-pointer'}`}
                >
                  ← Previous
                </button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) pageNum = i + 1;
                    else if (currentPage <= 3) pageNum = i + 1;
                    else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                    else pageNum = currentPage - 2 + i;
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`w-9 h-9 flex items-center justify-center rounded-lg font-bold text-sm transition-colors cursor-pointer ${currentPage === pageNum ? 'bg-[#004AC6] text-white' : 'hover:bg-white text-[#434655]'}`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>
                <button
                  onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className={`flex items-center gap-1 px-4 py-2 text-sm font-bold rounded-lg transition-all border border-transparent ${currentPage === totalPages ? 'text-[#C3C6D7] cursor-not-allowed opacity-50' : 'text-[#191C1E] hover:text-[#004AC6] hover:bg-white hover:border-[#C3C6D7]/20 cursor-pointer'}`}
                >
                  Next →
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── Delete Confirmation Modal — Stitch Glass Overlay ─── */}
      {deleteTarget !== null && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 outline-none"
          style={{ backdropFilter: 'blur(8px)', backgroundColor: 'rgba(255,255,255,0.7)' }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-order-heading"
          tabIndex={-1}
          ref={deleteModalRef}
          onKeyDown={(e) => { if (e.key === 'Escape' && !isDeleting) setDeleteTarget(null); }}
          onClick={(e) => { if (e.target === e.currentTarget && !isDeleting) setDeleteTarget(null); }}
        >
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-[#C3C6D7]/20 p-8">
            <div className="w-12 h-12 rounded-full bg-red-100/50 flex items-center justify-center text-red-600 mb-6 mx-auto">
              <Trash2 size={28} />
            </div>
            <h2 id="delete-order-heading" className="text-2xl font-extrabold text-[#0F172A] tracking-tight mb-3 text-center">Delete Order?</h2>
            <p className="text-[#434655] leading-relaxed mb-8 text-center">
              Are you sure you want to delete order <span className="font-bold text-[#191C1E]">{deleteTarget}</span>? This action cannot be undone.
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 px-6 py-3 bg-[#E6E8EA] text-[#191C1E] font-bold rounded-xl hover:bg-[#E0E3E5] transition-all text-sm cursor-pointer"
              >Cancel</button>
              <button
                onClick={confirmDelete}
                disabled={isDeleting}
                className="flex-1 px-6 py-3 bg-[#DC2626] text-white font-bold rounded-xl shadow-lg shadow-[#DC2626]/20 hover:bg-red-700 active:scale-95 transition-all text-sm cursor-pointer disabled:opacity-50"
              >{isDeleting ? 'Deleting...' : 'Delete'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SupplierOrder;