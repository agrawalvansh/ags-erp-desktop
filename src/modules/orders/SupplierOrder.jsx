import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Search, ChevronDown, ChevronLeft, ChevronRight, Plus, Edit, Trash2, X } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

const SupplierOrder = () => {
  const navigate = useNavigate();

  const [searchTerm, setSearchTerm] = useState('');
  const searchInputRef = useRef(null);
  const [orders, setOrders] = useState([]);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const deleteModalRef = useRef(null);
  const [statusFilter, setStatusFilter] = useState('All');

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

  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

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

    if (sortConfig.key) {
      filtered.sort((a, b) => {
        if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'asc' ? -1 : 1;
        if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  }, [searchTerm, sortConfig, orders, statusFilter]);

  const totalFiltered = processedOrders.length;
  const totalPages = Math.ceil(totalFiltered / itemsPerPage);

  useEffect(() => {
    if (totalPages > 0 && currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);

  const paginatedOrders = processedOrders.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

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

  // Page numbers for pagination
  const pageNumbers = useMemo(() => {
    const pages = [];
    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push('...');
      for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
        pages.push(i);
      }
      if (currentPage < totalPages - 2) pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  }, [currentPage, totalPages]);

  // Unique statuses for filter tabs
  const statusTabs = useMemo(() => {
    const statuses = [...new Set(orders.map(o => o.status || 'Placed'))];
    return ['All', ...statuses];
  }, [orders]);

  return (
    <div className="min-h-screen bg-[#F7F9FB]">
      {/* ─── Page Content ─── */}
      <section className="p-8 max-w-7xl mx-auto">
        {/* ─── Header ─── */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
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
                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              />
              {searchTerm && (
                <button
                  onClick={() => { setSearchTerm(''); setCurrentPage(1); searchInputRef.current?.focus(); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#434655] hover:text-[#191C1E] cursor-pointer"
                >
                  <X size={16} />
                </button>
              )}
            </div>
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

        {/* ─── Filter Tabs ─── */}
        <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-1">
          {statusTabs.map(tab => (
            <button
              key={tab}
              onClick={() => { setStatusFilter(tab); setCurrentPage(1); }}
              className={`px-5 py-2 rounded-full text-xs font-bold transition-colors cursor-pointer ${statusFilter === tab
                  ? 'bg-[#004AC6] text-white shadow-sm'
                  : 'bg-white text-[#434655] hover:bg-[#F2F4F6] border border-[#C3C6D7]/10'
                }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* ─── Data Table ─── */}
        <div className="bg-white rounded-xl overflow-hidden shadow-sm border border-[#C3C6D7]/5">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-[#F2F4F6]/50">
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
                      className="hover:bg-[#F2F4F6] transition-colors cursor-pointer"
                      onClick={() => handleRowClick(order.orderNo)}
                    >
                      <td className="py-5 px-6 text-sm text-[#434655]">{(currentPage - 1) * itemsPerPage + index + 1}</td>
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
          </div>

          {/* ─── Pagination Footer ─── */}
          {totalPages > 0 && (
            <div className="px-8 py-6 flex items-center justify-between bg-[#F2F4F6]/30 border-t border-[#C3C6D7]/10">
              <p className="text-sm text-[#434655]">
                Showing <span className="font-bold text-[#191C1E]">{totalFiltered === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1}</span> to{' '}
                <span className="font-bold text-[#191C1E]">{Math.min(currentPage * itemsPerPage, totalFiltered)}</span>{' '}
                of <span className="font-bold text-[#191C1E]">{totalFiltered}</span> results
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="flex items-center gap-1 px-4 py-2 text-sm font-bold text-[#434655] hover:text-[#004AC6] hover:bg-white rounded-lg transition-all border border-transparent hover:border-[#C3C6D7]/20 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                >
                  <ChevronLeft size={16} />
                  Previous
                </button>
                <div className="flex items-center gap-1">
                  {pageNumbers.map((page, i) =>
                    page === '...' ? (
                      <span key={`dots-${i}`} className="px-2 text-[#434655]">...</span>
                    ) : (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`w-9 h-9 flex items-center justify-center rounded-lg font-bold text-sm transition-colors cursor-pointer ${currentPage === page
                            ? 'bg-[#004AC6] text-white'
                            : 'hover:bg-white text-[#434655]'
                          }`}
                      >
                        {page}
                      </button>
                    )
                  )}
                </div>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages || totalPages === 0}
                  className="flex items-center gap-1 px-4 py-2 text-sm font-bold text-[#191C1E] hover:text-[#004AC6] hover:bg-white rounded-lg transition-all border border-transparent hover:border-[#C3C6D7]/20 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                >
                  Next
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ─── Delete Confirmation Modal — Stitch Glass Overlay ─── */}
      {deleteTarget !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 outline-none"
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
                className="flex-1 px-6 py-3 bg-red-600 text-white font-bold rounded-xl shadow-lg shadow-red-600/20 hover:bg-red-700 hover:scale-[1.02] active:scale-95 transition-all text-sm cursor-pointer disabled:opacity-50"
              >{isDeleting ? 'Deleting...' : 'Delete'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SupplierOrder;