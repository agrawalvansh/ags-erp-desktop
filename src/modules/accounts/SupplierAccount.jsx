import React, { useEffect, useMemo, useState, useRef } from 'react';
import { Plus, Search, ChevronDown, Edit, Trash2, CircleX, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';

// List of suppliers (copy of BuyerAccount but using suppliers endpoints)
const SupplierAccount = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const deleteModalRef = useRef(null);
  const navigate = useNavigate();
  const searchInputRef = useRef(null);

  const [suppliers, setSuppliers] = useState([]);
  const [loadingSuppliers, setLoadingSuppliers] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  // Focus the delete modal when it opens
  useEffect(() => {
    if (deleteTarget !== null) deleteModalRef.current?.focus();
  }, [deleteTarget]);

  useEffect(() => {
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
    fetchSuppliers();
  }, []);

  const processedSuppliers = useMemo(() => {
    let filtered = suppliers.filter((u) => {
      const term = searchTerm.toLowerCase();
      return (
        u.id.toLowerCase().includes(term) ||
        u.name.toLowerCase().includes(term) ||
        u.phone.toLowerCase().includes(term) ||
        u.address.toLowerCase().includes(term)
      );
    });

    if (sortConfig.key) {
      filtered.sort((a, b) => {
        if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'asc' ? -1 : 1;
        if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    const start = (currentPage - 1) * itemsPerPage;
    return filtered.slice(start, start + itemsPerPage);
  }, [searchTerm, sortConfig, currentPage, suppliers]);

  const totalPages = Math.ceil(
    suppliers.filter((u) => {
      const term = searchTerm.toLowerCase();
      return u.id.toLowerCase().includes(term) || u.name.toLowerCase().includes(term);
    }).length / itemsPerPage
  );

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
        if (deps.jamaCount > 0) parts.push(`${deps.jamaCount} jama`);
        if (deps.orderCount > 0) parts.push(`${deps.orderCount} order`);
        const detail = parts.length > 0 ? parts.join(', ') : 'existing dependent';
        setDeleteError(`Cannot delete: this supplier has ${detail} entries. Remove them first.`);
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

  // Filtered count for pagination text
  const filteredCount = suppliers.filter((u) => {
    const term = searchTerm.toLowerCase();
    return u.id.toLowerCase().includes(term) || u.name.toLowerCase().includes(term) || u.phone.toLowerCase().includes(term) || u.address.toLowerCase().includes(term);
  }).length;

  return (
    <div className="flex flex-col min-h-screen bg-[#F7F9FB]">
      {/* Page Header */}
      <div className="px-4 md:px-8 pt-8 pb-2">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
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
      <main className="flex-1 px-4 md:px-8 pb-12">
        <div className="max-w-7xl mx-auto bg-white rounded-xl overflow-hidden shadow-sm border border-[#C3C6D7]/5">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-[#F2F4F6]/50">
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
                      className="group hover:bg-[#F2F4F6]/30 transition-colors cursor-pointer"
                      onClick={() => handleRowClick(supplier.slug)}
                    >
                      <td className="py-5 px-6 text-sm font-medium text-[#434655]">{String((currentPage - 1) * itemsPerPage + index + 1).padStart(2, '0')}</td>
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
          </div>

          {/* Pagination Footer */}
          {totalPages > 1 && (
            <div className="px-8 py-6 flex items-center justify-between bg-[#F2F4F6]/30 border-t border-[#C3C6D7]/10">
              <p className="text-sm text-[#434655]">
                Showing <span className="font-bold text-[#191C1E]">{(currentPage - 1) * itemsPerPage + 1}</span> to{' '}
                <span className="font-bold text-[#191C1E]">
                  {Math.min(currentPage * itemsPerPage, filteredCount)}
                </span>{' '}
                of <span className="font-bold text-[#191C1E]">{filteredCount}</span> suppliers
              </p>
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
                        className={`w-9 h-9 flex items-center justify-center rounded-lg font-bold text-sm transition-colors cursor-pointer ${
                          currentPage === pageNum
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
            </div>
          )}
        </div>
      </main>

      {/* Delete Confirmation Modal — Stitch Glass Overlay */}
      {deleteTarget !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 outline-none"
          style={{ backdropFilter: 'blur(8px)', backgroundColor: 'rgba(255,255,255,0.7)' }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-supplier-heading"
          tabIndex={-1}
          ref={deleteModalRef}
          onKeyDown={(e) => { if (e.key === 'Escape' && !isDeleting) { setDeleteTarget(null); setDeleteError(null); } }}
          onClick={(e) => { if (e.target === e.currentTarget && !isDeleting) { setDeleteTarget(null); setDeleteError(null); } }}
        >
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-[#C3C6D7]/20 p-8 transform scale-100 transition-all">
            <div className="w-12 h-12 rounded-full bg-red-100/50 flex items-center justify-center text-red-600 mb-6">
              <AlertTriangle size={28} />
            </div>
            <h2 id="delete-supplier-heading" className="text-2xl font-extrabold text-[#0F172A] tracking-tight mb-3">
              Delete Supplier?
            </h2>
            {deleteError ? (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-8">
                <p className="text-red-700 text-sm font-medium">{deleteError}</p>
              </div>
            ) : (
              <p className="text-[#434655] leading-relaxed mb-8">
                Are you sure you want to delete <span className="font-bold text-[#191C1E]">{deleteTarget?.name || 'this supplier'}</span>? This action cannot be undone and will permanently remove the supplier from your records.
              </p>
            )}
            <div className="flex items-center gap-3">
              <button
                onClick={() => { setDeleteTarget(null); setDeleteError(null); }}
                disabled={isDeleting}
                className="flex-1 px-6 py-3 bg-[#E6E8EA] text-[#191C1E] font-bold rounded-xl hover:bg-[#E0E3E5] transition-all text-sm cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              {!deleteError && (
                <button
                  onClick={() => confirmDeleteSupplier()}
                  disabled={isDeleting}
                  className="flex-1 px-6 py-3 bg-red-600 text-white font-bold rounded-xl shadow-lg shadow-red-600/20 hover:bg-red-700 hover:scale-[1.02] active:scale-95 transition-all text-sm cursor-pointer disabled:opacity-50"
                >
                  {isDeleting ? 'Deleting...' : 'Delete'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SupplierAccount;
