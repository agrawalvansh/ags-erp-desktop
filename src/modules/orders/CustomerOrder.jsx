import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Search, ChevronDown, Plus, Edit, Trash2, AlertTriangle, CircleX } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import Popup from 'reactjs-popup';
import 'reactjs-popup/dist/index.css';

const CustomerOrder = () => {
  const navigate = useNavigate();

  const [searchTerm, setSearchTerm] = useState('');
  const searchInputRef = useRef(null);
  const [orders, setOrders] = useState([]);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchOrders = async () => {
    try {
      const data = await window.api.invoke('cusOrders:getAll');
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
      name: o.customer_name || o.name || o.customer_id,
      status: o.status || 'Received',
      orderNo: o.order_id || o.orderNo,
      date: o.order_date || o.date,
    }));

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

    const start = (currentPage - 1) * itemsPerPage;
    return filtered.slice(start, start + itemsPerPage);
  }, [searchTerm, sortConfig, currentPage, orders]);

  const totalFiltered = orders.filter(
    (o) =>
      (o.order_id || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (o.customer_name || o.name || '').toLowerCase().includes(searchTerm.toLowerCase())
  ).length;
  const totalPages = Math.ceil(totalFiltered / itemsPerPage);

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  };

  const handleRowClick = (orderNo) => {
    navigate(`/orders/customers/${orderNo}`);
  };

  const confirmDelete = async (close) => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const result = await window.api.invoke('cusOrders:delete', deleteTarget);
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
      close();
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-[#caf0f8] p-4 md:p-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <h1 className="text-2xl md:text-3xl font-bold text-[#05014A]">Orders Received</h1>

          <div className="flex flex-col sm:flex-row w-full md:w-auto gap-3">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search Orders..."
                className="w-full pl-10 pr-10 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#05014A] focus:border-transparent"
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
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                  aria-label="Clear search"
                >
                  <CircleX size={18} />
                </button>
              )}
            </div>

            <button
              className="flex items-center justify-center bg-[#05014A] text-white px-4 py-2 rounded-lg hover:bg-[#03012e] transition-colors duration-200 shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#05014A] whitespace-nowrap cursor-pointer"
              onClick={() => navigate('/orders/customers/add')}
            >
              <Plus className="mr-2" size={20} />
              Add New Order
            </button>

          </div>
        </div>
      </header>

      {/* Orders Table */}
      <main className="flex-1 p-4 md:p-6">
        <div className="max-w-7xl mx-auto bg-white rounded-xl shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#05014A] text-white">
                <tr>
                  <th className="p-3 text-left">No.</th>
                  <th
                    className="p-3 text-left cursor-pointer hover:bg-[#03012e] transition-colors"
                    onClick={() => handleSort('orderNo')}
                  >
                    <div className="flex items-center">
                      Order No.
                      <ChevronDown
                        className={`ml-1 transition-transform ${sortConfig.key === 'orderNo' && sortConfig.direction === 'desc' ? 'rotate-180' : ''
                          }`}
                        size={16}
                      />
                    </div>
                  </th>
                  <th
                    className="p-3 text-left cursor-pointer hover:bg-[#03012e] transition-colors"
                    onClick={() => handleSort('name')}
                  >
                    <div className="flex items-center">
                      Name
                      <ChevronDown
                        className={`ml-1 transition-transform ${sortConfig.key === 'name' && sortConfig.direction === 'desc' ? 'rotate-180' : ''
                          }`}
                        size={16}
                      />
                    </div>
                  </th>
                  <th
                    className="p-3 text-left cursor-pointer hover:bg-[#03012e] transition-colors"
                    onClick={() => handleSort('date')}
                  >
                    <div className="flex items-center">
                      Date
                      <ChevronDown
                        className={`ml-1 transition-transform ${sortConfig.key === 'date' && sortConfig.direction === 'desc' ? 'rotate-180' : ''
                          }`}
                        size={16}
                      />
                    </div>
                  </th>
                  <th
                    className="p-3 text-left cursor-pointer hover:bg-[#03012e] transition-colors"
                    onClick={() => handleSort('status')}
                  >
                    <div className="flex items-center">
                      Status
                      <ChevronDown
                        className={`ml-1 transition-transform ${sortConfig.key === 'status' && sortConfig.direction === 'desc' ? 'rotate-180' : ''
                          }`}
                        size={16}
                      />
                    </div>
                  </th>
                  <th className="p-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {processedOrders.length > 0 ? (
                  processedOrders.map((order, index) => (
                    <tr
                      key={order.orderNo || index}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="p-3">{(currentPage - 1) * itemsPerPage + index + 1}</td>
                      <td
                        className="p-3 font-medium text-blue-600 cursor-pointer hover:underline"
                        onClick={() => handleRowClick(order.orderNo)}
                      >
                        {order.orderNo}
                      </td>
                      <td className="p-3">{order.name}</td>
                      <td className="p-3">{order.date}</td>
                      <td className="p-3">{order.status}</td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center space-x-3">
                          <button
                            onClick={() => navigate(`/orders/customers/${order.orderNo}`)}
                            className="cursor-pointer text-blue-500 hover:text-blue-700 transition-colors"
                            aria-label="Edit order"
                          >
                            <Edit size={18} />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setDeleteTarget(order.orderNo); }}
                            className="cursor-pointer text-red-500 hover:text-red-700 transition-colors"
                            aria-label="Delete order"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="6" className="p-6 text-center text-gray-500">
                      No orders found.
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
                  {Math.min(currentPage * itemsPerPage, totalFiltered)}
                </span>{' '}
                of <span className="font-medium">{totalFiltered}</span> results
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className={`px-3 py-1 rounded-md ${currentPage === 1
                    ? 'bg-gray-100 cursor-not-allowed'
                    : 'bg-[#05014A] text-white hover:bg-[#03012e] cursor-pointer'
                    }`}
                >
                  Previous
                </button>
                <button
                  onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className={`px-3 py-1 rounded-md ${currentPage === totalPages
                    ? 'bg-gray-100 cursor-not-allowed'
                    : 'bg-[#05014A] text-white hover:bg-[#03012e] cursor-pointer'
                    }`}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Delete Confirmation Popup */}
      <Popup
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        modal
        nested
        overlayStyle={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
      >
        {close => (
          <div className="bg-white p-8 rounded-xl shadow-2xl mx-auto border border-gray-100" style={{ maxWidth: '400px' }}>
            <div className="mb-6">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="text-red-600" size={24} />
              </div>
              <h2 className="text-2xl font-bold text-gray-800 text-center mb-2">Confirm Delete</h2>
              <p className="text-gray-600 text-center">
                Are you sure you want to delete order <strong>{deleteTarget}</strong>? This action cannot be undone.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => { setDeleteTarget(null); close(); }}
                className="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => confirmDelete(close)}
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

export default CustomerOrder;