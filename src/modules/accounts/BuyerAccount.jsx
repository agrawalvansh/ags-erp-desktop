import React, { useState, useMemo, useEffect } from 'react';
import { Search, ChevronDown, Plus, Edit } from 'lucide-react';
import { useNavigate } from 'react-router-dom';


const BuyerAccount = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const navigate = useNavigate();

  const [buyers, setBuyers] = useState([]);
  const [loadingBuyers, setLoadingBuyers] = useState(true);

  useEffect(() => {
    const fetchBuyers = async () => {
      try {
        const data = await window.api.invoke('customers:getAll');
        const mapped = data.map((c) => ({
          id: c.customer_id,
          name: c.name,
          email: '',
          phone: c.mobile,
          address: c.address,
          company: '',
          gstNumber: '',
          panNumber: '',
          slug: c.customer_id,
        }));
        setBuyers(mapped);
      } catch (err) {
        console.error('Error fetching buyers:', err);
      } finally {
        setLoadingBuyers(false);
      }
    };
    fetchBuyers();
  }, []);

  const processedBuyers = useMemo(() => {
    // Search
    let filtered = buyers.filter((u) => {
      const term = searchTerm.toLowerCase();
      return (
        u.id.toLowerCase().includes(term) ||
        u.name.toLowerCase().includes(term) ||
        u.email.toLowerCase().includes(term) ||
        u.phone.toLowerCase().includes(term) ||
        u.address.toLowerCase().includes(term) ||
        u.company.toLowerCase().includes(term) ||
        u.gstNumber.toLowerCase().includes(term) ||
        u.panNumber.toLowerCase().includes(term)
      );
    });

    // Sorting
    if (sortConfig.key) {
      filtered.sort((a, b) => {
        if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'asc' ? -1 : 1;
        if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    // Pagination
    const start = (currentPage - 1) * itemsPerPage;
    return filtered.slice(start, start + itemsPerPage);
  }, [searchTerm, sortConfig, currentPage, buyers]);

  const totalPages = Math.ceil(
    buyers.filter((u) => {
      const term = searchTerm.toLowerCase();
      return (
        u.id.toLowerCase().includes(term) ||
        u.name.toLowerCase().includes(term) ||
        u.email.toLowerCase().includes(term)
      );
    }).length / itemsPerPage
  );

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  };

  const handleRowClick = (slug) => {
    navigate(`/accounts/customers/${slug}`);
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-[#caf0f8] p-4 md:p-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <h1 className="text-2xl md:text-3xl font-bold text-[#05014A]">Customer's Accounts</h1>

          <div className="flex flex-col sm:flex-row w-full md:w-auto gap-3">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Search buyers..."
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
              onClick={() => navigate('/accounts/customers/add')}
            >
              <Plus className="mr-2" size={20} />
              Add New Customer
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
                  {['id', 'name', 'phone', 'address'].map((col) => (
                    <th
                      key={col}
                      className="p-3 text-left cursor-pointer hover:bg-[#03012e] transition-colors"
                      onClick={() => handleSort(col)}
                    >
                      <div className="flex items-center capitalize">
                        {col}
                        <ChevronDown
                          className={`ml-1 transition-transform ${
                            sortConfig.key === col && sortConfig.direction === 'desc' ? 'rotate-180' : ''
                          }`}
                          size={16}
                        />
                      </div>
                    </th>
                  ))}
                  <th className="p-3 text-left">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {processedBuyers.length > 0 ? (
                  processedBuyers.map((buyer, index) => (
                    <tr
                      key={buyer.id}
                      className="hover:bg-gray-50 transition-colors cursor-pointer"
                      onClick={() => handleRowClick(buyer.slug)}
                    >
                      <td className="p-3">{(currentPage - 1) * itemsPerPage + index + 1}</td>
                      <td className="p-3">{buyer.id}</td>
                      <td className="p-3 font-medium text-gray-900">{buyer.name}</td>
                      <td className="p-3">{buyer.phone}</td>
                      <td className="p-3">{buyer.address}</td>
                      <td className="p-3">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/accounts/customers/edit/${buyer.id}`);
                          }}
                          className="text-blue-600 hover:underline flex items-center cursor-pointer"
                        >
                          <Edit size={16} />
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="9" className="p-6 text-center text-gray-500">
                      No buyers found.
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
                  {Math.min(currentPage * itemsPerPage, processedBuyers.length + (currentPage - 1) * itemsPerPage)}
                </span>{' '}
                of <span className="font-medium">{buyers.length}</span> results
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className={`px-3 py-1 rounded-md ${
                    currentPage === 1 ? 'bg-gray-100 cursor-not-allowed' : 'bg-[#05014A] text-white hover:bg-[#03012e]'
                  }`}
                >
                  Previous
                </button>
                <button
                  onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className={`px-3 py-1 rounded-md ${
                    currentPage === totalPages ? 'bg-gray-100 cursor-not-allowed' : 'bg-[#05014A] text-white hover:bg-[#03012e]'
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

export default BuyerAccount;