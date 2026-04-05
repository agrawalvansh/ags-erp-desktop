import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Printer, Plus, Trash2, Save, Edit, AlertTriangle, X, Search, ArrowLeft, ChevronDown } from 'lucide-react';
import { useParams, useNavigate, useBlocker } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { sortProducts, capitalizeWords, generateProductCode, DEFAULT_PACKING_TYPE, ALLOWED_PACKING_TYPES } from '../../utils/productUtils';

// ─── Stitch-styled Add Item Form ───
const AddItemForm = ({ newItem, setNewItem, handleAddItem, products, formErrors }) => {
  const [showProdDropdown, setShowProdDropdown] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const prodWrapperRef = useRef(null);
  const sizeInputRef = useRef(null);
  const quantityInputRef = useRef(null);

  const filteredProducts = useMemo(() => {
    const filtered = products.filter(p =>
      (p.name || '').toLowerCase().includes(newItem.productName.toLowerCase())
    );
    return sortProducts(filtered, 'name', 'size');
  }, [products, newItem.productName]);

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

  const handleProductSelect = (product) => {
    setNewItem({
      ...newItem,
      code: product.code,
      productName: product.name,
      size: product.size || '',
      sellingPrice: (product.selling_price ?? product.sellingPrice ?? 0).toString(),
      packingType: mapPackingType(product.packing_type || product.packingType),
    });
    setShowProdDropdown(false);
    setHighlightedIndex(-1);
  };

  const clearProductSearch = () => {
    setNewItem({ ...newItem, productName: '', code: '', size: '' });
    setShowProdDropdown(false);
    setHighlightedIndex(-1);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); clearProductSearch(); return; }
    if (e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault();
      setShowProdDropdown(false);
      if (newItem.code) { quantityInputRef.current?.focus(); } else { sizeInputRef.current?.focus(); }
      return;
    }
    if (!showProdDropdown) return;
    switch (e.key) {
      case 'ArrowDown': e.preventDefault(); setHighlightedIndex(prev => Math.min(prev + 1, filteredProducts.length - 1)); break;
      case 'ArrowUp': e.preventDefault(); setHighlightedIndex(prev => Math.max(prev - 1, 0)); break;
      case 'Enter': e.preventDefault(); if (highlightedIndex >= 0 && filteredProducts[highlightedIndex]) { handleProductSelect(filteredProducts[highlightedIndex]); } break;
    }
  };

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
    <section className="bg-[#F2F4F6] p-8 rounded-xl border border-[#C3C6D7]/10 print:hidden">
      <h3 className="text-[#434655] font-bold text-[0.65rem] uppercase tracking-[0.1em] mb-6">Quick Add Item</h3>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-end">
        {/* Product Name */}
        <div className="lg:col-span-3 space-y-2 relative" ref={prodWrapperRef}>
          <label className="text-[0.7rem] font-medium text-[#434655]">Product Name</label>
          <div className="relative">
            <input
              type="text"
              value={newItem.productName}
              onFocus={() => { setShowProdDropdown(true); setHighlightedIndex(0); }}
              onChange={(e) => { setNewItem({ ...newItem, productName: e.target.value }); setShowProdDropdown(true); setHighlightedIndex(0); }}
              onKeyDown={handleKeyDown}
              className={`w-full bg-white border-none rounded-lg py-3 px-4 text-sm font-medium focus:ring-2 focus:ring-[#2563EB]/20 outline-none ${formErrors.productName ? 'ring-2 ring-[#BA1A1A]/30' : ''}`}
              placeholder="Start typing product..."
              aria-autocomplete="list"
              aria-expanded={showProdDropdown}
            />
            {newItem.productName ? (
              <button type="button" onClick={clearProductSearch} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#434655]/40 hover:text-[#BA1A1A] cursor-pointer" tabIndex={-1}>
                <X size={16} />
              </button>
            ) : (
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-[#434655]/30" size={16} />
            )}
            {showProdDropdown && (
              <div className="absolute z-50 w-full mt-1 bg-white border border-[#C3C6D7]/20 rounded-lg shadow-lg max-h-60 overflow-y-auto" role="listbox">
                {filteredProducts.length > 0 ? (
                  filteredProducts.map((p, index) => (
                    <button
                      key={p.code} role="option" aria-selected={highlightedIndex === index}
                      className={`cursor-pointer w-full text-left px-4 py-3 transition-colors flex items-center justify-between ${highlightedIndex === index ? 'bg-[#004AC6]/5' : 'hover:bg-[#F2F4F6]'} ${index === 0 ? 'rounded-t-lg' : ''} ${index === filteredProducts.length - 1 ? 'rounded-b-lg' : ''}`}
                      onClick={() => handleProductSelect(p)}
                      onMouseEnter={() => setHighlightedIndex(index)}
                    >
                      <div>
                        <span className="font-medium block text-sm">{p.name}</span>
                        {p.size && <span className="text-xs text-[#434655]">Size: {p.size}</span>}
                      </div>
                      <span className="text-xs font-bold text-[#434655]">₹{(p.selling_price ?? p.sellingPrice ?? 0).toFixed(2)}</span>
                    </button>
                  ))
                ) : (<div></div>)}
              </div>
            )}
          </div>
          {formErrors.productName && (
            <p className="text-xs text-[#BA1A1A] flex items-center gap-1 absolute -bottom-5">
              <AlertCircle size={12} />{formErrors.productName}
            </p>
          )}
        </div>

        {/* Size */}
        <div className="lg:col-span-1 space-y-2">
          <label className="text-[0.7rem] font-medium text-[#434655]">Size</label>
          <input ref={sizeInputRef} type="text" value={newItem.size || ''} onChange={(e) => setNewItem({ ...newItem, size: e.target.value })} className="w-full bg-white border-none rounded-lg py-3 px-4 text-sm font-medium focus:ring-2 focus:ring-[#2563EB]/20 outline-none" placeholder="e.g. 1Kg" />
        </div>

        {/* Qty */}
        <div className="lg:col-span-1 space-y-2 relative">
          <label className="text-[0.7rem] font-medium text-[#434655]">Qty</label>
          <input
            ref={quantityInputRef} type="number" min="0.001" step="0.001" value={newItem.quantity}
            onChange={(e) => setNewItem({ ...newItem, quantity: e.target.value })}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddItem(); } }}
            className={`w-full bg-white border-none rounded-lg py-3 px-4 text-sm font-medium focus:ring-2 focus:ring-[#2563EB]/20 outline-none ${formErrors.quantity ? 'ring-2 ring-[#BA1A1A]/30' : ''}`}
            placeholder="0"
          />
          {formErrors.quantity && <p className="text-xs text-[#BA1A1A] flex items-center gap-1 absolute -bottom-5"><AlertCircle size={12} />{formErrors.quantity}</p>}
        </div>

        {/* Unit */}
        <div className="lg:col-span-1 space-y-2">
          <label className="text-[0.7rem] font-medium text-[#434655]">Unit</label>
          <select value={newItem.packingType} onChange={(e) => setNewItem({ ...newItem, packingType: e.target.value })} className="w-full bg-white border-none rounded-lg py-3 px-3 text-sm font-medium focus:ring-2 focus:ring-[#2563EB]/20 appearance-none outline-none">
            {ALLOWED_PACKING_TYPES.map((type) => (<option key={type} value={type}>{type}</option>))}
          </select>
        </div>

        {/* Item Remark */}
        <div className="lg:col-span-3 space-y-2">
          <label className="text-[0.7rem] font-medium text-[#434655]">Item Remark</label>
          <input type="text" value={newItem.itemRemark || ''} onChange={(e) => setNewItem({ ...newItem, itemRemark: e.target.value })} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddItem(); } }} className="w-full bg-white border-none rounded-lg py-3 px-4 text-sm font-medium focus:ring-2 focus:ring-[#2563EB]/20 outline-none" placeholder="Optional note..." />
        </div>

        {/* Add Button */}
        <div className="lg:col-span-3">
          <button onClick={handleAddItem} className="w-full text-white py-3 rounded-lg font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-all active:scale-95 shadow-md shadow-[#2563EB]/20 cursor-pointer" style={{ background: 'linear-gradient(135deg, #004AC6 0%, #2563EB 100%)' }}>
            <Plus size={16} />
            <span>Add Item</span>
          </button>
        </div>
      </div>
    </section>
  );
};

// ─── Main Order Component ───
const AddCustomerOrder = () => {
  const wrapperRef = useRef(null);
  const printRef = useRef(null);
  const { orderId: orderNo } = useParams();

  const [orderItems, setorderItems] = useState([]);
  const [newItem, setNewItem] = useState({ code: '', productName: '', size: '', quantity: '', packingType: DEFAULT_PACKING_TYPE, itemRemark: '' });
  const [products, setProducts] = useState([]);
  const [buyer, setBuyer] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [customers, setCustomers] = useState([]);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const deleteModalRef = useRef(null);

  // Focus the delete modal when it opens
  useEffect(() => {
    if (showDeleteModal) deleteModalRef.current?.focus();
  }, [showDeleteModal]);

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
  const [isSaved, setIsSaved] = useState(true);
  const [currentorderId, setCurrentorderId] = useState(orderNo || '');
  const [editIndex, setEditIndex] = useState(-1);

  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentType, setPaymentType] = useState('Cash');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const PAYMENT_TYPES = ['Cash', 'UPI', 'Bank', 'Cheque'];

  const [originalOrderData, setOriginalOrderData] = useState(null);
  const [isNewOrder, setIsNewOrder] = useState(true);
  const navigate = useNavigate();

  const isDirty = useMemo(() => {
    if (isNewOrder) return customerId && orderItems.length > 0;
    if (!originalOrderData) return false;
    if (remark !== (originalOrderData.remark || '')) return true;
    if (orderDate !== originalOrderData.order_date) return true;
    if (status !== (originalOrderData.status || 'Received')) return true;
    if (parseFloat(paymentAmount || 0) !== parseFloat(originalOrderData.payment_amount || 0)) return true;
    if (paymentType !== (originalOrderData.payment_type || 'Cash')) return true;
    if (paymentDate !== (originalOrderData.payment_date || originalOrderData.order_date)) return true;
    if (orderItems.length !== originalOrderData.items.length) return true;
    for (let i = 0; i < orderItems.length; i++) {
      const curr = orderItems[i]; const orig = originalOrderData.items[i];
      if (!orig) return true;
      if (curr.code !== orig.product_code) return true;
      if (parseFloat(curr.quantity) !== parseFloat(orig.quantity)) return true;
      if ((curr.itemRemark || '') !== (orig.item_remark || '')) return true;
      if ((curr.packingType || '') !== (orig.packing_type || '')) return true;
    }
    return false;
  }, [isNewOrder, customerId, orderItems, originalOrderData, remark, orderDate, status, paymentAmount, paymentType, paymentDate]);

  const hasUnsavedChanges = useCallback(() => isDirty, [isDirty]);
  const blocker = useBlocker(({ currentLocation, nextLocation }) => hasUnsavedChanges() && currentLocation.pathname !== nextLocation.pathname);

  const formatNumber = (value) => (parseFloat(value) || 0).toFixed(2);
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

  useEffect(() => { setCurrentorderId(orderNo || ''); }, [orderNo]);

  useEffect(() => {
    const getNextId = async () => {
      if (!orderNo) {
        try { const data = await window.api.invoke('cusOrders:getNextId'); setCustomorderNo(typeof data === 'object' ? data.next_id : data); } catch (err) { console.error('Error fetching next order id', err); }
      } else { setCustomorderNo(orderNo); }
    };
    getNextId();
    const fetchInitialData = async () => {
      try {
        const [customersData, productsData] = await Promise.all([window.api.getCustomers(), window.api.getProducts()]);
        setCustomers(customersData || []); setProducts(productsData || []);
      } catch (err) { console.error('Error fetching initial data:', err); }
    };
    fetchInitialData();
  }, [orderNo]);

  useEffect(() => {
    if (orderNo) {
      const fetchorder = async () => {
        try {
          const orderData = await window.api.invoke('cusOrders:get', orderNo);
          if (orderData && !orderData.error) {
            const formatName = (name) => {
              if (!name) return '';
              return name.replace(/-/g, ' ').split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
            };
            const processedItems = orderData.items.map((item) => {
              const prod = !item.is_temporary ? (products.find((p) => p.code === item.product_code) || {}) : {};
              const baseName = item.product_name || item.resolved_name || prod.name || item.product_code;
              const nameWithSpaces = formatName(baseName);
              const quantity = parseFloat(item.quantity).toFixed(2);
              return { ...item, productName: nameWithSpaces, size: item.product_size || item.resolved_size || prod.size || '', code: item.product_code, quantity, packingType: mapPackingType(item.packing_type || item.resolved_packing_type || prod.packing_type || ''), itemRemark: item.item_remark || '', isTemporary: item.is_temporary === 1 };
            });
            setorderItems(processedItems);
            setCurrentorderId(orderData.order_id || orderNo);
            setCustomerId(orderData.customer_id);
            const customer = customers.find(c => c.customer_id === orderData.customer_id);
            if (customer) { setBuyer(customer.name || orderData.customer_id); setMobileNo(customer.mobile || ''); setAddress(customer.address || ''); } else { setBuyer(orderData.customer_id); }
            setRemark(orderData.remark || '');
            setorderDate(orderData.order_date);
            setStatus(orderData.status || 'Received');
            if (orderData.payment_amount && orderData.payment_amount > 0) { setPaymentAmount(orderData.payment_amount.toString()); setPaymentType(orderData.payment_type || 'Cash'); setPaymentDate(orderData.payment_date || orderData.order_date); } else { setPaymentAmount(''); setPaymentType('Cash'); setPaymentDate(orderData.order_date); }
            setOriginalOrderData(orderData); setIsNewOrder(false);
          }
        } catch (err) { console.error('Error loading order:', err); }
      };
      fetchorder();
    }
  }, [orderNo, products]);

  useEffect(() => {
    const handleClickOutside = (event) => { if (wrapperRef.current && !wrapperRef.current.contains(event.target)) { setShowCustDropdown(false); } };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => { if (customerId) { setIsEditing(true); setIsSaved(false); } }, [customerId]);

  useEffect(() => {
    const handleFormChange = () => { if (isSaved && customerId) { setIsEditing(true); setIsSaved(false); } };
    const formInputs = document.querySelectorAll('input, select, textarea');
    formInputs.forEach(input => { input.addEventListener('change', handleFormChange); });
    return () => { formInputs.forEach(input => { input.removeEventListener('change', handleFormChange); }); };
  }, [isSaved, customerId]);

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
    if (isNaN(quantity) || quantity <= 0) { toast.error('Please enter valid Quantity'); return; }
    const isAdHoc = !newItem.code;
    const productCode = isAdHoc ? generateProductCode(newItem.productName, newItem.size) : newItem.code;
    const neworderItem = { code: productCode || null, product_code: productCode || null, productName: newItem.productName, size: newItem.size || '', quantity: quantity.toFixed(3), packingType: newItem.packingType, itemRemark: newItem.itemRemark || '', isTemporary: isAdHoc };
    if (editIndex > -1) { const updated = [...orderItems]; updated[editIndex] = neworderItem; setorderItems(updated); setEditIndex(-1); toast.success('Item updated successfully'); } else { setorderItems([...orderItems, neworderItem]); toast.success('Item added successfully'); }
    setNewItem({ code: '', productName: '', size: '', quantity: '', packingType: DEFAULT_PACKING_TYPE, itemRemark: '' });
    setFormErrors({});
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleEditItem = (index) => {
    const item = orderItems[index];
    setNewItem({ code: item.code, productName: item.productName, size: item.size || '', quantity: item.quantity, packingType: item.packingType, itemRemark: item.itemRemark || '' });
    setEditIndex(index);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteItem = (indexToDelete) => {
    setorderItems(orderItems.filter((_, index) => index !== indexToDelete));
    setIsEditing(true); setIsSaved(false);
    toast.success('Item deleted successfully');
  };

  const handleSelectCustomer = (cust) => {
    setBuyer(cust.name); setCustomerId(cust.customer_id); setAddress(cust.address); setMobileNo(cust.mobile); setShowCustDropdown(false);
  };

  const handleSave = async () => {
    if (!customerId) { toast.error('Please select a valid customer'); return; }
    if (orderItems.length === 0) { toast.error('Add at least one item'); return; }
    const payload = {
      customer_id: customerId, order_date: orderDate, remark, status,
      items: orderItems.map(i => ({ product_code: i.code || i.product_code || null, product_name: i.productName || '', product_size: i.size || '', packing_type: i.packingType || '', quantity: parseFloat(i.quantity), item_remark: i.itemRemark || '', is_temporary: i.isTemporary ? 1 : 0 })),
      payment_amount: parseFloat(paymentAmount || 0), payment_type: paymentType, payment_date: paymentDate || orderDate
    };
    try {
      let data;
      if (currentorderId) { data = await window.api.invoke('cusOrders:update', { id: currentorderId, ...payload }); } else { data = await window.api.invoke('cusOrders:create', payload); }
      if (!data || data.error || data.success === false) { toast.error(data?.error || 'An error occurred while saving. Please try again.'); return; }
      toast.success(`Order saved successfully (ID: ${data.order_id || currentorderId})`);
      const savedOrderId = data.order_id || currentorderId;
      if (!currentorderId && data.order_id) { setCurrentorderId(data.order_id); setCustomorderNo(data.order_id); }
      setOriginalOrderData({ ...payload, order_id: savedOrderId, items: orderItems.map(i => ({ ...i, product_code: i.code || i.product_code, product_size: i.size || '', quantity: parseFloat(i.quantity), item_remark: i.itemRemark || '', packing_type: i.packingType || '' })) });
      setIsNewOrder(false); setIsSaved(true); setIsEditing(false);
    } catch (err) { console.error('Error saving order:', err); toast.error('An error occurred while saving. Please try again.'); }
  };

  const handleDelete = async () => {
    if (!currentorderId) { toast.error('No order to delete'); return; }
    try {
      const result = await window.api.invoke('cusOrders:delete', currentorderId);
      if (!result || result.error || result.success === false) { toast.error(result?.error || 'An error occurred while deleting. Please try again.'); return; }
      setShowDeleteModal(false);
      toast.success('Order deleted successfully');
      setTimeout(() => { navigate('/orders/customers'); }, 500);
    } catch (err) { console.error('Error deleting order:', err); toast.error('An error occurred while deleting. Please try again.'); }
  };

  const handlePrint = () => {
    const originalTitle = document.title;
    if (customerId && customorderNo) { document.title = `${customerId} ${customorderNo}`; }
    window.print();
    document.title = originalTitle;
  };

  const getStatusColor = (s) => {
    const val = (s || '').toLowerCase();
    if (val === 'received') return 'bg-amber-50 text-amber-700 border-amber-200';
    if (val === 'in progress') return 'bg-blue-50 text-blue-700 border-blue-200';
    if (val === 'completed' || val === 'delivered') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (val === 'shipped') return 'bg-indigo-50 text-indigo-700 border-indigo-200';
    if (val === 'waiting for payment') return 'bg-orange-50 text-orange-700 border-orange-200';
    if (val === 'cancelled') return 'bg-rose-50 text-rose-700 border-rose-200';
    return 'bg-amber-50 text-amber-700 border-amber-200';
  };

  return (
    <div className="min-h-screen bg-[#F7F9FB] print:bg-white print:p-0 print:text-black">
      {/* ─── Navigation Warning Modal — Stitch Glass ─── */}
      {blocker.state === 'blocked' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 print:hidden" style={{ backdropFilter: 'blur(8px)', backgroundColor: 'rgba(255,255,255,0.7)' }}>
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-[#C3C6D7]/20 p-8">
            <div className="w-12 h-12 rounded-full bg-amber-100/50 flex items-center justify-center text-amber-600 mb-6 mx-auto">
              <AlertTriangle size={28} />
            </div>
            <h2 className="text-2xl font-extrabold text-[#0F172A] tracking-tight mb-3 text-center">Unsaved Changes</h2>
            <p className="text-[#434655] leading-relaxed mb-8 text-center">This order is not saved. Do you want to leave this page?</p>
            <div className="flex items-center gap-3">
              <button onClick={() => blocker.reset()} className="flex-1 px-6 py-3 font-bold rounded-xl text-sm cursor-pointer text-white shadow-lg shadow-[#004AC6]/20 hover:scale-[1.02] active:scale-95 transition-all" style={{ background: 'linear-gradient(135deg, #004AC6 0%, #2563EB 100%)' }}>Stay on Page</button>
              <button onClick={() => blocker.proceed()} className="flex-1 px-6 py-3 bg-[#E6E8EA] text-[#191C1E] font-bold rounded-xl hover:bg-[#E0E3E5] transition-all text-sm cursor-pointer">Leave</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Top App Bar ─── */}
      <header className="bg-[#F7F9FB] flex justify-between items-center px-8 py-5 print:hidden">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/orders/customers')} className="p-2 hover:bg-[#ECEEF0] rounded-full transition-colors cursor-pointer">
            <ArrowLeft size={20} className="text-[#191C1E]" />
          </button>
          <h2 className="text-xl font-bold text-[#191C1E]">{orderNo ? 'Edit Customer Order' : 'New Customer Order'}</h2>
          <span className={`text-xs font-bold px-3 py-1.5 rounded-full border ${getStatusColor(status)}`}>{status}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-[#434655] font-medium">{customorderNo || '...'}</span>
        </div>
      </header>

      {/* ─── Main Content ─── */}
      <main className="px-8 pb-12 max-w-7xl mx-auto space-y-6 print:p-0 print:m-0 print:space-y-2">
        {/* ─── Customer Info Card ─── */}
        <section className="bg-white p-8 rounded-xl shadow-sm border border-[#C3C6D7]/10 print:shadow-none print:border-none print:p-0 print:m-0" ref={printRef}>
          <div className="hidden print:block text-center mb-2">
            <h1 className="text-2xl font-bold">Customer Order</h1>
            <p className="text-xs text-gray-600">Order No: {customorderNo} | Date: {orderDate}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-x-8 gap-y-6 print:gap-y-2 print:gap-x-4">
            {/* Customer Name */}
            <div className="flex flex-col space-y-2 relative" ref={wrapperRef}>
              <label className="text-[0.65rem] font-bold text-[#434655] uppercase tracking-[0.05em]">Customer Name</label>
              <div className="relative">
                <input
                  type="text" value={buyer}
                  onFocus={() => setShowCustDropdown(true)}
                  onChange={(e) => {
                    const name = e.target.value; setBuyer(name); setShowCustDropdown(true);
                    const cust = customers.find(c => c.name.toLowerCase() === name.toLowerCase());
                    if (cust) { setCustomerId(cust.customer_id); setAddress(cust.address); setMobileNo(cust.mobile); } else { setCustomerId(''); setAddress(''); setMobileNo(''); }
                  }}
                  className="w-full bg-[#ECEEF0] border-none rounded-lg py-3 px-4 focus:ring-2 focus:ring-[#2563EB]/20 transition-all text-sm font-medium outline-none"
                  placeholder="Search customer..."
                />
                {buyer ? (
                  <button type="button" tabIndex={-1} onClick={() => { setBuyer(''); setCustomerId(''); setAddress(''); setMobileNo(''); setShowCustDropdown(false); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#434655]/40 hover:text-[#BA1A1A] cursor-pointer transition-colors">
                    <X size={16} />
                  </button>
                ) : (
                  <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#434655]/40" />
                )}
              </div>
              {showCustDropdown && (
                <ul className="absolute z-50 w-full top-full mt-1 max-h-60 overflow-y-auto bg-white border border-[#C3C6D7]/20 rounded-lg shadow-lg">
                  {customers.filter((c) => c.name.toLowerCase().includes(buyer.toLowerCase())).map((c) => (
                    <li key={c.customer_id} className="px-4 py-2.5 hover:bg-[#004AC6]/5 cursor-pointer text-sm font-medium" onClick={() => handleSelectCustomer(c)}>{c.name}</li>
                  ))}
                  {customers.filter((c) => c.name.toLowerCase().includes(buyer.toLowerCase())).length === 0 && (
                    <li className="px-4 py-2.5 text-[#434655] text-sm">No customers found</li>
                  )}
                </ul>
              )}
            </div>

            {/* Mobile */}
            <div className="flex flex-col space-y-2">
              <label className="text-[0.65rem] font-bold text-[#434655] uppercase tracking-[0.05em]">Mobile Number</label>
              <input type="text" value={mobileNo} onChange={(e) => setMobileNo(e.target.value)} className="w-full bg-[#ECEEF0] border-none rounded-lg py-3 px-4 text-sm font-medium outline-none focus:ring-2 focus:ring-[#2563EB]/20" placeholder="Mobile number" />
            </div>

            {/* Order Date */}
            <div className="flex flex-col space-y-2">
              <label className="text-[0.65rem] font-bold text-[#434655] uppercase tracking-[0.05em]">Order Date</label>
              <input type="date" value={orderDate} onChange={(e) => setorderDate(e.target.value)} className="w-full bg-[#ECEEF0] border-none rounded-lg py-3 px-4 text-sm font-medium outline-none focus:ring-2 focus:ring-[#2563EB]/20" />
            </div>

            {/* Status */}
            <div className="flex flex-col space-y-2">
              <label className="text-[0.65rem] font-bold text-[#434655] uppercase tracking-[0.05em]">Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full bg-[#ECEEF0] border-none rounded-lg py-3 px-4 text-sm font-medium outline-none focus:ring-2 focus:ring-[#2563EB]/20 appearance-none print:bg-transparent">
                <option>Received</option><option>In Progress</option><option>Waiting for Payment</option><option>Completed</option><option>Shipped</option><option>Delivered</option><option>Cancelled</option>
              </select>
            </div>

            {/* Address */}
            <div className="flex flex-col space-y-2 md:col-span-2">
              <label className="text-[0.65rem] font-bold text-[#434655] uppercase tracking-[0.05em]">Address</label>
              <textarea value={address} onChange={(e) => setAddress(e.target.value)} className="w-full bg-[#ECEEF0] border-none rounded-lg py-3 px-4 text-sm font-medium outline-none focus:ring-2 focus:ring-[#2563EB]/20 resize-none" placeholder="Address" rows="2" />
            </div>

            {/* Remark */}
            <div className="flex flex-col space-y-2 md:col-span-2">
              <label className="text-[0.65rem] font-bold text-[#434655] uppercase tracking-[0.05em]">Order Remark</label>
              <input type="text" value={remark} onChange={(e) => setRemark(e.target.value)} className="w-full bg-[#ECEEF0] border-none rounded-lg py-3 px-4 text-sm font-medium outline-none focus:ring-2 focus:ring-[#2563EB]/20" placeholder="Add notes or instructions..." />
            </div>
          </div>
        </section>

        {/* ─── Quick Add Item ─── */}
        <AddItemForm newItem={newItem} setNewItem={setNewItem} handleAddItem={handleAddItem} products={products} formErrors={formErrors} />

        {/* ─── Items Table ─── */}
        <section className="bg-white rounded-xl overflow-hidden border border-[#C3C6D7]/10 shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-[0.65rem] font-bold text-[#434655] uppercase tracking-widest border-b border-[#C3C6D7]/10">
                  <th className="px-8 py-5 w-16 print:px-2 print:py-1 print:text-[8px]">S.No</th>
                  <th className="px-8 py-5 print:px-2 print:py-1 print:text-[8px]">Item Name</th>
                  <th className="px-8 py-5 print:px-2 print:py-1 print:text-[8px]">Size</th>
                  <th className="px-8 py-5 text-right print:px-2 print:py-1 print:text-[8px]">Qty</th>
                  <th className="px-8 py-5 print:px-2 print:py-1 print:text-[8px]">Unit</th>
                  <th className="px-8 py-5 print:px-2 print:py-1 print:text-[8px]">Remark</th>
                  <th className="px-8 py-5 text-center print:hidden">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#C3C6D7]/5">
                {orderItems.map((item, index) => (
                  <tr key={index} className="hover:bg-[#F2F4F6]/50 transition-colors print:break-inside-avoid print:border-b print:border-gray-200">
                    <td className="px-8 py-5 text-sm text-[#434655] print:px-2 print:py-1 print:text-[10px]">{String(index + 1).padStart(2, '0')}</td>
                    <td className="px-8 py-5 text-sm font-bold text-[#191C1E] print:px-2 print:py-1 print:text-[10px]" style={{ maxWidth: '200px', wordWrap: 'break-word', whiteSpace: 'normal' }}>{item.productName}</td>
                    <td className="px-8 py-5 text-sm text-[#434655] print:px-2 print:py-1 print:text-[10px]">{item.size || '-'}</td>
                    <td className="px-8 py-5 text-sm font-medium text-[#191C1E] text-right print:px-2 print:py-1 print:text-[10px]">{item.quantity}</td>
                    <td className="px-8 py-5 text-sm text-[#434655] print:px-2 print:py-1 print:text-[10px]">{item.packingType}</td>
                    <td className="px-8 py-5 text-sm text-[#434655] print:px-2 print:py-1 print:text-[10px]" style={{ maxWidth: '150px', wordWrap: 'break-word', whiteSpace: 'normal' }}>{item.itemRemark || '-'}</td>
                    <td className="px-8 py-5 text-center print:hidden">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => handleEditItem(index)} className="p-2 rounded-lg text-[#434655] hover:text-[#004AC6] hover:bg-white transition-all cursor-pointer"><Edit size={16} /></button>
                        <button onClick={() => handleDeleteItem(index)} className="p-2 rounded-lg text-[#434655] hover:text-[#DC2626] hover:bg-red-50 transition-all cursor-pointer"><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
                {orderItems.length === 0 && (
                  <tr><td colSpan="7" className="px-8 py-12 text-center text-[#434655] text-sm">No items added yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          {orderItems.length > 0 && (
            <div className="px-8 py-4 bg-[#F2F4F6]/50">
              <p className="text-[0.7rem] text-[#434655] italic">Showing {orderItems.length} item{orderItems.length !== 1 ? 's' : ''} in the current order.</p>
            </div>
          )}
        </section>

        {/* ─── Bottom: Payment + Actions ─── */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start print:hidden">
          <div className="bg-white p-8 rounded-xl shadow-sm border border-[#C3C6D7]/10 space-y-6">
            <h4 className="text-[0.65rem] font-bold text-[#434655] uppercase tracking-[0.1em]">Payment / Advance Received</h4>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-[#434655]">Amount (₹)</span>
                <input type="number" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} className="w-32 text-right bg-[#ECEEF0] border-none rounded-lg py-2 px-3 text-sm font-medium outline-none focus:ring-2 focus:ring-[#2563EB]/20" placeholder="0.00" min="0" />
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-[#434655]">Type</span>
                <select value={paymentType} onChange={(e) => setPaymentType(e.target.value)} className="w-28 text-right bg-[#ECEEF0] border-none rounded-lg py-2 px-3 text-sm font-medium outline-none focus:ring-2 focus:ring-[#2563EB]/20 appearance-none">
                  {PAYMENT_TYPES.map(type => (<option key={type} value={type}>{type}</option>))}
                </select>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-[#434655]">Date</span>
                <input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} className="w-40 text-right bg-[#ECEEF0] border-none rounded-lg py-2 px-3 text-sm font-medium outline-none focus:ring-2 focus:ring-[#2563EB]/20" />
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {isDirty ? (
              <button onClick={handleSave} className="w-full text-white py-4 rounded-xl font-bold text-base flex items-center justify-center gap-3 hover:opacity-95 transition-all active:scale-[0.98] shadow-xl shadow-[#004AC6]/20 cursor-pointer" style={{ background: 'linear-gradient(135deg, #004AC6 0%, #2563EB 100%)' }}>
                <Save size={20} /><span>Save Order</span>
              </button>
            ) : (
              <button onClick={handlePrint} className="w-full text-white py-4 rounded-xl font-bold text-base flex items-center justify-center gap-3 hover:opacity-95 transition-all active:scale-[0.98] shadow-xl shadow-[#004AC6]/20 cursor-pointer" style={{ background: 'linear-gradient(135deg, #004AC6 0%, #2563EB 100%)' }}>
                <Printer size={20} /><span>Print Order</span>
              </button>
            )}
            {currentorderId && (
              <button onClick={() => setShowDeleteModal(true)} className="w-full bg-red-600 hover:bg-red-700 text-white py-4 rounded-xl font-bold text-base flex items-center justify-center gap-3 transition-all active:scale-[0.98] shadow-lg shadow-red-600/20 cursor-pointer">
                <Trash2 size={20} /><span>Delete Order</span>
              </button>
            )}
          </div>
        </section>
      </main>

      {/* ─── Delete Confirmation — Stitch Glass Overlay ─── */}
      {showDeleteModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 print:hidden outline-none"
          style={{ backdropFilter: 'blur(8px)', backgroundColor: 'rgba(255,255,255,0.7)' }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-order-heading"
          tabIndex={-1}
          ref={deleteModalRef}
          onKeyDown={(e) => { if (e.key === 'Escape') setShowDeleteModal(false); }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowDeleteModal(false); }}
        >
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-[#C3C6D7]/20 p-8">
            <div className="w-12 h-12 rounded-full bg-red-100/50 flex items-center justify-center text-red-600 mb-6 mx-auto"><Trash2 size={28} /></div>
            <h2 id="delete-order-heading" className="text-2xl font-extrabold text-[#0F172A] tracking-tight mb-3 text-center">Delete Order?</h2>
            <p className="text-[#434655] leading-relaxed mb-8 text-center">Are you sure you want to delete this order? This action cannot be undone.</p>
            <div className="flex items-center gap-3">
              <button onClick={() => setShowDeleteModal(false)} className="flex-1 px-6 py-3 bg-[#E6E8EA] text-[#191C1E] font-bold rounded-xl hover:bg-[#E0E3E5] transition-all text-sm cursor-pointer">Cancel</button>
              <button onClick={async () => { await handleDelete(); }} className="flex-1 px-6 py-3 bg-red-600 text-white font-bold rounded-xl shadow-lg shadow-red-600/20 hover:bg-red-700 hover:scale-[1.02] active:scale-95 transition-all text-sm cursor-pointer">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AddCustomerOrder;