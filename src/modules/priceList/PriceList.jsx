import { useNavigate, useLocation } from 'react-router-dom';
import { getProducts } from '../../../erpApi';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ChevronDown, Plus, Search, Eye, EyeOff, Edit, Trash2, AlertTriangle } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { sortProducts, extractNumericFromSize } from '../../utils/productUtils';
import Popup from 'reactjs-popup';
import 'reactjs-popup/dist/index.css';

const PriceList = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchTerm, setSearchTerm] = useState('');
  const [products, setProducts] = useState([]);
  const [sortConfig, setSortConfig] = useState({ key: 'productName', direction: 'asc' });
  const [showCostPrice, setShowCostPrice] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [highlightedCode, setHighlightedCode] = useState(null);
  const rowRefs = useRef({});

  // Load products from backend on first render (IPC)
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const data = await getProducts();
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

  // Auto-scroll to edited product when returning from edit page
  useEffect(() => {
    if (location.state?.editedProductCode && products.length > 0) {
      const code = location.state.editedProductCode;
      setHighlightedCode(code);

      // Wait for render then scroll
      setTimeout(() => {
        const rowElement = rowRefs.current[code];
        if (rowElement) {
          rowElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }

        // Remove highlight after 2 seconds
        setTimeout(() => {
          setHighlightedCode(null);
        }, 2000);
      }, 100);

      // Clear location state
      window.history.replaceState({}, document.title);
    }
  }, [location.state, products]);

  // Get filtered and sorted products (no pagination)
  const filteredProducts = useMemo(() => {
    let filtered = products.filter(item =>
      (item.productName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.code || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Apply smart sorting: name A-Z, then numeric size
    if (sortConfig.key === 'productName') {
      filtered = sortProducts(filtered, 'productName', 'size');
      if (sortConfig.direction === 'desc') {
        filtered = filtered.reverse();
      }
    } else if (sortConfig.key) {
      filtered.sort((a, b) => {
        let valA = a[sortConfig.key];
        let valB = b[sortConfig.key];

        if (typeof valA === 'number' && typeof valB === 'number') {
          return sortConfig.direction === 'asc' ? valA - valB : valB - valA;
        }

        valA = String(valA || '').toLowerCase();
        valB = String(valB || '').toLowerCase();

        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    } else {
      filtered = sortProducts(filtered, 'productName', 'size');
    }

    return filtered;
  }, [products, searchTerm, sortConfig]);

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // Handle delete product confirmation
  const confirmDeleteProduct = async () => {
    if (!deleteTarget) return;

    setIsDeleting(true);
    try {
      await window.api.deleteProduct(deleteTarget.code || '');
      toast.success('Product deleted successfully');
      const data = await getProducts();
      const normalized = data.map(p => ({
        id: p.code || `blank-${Math.random()}`,
        productName: p.name,
        code: p.code,
        size: p.size,
        costPrice: p.cost_price,
        packingType: p.packing_type,
        sellingPrice: p.selling_price,
      }));
      setProducts(normalized);
      setDeleteTarget(null);
    } catch (err) {
      console.error('Error deleting product:', err);
      toast.error('Failed to delete product');
    } finally {
      setIsDeleting(false);
    }
  };

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
                onChange={(e) => setSearchTerm(e.target.value)}
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

            <button
              className="flex items-center justify-center bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors duration-200 shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 whitespace-nowrap cursor-pointer"
              onClick={() => setShowCleanupPopup(true)}
              title="Admin: Hard delete soft-deleted products"
            >
              <Settings className="mr-2" size={20} />
              Admin Cleanup
            </button>
          </div>
        </div>
      </header>

      {/* Price List Table */}
      <main className="flex-1 p-4 md:p-6">
        <div className="max-w-7xl mx-auto bg-white rounded-xl shadow-md overflow-hidden">
          {/* Results count */}
          <div className="px-4 py-3 border-b border-gray-200">
            <span className="text-sm text-gray-700">
              Showing <span className="font-medium">{filteredProducts.length}</span> products
            </span>
          </div>

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
                  <th className="p-3 text-center">Size</th>
                  <th className="p-3 text-center">Code</th>
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
                {filteredProducts.length > 0 ? (
                  filteredProducts.map((item, index) => (
                    <tr
                      key={item.id}
                      ref={el => rowRefs.current[item.code] = el}
                      className={`transition-colors duration-500 ${highlightedCode === item.code
                        ? 'bg-yellow-100'
                        : 'hover:bg-gray-50'
                        }`}
                    >
                      <td className="p-3 text-center">{index + 1}</td>
                      <td className="p-3 text-center font-medium text-gray-900">{item.productName}</td>
                      <td className="p-3 text-center text-gray-600">{item.size}</td>
                      <td className="p-3 text-center text-gray-600">{item.code}</td>
                      {showCostPrice && (
                        <td className="p-3 text-center">{formatCurrency(item.costPrice)}</td>
                      )}
                      <td className="p-3 text-center font-semibold">{formatCurrency(item.sellingPrice)}</td>
                      <td className="p-3 text-center">{item.packingType}</td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          {item.productName && item.productName.trim() ? (
                            <button
                              onClick={() => navigate(`/price-list/edit/${item.code}`)}
                              className="text-blue-600 hover:underline cursor-pointer"
                              title="Edit product"
                            >
                              <Edit size={18} />
                            </button>
                          ) : null}
                          <button
                            onClick={() => setDeleteTarget(item)}
                            className="text-red-600 hover:text-red-800 cursor-pointer"
                            title="Delete product"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
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
        </div>
      </main>

      {/* Delete Confirmation Popup */}
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
            <h2 className="text-xl font-bold text-gray-800 text-center mb-2">
              Delete Product
            </h2>
            <p className="text-gray-600 text-center mb-6">
              {deleteTarget && (!deleteTarget.productName || !deleteTarget.productName.trim())
                ? 'This product has incomplete data. Are you sure you want to delete it?'
                : `Are you sure you want to delete "${deleteTarget?.productName || 'this product'}"?`
              }
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => {
                  setDeleteTarget(null);
                  close();
                }}
                disabled={isDeleting}
                className="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  await confirmDeleteProduct();
                  close();
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

      {/* Admin Cleanup Confirmation Popup */}
      <Popup
        open={showCleanupPopup}
        onClose={() => setShowCleanupPopup(false)}
        modal
        nested
        closeOnDocumentClick={!isCleaningUp}
        closeOnEscape={!isCleaningUp}
      >
        {(close) => (
          <div className="p-6 bg-white rounded-xl shadow-2xl max-w-md mx-auto">
            <div className="flex items-center justify-center mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <AlertTriangle className="text-red-600" size={24} />
              </div>
            </div>
            <h2 className="text-xl font-bold text-gray-800 text-center mb-2">
              Hard Delete Soft-Deleted Products
            </h2>
            <p className="text-gray-600 text-center mb-6">
              This will permanently delete all soft-deleted products. Products still referenced in invoices or orders will be skipped. This action cannot be undone.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => {
                  setShowCleanupPopup(false);
                  close();
                }}
                disabled={isCleaningUp}
                className="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAdminCleanup}
                disabled={isCleaningUp}
                className="flex-1 px-4 py-2.5 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 transition-colors cursor-pointer disabled:opacity-50"
              >
                {isCleaningUp ? 'Cleaning up...' : 'Delete Permanently'}
              </button>
            </div>
          </div>
        )}
      </Popup>
    </div>
  );
};

export default PriceList;