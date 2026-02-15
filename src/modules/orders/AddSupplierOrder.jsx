import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Printer, Plus, Trash2, Save, Edit, AlertTriangle } from 'lucide-react';
import { useParams, useNavigate, useBlocker } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import { Search } from 'lucide-react';
import { toast } from 'react-hot-toast';
import Popup from 'reactjs-popup';
import 'reactjs-popup/dist/index.css';
import { sortProducts, capitalizeWords, DEFAULT_PACKING_TYPE, ALLOWED_PACKING_TYPES } from '../../utils/productUtils';

// Add Item Form Component
// Improved Add Item Form Component
const AddItemForm = ({ newItem, setNewItem, handleAddItem, products, formErrors }) => {
  const [showProdDropdown, setShowProdDropdown] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const prodWrapperRef = useRef(null);


  // Filter and sort products with smart sorting (name A-Z, then numeric size)
  const filteredProducts = useMemo(() => {
    const filtered = products.filter(p =>
      (p.name || '').toLowerCase().includes(newItem.productName.toLowerCase())
    );
    return sortProducts(filtered, 'name', 'size');
  }, [products, newItem.productName]);

  // Utility to normalize different packing type values returned from backend
  // Utility to format product names (hyphens to spaces and capitalize words)
  const formatName = (name) => {
    if (!name) return '';
    return name
      .replace(/-/g, ' ')
      .split(' ')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  };

  // Utility to normalize packing type values and map them to valid dropdown option values
  const mapPackingType = (rawType) => {
    if (!rawType) return DEFAULT_PACKING_TYPE; // default fallback
    const trimmed = rawType.toString().trim();
    if (ALLOWED_PACKING_TYPES.includes(trimmed)) return trimmed;
    const upper = trimmed.toUpperCase();
    if (['PC', 'PCS'].includes(upper)) return 'Pc';
    if (['KG', 'KGS'].includes(upper)) return 'Kg';
    if (['DZ', 'DOZ', 'DOZEN'].includes(upper)) return 'Dz';
    if (['BOX', 'BOXES'].includes(upper)) return 'Box';
    if (['KODI'].includes(upper)) return 'Kodi';
    if (['THELI'].includes(upper)) return 'Theli';
    if (['PACKET'].includes(upper)) return 'Packet';
    if (['SET'].includes(upper)) return 'Set';
    return DEFAULT_PACKING_TYPE; // fallback to default for unknown types
  };

  const handleProductSelect = (product) => {
    setNewItem({
      ...newItem,
      code: product.code,
      productName: formatName(product.name),
      size: product.size || '',
      sellingPrice: (product.selling_price ?? product.sellingPrice ?? 0).toString(),
      packingType: mapPackingType(product.packing_type || product.packingType),
    });
    setShowProdDropdown(false);
    setHighlightedIndex(-1);
  };

  // Handle keyboard navigation
  const handleKeyDown = (e) => {
    if (!showProdDropdown) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev =>
          Math.min(prev + 1, filteredProducts.length - 1)
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && filteredProducts[highlightedIndex]) {
          handleProductSelect(filteredProducts[highlightedIndex]);
        }
        break;
      case 'Escape':
        setShowProdDropdown(false);
        break;
    }
  };


  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (prodWrapperRef.current && !prodWrapperRef.current.contains(event.target)) {
        setShowProdDropdown(false);
        setHighlightedIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
      <h3 className="text-lg font-semibold text-[#05014A] mb-4 flex items-center">
        <Plus size={20} className="mr-2" />
        Add New Item
      </h3>

      <div className="grid grid-cols-12 gap-4 items-end">
        {/* Product Search Field */}
        <div className="col-span-4 relative" ref={prodWrapperRef}>
          <label htmlFor="product-search" className="block text-sm font-medium text-gray-700 mb-1">
            Product Name
          </label>
          <div className="relative">
            <input
              type="text"
              value={newItem.productName}
              onFocus={() => {
                setShowProdDropdown(true);
                setHighlightedIndex(0);
              }}
              onChange={(e) => {
                setNewItem({ ...newItem, productName: e.target.value });
                setShowProdDropdown(true);
                setHighlightedIndex(0);
              }}
              onKeyDown={handleKeyDown}
              className={`w-full px-4 py-2.5 border ${formErrors.productName ? 'border-red-500' : 'border-gray-300'
                } rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all pr-10`}
              placeholder="Search for a product..."
              aria-autocomplete="list"
              aria-expanded={showProdDropdown}
              aria-controls="product-options"
            />
            <Search className="absolute right-3 top-3 text-gray-400" size={18} />

            {/* Product Dropdown */}
            {showProdDropdown && (
              <div
                className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto"
                role="listbox"
              >
                {filteredProducts.length > 0 ? (
                  filteredProducts.map((p, index) => (
                    <button
                      key={p.code}
                      role="option"
                      aria-selected={highlightedIndex === index}
                      className={`cursor-pointer w-full text-left px-4 py-3 transition-colors flex items-center justify-between ${highlightedIndex === index
                        ? 'bg-blue-50'
                        : 'hover:bg-gray-50'
                        } ${index === 0 ? 'rounded-t-lg' : ''} ${index === filteredProducts.length - 1 ? 'rounded-b-lg' : ''
                        }`}
                      onClick={() => handleProductSelect(p)}
                      onMouseEnter={() => setHighlightedIndex(index)}
                    >
                      <div>
                        <span className="font-medium block">{formatName(p.name)}</span>
                        {p.size && <span className="text-sm text-gray-600 mt-1">Size: {p.size}</span>}
                      </div>
                      <span className="text-sm font-medium text-gray-700">
                        ₹{(p.selling_price ?? p.sellingPrice ?? 0).toFixed(2)}
                      </span>
                    </button>
                  ))
                ) : (
                  <div className="px-4 py-3 text-gray-500 text-sm">
                    {products.length === 0
                      ? 'Loading products...'
                      : 'No matching products found'}
                  </div>
                )}
              </div>
            )}
          </div>
          {formErrors.productName && (
            <p className="mt-1.5 text-sm text-red-600 flex items-center absolute">
              <AlertCircle size={16} className="mr-1" />
              {formErrors.productName}
            </p>
          )}
        </div>

        {/* Size Field */}
        <div className="col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Size
          </label>
          <input
            type="text"
            value={newItem.size || ''}
            onChange={(e) => setNewItem({ ...newItem, size: e.target.value })}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="e.g., 1 L, 500g"
          />
        </div>

        {/* Quantity Field */}
        <div className="col-span-2">
          <label htmlFor="item-quantity" className="block text-sm font-medium text-gray-700 mb-1">
            Quantity
          </label>
          <input
            type="number"
            min="0.001"
            step="0.001"
            value={newItem.quantity}
            onChange={(e) => setNewItem({ ...newItem, quantity: e.target.value })}
            className={`w-full px-4 py-2.5 border ${formErrors.quantity ? 'border-red-500' : 'border-gray-300'
              } rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
            placeholder="0.000"
          />
          {formErrors.quantity && (
            <p className="mt-1.5 text-sm text-red-600 flex items-center absolute">
              <AlertCircle size={16} className="mr-1" />
              {formErrors.quantity}
            </p>
          )}
        </div>

        {/* Unit Field */}
        <div className="col-span-2">
          <div>
            <label htmlFor="item-unit" className="block text-sm font-medium text-gray-700 mb-1">
              Unit
            </label>
            <select
              value={newItem.packingType}
              onChange={(e) => setNewItem({ ...newItem, packingType: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none bg-white"
            >
              {/* Packing type options from centralized ALLOWED_PACKING_TYPES */}
              {ALLOWED_PACKING_TYPES.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>

        </div>

        {/* Add Button */}
        <div className="col-span-3">
          <button
            onClick={handleAddItem}
            className="cursor-pointer w-full bg-[#05014A] hover:bg-[#0A0A47] text-white px-6 py-2.5 rounded-lg transition-colors flex items-center justify-center space-x-2 font-medium shadow-md hover:shadow-lg"
          >
            <Plus size={20} />
            <span>Add Item</span>
          </button>
        </div>
      </div>
    </div>
  );
};
const order = () => {
  const wrapperRef = useRef(null);  // supplier dropdown wrapper
  const printRef = useRef(null);
  const { orderId: orderNo } = useParams();

  // State declarations
  const [orderItems, setorderItems] = useState([]);
  const [newItem, setNewItem] = useState({
    code: '',
    productName: '',
    size: '',
    quantity: '',
    packingType: 'PCS',
  });
  const [total, setTotal] = useState(0);
  const [products, setProducts] = useState([]);
  const [packing, setPacking] = useState('');
  const [freight, setFreight] = useState('');
  const [riksha, setRiksha] = useState('');
  const [buyer, setBuyer] = useState('');
  const [supplierId, setsupplierId] = useState('');
  const [suppliers, setsuppliers] = useState([]);
  // once suppliers loaded, map id to name if needed
  useEffect(() => {
    if (supplierId && suppliers.length) {
      const cu = suppliers.find(c => c.supplier_id === supplierId);
      if (cu) { setBuyer(cu.name); setAddress(cu.address || ''); setMobileNo(cu.mobile || ''); }
    }
  }, [suppliers, supplierId]);
  const [showCustDropdown, setShowCustDropdown] = useState(false);
  const [mobileNo, setMobileNo] = useState('');
  const [address, setAddress] = useState('');
  const [remark, setRemark] = useState('');
  const [status, setStatus] = useState('Placed');
  const [orderDate, setorderDate] = useState(new Date().toISOString().split('T')[0]);
  const [customorderNo, setCustomorderNo] = useState('');
  const [formErrors, setFormErrors] = useState({});
  const [isEditing, setIsEditing] = useState(false);
  const [isSaved, setIsSaved] = useState(true); // Start with true to show Print by default
  const [currentorderId, setCurrentorderId] = useState(orderNo || '');
  const [editIndex, setEditIndex] = useState(-1);

  // Payment/Advance state
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentType, setPaymentType] = useState('Cash');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const PAYMENT_TYPES = ['Cash', 'UPI', 'Bank', 'Cheque'];

  // Unsaved changes tracking (like Invoice)
  const [originalOrderData, setOriginalOrderData] = useState(null);
  const [isNewOrder, setIsNewOrder] = useState(true);
  const navigate = useNavigate();

  // Check if there are unsaved changes by comparing current state with original
  const isDirty = useMemo(() => {
    // New order with items is always dirty until saved
    if (isNewOrder) {
      return supplierId && orderItems.length > 0;
    }
    // Existing order - compare with original data
    if (!originalOrderData) return false;

    if (remark !== (originalOrderData.remark || '')) return true;
    if (orderDate !== originalOrderData.order_date) return true;
    if (status !== (originalOrderData.status || 'Received')) return true;
    if (parseFloat(paymentAmount || 0) !== parseFloat(originalOrderData.payment_amount || 0)) return true;
    if (paymentType !== (originalOrderData.payment_type || 'Cash')) return true;
    if (paymentDate !== (originalOrderData.payment_date || originalOrderData.order_date)) return true;

    // Compare items
    if (orderItems.length !== originalOrderData.items.length) return true;
    for (let i = 0; i < orderItems.length; i++) {
      const curr = orderItems[i];
      const orig = originalOrderData.items[i];
      if (!orig) return true;
      if (curr.code !== orig.product_code) return true;
      if (parseFloat(curr.quantity) !== parseFloat(orig.quantity)) return true;
    }
    return false;
  }, [isNewOrder, supplierId, orderItems, originalOrderData, remark, orderDate, status, paymentAmount, paymentType, paymentDate]);

  // Backward compatibility for navigation blocker
  const hasUnsavedChanges = useCallback(() => isDirty, [isDirty]);

  // Navigation blocker for unsaved orders
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      hasUnsavedChanges() && currentLocation.pathname !== nextLocation.pathname
  );

  // Helper Functions
  const formatNumber = (value) => {
    return (parseFloat(value) || 0).toFixed(2);
  };

  // Utility to format product name and capitalize
  const formatName = (name) => {
    if (!name) return '';
    return name
      .replace(/-/g, ' ')
      .split(' ')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  };

  // Normalize packing type values to standard set
  const mapPackingType = (rawType) => {
    if (!rawType) return DEFAULT_PACKING_TYPE;
    const trimmed = rawType.toString().trim();
    if (ALLOWED_PACKING_TYPES.includes(trimmed)) return trimmed;
    const upper = trimmed.toUpperCase();
    if (['PC', 'PCS'].includes(upper)) return 'Pc';
    if (['KG', 'KGS'].includes(upper)) return 'Kg';
    if (['DZ', 'DOZ', 'DOZEN'].includes(upper)) return 'Dz';
    if (['BOX', 'BOXES'].includes(upper)) return 'Box';
    if (['KODI'].includes(upper)) return 'Kodi';
    if (['THELI'].includes(upper)) return 'Theli';
    if (['PACKET'].includes(upper)) return 'Packet';
    if (['SET'].includes(upper)) return 'Set';
    return DEFAULT_PACKING_TYPE;
  };

  const calculateGrandTotal = () => {
    const subtotal = total + parseFloat(packing || 0) + parseFloat(freight || 0) + parseFloat(riksha || 0);
    const roundedTotal = Math.round(subtotal);
    const roundOff = roundedTotal - subtotal;

    return {
      subtotal,
      roundOff,
      grandTotal: roundedTotal
    };
  };

  // Sync local state when route param changes
  useEffect(() => {
    setCurrentorderId(orderNo || '');
  }, [orderNo]);

  // Fetch initial data
  useEffect(() => {
    const getNextId = async () => {
      if (!orderNo) {
        try {
          const data = await window.api.invoke('supOrders:getNextId');
          setCustomorderNo(typeof data === 'object' ? data.next_id : data);
        } catch (err) {
          console.error('Error fetching next order id', err);
        }
      } else {
        setCustomorderNo(orderNo);
      }
    };
    getNextId();

    // Fetch suppliers & products
    const fetchInitialData = async () => {
      try {
        const [suppliersData, productsData] = await Promise.all([
          window.api.getSuppliers(),
          window.api.getProducts()
        ]);

        setsuppliers(suppliersData || []);
        setProducts(productsData || []);
      } catch (err) {
        console.error('Error fetching initial data:', err);
      }
    };

    fetchInitialData();
  }, [orderNo]);

  // Load existing order if editing
  useEffect(() => {
    if (orderNo) {
      const fetchorder = async () => {
        try {
          const inv = await window.api.invoke('supOrders:get', orderNo);
          if (inv && !inv.error) {
            const processedItems = inv.items.map((item) => {
              const prod = products.find((p) => p.code === item.product_code) || {};
              const baseName = prod.name || item.product_name || item.product_code;
              const nameWithSpaces = formatName(baseName);
              const quantity = parseFloat(item.quantity).toFixed(2);
              return {
                ...item,
                productName: nameWithSpaces,
                size: prod.size || item.size || '',
                code: item.product_code,
                quantity,
                packingType: mapPackingType(prod.packing_type || item.packing_type || '')
              };
            });

            setorderItems(processedItems);
            setCurrentorderId(inv.order_id || orderNo);
            setsupplierId(inv.supplier_id);

            // Look up supplier details from suppliers list
            const supplier = suppliers.find(s => s.supplier_id === inv.supplier_id);
            if (supplier) {
              setBuyer(supplier.name || inv.supplier_id); // Use name, fallback to ID
              setMobileNo(supplier.mobile || '');
              setAddress(supplier.address || '');
            } else {
              setBuyer(inv.supplier_id); // Fallback if supplier not found
            }

            setRemark(inv.remark || '');
            setorderDate(inv.order_date);
            setPacking(inv.packing || '');
            setFreight(inv.freight || '');
            setRiksha(inv.riksha || '');
            setStatus(inv.status || 'Received');

            // Load payment info if exists
            if (inv.payment_amount && inv.payment_amount > 0) {
              setPaymentAmount(inv.payment_amount.toString());
              setPaymentType(inv.payment_type || 'Cash');
              setPaymentDate(inv.payment_date || inv.order_date);
            } else {
              setPaymentAmount('');
              setPaymentType('Cash');
              setPaymentDate(inv.order_date);
            }

            // Store original data for unsaved changes detection
            setOriginalOrderData(inv);
            setIsNewOrder(false);
          }
        } catch (err) {
          console.error('Error loading order:', err);
        }
      };
      fetchorder();
    }
  }, [orderNo, products]);

  // Calculate total whenever items change
  useEffect(() => {
    const sum = orderItems.reduce((acc, item) => {
      return acc + (parseFloat(item.amount) || 0);
    }, 0);
    setTotal(sum);
  }, [orderItems]);

  // Click outside handler for dropdowns
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setShowCustDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Watch for changes in supplierId to toggle editing state
  useEffect(() => {
    if (supplierId) {
      setIsEditing(true);
      setIsSaved(false);
    }
  }, [supplierId]);

  // Watch for changes in any form inputs to toggle editing state
  useEffect(() => {
    const handleFormChange = () => {
      if (isSaved && supplierId) {
        setIsEditing(true);
        setIsSaved(false);
      }
    };

    const formInputs = document.querySelectorAll('input, select, textarea');
    formInputs.forEach(input => {
      input.addEventListener('change', handleFormChange);
    });

    return () => {
      formInputs.forEach(input => {
        input.removeEventListener('change', handleFormChange);
      });
    };
  }, [isSaved, supplierId]);

  // Handler Functions
  const validateForm = () => {
    const errors = {};
    if (!newItem.productName) errors.productName = 'Product is required';
    if (!newItem.quantity) errors.quantity = 'Quantity is required';


    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleAddItem = () => {
    if (!validateForm()) return;

    const quantity = parseFloat(newItem.quantity);
    const sellingPrice = 0;

    if (isNaN(quantity) || quantity <= 0) {
      toast.error('Please enter valid Quantity');
      return;
    }

    const amount = quantity * sellingPrice;

    const neworderItem = {
      code: newItem.code,
      product_code: newItem.code,
      productName: newItem.productName,
      size: newItem.size || '',
      quantity: quantity.toFixed(2),
      packingType: newItem.packingType,
    };

    if (editIndex > -1) {
      const updated = [...orderItems];
      updated[editIndex] = neworderItem;
      setorderItems(updated);
      setEditIndex(-1);
      toast.success('Item updated successfully');
    } else {
      setorderItems([...orderItems, neworderItem]);
      toast.success('Item added successfully');
    }
    setNewItem({
      code: '',
      productName: '',
      size: '',
      quantity: '',
      packingType: 'PCS',
    });
    setFormErrors({});
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleEditItem = (index) => {
    const item = orderItems[index];
    setNewItem({
      code: item.code,
      productName: item.productName,
      size: item.size || '',
      quantity: item.quantity,
      packingType: item.packingType,
    });
    setEditIndex(index);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteItem = (indexToDelete) => {
    setorderItems(orderItems.filter((_, index) => index !== indexToDelete));
    setIsEditing(true);
    setIsSaved(false);
    toast.success('Item deleted successfully');
  };

  const handleSelectsupplier = (cust) => {
    setBuyer(cust.name);
    setsupplierId(cust.supplier_id);
    setAddress(cust.address);
    setMobileNo(cust.mobile);
    setShowCustDropdown(false);
  };

  const handleSave = async () => {
    if (!supplierId) {
      toast.error('Please select a valid supplier');
      return;
    }
    if (orderItems.length === 0) {
      toast.error('Add at least one item');
      return;
    }

    // No monetary fields needed for supplier orders

    const payload = {
      supplier_id: supplierId,
      order_date: orderDate,
      remark,
      status,
      items: orderItems.map(i => ({
        product_code: i.code || i.product_code,
        quantity: parseFloat(i.quantity)
      })),
      // Payment/Advance fields
      payment_amount: parseFloat(paymentAmount || 0),
      payment_type: paymentType,
      payment_date: paymentDate || orderDate
    };

    try {
      let data;
      if (currentorderId) {
        data = await window.api.invoke('supOrders:update', { id: currentorderId, ...payload });
      } else {
        data = await window.api.invoke('supOrders:create', payload);
      }

      // Explicit success check - only proceed if backend confirms success
      if (!data || data.error || data.success === false) {
        toast.error(data?.error || 'An error occurred while saving. Please try again.');
        return; // Keep data, do NOT clear or navigate
      }

      // Only on confirmed success
      toast.success(`Order saved successfully (ID: ${data.order_id || currentorderId})`);
      const savedOrderId = data.order_id || currentorderId;
      // if it was a create request, persist the returned id for future updates
      if (!currentorderId && data.order_id) {
        setCurrentorderId(data.order_id);
        setCustomorderNo(data.order_id);
      }

      // Update original data to reflect saved state (makes isDirty = false)
      setOriginalOrderData({
        ...payload,
        order_id: savedOrderId,
        items: orderItems.map(i => ({
          product_code: i.code || i.product_code,
          quantity: parseFloat(i.quantity)
        }))
      });
      setIsNewOrder(false);

      setIsSaved(true);
      setIsEditing(false);
    } catch (err) {
      console.error('Error saving order:', err);
      toast.error('An error occurred while saving. Please try again.');
      // Keep data, do NOT clear or navigate
    }
  };

  const handleDelete = async () => {
    if (!currentorderId) {
      toast.error('No order to delete');
      return;
    }

    try {
      const result = await window.api.invoke('supOrders:delete', currentorderId);

      // Explicit success check
      if (!result || result.error || result.success === false) {
        toast.error(result?.error || 'An error occurred while deleting. Please try again.');
        return; // Keep UI state, do NOT navigate
      }

      // Only on confirmed success
      toast.success('Order deleted successfully');
      navigate('/orders/suppliers');
    } catch (err) {
      console.error('Error deleting order:', err);
      toast.error('An error occurred while deleting. Please try again.');
      // Keep UI state, do NOT navigate
    }
  };

  const handlePrint = () => {
    const originalTitle = document.title;
    if (supplierId && customorderNo) {
      document.title = `${supplierId} ${customorderNo}`;
    }
    // just trigger browser print; @media print styles handle visibility
    window.print();
    document.title = originalTitle;
  };

  const { roundOff, grandTotal } = calculateGrandTotal();
  return (
    <div className="p-2 sm:p-6 min-h-screen bg-gray-50 print:bg-white print:p-0 print:text-black">
      {/* Navigation Warning Modal */}
      {blocker.state === 'blocked' && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100] print:hidden">
          <div className="bg-white rounded-xl shadow-2xl p-6 max-w-md mx-4 transform transition-all">
            <div className="flex items-center justify-center mb-4">
              <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
                <AlertTriangle className="text-yellow-600" size={24} />
              </div>
            </div>
            <h2 className="text-xl font-bold text-gray-800 text-center mb-2">
              Unsaved Changes
            </h2>
            <p className="text-gray-600 text-center mb-6">
              This order is not saved. Do you want to leave this page?
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => blocker.reset()}
                className="flex-1 px-4 py-2.5 rounded-lg bg-[#05014A] text-white font-medium hover:bg-[#0A0A47] transition-colors cursor-pointer"
              >
                Stay on Page
              </button>
              <button
                onClick={() => blocker.proceed()}
                className="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-colors cursor-pointer"
              >
                Leave Without Saving
              </button>
            </div>
          </div>
        </div>
      )}
      <div
        ref={printRef}
        className="max-w-[1040px] mx-auto bg-white shadow-lg rounded-lg overflow-hidden print:shadow-none print:rounded-none print:w-[210mm] print:min-h-[297mm]"
      >
        {/* Header Section */}
        <div className="p-3 sm:p-6 border-b print:p-4">
          <div className="text-center mb-4">
            <h1 className="text-2xl sm:text-3xl font-bold text-[#05014A]">Supplier Order</h1>
          </div>
          {/* order Details and supplier Section */}
          <div className="flex flex-col sm:flex-row justify-between mb-4">
            <div className="mb-2 sm:mb-0">
              <p className="font-semibold">
                <span className="text-gray-600">Order No.: </span>
                {customorderNo || '...'}
              </p>
            </div>
            <div>
              <p className="font-semibold">
                <span className="text-gray-600">Order Date: </span>
                <input
                  type="date"
                  value={orderDate}
                  onChange={(e) => setorderDate(e.target.value)}
                  className="border rounded px-2 py-1 print:border-none print:bg-transparent"
                />
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-3">
            <div className="space-y-2">
              {/* supplier Selection */}
              <div className="flex items-center relative" ref={wrapperRef}>
                <label className="inline-block w-28 text-sm font-medium text-gray-700 mr-2">Supplier:</label>
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={buyer}
                    onFocus={() => setShowCustDropdown(true)}
                    onChange={(e) => {
                      const name = e.target.value;
                      setBuyer(name);
                      setShowCustDropdown(true);
                      const cust = suppliers.find(c => c.name.toLowerCase() === name.toLowerCase());
                      if (cust) {
                        setsupplierId(cust.supplier_id);
                        setAddress(cust.address);
                        setMobileNo(cust.mobile);
                      } else {
                        setsupplierId('');
                      }
                    }}
                    className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                    placeholder="Search supplier..."
                  />
                  {showCustDropdown && (
                    <ul className="absolute z-50 w-full mt-1 max-h-60 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg">
                      {suppliers
                        .filter((c) => c.name.toLowerCase().includes(buyer.toLowerCase()))
                        .map((c) => (
                          <li
                            key={c.supplier_id}
                            className="px-4 py-2 hover:bg-blue-50 cursor-pointer text-sm"
                            onClick={() => handleSelectsupplier(c)}
                          >
                            {c.name}
                          </li>
                        ))}
                      {suppliers.filter((c) => c.name.toLowerCase().includes(buyer.toLowerCase())).length === 0 && (
                        <li className="px-4 py-2 text-gray-500 text-sm">No suppliers found</li>
                      )}
                    </ul>
                  )}
                </div>
              </div>

              {/* Mobile Number */}
              <div className="flex items-center">
                <label className="inline-block w-28 text-sm font-medium text-gray-700 mr-2">Mobile No:</label>
                <input
                  type="text"
                  value={mobileNo}
                  onChange={(e) => setMobileNo(e.target.value)}
                  className="flex-1 border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                  placeholder="Enter mobile number"
                />
              </div>
            </div>

            <div className="space-y-2">
              {/* Status */}
              <div className="flex items-center">
                <label className="inline-block w-28 text-sm font-medium text-gray-700 mr-2">Status:</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="flex-1 border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition bg-white print:border-none print:bg-transparent print:p-0 print:m-0 print:outline-none print:appearance-none"
                >
                  <option>Placed</option>
                  <option>Confirmed</option>
                  <option>In Progress</option>
                  <option>Dispatched</option>
                  <option>Received</option>
                  <option>Payment Pending</option>
                  <option>Paid</option>
                  <option>Cancelled</option>
                </select>
              </div>

              {/* Address */}
              <div className="flex items-start">
                <label className="inline-block w-28 text-sm font-medium text-gray-700 mr-2 mt-2">Address:</label>
                <textarea
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="flex-1 border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition resize-none print:border-none print:bg-transparent print:p-0 print:m-0 print:overflow-visible"
                  placeholder="Enter address"
                  rows="2"
                ></textarea>
              </div>

              {/* Remark */}
              <div className="flex items-center">
                <label className="inline-block w-28 text-sm font-medium text-gray-700 mr-2">Remark:</label>
                <input
                  type="text"
                  value={remark}
                  onChange={(e) => setRemark(e.target.value)}
                  className="flex-1 border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                  placeholder="Enter remark"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Items Table Section */}
        <div className="p-3 sm:p-6">
          {/* Add New Item Form */}
          <div className="print:hidden">
            <AddItemForm
              newItem={newItem}
              setNewItem={setNewItem}
              handleAddItem={handleAddItem}
              products={products}
              formErrors={formErrors}
            />
          </div>

          {/* Items Table */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] border-collapse">
              <thead>
                <tr className="bg-gray-50">
                  <th className="border p-3 text-left text-sm font-semibold text-gray-700">S.No.</th>
                  <th className="border p-3 text-left text-sm font-semibold text-gray-700">Item Name</th>
                  <th className="border p-3 text-center text-sm font-semibold text-gray-700">Size</th>
                  <th className="border p-3 text-center text-sm font-semibold text-gray-700">Qty</th>
                  <th className="border p-3 text-center text-sm font-semibold text-gray-700 print:hidden">Action</th>
                </tr>
              </thead>
              <tbody>
                {orderItems.map((item, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="border p-3 text-sm text-gray-600">{index + 1}</td>
                    <td className="border p-3 text-sm text-gray-800 font-medium">{item.productName}</td>
                    <td className="border p-3 text-sm text-gray-600 text-center">{item.size || '-'}</td>
                    <td className="border p-3 text-sm text-gray-600 text-center">
                      {item.quantity} {item.packingType}
                    </td>
                    <td className="border p-3 text-center print:hidden">
                      <div className="flex items-center justify-center space-x-3">
                        <button
                          onClick={() => handleEditItem(index)}
                          className="cursor-pointer text-blue-500 hover:text-blue-700 transition-colors"
                          aria-label="Edit item"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={() => handleDeleteItem(index)}
                          className="cursor-pointer text-red-500 hover:text-red-700 transition-colors"
                          aria-label="Delete item"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Summary Section */}
        <div className="px-6 pb-6">
          <div className="max-w-md ml-auto">
            <div className="bg-gray-50 rounded-xl p-5 border border-gray-200 print:border-none print:bg-transparent">
              {/* Payment/Advance Section */}
              <div className="mb-4 print:hidden">
                <h4 className="font-semibold text-gray-700 mb-3">
                  Payment / Advance Made
                </h4>

                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Amount:</span>
                    <input
                      type="number"
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      className="w-28 text-right border-b border-gray-300 focus:outline-none focus:border-blue-500 px-1"
                      placeholder="0.00"
                      min="0"
                    />
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Type:</span>
                    <select
                      value={paymentType}
                      onChange={(e) => setPaymentType(e.target.value)}
                      className="w-28 text-right border-b border-gray-300 focus:outline-none focus:border-blue-500 bg-transparent"
                    >
                      {PAYMENT_TYPES.map(type => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Date:</span>
                    <input
                      type="date"
                      value={paymentDate}
                      onChange={(e) => setPaymentDate(e.target.value)}
                      className="w-32 text-right border-b border-gray-300 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>

              <div className="print:hidden">
                {isDirty ? (
                  <button
                    onClick={handleSave}
                    className="cursor-pointer mt-6 w-full bg-[#05014A] hover:bg-[#0A0A47] text-white py-3 rounded-lg font-medium flex items-center justify-center transition-colors"
                  >
                    <Save className="mr-2" size={20} />
                    Save Order
                  </button>
                ) : (
                  <button
                    onClick={handlePrint}
                    className="cursor-pointer mt-6 w-full bg-[#05014A] hover:bg-[#0A0A47] text-white py-3 rounded-lg font-medium flex items-center justify-center transition-colors"
                  >
                    <Printer className="mr-2" size={20} />
                    Print Order
                  </button>
                )}

                {/* Delete Order Button with Popup Confirmation */}
                {currentorderId && (
                  <Popup
                    trigger={
                      <button
                        type="button"
                        className="cursor-pointer mt-3 w-full bg-red-600 hover:bg-red-700 text-white py-3 rounded-lg font-medium flex items-center justify-center transition-colors"
                      >
                        <Trash2 className="mr-2" size={20} />
                        Delete Order
                      </button>
                    }
                    modal
                    nested
                    overlayStyle={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
                  >
                    {close => (
                      <div className="relative transform transition-all duration-300 scale-100">
                        <div className="bg-white p-8 rounded-xl shadow-2xl mx-auto border border-gray-100">
                          <div className="mb-6">
                            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                              <Trash2 className="text-red-600" size={24} />
                            </div>
                            <h2 className="text-2xl font-bold text-gray-800 text-center mb-2">
                              Confirm Delete
                            </h2>
                            <p className="text-gray-600 text-center">
                              Are you sure you want to delete this order? This action cannot be undone.
                            </p>
                          </div>

                          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                            <button
                              onClick={close}
                              className="w-full sm:w-auto px-6 py-2.5 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-gray-300 cursor-pointer"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => {
                                handleDelete();
                                close();
                              }}
                              className="w-full sm:w-auto px-6 py-2.5 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transform hover:scale-105 active:scale-95 cursor-pointer"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </Popup>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default order;