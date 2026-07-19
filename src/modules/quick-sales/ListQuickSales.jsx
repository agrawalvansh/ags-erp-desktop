import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useDebounce } from '../../hooks/useDebounce';
import { Search, ChevronDown, Plus, Edit, Trash2, AlertTriangle, CalendarDays, SlidersHorizontal } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { naturalCompare } from '../../utils/productUtils';

const ListQuickSales = () => {
    const navigate = useNavigate();

    const [searchTerm, setSearchTerm] = useState('');
    const debouncedSearchTerm = useDebounce(searchTerm, 300);
    const [sales, setSales] = useState([]);
    const [sortConfig, setSortConfig] = useState({ key: 'qs_id', direction: 'desc' });
    const [currentPage, setCurrentPage] = useState(1);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const deleteModalRef = useRef(null);
    const searchInputRef = useRef(null);
    const [itemsPerPage, setItemsPerPage] = useState(25);
    const ROWS_OPTIONS = [25, 50, 100, 'All'];
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');
    const [showFilters, setShowFilters] = useState(false);
    const hasActiveFilters = fromDate || toDate;

    // Focus the delete modal when it opens
    useEffect(() => {
        if (deleteTarget !== null) deleteModalRef.current?.focus();
    }, [deleteTarget]);

    // Fetch quick sales on mount
    useEffect(() => {
        fetchSales();
    }, []);

    const fetchSales = async () => {
        try {
            const data = await window.api.invoke('quickSales:getAll');
            setSales(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error(err);
            toast.error('Failed to fetch quick sales');
        }
    };

    // Global shortcut listeners (Ctrl+N, Ctrl+F, F5)
    useEffect(() => {
        const onNew = () => navigate('/quick-sales/create');
        const onSearch = () => searchInputRef.current?.focus();
        const onRefresh = () => fetchSales();
        window.addEventListener('shortcut:new', onNew);
        window.addEventListener('shortcut:search', onSearch);
        window.addEventListener('shortcut:refresh', onRefresh);
        return () => {
            window.removeEventListener('shortcut:new', onNew);
            window.removeEventListener('shortcut:search', onSearch);
            window.removeEventListener('shortcut:refresh', onRefresh);
        };
    }, []);

    // Filter, sort, paginate
    const filteredSales = useMemo(() => {
        let filtered = sales.filter(s =>
            (s.qs_id || '').toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
            (s.remark || '').toLowerCase().includes(debouncedSearchTerm.toLowerCase())
        );

        // Date range filter
        if (fromDate) {
            const from = new Date(fromDate);
            filtered = filtered.filter(s => {
                const d = new Date(s.qs_date);
                return !isNaN(d.getTime()) && d >= from;
            });
        }
        if (toDate) {
            const to = new Date(toDate);
            to.setHours(23, 59, 59);
            filtered = filtered.filter(s => {
                const d = new Date(s.qs_date);
                return !isNaN(d.getTime()) && d <= to;
            });
        }

        return filtered;
    }, [sales, debouncedSearchTerm, fromDate, toDate]);

    const processedSales = useMemo(() => {
        let sorted = [...filteredSales];

        if (sortConfig.key) {
            sorted.sort((a, b) => {
                const dir = sortConfig.direction === 'asc' ? 1 : -1;
                if (sortConfig.key === 'qs_id') return dir * naturalCompare(a.qs_id, b.qs_id);
                const aVal = a[sortConfig.key] ?? '';
                const bVal = b[sortConfig.key] ?? '';
                if (aVal < bVal) return -dir;
                if (aVal > bVal) return dir;
                return 0;
            });
        }

        if (itemsPerPage === 'All') return sorted;
        const start = (currentPage - 1) * itemsPerPage;
        return sorted.slice(start, start + itemsPerPage);
    }, [filteredSales, sortConfig, currentPage, itemsPerPage]);

    const filteredCount = filteredSales.length;
    const effectivePerPage = itemsPerPage === 'All' ? filteredCount || 1 : itemsPerPage;
    const totalPages = Math.ceil(filteredCount / effectivePerPage);

    // Reset page when search changes
    useEffect(() => { setCurrentPage(1); }, [searchTerm]);
    useEffect(() => {
        if (totalPages > 0 && currentPage > totalPages) setCurrentPage(totalPages);
    }, [totalPages, currentPage]);

    const handleSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
        setSortConfig({ key, direction });
    };

    const handleEdit = (qsId) => {
        navigate(`/quick-sales/${qsId}`);
    };

    const confirmDelete = async () => {
        if (!deleteTarget) return;
        setIsDeleting(true);
        try {
            const res = await window.api.invoke('quickSales:delete', deleteTarget);
            if (res.success) {
                toast.success(`${deleteTarget} deleted`);
                fetchSales();
                setDeleteTarget(null);
            } else {
                toast.error(res.error || 'Failed to delete');
            }
        } catch (err) {
            console.error(err);
            toast.error('Failed to delete quick sale');
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <div className="flex flex-col h-screen bg-[#F7F9FB] overflow-hidden">
            {/* Page Header */}
            <div className="flex-shrink-0 px-4 md:px-8 pt-6 pb-2">
                <div className="max-w-7xl mx-auto">
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-4">
                        <div>
                            <h1 className="text-3xl font-extrabold tracking-tight text-[#191C1E] mb-1">Quick Sales</h1>
                            <p className="text-[#434655] text-sm font-medium">View and manage rapid point-of-sale transactions</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#434655]" size={18} />
                                <input
                                    ref={searchInputRef}
                                    type="text"
                                    placeholder="Search Quick Sales..."
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
                                        onClick={() => { setSearchTerm(''); setCurrentPage(1); }}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#434655] hover:text-[#DC2626] cursor-pointer transition-colors"
                                    >
                                        ×
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
                                className="cursor-pointer bg-gradient-to-br from-[#004AC6] to-[#2563EB] text-white px-5 py-2.5 rounded-lg flex items-center gap-2 font-semibold shadow-lg shadow-[#004AC6]/20 active:scale-95 transition-transform whitespace-nowrap"
                                onClick={() => navigate('/quick-sales/create')}
                            >
                                <Plus size={18} />
                                <span>New Sale</span>
                            </button>
                        </div>
                    </div>

                    {/* ─── Collapsible Filter Bar ─── */}
                    {showFilters && (
                        <div className="mb-4 bg-white rounded-xl border border-[#C3C6D7]/10 px-5 py-3 flex items-center gap-3">
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
                    )}
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
                                        onClick={() => handleSort('qs_id')}
                                    >
                                        <div className="flex items-center gap-1">
                                            Quick Sale ID
                                            <ChevronDown
                                                className={`transition-transform ${sortConfig.key === 'qs_id' && sortConfig.direction === 'desc' ? 'rotate-180' : ''}`}
                                                size={14}
                                            />
                                        </div>
                                    </th>
                                    <th
                                        className="py-4 px-6 text-[11px] font-bold text-[#434655] uppercase tracking-wider cursor-pointer hover:text-[#004AC6] transition-colors"
                                        onClick={() => handleSort('qs_date')}
                                    >
                                        <div className="flex items-center gap-1">
                                            Date
                                            <ChevronDown
                                                className={`transition-transform ${sortConfig.key === 'qs_date' && sortConfig.direction === 'desc' ? 'rotate-180' : ''}`}
                                                size={14}
                                            />
                                        </div>
                                    </th>
                                    <th
                                        className="py-4 px-6 text-[11px] font-bold text-[#434655] uppercase tracking-wider text-right cursor-pointer hover:text-[#004AC6] transition-colors"
                                        onClick={() => handleSort('total')}
                                    >
                                        <div className="flex items-center justify-end gap-1">
                                            Total Amount (₹)
                                            <ChevronDown
                                                className={`transition-transform ${sortConfig.key === 'total' && sortConfig.direction === 'desc' ? 'rotate-180' : ''}`}
                                                size={14}
                                            />
                                        </div>
                                    </th>
                                    <th className="py-4 px-6 text-[11px] font-bold text-[#434655] uppercase tracking-wider text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y-0">
                                {processedSales.length > 0 ? (
                                    processedSales.map((sale, index) => (
                                        <tr key={sale.qs_id} className="group hover:bg-[#F2F4F6] transition-colors cursor-pointer" onClick={() => handleEdit(sale.qs_id)}>
                                            <td className="py-5 px-6 text-sm text-[#434655] font-medium">{String((itemsPerPage === 'All' ? index : (currentPage - 1) * itemsPerPage + index) + 1).padStart(2, '0')}</td>
                                            <td className="py-5 px-6">
                                                <span
                                                    className="bg-[#E6E8EA] px-2 py-1 rounded text-[10px] font-bold text-[#004AC6]"
                                                >
                                                    {sale.qs_id}
                                                </span>
                                            </td>
                                            <td className="py-5 px-6 text-sm font-medium text-[#191C1E]">{sale.qs_date}</td>
                                            <td className="py-5 px-6 text-right font-black text-[#191C1E]">₹{(parseFloat(sale.total) || 0).toFixed(2)}</td>
                                            <td className="py-5 px-6 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleEdit(sale.qs_id); }}
                                                        className="cursor-pointer p-2 rounded-full hover:bg-white text-[#434655] hover:text-[#004AC6] transition-all shadow-none hover:shadow-sm"
                                                        title="Edit"
                                                    >
                                                        <Edit size={16} />
                                                    </button>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); setDeleteTarget(sale.qs_id); }}
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
                                        <td colSpan="5" className="px-6 py-12 text-center text-[#434655] text-sm">
                                            No quick sales found.
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
                                of <span className="font-bold text-[#191C1E]">{filteredCount}</span> results
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
                                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
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
                                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
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

            {/* Delete Confirmation Modal — Stitch Glass Overlay */}
            {deleteTarget !== null && (
                <div
                    className="fixed inset-0 z-[100] flex items-center justify-center p-4 outline-none"
                    style={{ backdropFilter: 'blur(8px)', backgroundColor: 'rgba(255,255,255,0.7)' }}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="delete-qs-heading"
                    tabIndex={-1}
                    ref={deleteModalRef}
                    onKeyDown={(e) => { if (e.key === 'Escape' && !isDeleting) setDeleteTarget(null); }}
                    onClick={(e) => { if (e.target === e.currentTarget && !isDeleting) setDeleteTarget(null); }}
                >
                    <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-[#C3C6D7]/20 p-8">
                        <div className="w-12 h-12 rounded-full bg-red-100/50 flex items-center justify-center text-red-600 mb-6 mx-auto">
                            <AlertTriangle size={28} />
                        </div>
                        <h2 id="delete-qs-heading" className="text-2xl font-extrabold text-[#0F172A] tracking-tight mb-3 text-center">
                            Delete Quick Sale?
                        </h2>
                        <p className="text-[#434655] leading-relaxed mb-8 text-center">
                            Are you sure you want to delete <span className="font-bold text-[#191C1E]">"{deleteTarget}"</span>? This action cannot be undone.
                        </p>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setDeleteTarget(null)}
                                disabled={isDeleting}
                                className="flex-1 px-6 py-3 bg-[#E6E8EA] text-[#191C1E] font-bold rounded-xl hover:bg-[#E0E3E5] transition-all text-sm cursor-pointer disabled:opacity-50"
                            >Cancel</button>
                            <button
                                onClick={async () => { await confirmDelete(); }}
                                disabled={isDeleting}
                                className="flex-1 px-6 py-3 bg-[#DC2626] text-white font-bold rounded-xl shadow-lg shadow-[#DC2626]/20 hover:bg-red-700 active:scale-95 transition-all text-sm cursor-pointer disabled:opacity-50"
                            >
                                {isDeleting ? 'Deleting...' : 'Delete'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ListQuickSales;