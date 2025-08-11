import React, { useState, useEffect, useMemo } from 'react';
import { Search, ChevronDown, Plus } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

// Remove mock data; will fetch from API

const CustomerOrder = () => {
  const navigate = useNavigate();

  const [searchTerm, setSearchTerm] = useState('');
  const [orders, setOrders] = useState([]);

  // fetch orders on mount
  useEffect(() => {
    (async () => {
      try {
        const data = await window.api.invoke('cusOrders:getAll');
        setOrders(data);
      } catch (err) {
        console.error(err);
        toast.error('Failed to fetch orders');
      }
    })();
  }, []);
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

    // Search filter
    let filtered = merged.filter(
      (o) =>
        (o.orderNo || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (o.name || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Sorting
    if (sortConfig.key) {
      filtered.sort((a, b) => {
        if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'asc' ? -1 : 1;
        if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    // Pagination slice
    const start = (currentPage - 1) * itemsPerPage;
    return filtered.slice(start, start + itemsPerPage);
  }, [searchTerm, sortConfig, currentPage, orders]);

  const totalPages = Math.ceil(
    orders.filter(
      (o) =>
        (o.orderNo || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (o.name || '').toLowerCase().includes(searchTerm.toLowerCase())
    ).length / itemsPerPage
  );

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  };

  const handleRowClick = (orderNo) => {
    navigate(`/orders/customers/${orderNo}`);
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
                type="text" 
                placeholder="Search products or codes..."
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
                      Order No
                      <ChevronDown
                        className={`ml-1 transition-transform ${
                          sortConfig.key === 'orderNo' && sortConfig.direction === 'desc' ? 'rotate-180' : ''
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
                        className={`ml-1 transition-transform ${
                          sortConfig.key === 'name' && sortConfig.direction === 'desc' ? 'rotate-180' : ''
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
                        className={`ml-1 transition-transform ${
                          sortConfig.key === 'date' && sortConfig.direction === 'desc' ? 'rotate-180' : ''
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
                        className={`ml-1 transition-transform ${
                          sortConfig.key === 'status' && sortConfig.direction === 'desc' ? 'rotate-180' : ''
                        }`}
                        size={16}
                      />
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {processedOrders.length > 0 ? (
                  processedOrders.map((order, index) => (
                    <tr
                      key={order.id}
                      className="hover:bg-gray-50 transition-colors cursor-pointer"
                      onClick={() => handleRowClick(order.orderNo)}
                    >
                      <td className="p-3">{(currentPage - 1) * itemsPerPage + index + 1}</td>
                      <td className="p-3 font-medium text-gray-900">{order.orderNo}</td>
                      <td className="p-3">{order.name}</td>
                      <td className="p-3">{order.date}</td>
                      <td className="p-3">{order.status}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="5" className="p-6 text-center text-gray-500">
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
                  {Math.min(
                    currentPage * itemsPerPage,
                    processedOrders.length + (currentPage - 1) * itemsPerPage
                  )}
                </span>{' '}
                of <span className="font-medium">{orders.length}</span> results
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className={`px-3 py-1 rounded-md ${
                    currentPage === 1
                      ? 'bg-gray-100 cursor-not-allowed'
                      : 'bg-[#05014A] text-white hover:bg-[#03012e] cursor-pointer'
                  }`}
                >
                  Previous
                </button>
                <button
                  onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className={`px-3 py-1 rounded-md ${
                    currentPage === totalPages
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
    </div>
  );
};

export default CustomerOrder;