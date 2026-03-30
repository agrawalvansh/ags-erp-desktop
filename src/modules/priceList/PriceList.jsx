import { useNavigate, useLocation } from 'react-router-dom';
import { getProducts } from '../../../erpApi';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ChevronDown, Plus, Search, Eye, EyeOff, Edit, Trash2, AlertTriangle, CircleX } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { sortProducts, extractNumericFromSize } from '../../utils/productUtils';


const PriceList = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchTerm, setSearchTerm] = useState('');
  const searchInputRef = useRef(null);
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
    <div className="flex flex-col min-h-screen bg-[#F7F9FB]">
      {/* Page Header */}
      <div className="px-4 md:px-8 pt-8 pb-2">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight text-[#191C1E] mb-1">Price List</h1>
              <p className="text-[#434655] text-sm font-medium">Showing {filteredProducts.length} products</p>
            </div>
            <div className="flex items-center gap-3">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#434655]" size={18} />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search products or codes..."
                  className="w-72 bg-white border border-[#C3C6D7]/20 rounded-lg py-2.5 pl-10 pr-10 text-sm focus:border-[#004AC6] focus:ring-4 focus:ring-[#004AC6]/5 transition-all outline-none"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => { setSearchTerm(''); searchInputRef.current?.focus(); }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#434655] hover:text-[#DC2626] cursor-pointer transition-colors"
                    aria-label="Clear search"
                  >
                    <CircleX size={16} />
                  </button>
                )}
              </div>

              {/* Show/Hide Cost Price */}
              <button
                className="cursor-pointer flex items-center gap-2 px-5 py-2.5 bg-[#E6E8EA] text-[#191C1E] font-semibold rounded-lg hover:bg-[#E0E3E5] transition-all text-sm whitespace-nowrap"
                onClick={() => setShowCostPrice(prev => !prev)}
              >
                {showCostPrice ? <EyeOff size={18} /> : <Eye size={18} />}
                {showCostPrice ? 'Hide' : 'Show'} Cost Price
              </button>

              {/* Add New Product */}
              <button
                className="cursor-pointer flex items-center gap-2 px-6 py-2.5 bg-gradient-to-br from-[#004AC6] to-[#2563EB] text-white font-bold rounded-lg shadow-lg shadow-[#004AC6]/20 hover:scale-[1.02] active:scale-95 transition-all text-sm whitespace-nowrap"
                onClick={() => navigate('/price-list/add')}
              >
                <Plus size={18} />
                Add New Product
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
              <thead className="bg-[#F2F4F6]">
                <tr className="text-[11px] font-bold text-[#434655] uppercase tracking-wider">
                  <th className="py-5 px-6 w-16">No.</th>
                  <th
                    className="py-5 px-6 cursor-pointer hover:text-[#004AC6] transition-colors"
                    onClick={() => handleSort('productName')}
                  >
                    <div className="flex items-center gap-1">
                      Product Name
                      <ChevronDown
                        className={`transition-transform ${sortConfig.key === 'productName' && sortConfig.direction === 'desc' ? 'rotate-180' : ''}`}
                        size={14}
                      />
                    </div>
                  </th>
                  <th className="py-5 px-6">Size</th>
                  <th className="py-5 px-6">Code</th>
                  {showCostPrice && (
                    <th
                      className="py-5 px-6 cursor-pointer hover:text-[#004AC6] transition-colors text-[#434655]/40 italic"
                      onClick={() => handleSort('costPrice')}
                    >
                      <div className="flex items-center gap-1">
                        Cost Price
                        <ChevronDown
                          className={`transition-transform ${sortConfig.key === 'costPrice' && sortConfig.direction === 'desc' ? 'rotate-180' : ''}`}
                          size={14}
                        />
                      </div>
                    </th>
                  )}
                  <th
                    className="py-5 px-6 cursor-pointer hover:text-[#004AC6] transition-colors"
                    onClick={() => handleSort('sellingPrice')}
                  >
                    <div className="flex items-center gap-1">
                      Selling Price (₹)
                      <ChevronDown
                        className={`transition-transform ${sortConfig.key === 'sellingPrice' && sortConfig.direction === 'desc' ? 'rotate-180' : ''}`}
                        size={14}
                      />
                    </div>
                  </th>
                  <th
                    className="py-5 px-6 cursor-pointer hover:text-[#004AC6] transition-colors"
                    onClick={() => handleSort('packingType')}
                  >
                    <div className="flex items-center gap-1">
                      Packing Type
                      <ChevronDown
                        className={`transition-transform ${sortConfig.key === 'packingType' && sortConfig.direction === 'desc' ? 'rotate-180' : ''}`}
                        size={14}
                      />
                    </div>
                  </th>
                  <th className="py-5 px-6 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#C3C6D7]/5">
                {filteredProducts.length > 0 ? (
                  filteredProducts.map((item, index) => (
                    <tr
                      key={item.id}
                      ref={el => rowRefs.current[item.code] = el}
                      className={`group transition-colors duration-500 cursor-pointer ${highlightedCode === item.code
                        ? 'bg-yellow-50'
                        : 'hover:bg-[#F2F4F6]/50'
                      }`}
                    >
                      <td className="py-5 px-6 text-sm font-medium text-[#434655]">{index + 1}</td>
                      <td className="py-5 px-6">
                        <span className="text-sm font-bold text-[#191C1E]">{item.productName}</span>
                      </td>
                      <td className="py-5 px-6 text-sm text-[#434655]">{item.size}</td>
                      <td className="py-5 px-6">
                        <span className="px-2 py-1 bg-[#ECEEF0] text-[10px] font-bold rounded-md text-[#434655]">{item.code}</span>
                      </td>
                      {showCostPrice && (
                        <td className="py-5 px-6 text-sm text-[#434655]">{formatCurrency(item.costPrice)}</td>
                      )}
                      <td className="py-5 px-6 text-sm font-bold text-[#004AC6]">{formatCurrency(item.sellingPrice)}</td>
                      <td className="py-5 px-6">
                        <span className="text-xs font-medium px-3 py-1 bg-[#D0E1FB]/30 text-[#54647A] rounded-full">{item.packingType}</span>
                      </td>
                      <td className="py-5 px-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {item.productName && item.productName.trim() ? (
                            <button
                              onClick={() => navigate(`/price-list/edit/${item.code}`)}
                              className="cursor-pointer p-2 rounded-full hover:bg-white text-[#434655] hover:text-[#004AC6] transition-all shadow-none hover:shadow-sm"
                              title="Edit product"
                            >
                              <Edit size={16} />
                            </button>
                          ) : null}
                          <button
                            onClick={() => setDeleteTarget(item)}
                            className="cursor-pointer p-2 rounded-full hover:bg-white text-[#434655] hover:text-[#DC2626] transition-all shadow-none hover:shadow-sm"
                            title="Delete product"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={showCostPrice ? 8 : 7} className="px-6 py-12 text-center text-[#434655] text-sm">
                      No products found. Try a different search term.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Delete Confirmation Modal — Stitch Glass Overlay */}
      {deleteTarget !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backdropFilter: 'blur(8px)', backgroundColor: 'rgba(255,255,255,0.7)' }}>
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-[#C3C6D7]/20 p-8 transform scale-100 transition-all">
            <div className="w-12 h-12 rounded-full bg-red-100/50 flex items-center justify-center text-red-600 mb-6">
              <AlertTriangle size={28} />
            </div>
            <h2 className="text-2xl font-extrabold text-[#0F172A] tracking-tight mb-3">
              Delete Product?
            </h2>
            <p className="text-[#434655] leading-relaxed mb-8">
              {deleteTarget && (!deleteTarget.productName || !deleteTarget.productName.trim())
                ? 'This product has incomplete data. Are you sure you want to delete it?'
                : <>Are you sure you want to delete <span className="font-bold text-[#191C1E]">{deleteTarget?.productName || 'this product'}</span>? This action cannot be undone and will remove the product permanently from your catalog.</>
              }
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={isDeleting}
                className="flex-1 px-6 py-3 bg-[#E6E8EA] text-[#191C1E] font-bold rounded-xl hover:bg-[#E0E3E5] transition-all text-sm cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => confirmDeleteProduct()}
                disabled={isDeleting}
                className="flex-1 px-6 py-3 bg-red-600 text-white font-bold rounded-xl shadow-lg shadow-red-600/20 hover:bg-red-700 hover:scale-[1.02] active:scale-95 transition-all text-sm cursor-pointer disabled:opacity-50"
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

export default PriceList;