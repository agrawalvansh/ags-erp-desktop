import { useState, useEffect, useRef, useMemo } from 'react';
import { Printer, Plus, Trash2, Save, Edit } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import { Search } from 'lucide-react';
import { toast } from 'react-hot-toast';

// Add Item Form Component
// Improved Add Item Form Component
const AddItemForm = ({ newItem, setNewItem, handleAddItem, products, formErrors }) => {
  const [showProdDropdown, setShowProdDropdown] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const prodWrapperRef = useRef(null);


  // Filter products with memoization
  const filteredProducts = useMemo(() => {
    return products.filter(p =>
      p.name.toLowerCase().includes(newItem.productName.toLowerCase())
    );
  }, [products, newItem.productName]);

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
            <p className="mt-1.5 text-sm text-red-600 flex items-center absolute">
              <AlertCircle size={16} className="mr-1" />
              {formErrors.productName}
            </p>
          )}
        </div>

        {/* Quantity Field */}
        <div className="col-span-3">
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
              {/* Show custom type if not in defaults */}
              {(!['PCS', 'KGS', 'BOX', 'KODI', 'OTHER'].includes(newItem.packingType?.toUpperCase())) && (
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
  const wrapperRef = useRef(null);  // customer dropdown wrapper
  const printRef = useRef(null);
  const { orderId: orderNo } = useParams();

  // State declarations
  const [orderItems, setorderItems] = useState([]);
  const [newItem, setNewItem] = useState({
    code: '',
    productName: '',
    quantity: '',
    packingType: 'PCS',
  });
  const [total, setTotal] = useState(0);
  const [products, setProducts] = useState([]);
  const [packing, setPacking] = useState('');
  const [freight, setFreight] = useState('');
  const [riksha, setRiksha] = useState('');
  const [buyer, setBuyer] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [customers, setCustomers] = useState([]);
  // once customers loaded, map id to name if needed
  useEffect(() => {
    if (customerId && customers.length) {
      const cu = customers.find(c => c.customer_id === customerId);
      if (cu) { setBuyer(cu.name); setAddress(cu.address || ''); setMobileNo(cu.mobile || ''); }
    }
  }, [customers, customerId]);
  const [showCustDropdown, setShowCustDropdown] = useState(false);
  const [mobileNo, setMobileNo] = useState('');
  const [address, setAddress] = useState('');
  const [remark, setRemark] = useState('');
  const [status, setStatus] = useState('Received');
  const [orderDate, setorderDate] = useState(new Date().toISOString().split('T')[0]);
  const [customorderNo, setCustomorderNo] = useState('');
  const [formErrors, setFormErrors] = useState({});
  const [isEditing, setIsEditing] = useState(false);
  const [isSaved, setIsSaved] = useState(true); // Start with true to show Print by default
  const [currentorderId, setCurrentorderId] = useState(orderNo || '');
  const [editIndex, setEditIndex] = useState(-1);

  // Helper Functions
  const formatNumber = (value) => {
    return (parseFloat(value) || 0).toFixed(2);
  };

  // Normalize packing type values to standard set
  const mapPackingType = (rawType) => {
    if (!rawType) return 'PCS';
    const upper = rawType.toString().trim().toUpperCase();
    if (['PC', 'PCS'].includes(upper)) return 'PCS';
    if (['KG', 'KGS'].includes(upper)) return 'KGS';
    if (['DZ', 'DOZ', 'DOZEN'].includes(upper)) return 'DOZEN';
    if (['BOX', 'BOXES'].includes(upper)) return 'BOX';
    if (['KODI'].includes(upper)) return 'KODI';
    return upper;
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
          const data = await window.api.invoke('cusOrders:getNextId');
          setCustomorderNo(typeof data === 'object' ? data.next_id : data);
        } catch (err) {
          console.error('Error fetching next order id', err);
        }
      } else {
        setCustomorderNo(orderNo);
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

        setCustomers(customersData || []);
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
          const inv = await window.api.invoke('cusOrders:get', orderNo);
          if (inv && !inv.error) {
            const formatName = (name) => {
              if (!name) return '';
              return name
                .replace(/-/g, ' ')
                .split(' ')
                .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                .join(' ');
            };
            const processedItems = inv.items.map((item) => {
              const prod = products.find((p) => p.code === item.product_code) || {};
              const baseName = prod.name || item.product_name || item.product_code;
              const nameWithSpaces = formatName(baseName);
              const sizeText = prod.size || item.size ? ` ${prod.size || item.size}` : '';
              const productName = `${nameWithSpaces}${sizeText}`.trim();
              const quantity = parseFloat(item.quantity).toFixed(2);
              return {
                ...item,
                productName,
                code: item.product_code,
                quantity,
                packingType: mapPackingType(prod.packing_type || item.packing_type || ''),
              };
            });

            setorderItems(processedItems);
            setCurrentorderId(inv.order_id || orderNo);
            setBuyer(inv.customer_id);
            setCustomerId(inv.customer_id);
            setRemark(inv.remark || '');
            setorderDate(inv.order_date);
            setPacking(inv.packing || '');
            setFreight(inv.freight || '');
            setRiksha(inv.riksha || '');
            setStatus(inv.status || 'Received');
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
      quantity: quantity.toFixed(3),
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
      quantity: item.quantity,
      packingType: item.packingType,
      sellingPrice: item.sellingPrice,
    });
    setEditIndex(index);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteItem = (indexToDelete) => {
    setorderItems(orderItems.filter((_, index) => index !== indexToDelete));
    // trigger save button visibility
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
    if (orderItems.length === 0) {
      toast.error('Add at least one item');
      return;
    }

    const { grandTotal } = calculateGrandTotal();
    const payload = {
      customer_id: customerId,
      order_date: orderDate,
      remark,
      packing: parseFloat(packing || 0),
      freight: parseFloat(freight || 0),
      riksha: parseFloat(riksha || 0),
      status,
      items: orderItems.map(i => ({
        product_code: i.code || i.product_code,
        quantity: parseFloat(i.quantity)

      }))
    };

    try {
      let data;
      if (currentorderId) {
        data = await window.api.invoke('cusOrders:update', { id: currentorderId, ...payload });
      } else {
        data = await window.api.invoke('cusOrders:create', payload);
      }
      toast.success(`Order saved successfully (ID: ${data.order_id || currentorderId})`);
      // if it was a create request, persist the returned id for future updates
      if (!currentorderId && data.order_id) {
        setCurrentorderId(data.order_id);
        setCustomorderNo(data.order_id);
      }
      setIsSaved(true);
      setIsEditing(false);
    } catch (err) {
      console.error('Error saving order:', err);
      toast.error('Error saving order');
    }
  };

  const handlePrint = () => {
    const originalTitle = document.title;
    if (customerId && customorderNo) {
      document.title = `${customerId} ${customorderNo}`;
    }
    // just trigger browser print; @media print styles handle visibility
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
            <h1 className="text-2xl sm:text-3xl font-bold text-[#05014A]">Customer Order</h1>
          </div>
          {/* order Details and Customer Section */}
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
                    <ul className="absolute z-50 w-full mt-1 max-h-60 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg">
                      {customers
                        .filter((c) => c.name.toLowerCase().includes(buyer.toLowerCase()))
                        .map((c) => (
                          <li
                            key={c.customer_id}
                            className="px-4 py-2 hover:bg-blue-50 cursor-pointer text-sm"
                            onClick={() => handleSelectCustomer(c)}
                          >
                            {c.name}
                          </li>
                        ))}
                      {customers.filter((c) => c.name.toLowerCase().includes(buyer.toLowerCase())).length === 0 && (
                        <li className="px-4 py-2 text-gray-500 text-sm">No customers found</li>
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
                  <option>Received</option>
                  <option>In Progress</option>
                  <option>Waiting for Payment</option>
                  <option>Completed</option>
                  <option>Shipped</option>
                  <option>Delivered</option>
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
                  <th className="border p-3 text-center text-sm font-semibold text-gray-700">Qty</th>


                  <th className="border p-3 text-center text-sm font-semibold text-gray-700 print:hidden">Action</th>
                </tr>
              </thead>
              <tbody>
                {orderItems.map((item, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="border p-3 text-sm text-gray-600">{index + 1}</td>
                    <td className="border p-3 text-sm text-gray-800 font-medium">{item.productName}</td>
                    <td className="border p-3 text-sm text-gray-600 text-center">
                      {item.quantity} {item.packingType}
                    </td>
                    {isEditing ? (
                      <>

                      </>
                    ) : (
                      <></>
                    )}
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
            <div className="bg-gray-50 rounded-xl p-5 border border-gray-200 print:border-none print:bg-transparent print:p-0 print:m-0 print:outline-none print:appearance-none">
              <div className="print:hidden">
                {(isEditing && !isSaved && customerId) ? (
                  <button
                    onClick={handleSave}
                    className="cursor-pointer mt-6 w-full bg-[#05014A] hover:bg-[#0A0A47] text-white py-3 rounded-lg font-medium flex items-center justify-center transition-colors"
                  >
                    <Save className="mr-2" size={20} />
                    Save order
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
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default order;