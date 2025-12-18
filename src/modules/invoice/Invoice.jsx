import { useState, useEffect, useRef, useMemo } from 'react';
import { Printer, Plus, Trash2, Save, Edit } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import { Search } from 'lucide-react';
import { toast } from 'react-hot-toast';

// Add Item Form Component
// Improved Add Item Form Component
const AddItemForm = ({ newItem, setNewItem, handleAddItem, products, formErrors, productNameInputRef }) => {
  const [showProdDropdown, setShowProdDropdown] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const prodWrapperRef = useRef(null);

  const capitalizeWords = (str) => {
    return str.replace(/\b\w/g, (char) => char.toUpperCase());
  };


  // Filter products with memoization
  const filteredProducts = useMemo(() => {
    return products.filter(p =>
      p.name.toLowerCase().includes(newItem.productName.toLowerCase())
    );
  }, [products, newItem.productName]);

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

  // Utility to normalize different packing type values returned from backend and map them to valid dropdown option values
  const mapPackingType = (rawType) => {
    if (!rawType) return 'PCS'; // default fallback
    const upper = rawType.toString().trim().toUpperCase();

    if (['PC', 'PCS'].includes(upper)) return 'PCS';
    if (['KG', 'KGS'].includes(upper)) return 'KGS';
    if (['DZ', 'DOZ', 'DOZEN'].includes(upper)) return 'DOZEN';
    if (['BOX', 'BOXES'].includes(upper)) return 'BOX';
    if (['KODI'].includes(upper)) return 'KODI';

    return upper; // unknown types shown as-is
  };

  const handleProductSelect = (product) => {
    setNewItem({
      ...newItem,
      code: product.code,
      productName: `${product.name}${product.size ? ' ' + product.size : ''}`.trim(),
      sellingPrice: (product.selling_price ?? product.sellingPrice ?? 0).toString(),
      packingType: mapPackingType(product.packing_type || product.packingType),
    });
    setShowProdDropdown(false);
    setHighlightedIndex(-1);
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Product Search Field */}
        <div className="relative" ref={prodWrapperRef}>
          <label htmlFor="product-search" className="block text-sm font-medium text-gray-700 mb-1">
            Product Name
          </label>
          <div className="relative">
            <input
              ref={productNameInputRef}
              // id="product-search"
              type="text"
              value={newItem.productName}
              onFocus={() => {
                setShowProdDropdown(true);
                setHighlightedIndex(0);
              }}
              onChange={(e) => {
                const capitalizedValue = capitalizeWords(e.target.value);
                setNewItem({ ...newItem, productName: capitalizedValue });
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
                // id="product-options"
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
                        <span className="font-medium block">{p.name}</span>
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
            <p className="mt-1.5 text-sm text-red-600 flex items-center">
              <AlertCircle size={16} className="mr-1" />
              {formErrors.productName}
            </p>
          )}
        </div>

        {/* Quantity and Unit Fields */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="item-quantity" className="block text-sm font-medium text-gray-700 mb-1">
              Quantity
            </label>
            <input
              // id="item-quantity"
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
              <p className="mt-1.5 text-sm text-red-600 flex items-center">
                <AlertCircle size={16} className="mr-1" />
                {formErrors.quantity}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="item-unit" className="block text-sm font-medium text-gray-700 mb-1">
              Unit
            </label>
            <select
              value={newItem.packingType}
              onChange={(e) => setNewItem({ ...newItem, packingType: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none bg-white"
            >
              {/* Show custom type if not in defaults */}
              {(!['PCS', 'KGS', 'BOX', 'DOZEN', 'KODI', 'OTHER'].includes(newItem.packingType?.toUpperCase())) && (
                <option value={newItem.packingType}>{newItem.packingType}</option>
              )}

              <option value="PCS">PCS</option>
              <option value="KGS">KGS</option>
              <option value="BOX">Box</option>
              <option value="DOZEN">Dozen</option>
              <option value="KODI">Kodi</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
        </div>

        {/* Rate Field */}
        <div>
          <label htmlFor="item-rate" className="block text-sm font-medium text-gray-700 mb-1">
            Rate (₹)
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">₹</span>
            <input
              // id="item-rate"
              type="number"
              min="0.01"
              step="0.01"
              value={newItem.sellingPrice}
              onChange={(e) => setNewItem({ ...newItem, sellingPrice: e.target.value })}
              className={`w-full pl-8 pr-4 py-2.5 border ${formErrors.sellingPrice ? 'border-red-500' : 'border-gray-300'
                } rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
              placeholder="0.00"
            />
          </div>
          {formErrors.sellingPrice && (
            <p className="mt-1.5 text-sm text-red-600 flex items-center">
              <AlertCircle size={16} className="mr-1" />
              {formErrors.sellingPrice}
            </p>
          )}
        </div>

        {/* Add Button */}
        <div className="flex items-end">
          <button
            onClick={handleAddItem}
            className="cursor-pointer w-full bg-[#05014A] hover:bg-[#0A0A47] text-white px-6 py-3 rounded-lg transition-colors flex items-center justify-center space-x-2 font-medium shadow-md hover:shadow-lg"
          >
            <Plus size={20} />
            <span>Add Item</span>
          </button>
        </div>
      </div>
    </div>
  );
};
const Invoice = () => {
  const wrapperRef = useRef(null);  // customer dropdown wrapper
  const printRef = useRef(null);
  const productNameInputRef = useRef(null);  // product name input field
  const { invoiceNo } = useParams();

  // State declarations
  const [invoiceItems, setInvoiceItems] = useState([]);
  const [newItem, setNewItem] = useState({
    code: '',
    productName: '',
    quantity: '',
    packingType: 'PCS',
    sellingPrice: '',
  });
  const [total, setTotal] = useState(0);
  const [products, setProducts] = useState([]);
  const [packing, setPacking] = useState('');
  const [freight, setFreight] = useState('');
  const [riksha, setRiksha] = useState('');
  const [buyer, setBuyer] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [customers, setCustomers] = useState([]);
  const [showCustDropdown, setShowCustDropdown] = useState(false);
  const [mobileNo, setMobileNo] = useState('');
  const [address, setAddress] = useState('');
  const [remark, setRemark] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [customInvoiceNo, setCustomInvoiceNo] = useState('');
  const [formErrors, setFormErrors] = useState({});
  const [isEditing, setIsEditing] = useState(false);
  const [isSaved, setIsSaved] = useState(true); // Start with true to show Print by default
  const [currentInvoiceId, setCurrentInvoiceId] = useState(invoiceNo || '');
  const [editIndex, setEditIndex] = useState(-1);

  // Helper Functions
  const formatNumber = (value) => {
    return (parseFloat(value) || 0).toFixed(2);
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
    setCurrentInvoiceId(invoiceNo || '');
  }, [invoiceNo]);

  // Fetch initial data
  useEffect(() => {
    const getNextId = async () => {
      if (!invoiceNo) {
        try {
          const data = await window.api.getNextInvoiceId();
          const nextId = typeof data === 'object' && data !== null ? data.next_id : data;
          setCustomInvoiceNo(nextId);
        } catch (err) {
          console.error('Error fetching next invoice id', err);
        }
      } else {
        setCustomInvoiceNo(invoiceNo);
      }
    };
    getNextId();

    // Fetch customers & products
    const fetchInitialData = async () => {
      try {
        const [customersData, productsData] = await Promise.all([
          window.api.getCustomers(),
          window.api.getProducts()
        ]);
        setCustomers(customersData);
        setProducts(productsData);
      } catch (err) {
        console.error('Error fetching initial data:', err);
      }
    };
    fetchInitialData();
  }, [invoiceNo]);

  // Load existing invoice if editing
  useEffect(() => {
    if (invoiceNo) {
      const fetchInvoice = async () => {
        try {
          const inv = await window.api.getInvoice(invoiceNo);
          if (!inv) return;
          //TODO Work on this
          const formatName = (name) => {
            if (!name) return '';
            return name
              .replace(/-/g, ' ') // replace hyphens with spaces
              .split(' ')
              .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
              .join(' ');
          };

          const processedItems = inv.items.map((item) => {
            // Find matching product details (for packing type, size etc.)
            const prod = products.find((p) => p.code === item.product_code) || {};

            // Build product name → Title-cased and include size
            const baseName = prod.name || item.product_name || item.product_code;
            const nameWithSpaces = formatName(baseName);
            const sizeText = prod.size || item.size ? ` ${prod.size || item.size}` : '';
            const productName = `${nameWithSpaces}${sizeText}`.trim();

            // Quantity (numeric, 2 dp)
            const quantity = parseFloat(item.quantity).toFixed(2);

            return {
              ...item,
              productName,
              code: item.product_code,
              quantity,               // keep numeric text only
              packingType: prod.packing_type || item.packing_type || '',
              sellingPrice: parseFloat(item.selling_price).toFixed(2),
              amount: (item.quantity * item.selling_price).toFixed(2),
            };
          });

          setInvoiceItems(processedItems);
          setCurrentInvoiceId(inv.invoice_id || invoiceNo);
          setCustomerId(inv.customer_id);
          setRemark(inv.remark || '');
          setInvoiceDate(inv.invoice_date);
          setPacking(inv.packing || '');
          setFreight(inv.freight || '');
          setRiksha(inv.riksha || '');

          // Try to fetch full customer details
          let cust = customers.find(c => c.customer_id === inv.customer_id);
          if (!cust) {
            try {
              cust = await window.api.invoke('customers:get', inv.customer_id);
            } catch (err) {
              console.error('Error fetching customer details:', err);
            }
            if (cust) {
              setBuyer(cust.name);
              setAddress(cust.address || '');
              setMobileNo(cust.mobile || '');
            } else {
              setBuyer(inv.customer_id); // fallback
            }
          }

        } catch (err) {
          console.error('Error loading invoice:', err);
        }
      };
      fetchInvoice();
    }
  }, [invoiceNo, products]);

  // Calculate total whenever items change
  useEffect(() => {
    const sum = invoiceItems.reduce((acc, item) => {
      return acc + (parseFloat(item.amount) || 0);
    }, 0);
    setTotal(sum);
  }, [invoiceItems]);

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

  // Watch for changes in customerId to toggle editing state
  useEffect(() => {
    if (customerId) {
      setIsEditing(true);
      setIsSaved(false);
    }
  }, [customerId]);

  // Watch for changes in any form inputs to toggle editing state
  useEffect(() => {
    const handleFormChange = () => {
      if (isSaved && customerId) {
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
  }, [isSaved, customerId]);

  // Handler Functions
  const validateForm = () => {
    const errors = {};
    if (!newItem.productName) errors.productName = 'Product is required';
    if (!newItem.quantity) errors.quantity = 'Quantity is required';
    if (!newItem.sellingPrice) errors.sellingPrice = 'Price is required';

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleAddItem = () => {
    if (!validateForm()) return;

    const quantity = parseFloat(newItem.quantity);
    const sellingPrice = parseFloat(newItem.sellingPrice);

    if (isNaN(quantity) || isNaN(sellingPrice) || quantity <= 0 || sellingPrice <= 0) {
      toast.error('Please enter valid quantity and selling price');
      return;
    }

    const amount = quantity * sellingPrice;

    const productCode = newItem.code || newItem.productName;

    const newInvoiceItem = {
      code: productCode,
      product_code: productCode,
      productName: newItem.productName,
      quantity: quantity.toFixed(3),
      packingType: newItem.packingType,
      sellingPrice: sellingPrice.toFixed(2),
      amount: amount.toFixed(2)
    };

    if (editIndex > -1) {
      const updated = [...invoiceItems];
      updated[editIndex] = newInvoiceItem;
      setInvoiceItems(updated);
      setEditIndex(-1);
      toast.success('Item updated successfully');
    } else {
      setInvoiceItems([...invoiceItems, newInvoiceItem]);
      toast.success('Item added successfully');
    }
    setNewItem({
      code: '',
      productName: '',
      quantity: '',
      packingType: 'PCS',
      sellingPrice: ''
    });
    setFormErrors({});
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    setTimeout(() => {
      if (productNameInputRef.current) {
        productNameInputRef.current.focus();
      }
    }, 100);
  };

  const handleEditItem = (index) => {
    const item = invoiceItems[index];
    setNewItem({
      code: item.code,
      productName: item.productName,
      quantity: item.quantity,
      packingType: item.packingType,
      sellingPrice: item.sellingPrice,
    });
    setEditIndex(index);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteItem = (indexToDelete) => {
    setInvoiceItems(invoiceItems.filter((_, index) => index !== indexToDelete));
    // Mark form as dirty so that Save button appears
    setIsEditing(true);
    setIsSaved(false);
    toast.success('Item deleted successfully');
  };

  const handleSelectCustomer = (cust) => {
    setBuyer(cust.name);
    setCustomerId(cust.customer_id);
    setAddress(cust.address);
    setMobileNo(cust.mobile);
    setShowCustDropdown(false);
  };

  const handleSave = async () => {
    if (!customerId) {
      toast.error('Please select a valid customer');
      return;
    }
    if (invoiceItems.length === 0) {
      toast.error('Add at least one item');
      return;
    }

    const { grandTotal } = calculateGrandTotal();
    const payload = {
      customer_id: customerId,
      invoice_date: invoiceDate,
      remark,
      packing: parseFloat(packing || 0),
      freight: parseFloat(freight || 0),
      riksha: parseFloat(riksha || 0),
      grand_total: grandTotal,
      items: invoiceItems.map(i => ({
        product_code: i.code || i.product_code,
        quantity: parseFloat(i.quantity),
        selling_price: parseFloat(i.sellingPrice)
      }))
    };

    try {
      const data = await window.api.invoke(
        currentInvoiceId ? 'invoices:update' : 'invoices:create',
        currentInvoiceId ? { id: currentInvoiceId, ...payload } : payload
      );
      toast.success(`Invoice saved successfully (ID: ${data.invoice_id || currentInvoiceId})`);
      // if it was a create request, persist the returned id for future updates
      if (!currentInvoiceId && data.invoice_id) {
        setCurrentInvoiceId(data.invoice_id);
        setCustomInvoiceNo(data.invoice_id);
      }
      setIsSaved(true);
      setIsEditing(false);
    } catch (err) {
      console.error('Error saving invoice:', err);
      toast.error('Error saving invoice');
    }
  };

  const handlePrint = () => {
    const originalTitle = document.title;
    if (customerId && customInvoiceNo) {
      document.title = `${customerId} ${customInvoiceNo}`;
    }
    window.print();
    document.title = originalTitle;
  };

  const { roundOff, grandTotal } = calculateGrandTotal();
  return (
    <div className="p-2 sm:p-6 min-h-screen bg-gray-50 print:bg-white print:p-0 print:text-black">
      <div
        ref={printRef}
        className="max-w-[1040px] mx-auto bg-white shadow-lg rounded-lg overflow-hidden print:shadow-none print:rounded-none print:w-[210mm] print:min-h-[297mm]"
      >
        {/* Header Section */}
        <div className="p-3 sm:p-6 border-b print:p-4">
          <div className="text-center mb-4">
            <h1 className="text-2xl sm:text-3xl font-bold text-[#05014A]">ESTIMATE</h1>
          </div>
          {/* Invoice Details and Customer Section */}
          <div className="flex flex-col sm:flex-row justify-between mb-4">
            <div className="mb-2 sm:mb-0">
              <p className="font-semibold">
                <span className="text-gray-600">Estimate No.: </span>
                {customInvoiceNo || '...'}
              </p>
            </div>
            <div>
              <p className="font-semibold">
                <span className="text-gray-600">Estimate Date: </span>
                <input
                  type="date"
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                  className="border rounded px-2 py-1 print:border-none print:bg-transparent"
                />
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-3">
            <div className="space-y-2">
              {/* Customer Selection */}
              <div className="flex items-center relative" ref={wrapperRef}>
                <label className="inline-block w-28 text-sm font-medium text-gray-700 mr-2">Customer:</label>
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={buyer}
                    onFocus={() => setShowCustDropdown(true)}
                    onChange={(e) => {
                      const name = e.target.value;
                      setBuyer(name);
                      setShowCustDropdown(true);
                      const cust = customers.find(c => c.name.toLowerCase() === name.toLowerCase());
                      if (cust) {
                        setCustomerId(cust.customer_id);
                        setAddress(cust.address);
                        setMobileNo(cust.mobile);
                      } else {
                        setCustomerId('');
                      }
                    }}
                    className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                    placeholder="Search customer..."
                  />
                  {showCustDropdown && (
                    <ul className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-y-auto" style={{ maxHeight: '9rem' }}>
                      {customers
                        .filter((c) => c.name.toLowerCase().includes(buyer.toLowerCase()))
                        .map((c) => (
                          <li
                            key={c.customer_id}
                            className="px-4 py-3 hover:bg-blue-50 cursor-pointer text-sm transition-colors"
                            onClick={() => handleSelectCustomer(c)}
                          >
                            {c.name}
                          </li>
                        ))}
                      {customers.filter((c) => c.name.toLowerCase().includes(buyer.toLowerCase())).length === 0 && (
                        <li className="px-4 py-3 text-gray-500 text-sm">No customers found</li>
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
              {/* Address */}
              <div className="flex items-start">
                <label className="inline-block w-28 text-sm font-medium text-gray-700 mr-2 mt-2">Address:</label>
                <textarea
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="flex-1 border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition resize-none"
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
              productNameInputRef={productNameInputRef}
            />
          </div>

          {/* Items Table */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] border-collapse">
              <thead>
                <tr className="bg-gray-50">
                  <th className="border p-3 text-left text-sm font-semibold text-gray-700">S.No.</th>
                  <th className="border p-3 text-left text-sm font-semibold text-gray-700">Item Name</th>
                  <th className="border p-3 text-center text-sm font-semibold text-gray-700">Qty</th>
                  <th className="border p-3 text-center text-sm font-semibold text-gray-700">Rate</th>
                  <th className="border p-3 text-center text-sm font-semibold text-gray-700">Amount</th>
                  <th className="border p-3 text-center text-sm font-semibold text-gray-700 print:hidden">Action</th>
                </tr>
              </thead>
              <tbody>
                {invoiceItems.map((item, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="border p-3 text-sm text-gray-600">{index + 1}</td>
                    <td className="border p-3 text-sm text-gray-800 font-medium">{item.productName}</td>
                    <td className="border p-3 text-sm text-gray-600 text-center">
                      {item.quantity} {item.packingType}
                    </td>
                    <td className="border p-3 text-sm text-gray-600 text-center">
                      ₹{formatNumber(item.sellingPrice)}
                    </td>
                    <td className="border p-3 text-sm text-gray-800 font-medium text-center">
                      ₹{formatNumber(item.amount)}
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
            <div className="bg-gray-50 rounded-xl p-5 border border-gray-200">
              <h3 className="font-semibold text-lg text-gray-800 mb-4">Invoice Summary</h3>

              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Subtotal:</span>
                  <span className="font-medium">₹{formatNumber(total)}</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-gray-600">Packing:</span>
                  <input
                    type="number"
                    value={packing}
                    onChange={(e) => setPacking(e.target.value)}
                    className="w-24 text-right border-b border-gray-300 focus:outline-none focus:border-blue-500"
                    placeholder="0.00"
                  />
                </div>

                <div className="flex justify-between">
                  <span className="text-gray-600">Freight:</span>
                  <input
                    type="number"
                    value={freight}
                    onChange={(e) => setFreight(e.target.value)}
                    className="w-24 text-right border-b border-gray-300 focus:outline-none focus:border-blue-500"
                    placeholder="0.00"
                  />
                </div>

                <div className="flex justify-between">
                  <span className="text-gray-600">Riksha:</span>
                  <input
                    type="number"
                    value={riksha}
                    onChange={(e) => setRiksha(e.target.value)}
                    className="w-24 text-right border-b border-gray-300 focus:outline-none focus:border-blue-500"
                    placeholder="0.00"
                  />
                </div>

                <div className="flex justify-between pt-3 border-t border-gray-200">
                  <span className="text-gray-600">Round Off:</span>
                  <span>₹{roundOff.toFixed(2)}</span>
                </div>

                <div className="flex justify-between pt-3 border-t border-gray-300 font-bold text-lg">
                  <span>Grand Total:</span>
                  <span className="text-[#05014A]">₹{grandTotal.toFixed(2)}</span>
                </div>
              </div>

              <div className="print:hidden">
                {(isEditing && !isSaved && customerId) ? (
                  <button
                    onClick={handleSave}
                    className="cursor-pointer mt-6 w-full bg-[#05014A] hover:bg-[#0A0A47] text-white py-3 rounded-lg font-medium flex items-center justify-center transition-colors"
                  >
                    <Save className="mr-2" size={20} />
                    Save Invoice
                  </button>
                ) : (
                  <button
                    onClick={handlePrint}
                    className="cursor-pointer mt-6 w-full bg-[#05014A] hover:bg-[#0A0A47] text-white py-3 rounded-lg font-medium flex items-center justify-center transition-colors"
                  >
                    <Printer className="mr-2" size={20} />
                    Print Invoice
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Invoice;