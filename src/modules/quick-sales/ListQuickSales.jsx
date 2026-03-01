import React, { useState, useEffect, useMemo } from 'react';
import { Search, ChevronDown, Plus, Edit, Trash2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

const ListQuickSales = () => {
    const navigate = useNavigate();

    const [searchTerm, setSearchTerm] = useState('');
    const [sales, setSales] = useState([]);
    const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
    const [currentPage, setCurrentPage] = useState(1);
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

    const handleDelete = async (qsId) => {
        if (!window.confirm(`Are you sure you want to delete ${qsId}?`)) return;
        try {
            const res = await window.api.invoke('quickSales:delete', qsId);
            if (res.success) {
                toast.success(`${qsId} deleted`);
                fetchSales();
            } else {
                toast.error(res.error || 'Failed to delete');
            }
        } catch (err) {
            console.error(err);
            toast.error('Failed to delete quick sale');
        }
    };

    return (
        <div className="flex flex-col min-h-screen bg-gray-50">
            {/* Header */}
            <header className="bg-[#caf0f8] p-4 md:p-6">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
                    <h1 className="text-2xl md:text-3xl font-bold text-[#05014A]">Quick Sales</h1>

                    <div className="flex flex-col sm:flex-row w-full md:w-auto gap-3">
                        <div className="relative w-full">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                            <input
                                type="text"
                                placeholder="Search by ID or remark..."
                                className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#05014A] focus:border-transparent"
                                value={searchTerm}
                                onChange={(e) => {
                                    setSearchTerm(e.target.value);
                                    setCurrentPage(1);
                                }}
                            />
                        </div>

                        <button
                            className="flex items-center justify-center bg-[#05014A] text-white px-4 py-2 rounded-lg hover:bg-[#03012e] transition-colors duration-200 shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#05014A] whitespace-nowrap cursor-pointer"
                            onClick={() => navigate('/quick-sales/create')}
                        >
                            <Plus className="mr-2" size={20} />
                            New Quick Sale
                        </button>
                    </div>
                </div>
            </header>

            {/* Table */}
            <main className="flex-1 p-4 md:p-6">
                <div className="max-w-7xl mx-auto bg-white rounded-xl shadow-md overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-[#05014A] text-white">
                                <tr>
                                    <th className="p-3 text-left">No.</th>
                                    <th
                                        className="p-3 text-left cursor-pointer hover:bg-[#03012e] transition-colors"
                                        onClick={() => handleSort('qs_id')}
                                    >
                                        <div className="flex items-center">
                                            Quick Sale No
                                            <ChevronDown
                                                className={`ml-1 transition-transform ${sortConfig.key === 'qs_id' && sortConfig.direction === 'desc' ? 'rotate-180' : ''}`}
                                                size={16}
                                            />
                                        </div>
                                    </th>
                                    <th
                                        className="p-3 text-left cursor-pointer hover:bg-[#03012e] transition-colors"
                                        onClick={() => handleSort('total')}
                                    >
                                        <div className="flex items-center">
                                            Amount
                                            <ChevronDown
                                                className={`ml-1 transition-transform ${sortConfig.key === 'total' && sortConfig.direction === 'desc' ? 'rotate-180' : ''}`}
                                                size={16}
                                            />
                                        </div>
                                    </th>
                                    <th
                                        className="p-3 text-left cursor-pointer hover:bg-[#03012e] transition-colors"
                                        onClick={() => handleSort('qs_date')}
                                    >
                                        <div className="flex items-center">
                                            Date
                                            <ChevronDown
                                                className={`ml-1 transition-transform ${sortConfig.key === 'qs_date' && sortConfig.direction === 'desc' ? 'rotate-180' : ''}`}
                                                size={16}
                                            />
                                        </div>
                                    </th>
                                    <th className="p-3 text-center">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {processedSales.length > 0 ? (
                                    processedSales.map((sale, index) => (
                                        <tr key={sale.qs_id} className="hover:bg-gray-50 transition-colors">
                                            <td className="p-3">{(currentPage - 1) * itemsPerPage + index + 1}</td>
                                            <td className="p-3 font-medium text-gray-900 cursor-pointer hover:text-blue-600 hover:underline" onClick={() => handleEdit(sale.qs_id)}>{sale.qs_id}</td>
                                            <td className="p-3">₹{(parseFloat(sale.total) || 0).toFixed(2)}</td>
                                            <td className="p-3">{sale.qs_date}</td>
                                            <td className="p-3 text-center">
                                                <div className="flex items-center justify-center space-x-3">
                                                    <button
                                                        onClick={() => handleEdit(sale.qs_id)}
                                                        className="cursor-pointer text-blue-500 hover:text-blue-700 transition-colors"
                                                        title="Edit"
                                                    >
                                                        <Edit size={18} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(sale.qs_id)}
                                                        className="cursor-pointer text-red-500 hover:text-red-700 transition-colors"
                                                        title="Delete"
                                                    >
                                                        <Trash2 size={18} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan="5" className="p-6 text-center text-gray-500">
                                            No quick sales found.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3 sm:px-6">
                            <div className="text-sm text-gray-700">
                                Showing <span className="font-medium">{(currentPage - 1) * itemsPerPage + 1}</span> to{' '}
                                <span className="font-medium">
                                    {Math.min(currentPage * itemsPerPage, filteredSales.length)}
                                </span>{' '}
                                of <span className="font-medium">{filteredSales.length}</span> results
                            </div>
                            <div className="flex space-x-2">
                                <button
                                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                    disabled={currentPage === 1}
                                    className={`px-3 py-1 rounded-md ${currentPage === 1 ? 'bg-gray-100 cursor-not-allowed' : 'bg-[#05014A] text-white hover:bg-[#03012e] cursor-pointer'}`}
                                >
                                    Previous
                                </button>
                                <button
                                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                    disabled={currentPage === totalPages}
                                    className={`px-3 py-1 rounded-md ${currentPage === totalPages ? 'bg-gray-100 cursor-not-allowed' : 'bg-[#05014A] text-white hover:bg-[#03012e] cursor-pointer'}`}
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};

export default ListQuickSales;