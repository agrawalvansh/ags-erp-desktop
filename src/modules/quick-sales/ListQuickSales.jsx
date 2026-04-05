import React, { useState, useEffect, useMemo } from 'react';
import { Search, ChevronDown, Plus, Edit, Trash2, AlertTriangle } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import Popup from 'reactjs-popup';
import 'reactjs-popup/dist/index.css';

const ListQuickSales = () => {
    const navigate = useNavigate();

    const [searchTerm, setSearchTerm] = useState('');
    const [sales, setSales] = useState([]);
    const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
    const [currentPage, setCurrentPage] = useState(1);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const itemsPerPage = 10;

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

    // Filter, sort, paginate
    const filteredSales = useMemo(() => {
        return sales.filter(s =>
            (s.qs_id || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (s.remark || '').toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [sales, searchTerm]);

    const processedSales = useMemo(() => {
        let sorted = [...filteredSales];

        if (sortConfig.key) {
            sorted.sort((a, b) => {
                const aVal = a[sortConfig.key] ?? '';
                const bVal = b[sortConfig.key] ?? '';
                if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }

        const start = (currentPage - 1) * itemsPerPage;
        return sorted.slice(start, start + itemsPerPage);
    }, [filteredSales, sortConfig, currentPage]);

    const totalPages = Math.ceil(filteredSales.length / itemsPerPage);

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
        <div className="flex flex-col min-h-screen bg-[#F7F9FB]">
            {/* Page Header */}
            <div className="px-4 md:px-8 pt-8 pb-2">
                <div className="max-w-7xl mx-auto">
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
                        <div>
                            <h1 className="text-3xl font-extrabold tracking-tight text-[#191C1E] mb-1">Quick Sales</h1>
                            <p className="text-[#434655] text-sm font-medium">View and manage rapid point-of-sale transactions</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#434655]" size={18} />
                                <input
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
                                className="cursor-pointer bg-gradient-to-br from-[#004AC6] to-[#2563EB] text-white px-5 py-2.5 rounded-lg flex items-center gap-2 font-semibold shadow-lg shadow-[#004AC6]/20 active:scale-95 transition-transform whitespace-nowrap"
                                onClick={() => navigate('/quick-sales/create')}
                            >
                                <Plus size={18} />
                                <span>New Sale</span>
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
                                        <tr key={sale.qs_id} className="group hover:bg-[#F2F4F6] transition-colors cursor-pointer">
                                            <td className="py-5 px-6 text-sm text-[#434655] font-medium">{String((currentPage - 1) * itemsPerPage + index + 1).padStart(2, '0')}</td>
                                            <td className="py-5 px-6">
                                                <button
                                                    type="button"
                                                    className="bg-[#E6E8EA] px-2 py-1 rounded text-[10px] font-bold text-[#004AC6] cursor-pointer hover:bg-[#D0E1FB] transition-colors border-none"
                                                    onClick={() => handleEdit(sale.qs_id)}
                                                    aria-label={`Open quick sale ${sale.qs_id}`}
                                                >
                                                    {sale.qs_id}
                                                </button>
                                            </td>
                                            <td className="py-5 px-6 text-sm font-medium text-[#191C1E]">{sale.qs_date}</td>
                                            <td className="py-5 px-6 text-right font-black text-[#191C1E]">₹{(parseFloat(sale.total) || 0).toFixed(2)}</td>
                                            <td className="py-5 px-6 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button
                                                        onClick={() => handleEdit(sale.qs_id)}
                                                        className="cursor-pointer p-2 rounded-full hover:bg-white text-[#434655] hover:text-[#004AC6] transition-all shadow-none hover:shadow-sm"
                                                        title="Edit"
                                                    >
                                                        <Edit size={16} />
                                                    </button>
                                                    <button
                                                        onClick={() => setDeleteTarget(sale.qs_id)}
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
                    </div>

                    {/* Pagination Footer */}
                    {totalPages > 1 && (
                        <div className="px-8 py-6 flex items-center justify-between bg-[#F2F4F6]/30 border-t border-[#C3C6D7]/10">
                            <p className="text-sm text-[#434655]">
                                Showing <span className="font-bold text-[#191C1E]">{(currentPage - 1) * itemsPerPage + 1}</span> to{' '}
                                <span className="font-bold text-[#191C1E]">
                                    {Math.min(currentPage * itemsPerPage, filteredSales.length)}
                                </span>{' '}
                                of <span className="font-bold text-[#191C1E]">{filteredSales.length}</span> results
                            </p>
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
                                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
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

            {/* Delete Confirmation Modal */}
            <Popup
                open={deleteTarget !== null}
                onClose={() => setDeleteTarget(null)}
                modal
                nested
                closeOnDocumentClick={!isDeleting}
                closeOnEscape={!isDeleting}
            >
                {(close) => (
                    <div className="p-6 bg-white rounded-xl shadow-2xl max-w-md mx-auto">
                        <div className="flex items-center justify-center mb-4">
                            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                                <AlertTriangle className="text-red-600" size={24} />
                            </div>
                        </div>
                        <h2 className="text-xl font-bold text-[#0F172A] text-center mb-2">
                            Delete Quick Sale
                        </h2>
                        <p className="text-[#64748B] text-center mb-6">
                            {`Are you sure you want to delete "${deleteTarget}"?`}
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => {
                                    setDeleteTarget(null);
                                    close();
                                }}
                                disabled={isDeleting}
                                className="flex-1 px-4 py-2.5 rounded-lg border border-[#E2E8F0] text-[#64748B] font-medium hover:bg-[#F1F5F9] transition-colors cursor-pointer disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={async () => {
                                    await confirmDelete();
                                }}
                                disabled={isDeleting}
                                className="flex-1 px-4 py-2.5 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 transition-colors cursor-pointer disabled:opacity-50"
                            >
                                {isDeleting ? 'Deleting...' : 'Delete'}
                            </button>
                        </div>
                    </div>
                )}
            </Popup>
        </div>
    );
};

export default ListQuickSales;