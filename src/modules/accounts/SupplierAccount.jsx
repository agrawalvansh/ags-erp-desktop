import React, { useEffect, useMemo, useState, useRef } from 'react';
import { Plus, Search, ChevronDown, Edit, Trash2, CircleX } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import DeleteConfirmModal from '../../components/DeleteConfirmModal';
import { naturalCompare } from '../../utils/productUtils';

// List of suppliers (copy of BuyerAccount but using suppliers endpoints)
const SupplierAccount = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'id', direction: 'asc' });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const ROWS_OPTIONS = [25, 50, 100, 'All'];
  const deleteModalRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();
  const searchInputRef = useRef(null);
  const rowRefs = useRef({});

  const [suppliers, setSuppliers] = useState([]);
  const [loadingSuppliers, setLoadingSuppliers] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);
  const [highlightedId, setHighlightedId] = useState(null);

  // Focus the delete modal when it opens
  useEffect(() => {
    if (deleteTarget !== null) deleteModalRef.current?.focus();
  }, [deleteTarget]);

  const fetchSuppliers = async () => {
    try {
      const data = await window.api.invoke('suppliers:getAll');
      const mapped = data.map((s) => ({
        id: s.supplier_id,
        name: s.name,
        phone: s.mobile,
        address: s.address,
        slug: s.supplier_id,
      }));
      setSuppliers(mapped);
    } catch (err) {
      console.error('Error fetching suppliers:', err);
    } finally {
      setLoadingSuppliers(false);
    }
  };

  useEffect(() => {
    fetchSuppliers();
  }, []);

  // Global shortcut listeners (Ctrl+F, Ctrl+N, F5)
  useEffect(() => {
    const onSearch = () => searchInputRef.current?.focus();
    const onNew = () => navigate('/accounts/suppliers/add');
    const onRefresh = () => fetchSuppliers();
    window.addEventListener('shortcut:search', onSearch);
    window.addEventListener('shortcut:new', onNew);
    window.addEventListener('shortcut:refresh', onRefresh);
    return () => {
      window.removeEventListener('shortcut:search', onSearch);
      window.removeEventListener('shortcut:new', onNew);
      window.removeEventListener('shortcut:refresh', onRefresh);
    };
  }, []);

  const filteredSuppliers = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return suppliers.filter((u) =>
      u.id.toLowerCase().includes(term) ||
      u.name.toLowerCase().includes(term) ||
      u.phone.toLowerCase().includes(term) ||
      u.address.toLowerCase().includes(term)
    );
  }, [searchTerm, suppliers]);

  const processedSuppliers = useMemo(() => {
    let filtered = [...filteredSuppliers];

    if (sortConfig.key) {
      filtered.sort((a, b) => {
        const dir = sortConfig.direction === 'asc' ? 1 : -1;
        if (sortConfig.key === 'id') return dir * naturalCompare(a.id, b.id);
        if (a[sortConfig.key] < b[sortConfig.key]) return -dir;
        if (a[sortConfig.key] > b[sortConfig.key]) return dir;
        return 0;
      });
    }

    if (itemsPerPage === 'All') return filtered;
    const start = (currentPage - 1) * itemsPerPage;
    return filtered.slice(start, start + itemsPerPage);
  }, [filteredSuppliers, sortConfig, currentPage, itemsPerPage]);

  const filteredCount = filteredSuppliers.length;
  const effectivePerPage = itemsPerPage === 'All' ? filteredCount || 1 : itemsPerPage;
  const totalPages = Math.ceil(filteredCount / effectivePerPage);

  // Clamp page when filteredCount shrinks (e.g. after delete or search)
  useEffect(() => { setCurrentPage(1); }, [searchTerm]);
  useEffect(() => {
    if (totalPages > 0 && currentPage > totalPages) setCurrentPage(totalPages);
  }, [totalPages, currentPage]);

  // Auto-scroll and highlight when returning from supplier detail
  useEffect(() => {
    let scrollTimer, fadeTimer;
    if (location.state?.returnedFromAccount && suppliers.length > 0) {
      const returnedId = location.state.returnedFromAccount;
      // Clear nav state first to prevent re-fire on re-render
      window.history.replaceState({}, document.title);
      setHighlightedId(returnedId);

      const globalIndex = filteredSuppliers.findIndex(s => s.slug === returnedId);
      if (globalIndex >= 0 && itemsPerPage !== 'All') {
        const targetPage = Math.floor(globalIndex / itemsPerPage) + 1;
        setCurrentPage(targetPage);
      }

      scrollTimer = setTimeout(() => {
        const rowElement = rowRefs.current[returnedId];
        if (rowElement) {
          rowElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        fadeTimer = setTimeout(() => setHighlightedId(null), 2000);
      }, 150);
    }
    return () => { clearTimeout(scrollTimer); clearTimeout(fadeTimer); };
  }, [location.state, suppliers, filteredSuppliers, itemsPerPage]);

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  };

  const handleRowClick = (slug) => {
    navigate(`/accounts/suppliers/${slug}`);
  };

  const handleDeleteClick = async (e, supplier) => {
    e.stopPropagation();
    setDeleteError(null);
    try {
      const deps = await window.api.invoke('suppliers:checkDependencies', supplier.id);
      if (deps.hasDependencies) {
        const parts = [];
        if (deps.maalCount > 0) parts.push(`${deps.maalCount} maal`);
        if (deps.jamaCount > 0) parts.push(`${deps.jamaCount} payment`);
        if (deps.orderCount > 0) parts.push(`${deps.orderCount} order`);
        setDeleteError(
          parts.length > 0
            ? `Cannot delete: this supplier has ${parts.join(', ')} entries. Remove them first.`
            : 'Cannot delete: this supplier has dependent entries. Remove them first.'
        );
        setDeleteTarget(supplier);
      } else {
        setDeleteTarget(supplier);
      }
    } catch (err) {
      console.error('Error checking dependencies:', err);
      toast.error('Failed to check supplier dependencies.');
    }
  };

  const confirmDeleteSupplier = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const result = await window.api.invoke('suppliers:delete', deleteTarget.id);
      if (result.success) {
        setSuppliers(prev => prev.filter(s => s.id !== deleteTarget.id));
        toast.success(`Supplier "${deleteTarget.name}" deleted successfully.`);
        setDeleteTarget(null);
      } else {
        toast.error(result.error || 'Failed to delete supplier.');
      }
    } catch (err) {
      console.error('Error deleting supplier:', err);
      toast.error('Failed to delete supplier.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Helper to get initials from supplier name
  const getInitials = (name) => {
    const trimmed = name?.trim();
    if (!trimmed) return '?';
    const parts = trimmed.split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return parts[0].substring(0, 2).toUpperCase();
  };


  return (
    <div className="flex flex-col h-screen bg-[#F7F9FB] overflow-hidden">
      {/* Page Header */}
      <div className="flex-shrink-0 px-4 md:px-8 pt-6 pb-2">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-4">
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight text-[#191C1E] mb-1">Supplier's Accounts</h1>
              <p className="text-[#434655] text-sm font-medium">Showing {filteredCount} suppliers</p>
            </div>
            <div className="flex items-center gap-3">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#434655]" size={18} />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search Suppliers..."
                  className="w-72 bg-white border border-[#C3C6D7]/20 rounded-lg py-2.5 pl-10 pr-10 text-sm focus:border-[#004AC6] focus:ring-4 focus:ring-[#004AC6]/5 transition-all outline-none"
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => { setSearchTerm(''); setCurrentPage(1); searchInputRef.current?.focus(); }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#434655] hover:text-[#DC2626] cursor-pointer transition-colors"
                    aria-label="Clear search"
                  >
                    <CircleX size={16} />
                  </button>
                )}
              </div>

              {/* Add New Supplier */}
              <button
                className="cursor-pointer flex items-center gap-2 px-6 py-2.5 bg-gradient-to-br from-[#004AC6] to-[#2563EB] text-white font-bold rounded-lg shadow-lg shadow-[#004AC6]/20 hover:scale-[1.02] active:scale-95 transition-all text-sm whitespace-nowrap"
                onClick={() => navigate('/accounts/suppliers/add')}
              >
                <Plus size={18} />
                Add New Supplier
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Data Table */}
      <div className="flex-1 flex flex-col min-h-0 px-4 md:px-8 pb-4">
        <div className="flex-1 max-w-7xl mx-auto w-full bg-white rounded-xl overflow-auto shadow-sm border border-[#C3C6D7]/5">

            <table className="w-full text-left border-collapse">
              <thead className="bg-[#F2F4F6] sticky top-0 z-10">
                <tr>
                  <th className="py-4 px-6 text-[11px] font-bold text-[#434655] uppercase tracking-wider">No.</th>
                  <th
                    className="py-4 px-6 text-[11px] font-bold text-[#434655] uppercase tracking-wider cursor-pointer hover:text-[#004AC6] transition-colors"
                    onClick={() => handleSort('id')}
                  >
                    <div className="flex items-center gap-1">
                      Supplier ID
                      <ChevronDown className={`transition-transform ${sortConfig.key === 'id' && sortConfig.direction === 'desc' ? 'rotate-180' : ''}`} size={14} />
                    </div>
                  </th>
                  <th
                    className="py-4 px-6 text-[11px] font-bold text-[#434655] uppercase tracking-wider cursor-pointer hover:text-[#004AC6] transition-colors"
                    onClick={() => handleSort('name')}
                  >
                    <div className="flex items-center gap-1">
                      Name
                      <ChevronDown className={`transition-transform ${sortConfig.key === 'name' && sortConfig.direction === 'desc' ? 'rotate-180' : ''}`} size={14} />
                    </div>
                  </th>
                  <th
                    className="py-4 px-6 text-[11px] font-bold text-[#434655] uppercase tracking-wider cursor-pointer hover:text-[#004AC6] transition-colors"
                    onClick={() => handleSort('phone')}
                  >
                    <div className="flex items-center gap-1">
                      Phone
                      <ChevronDown className={`transition-transform ${sortConfig.key === 'phone' && sortConfig.direction === 'desc' ? 'rotate-180' : ''}`} size={14} />
                    </div>
                  </th>
                  <th
                    className="py-4 px-6 text-[11px] font-bold text-[#434655] uppercase tracking-wider cursor-pointer hover:text-[#004AC6] transition-colors"
                    onClick={() => handleSort('address')}
                  >
                    <div className="flex items-center gap-1">
                      Address
                      <ChevronDown className={`transition-transform ${sortConfig.key === 'address' && sortConfig.direction === 'desc' ? 'rotate-180' : ''}`} size={14} />
                    </div>
                  </th>
                  <th className="py-4 px-6 text-[11px] font-bold text-[#434655] uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F2F4F6]">
                {processedSuppliers.length > 0 ? (
                  processedSuppliers.map((supplier, index) => (
                    <tr
                      key={supplier.id}
                      ref={(el) => { rowRefs.current[supplier.slug] = el; }}
                      className={`group hover:bg-[#F2F4F6]/30 transition-colors cursor-pointer ${highlightedId === supplier.slug ? 'bg-[#EFF6FF] ring-1 ring-[#2563EB]/30' : ''}`}
                      onClick={() => handleRowClick(supplier.slug)}
                    >
                      <td className="py-5 px-6 text-sm font-medium text-[#434655]">{String((itemsPerPage === 'All' ? index : (currentPage - 1) * itemsPerPage + index) + 1).padStart(2, '0')}</td>
                      <td className="py-5 px-6 text-sm font-bold text-[#004AC6]">{supplier.id}</td>
                      <td className="py-5 px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-[#DBE1FF] flex items-center justify-center text-[#004AC6] font-bold text-xs flex-shrink-0">
                            {getInitials(supplier.name)}
                          </div>
                          <span className="text-sm font-semibold text-[#191C1E]">{supplier.name}</span>
                        </div>
                      </td>
                      <td className="py-5 px-6 text-sm text-[#434655] font-medium">{supplier.phone}</td>
                      <td className="py-5 px-6 text-sm text-[#434655]">{supplier.address}</td>
                      <td className="py-5 px-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/accounts/suppliers/edit/${supplier.id}`);
                            }}
                            className="cursor-pointer p-2 rounded-full hover:bg-white text-[#434655] hover:text-[#004AC6] transition-all shadow-none hover:shadow-sm"
                            title="Edit"
                          >
                            <Edit size={16} />
                          </button>
                          <button
                            onClick={(e) => handleDeleteClick(e, supplier)}
                            className="cursor-pointer p-2 rounded-full hover:bg-white text-[#434655] hover:text-[#DC2626] transition-all shadow-none hover:shadow-sm"
                            title="Delete"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="6" className="px-6 py-12 text-center text-[#434655] text-sm">
                      {loadingSuppliers ? 'Loading...' : 'No suppliers found.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

          {/* Pagination Footer */}
          <div className="px-8 py-5 flex items-center justify-between bg-[#F2F4F6]/30 border-t border-[#C3C6D7]/10">
            <div className="flex items-center gap-4">
              <p className="text-sm text-[#434655]">
                Showing <span className="font-bold text-[#191C1E]">{filteredCount === 0 ? 0 : itemsPerPage === 'All' ? 1 : (currentPage - 1) * itemsPerPage + 1}</span> to{' '}
                <span className="font-bold text-[#191C1E]">
                  {itemsPerPage === 'All' ? filteredCount : Math.min(currentPage * itemsPerPage, filteredCount)}
                </span>{' '}
                of <span className="font-bold text-[#191C1E]">{filteredCount}</span> suppliers
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
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`w-9 h-9 flex items-center justify-center rounded-lg font-bold text-sm transition-colors cursor-pointer ${currentPage === pageNum
                            ? 'bg-[#004AC6] text-white'
                            : 'hover:bg-white text-[#434655]'
                          }`}
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

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={deleteTarget !== null && !deleteError}
        onConfirm={() => confirmDeleteSupplier()}
        onCancel={() => { setDeleteTarget(null); setDeleteError(null); }}
        title="Delete Supplier?"
        message={`Are you sure you want to delete ${deleteTarget?.name || 'this supplier'}? This action cannot be undone and will permanently remove the supplier from your records.`}
        confirmLabel="Delete"
        isLoading={isDeleting}
      />

      {/* Delete Error Modal (dependency conflict) */}
      {deleteTarget !== null && deleteError && (
        <div
          className="fixed inset-0 flex items-center justify-center z-[100]"
          style={{ background: 'rgba(255, 255, 255, 0.7)', backdropFilter: 'blur(8px)' }}
          onClick={() => { setDeleteTarget(null); setDeleteError(null); }}
        >
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
              <p className="text-red-700 text-sm font-medium">{deleteError}</p>
            </div>
            <button
              onClick={() => { setDeleteTarget(null); setDeleteError(null); }}
              className="w-full px-4 py-2.5 rounded-xl bg-[#E6E8EA] text-[#191C1E] font-semibold text-sm hover:bg-[#E0E3E5] active:scale-95 transition-all cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SupplierAccount;
