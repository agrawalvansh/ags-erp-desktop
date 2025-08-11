import { useNavigate } from 'react-router-dom';
import { getProducts } from '../../../erpApi';
import React, { useState, useEffect, useMemo } from 'react';
import { ChevronDown, Plus, Search, Eye, EyeOff, Edit } from 'lucide-react';

const PriceList = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [products, setProducts] = useState([]);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [showCostPrice, setShowCostPrice] = useState(false);

  // Load products from backend on first render (IPC)
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const data = await getProducts();
        // Normalize keys to match existing table code expectations
        const normalized = data.map(p => ({
          id: p.code,
          productName: p.name,
          code: p.code,
          size: p.size,
          costPrice: p.cost_price,
          packingType: p.packing_type,
          sellingPrice: p.selling_price,
        }));
        setProducts(normalized);
      } catch (err) {
        console.error('Error fetching products:', err);
      }
    };
    fetchProducts();
  }, []);

  // Apply sorting, searching and pagination
  const processedData = useMemo(() => {
    let filtered = products.filter(item => 
      item.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.code.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Sorting
    if (sortConfig.key) {
      filtered.sort((a, b) => {
        if (a[sortConfig.key] < b[sortConfig.key]) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (a[sortConfig.key] > b[sortConfig.key]) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }

    // Pagination
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filtered.slice(startIndex, startIndex + itemsPerPage);
  }, [products, searchTerm, sortConfig, currentPage]);

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const totalPages = Math.ceil(
    products.filter(item => 
      item.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.code.toLowerCase().includes(searchTerm.toLowerCase())
    ).length / itemsPerPage
  );

  // Format currency
  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2
    }).format(value);
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-[#caf0f8] p-4 md:p-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <h1 className="text-2xl md:text-3xl font-bold text-[#05014A]">Price List</h1>
          
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
              className="flex items-center justify-center bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300 transition-colors duration-200 shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#05014A] whitespace-nowrap cursor-pointer"
              onClick={() => setShowCostPrice(prev => !prev)}
            >
              {showCostPrice ? <EyeOff className="mr-2" size={20} /> : <Eye className="mr-2" size={20} />}
              {showCostPrice ? 'Hide' : 'Show'} Cost Price
            </button>
            
            <button 
              className="flex items-center justify-center bg-[#05014A] text-white px-4 py-2 rounded-lg hover:bg-[#03012e] transition-colors duration-200 shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#05014A] whitespace-nowrap cursor-pointer"
              onClick={() => navigate('/price-list/add')}
            >
              <Plus className="mr-2" size={20} />
              Add New Product
            </button>

          </div>
        </div>
      </header>

      {/* Price List Table */}
      <main className="flex-1 p-4 md:p-6">
        <div className="max-w-7xl mx-auto bg-white rounded-xl shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-center">
              <thead className="bg-[#05014A] text-white">
                <tr>
                  <th className="p-3 text-center">No.</th>
                  <th 
                    className="p-3 text-center cursor-pointer hover:bg-[#03012e] transition-colors"
                    onClick={() => handleSort('productName')}
                  >
                    <div className="flex items-center justify-center">
                      Product Name
                      <ChevronDown className={`ml-1 transition-transform ${sortConfig.key === 'productName' && sortConfig.direction === 'desc' ? 'rotate-180' : ''}`} size={16} />
                    </div>
                  </th>
                  <th className="p-3 text-center">Code</th>
                  <th className="p-3 text-center">Size</th>
                  {showCostPrice && (
                    <th 
                      className="p-3 text-center cursor-pointer hover:bg-[#03012e] transition-colors"
                      onClick={() => handleSort('costPrice')}
                    >
                      <div className="flex items-center justify-center">
                        Cost Price
                        <ChevronDown className={`ml-1 transition-transform ${sortConfig.key === 'costPrice' && sortConfig.direction === 'desc' ? 'rotate-180' : ''}`} size={16} />
                      </div>
                    </th>
                  )}
                  
                  <th 
                    className="p-3 text-center cursor-pointer hover:bg-[#03012e] transition-colors"
                    onClick={() => handleSort('sellingPrice')}
                  >
                    <div className="flex items-center justify-center">
                      Price
                      <ChevronDown className={`ml-1 transition-transform ${sortConfig.key === 'sellingPrice' && sortConfig.direction === 'desc' ? 'rotate-180' : ''}`} size={16} />
                    </div>
                  </th>
                  <th 
                    className="p-3 text-center cursor-pointer hover:bg-[#03012e] transition-colors"
                    onClick={() => handleSort('packingType')}
                  >
                    <div className="flex items-center justify-center">
                      Packing Type
                      <ChevronDown className={`ml-1 transition-transform ${sortConfig.key === 'packingType' && sortConfig.direction === 'desc' ? 'rotate-180' : ''}`} size={16} />
                    </div>
                  </th>
                  <th className="p-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {processedData.length > 0 ? (
                  processedData.map((item, index) => (
                    <tr 
                      key={item.id} 
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="p-3 text-center">{(currentPage - 1) * itemsPerPage + index + 1}</td>
                      <td className="p-3 text-center font-medium text-gray-900">{item.productName}</td>
                      <td className="p-3 text-center text-gray-600">{item.code}</td>
                      <td className="p-3 text-center text-gray-600">{item.size}</td>
                      {showCostPrice && (
                        <td className="p-3 text-center">{formatCurrency(item.costPrice)}</td>
                      )}
                      <td className="p-3 text-center font-semibold">{formatCurrency(item.sellingPrice)}</td>
                      <td className="p-3 text-center">{item.packingType}</td>
                      <td className="p-3 text-center">
                        <button
                          onClick={() => navigate(`/price-list/edit/${item.code}`)}
                          className="text-blue-600 hover:underline cursor-pointer"
                        >
                          <Edit size={18} />
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={showCostPrice ? 8 : 7} className="p-6 text-center text-gray-500">
                      No products found. Try a different search term.
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
                  {Math.min(currentPage * itemsPerPage, processedData.length + (currentPage - 1) * itemsPerPage)}
                </span>{' '}
                of <span className="font-medium">{products.length}</span> results
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
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
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
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

export default PriceList;