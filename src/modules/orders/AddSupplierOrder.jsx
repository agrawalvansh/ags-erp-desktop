import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Printer, Plus, Trash2, Save, Edit, AlertTriangle, X, Search, ArrowLeft, ChevronDown } from 'lucide-react';
import { generateOrderPDF } from './generateOrderPDF';
import { useParams, useNavigate, useBlocker } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { sortProducts, capitalizeWords, generateProductCode, DEFAULT_PACKING_TYPE, ALLOWED_PACKING_TYPES, mapPackingType } from '../../utils/productUtils';
import NavigationWarningModal from '../../components/NavigationWarningModal';
import PrinterSelectionModal from '../../components/PrinterSelectionModal';

// ─── Stitch-styled Add Item Form ───
const AddItemForm = ({ newItem, setNewItem, handleAddItem, products, formErrors, productNameInputRef }) => {
  const [showProdDropdown, setShowProdDropdown] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const prodWrapperRef = useRef(null);
  const sizeInputRef = useRef(null);
  const quantityInputRef = useRef(null);

  // Auto-scroll highlighted item into view
  useEffect(() => {
    if (highlightedIndex >= 0 && showProdDropdown) {
      const el = document.querySelector(`[data-so-prod-index="${highlightedIndex}"]`);
      el?.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightedIndex, showProdDropdown]);

  const filteredProducts = useMemo(() => {
    const filtered = products.filter(p =>
      (p.name || '').toLowerCase().includes(newItem.productName.toLowerCase())
    );
    return sortProducts(filtered, 'name', 'size');
  }, [products, newItem.productName]);

  const formatName = (name) => {
    if (!name) return '';
    return name.replace(/-/g, ' ').split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
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
    <section className="bg-white p-6 rounded-xl border border-[#2563EB]/20 shadow-[0_8px_30px_rgb(37,99,235,0.04)] print:hidden">
      <h3 className="text-xs font-bold text-[#434655] uppercase tracking-wider mb-6">Quick Add Item</h3>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-end">
        {/* Product Name */}
        <div className="lg:col-span-3 space-y-2 relative" ref={prodWrapperRef}>
          <label className="text-[10px] font-bold text-[#434655] uppercase mb-1.5 ml-1">Product Name</label>
          <div className="relative">
            <input
              ref={productNameInputRef}
              type="text"
              value={newItem.productName}
              onFocus={() => { setShowProdDropdown(true); setHighlightedIndex(0); }}
              onChange={(e) => { setNewItem({ ...newItem, productName: e.target.value }); setShowProdDropdown(true); setHighlightedIndex(0); }}
              onKeyDown={handleKeyDown}
              className={`w-full bg-[#F2F4F6] border-none rounded-lg py-2.5 px-3 text-sm focus:bg-white focus:ring-2 focus:ring-[#004AC6]/15 transition-all outline-none ${formErrors.productName ? 'ring-2 ring-[#BA1A1A]/30' : ''}`}
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
                      key={p.code} data-so-prod-index={index} role="option" aria-selected={highlightedIndex === index}
                      className={`cursor-pointer w-full text-left px-4 py-3 transition-colors flex items-center justify-between ${highlightedIndex === index ? 'bg-[#EFF6FF]' : 'hover:bg-[#F2F4F6]'} ${index === 0 ? 'rounded-t-lg' : ''} ${index === filteredProducts.length - 1 ? 'rounded-b-lg' : ''}`}
                      onClick={() => handleProductSelect(p)}
                      onMouseEnter={() => setHighlightedIndex(index)}
                    >
                      <div>
                        <span className="font-medium block text-sm">{formatName(p.name)}</span>
                        {p.size && <span className="text-xs text-[#434655]">Size: {p.size}</span>}
                      </div>
                      <span className="text-xs font-bold text-[#434655]">₹{(() => { const v = parseFloat(p.selling_price ?? p.sellingPrice ?? 0); return Number.isInteger(v) ? v.toString() : v.toFixed(2); })()}</span>
                    </button>
                  ))
                ) : (<div className="p-3 text-sm text-[#434655]">No products found</div>)}
              </div>
            )}
          </div>
          <div className="h-5">
            {formErrors.productName && (
              <p className="text-xs text-[#BA1A1A] flex items-center gap-1 mt-0.5">
                <AlertCircle size={12} />{formErrors.productName}
              </p>
            )}
          </div>
        </div>

        {/* Size */}
        <div className="lg:col-span-1 space-y-2">
          <label className="text-[10px] font-bold text-[#434655] uppercase mb-1.5 ml-1">Size</label>
          <input ref={sizeInputRef} type="text" value={newItem.size || ''} onChange={(e) => setNewItem({ ...newItem, size: e.target.value })} className="w-full bg-[#F2F4F6] border-none rounded-lg py-2.5 px-3 text-sm focus:bg-white focus:ring-2 focus:ring-[#004AC6]/15 transition-all outline-none" placeholder="e.g. 1Kg" />
          <div className="h-5"></div>
        </div>

        {/* Qty */}
        <div className="lg:col-span-1 space-y-2">
          <label className="text-[10px] font-bold text-[#434655] uppercase mb-1.5 ml-1">Qty</label>
          <input
            ref={quantityInputRef} type="number" min="0.001" step="0.001" value={newItem.quantity}
            onChange={(e) => setNewItem({ ...newItem, quantity: e.target.value })}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddItem(); } }}
            className={`w-full bg-[#F2F4F6] border-none rounded-lg py-2.5 px-3 text-sm focus:bg-white focus:ring-2 focus:ring-[#004AC6]/15 transition-all outline-none ${formErrors.quantity ? 'ring-2 ring-[#BA1A1A]/30' : ''}`}
            placeholder="0"
          />
          <div className="h-5">
            {formErrors.quantity && <p className="text-xs text-[#BA1A1A] flex items-center gap-1 mt-0.5"><AlertCircle size={12} />{formErrors.quantity}</p>}
          </div>
        </div>

        {/* Unit */}
        <div className="lg:col-span-1 space-y-2">
          <label className="text-[10px] font-bold text-[#434655] uppercase mb-1.5 ml-1">Unit</label>
          <select value={newItem.packingType} onChange={(e) => setNewItem({ ...newItem, packingType: e.target.value })} className="w-full bg-[#F2F4F6] border-none rounded-lg py-2.5 px-3 text-sm focus:bg-white focus:ring-2 focus:ring-[#004AC6]/15 appearance-none transition-all outline-none">
            {ALLOWED_PACKING_TYPES.map((type) => (<option key={type} value={type}>{type}</option>))}
          </select>
          <div className="h-5"></div>
        </div>

        {/* Item Remark */}
        <div className="lg:col-span-3 space-y-2">
          <label className="text-[10px] font-bold text-[#434655] uppercase mb-1.5 ml-1">Item Remark</label>
          <input type="text" value={newItem.itemRemark || ''} onChange={(e) => setNewItem({ ...newItem, itemRemark: e.target.value })} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddItem(); } }} className="w-full bg-[#F2F4F6] border-none rounded-lg py-2.5 px-3 text-sm focus:bg-white focus:ring-2 focus:ring-[#004AC6]/15 transition-all outline-none" placeholder="Optional note..." />
          <div className="h-5"></div>
        </div>

        {/* Add Button */}
        <div className="lg:col-span-3">
          <button onClick={handleAddItem} className="w-full text-white py-3 rounded-lg font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-all active:scale-95 shadow-md shadow-[#2563EB]/20 cursor-pointer" style={{ background: 'linear-gradient(135deg, #004AC6 0%, #2563EB 100%)' }}>
            <Plus size={16} />
            <span>Add Item</span>
          </button>
          <div className="h-5"></div>
        </div>
      </div>
    </section>
  );
};

// ─── Main Order Component ───
const AddSupplierOrder = () => {
  const wrapperRef = useRef(null);
  const printRef = useRef(null);
  const productNameInputRef = useRef(null);
  const { orderId: orderNo } = useParams();

  // State declarations
  const [orderItems, setorderItems] = useState([]);
  const [newItem, setNewItem] = useState({ code: '', productName: '', size: '', quantity: '', packingType: DEFAULT_PACKING_TYPE, itemRemark: '' });
  const [products, setProducts] = useState([]);
  const [buyer, setBuyer] = useState('');
  const [supplierId, setsupplierId] = useState('');
  const [suppliers, setsuppliers] = useState([]);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteAlsoPayment, setDeleteAlsoPayment] = useState(false);
  const deleteModalRef = useRef(null);

  // Focus the delete modal when it opens
  useEffect(() => {
    if (showDeleteModal) deleteModalRef.current?.focus();
  }, [showDeleteModal]);

  useEffect(() => {
    if (supplierId && suppliers.length) {
      const cu = suppliers.find(c => c.supplier_id === supplierId);
      if (cu) { setBuyer(cu.name); setAddress(cu.address || ''); setMobileNo(cu.mobile || ''); }
    }
  }, [suppliers, supplierId]);

  const [showCustDropdown, setShowCustDropdown] = useState(false);
  const [highlightedCustIndex, setHighlightedCustIndex] = useState(-1);
  const [mobileNo, setMobileNo] = useState('');
  const [address, setAddress] = useState('');
  const [remark, setRemark] = useState('');
  const [status, setStatus] = useState('Placed');
  const [orderDate, setorderDate] = useState(new Date().toISOString().split('T')[0]);
  const [customorderNo, setCustomorderNo] = useState('');
  const [formErrors, setFormErrors] = useState({});
  const [isEditing, setIsEditing] = useState(false);
  const [isSaved, setIsSaved] = useState(true);
  const [currentorderId, setCurrentorderId] = useState(orderNo || '');
  const [editIndex, setEditIndex] = useState(-1);

  // Payment/Advance state
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentType, setPaymentType] = useState('Cash');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const PAYMENT_TYPES = ['Cash', 'UPI', 'Bank', 'Cheque'];

  // Unsaved changes tracking
  const [originalOrderData, setOriginalOrderData] = useState(null);
  const [isNewOrder, setIsNewOrder] = useState(true);
  const navigate = useNavigate();

  const isDirty = useMemo(() => {
    if (isNewOrder) return (supplierId && orderItems.length > 0) || remark.trim() !== '' || parseFloat(paymentAmount || 0) > 0;
    if (!originalOrderData) return false;
    if (remark !== (originalOrderData.remark || '')) return true;
    if (orderDate !== originalOrderData.order_date) return true;
    if (status !== (originalOrderData.status || 'Placed')) return true;
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
  }, [isNewOrder, supplierId, orderItems, originalOrderData, remark, orderDate, status, paymentAmount, paymentType, paymentDate]);

  const hasUnsavedChanges = useCallback(() => isDirty, [isDirty]);
  const blocker = useBlocker(({ currentLocation, nextLocation }) => hasUnsavedChanges() && currentLocation.pathname !== nextLocation.pathname);

  // Warn on page refresh / browser close
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (isDirty) { e.preventDefault(); e.returnValue = ''; }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  const formatName = (name) => {
    if (!name) return '';
    return name.replace(/-/g, ' ').split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };


  useEffect(() => { setCurrentorderId(orderNo || ''); }, [orderNo]);

  useEffect(() => {
    const getNextId = async () => {
      if (!orderNo) {
        try { const data = await window.api.invoke('supOrders:getNextId'); setCustomorderNo(typeof data === 'object' ? data.next_id : data); } catch (err) { console.error('Error fetching next order id', err); }
      } else { setCustomorderNo(orderNo); }
    };
    getNextId();
    const fetchInitialData = async () => {
      try {
        const [suppliersData, productsData] = await Promise.all([window.api.getSuppliers(), window.api.getProducts()]);
        setsuppliers(suppliersData || []); setProducts(productsData || []);
      } catch (err) { console.error('Error fetching initial data:', err); }
    };
    fetchInitialData();
  }, [orderNo]);

  useEffect(() => {
    if (orderNo) {
      const fetchorder = async () => {
        try {
          const orderData = await window.api.invoke('supOrders:get', orderNo);
          if (orderData && !orderData.error) {
            const processedItems = orderData.items.map((item) => {
              const prod = !item.is_temporary ? (products.find((p) => p.code === item.product_code) || {}) : {};
              const baseName = item.product_name || item.resolved_name || prod.name || item.product_code;
              const nameWithSpaces = formatName(baseName);
              const quantity = parseFloat(item.quantity).toFixed(2);
              return { ...item, productName: nameWithSpaces, size: item.product_size || item.resolved_size || prod.size || '', code: item.product_code, quantity, packingType: mapPackingType(item.packing_type || item.resolved_packing_type || prod.packing_type || ''), itemRemark: item.item_remark || '', isTemporary: item.is_temporary === 1 };
            });
            setorderItems(processedItems);
            setCurrentorderId(orderData.order_id || orderNo);
            setsupplierId(orderData.supplier_id);
            const supplier = suppliers.find(s => s.supplier_id === orderData.supplier_id);
            if (supplier) { setBuyer(supplier.name || orderData.supplier_id); setMobileNo(supplier.mobile || ''); setAddress(supplier.address || ''); } else { setBuyer(orderData.supplier_id); }
            setRemark(orderData.remark || '');
            setorderDate(orderData.order_date);
            setStatus(orderData.status || 'Placed');
            if (orderData.payment_amount && orderData.payment_amount > 0) { setPaymentAmount(orderData.payment_amount.toString()); setPaymentType(orderData.payment_type || 'Cash'); setPaymentDate(orderData.payment_date || orderData.order_date); } else { setPaymentAmount(''); setPaymentType('Cash'); setPaymentDate(orderData.order_date); }
            setOriginalOrderData(orderData); setIsNewOrder(false);
          }
        } catch (err) { console.error('Error loading order:', err); }
      };
      fetchorder();
    }
  }, [orderNo, products]);

  useEffect(() => {
    const handleClickOutside = (event) => { if (wrapperRef.current && !wrapperRef.current.contains(event.target)) { setShowCustDropdown(false); setHighlightedCustIndex(-1); } };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Auto-scroll highlighted supplier into view
  useEffect(() => {
    if (highlightedCustIndex >= 0 && showCustDropdown) {
      const el = document.querySelector(`[data-so-cust-index="${highlightedCustIndex}"]`);
      el?.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightedCustIndex, showCustDropdown]);

  useEffect(() => { if (supplierId) { setIsEditing(true); setIsSaved(false); } }, [supplierId]);

  useEffect(() => {
    const handleFormChange = () => { if (isSaved && supplierId) { setIsEditing(true); setIsSaved(false); } };
    const formInputs = document.querySelectorAll('input, select, textarea');
    formInputs.forEach(input => { input.addEventListener('change', handleFormChange); });
    return () => { formInputs.forEach(input => { input.removeEventListener('change', handleFormChange); }); };
  }, [isSaved, supplierId]);

  const validateForm = () => {
    const errors = {};
    if (!newItem.productName) errors.productName = 'Product is required';
    if (!newItem.quantity) {
      errors.quantity = 'Quantity is required';
    } else if (parseFloat(newItem.quantity) <= 0) {
      errors.quantity = 'Please enter valid quantity';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleAddItem = () => {
    if (!validateForm()) return;
    const quantity = parseFloat(newItem.quantity);
    if (isNaN(quantity) || quantity <= 0) { toast.error('Please enter valid Quantity'); return; }
    const isAdHoc = !newItem.code;
    const productCode = isAdHoc ? generateProductCode(newItem.productName, newItem.size) : newItem.code;
    const neworderItem = { code: productCode || null, product_code: productCode || null, productName: newItem.productName, size: newItem.size || '', quantity: quantity.toFixed(2), packingType: newItem.packingType, itemRemark: newItem.itemRemark || '', isTemporary: isAdHoc };
    if (editIndex > -1) { const updated = [...orderItems]; updated[editIndex] = neworderItem; setorderItems(updated); setEditIndex(-1); toast.success('Item updated successfully'); } else { setorderItems([...orderItems, neworderItem]); toast.success('Item added successfully'); }
    setNewItem({ code: '', productName: '', size: '', quantity: '', packingType: DEFAULT_PACKING_TYPE, itemRemark: '' });
    setFormErrors({});
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(() => { productNameInputRef.current?.focus(); }, 100);
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

  const handleSelectsupplier = (cust) => {
    setBuyer(cust.name); setsupplierId(cust.supplier_id); setAddress(cust.address); setMobileNo(cust.mobile); setShowCustDropdown(false); setHighlightedCustIndex(-1);
  };

  const handleSave = async () => {
    if (!supplierId) { toast.error('Please select a valid supplier'); return; }
    if (orderItems.length === 0) { toast.error('Add at least one item'); return; }
    const payAmt = parseFloat(paymentAmount || 0);
    if (payAmt < 0) { toast.error('Payment amount must be positive'); return; }
    const payload = {
      supplier_id: supplierId, order_date: orderDate, remark, status,
      items: orderItems.map(i => ({ product_code: i.code || i.product_code || null, product_name: i.productName || '', product_size: i.size || '', packing_type: i.packingType || '', quantity: parseFloat(i.quantity), item_remark: i.itemRemark || '', is_temporary: i.isTemporary ? 1 : 0 })),
      payment_amount: parseFloat(paymentAmount || 0), payment_type: paymentType, payment_date: paymentDate || orderDate
    };
    try {
      let data;
      if (currentorderId) { data = await window.api.invoke('supOrders:update', { id: currentorderId, ...payload }); } else { data = await window.api.invoke('supOrders:create', payload); }
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
      const result = await window.api.invoke('supOrders:delete', { order_id: currentorderId, deletePayment: deleteAlsoPayment });
      if (!result || result.error || result.success === false) { toast.error(result?.error || 'An error occurred while deleting. Please try again.'); return; }
      
      // Clear dirty state BEFORE navigating so useBlocker allows navigation
      setOriginalOrderData(null);
      setIsNewOrder(true);
      setorderItems([]);
      setRemark('');
      setPaymentAmount('');
      
      setShowDeleteModal(false);
      setDeleteAlsoPayment(false);
      toast.success(deleteAlsoPayment ? 'Order & payment entry deleted' : 'Order deleted (payment kept in ledger)');
      setTimeout(() => { navigate('/orders/suppliers'); }, 500);
    } catch (err) { console.error('Error deleting order:', err); toast.error('An error occurred while deleting. Please try again.'); }
  };

  // Ctrl+S save shortcut (ref-based to avoid stale closure)
  const handleSaveRef = useRef(handleSave);
  handleSaveRef.current = handleSave;
  useEffect(() => {
    const onKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (showDeleteModal) return;
        handleSaveRef.current();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [showDeleteModal]);

  // ─── Printer state ───
  const [showPrinterModal, setShowPrinterModal] = useState(false);
  const [printerList, setPrinterList] = useState([]);
  const [selectedPrinter, setSelectedPrinter] = useState('');
  const [pendingPDFData, setPendingPDFData] = useState(null);
  const [isPrinting, setIsPrinting] = useState(false);

  const showPrinterSelection = (pdfResult) => {
    setPendingPDFData(pdfResult);
    window.api.invoke('print:listPrinters').then((res) => {
      setPrinterList(res.success ? res.printers.filter(p => p && p.trim()) : []);
      setSelectedPrinter('');
      setShowPrinterModal(true);
    }).catch(() => {
      setPrinterList([]);
      setSelectedPrinter('');
      setShowPrinterModal(true);
    });
  };

  const handlePrint = () => {
    try {
      const result = generateOrderPDF({
        orderType: 'Supplier Order',
        orderId: customorderNo,
        orderDate,
        partyName: buyer,
        mobileNo,
        address,
        status,
        remark,
        orderItems,
        printMarathi: false,
        marathiNames: {},
      });
      showPrinterSelection(result);
    } catch (err) {
      console.error('PDF generation failed:', err);
      toast.error('Failed to generate PDF: ' + (err.message || 'Unknown error'));
    }
  };

  const handleConfirmPrint = async () => {
    if (!pendingPDFData) return;
    setIsPrinting(true);
    try {
      const res = await window.api.invoke('print:pdf', {
        pdfBase64: pendingPDFData.pdfBase64,
        printerName: selectedPrinter || undefined,
        fileName: pendingPDFData.fileName,
      });
      if (res.success) {
        toast.success('Print job sent successfully');
      } else {
        toast.error(res.error || 'Failed to print');
      }
    } catch (err) {
      toast.error('Print failed: ' + (err.message || 'Unknown error'));
    } finally {
      setIsPrinting(false);
      setShowPrinterModal(false);
      setPendingPDFData(null);
    }
  };

  const handleDownloadPDF = () => {
    if (!pendingPDFData) return;
    const byteChars = atob(pendingPDFData.pdfBase64);
    const byteNumbers = new Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) {
      byteNumbers[i] = byteChars.charCodeAt(i);
    }
    const blob = new Blob([new Uint8Array(byteNumbers)], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${pendingPDFData.fileName}.pdf`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1000);
    toast.success('PDF downloaded');
    setShowPrinterModal(false);
    setPendingPDFData(null);
  };

  // Status color helper
  const getStatusColor = (s) => {
    const val = (s || '').toLowerCase();
    if (val === 'placed') return 'bg-amber-50 text-amber-700 border-amber-200';
    if (val === 'confirmed') return 'bg-blue-50 text-blue-700 border-blue-200';
    if (val === 'dispatched' || val === 'in progress') return 'bg-indigo-50 text-indigo-700 border-indigo-200';
    if (val === 'paid') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (val === 'cancelled') return 'bg-rose-50 text-rose-700 border-rose-200';
    return 'bg-amber-50 text-amber-700 border-amber-200';
  };

  return (
    <div className="min-h-screen bg-[#F7F9FB] print:bg-white print:p-0 print:text-black">
      {/* Navigation Warning Modal */}
      <NavigationWarningModal blocker={blocker} />

      {/* Printer Selection Modal */}
      <PrinterSelectionModal
        isOpen={showPrinterModal}
        onClose={() => { setShowPrinterModal(false); setPendingPDFData(null); }}
        printers={printerList}
        selectedPrinter={selectedPrinter}
        onSelectPrinter={setSelectedPrinter}
        onPrint={handleConfirmPrint}
        onDownload={handleDownloadPDF}
        isPrinting={isPrinting}
        title="Print Supplier Order"
        subtitle={pendingPDFData?.fileName || 'Supplier Order'}
      />

      {/* ─── Top App Bar ─── */}
      <header className="bg-[#F7F9FB] flex justify-between items-center px-8 py-5 print:hidden">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/orders/suppliers')} className="p-2 hover:bg-[#ECEEF0] rounded-full transition-colors cursor-pointer">
            <ArrowLeft size={20} className="text-[#191C1E]" />
          </button>
          <h2 className="text-xl font-bold text-[#191C1E]">{orderNo ? 'Edit Supplier Order' : 'New Supplier Order'}</h2>
          <span className={`text-xs font-bold px-3 py-1.5 rounded-full border ${getStatusColor(status)}`}>{status}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-[#434655] font-medium">{customorderNo || '...'}</span>
        </div>
      </header>

      {/* ─── Main Content ─── */}
      <main className="px-8 pb-12 max-w-7xl mx-auto space-y-6 print:p-0 print:m-0 print:space-y-2">
        {/* ─── Supplier Details ─── */}
        <section className="bg-white p-8 rounded-xl shadow-sm border border-[#C3C6D7]/10 print:shadow-none print:border-none print:p-0 print:m-0" ref={printRef}>
          {/* Print header */}
          <div className="hidden print:block text-center mb-2">
            <h1 className="text-2xl font-bold">Supplier Order</h1>
            <p className="text-xs text-gray-600">Order No: {customorderNo} | Date: {orderDate}</p>
          </div>

          <h3 className="text-[0.65rem] font-bold text-[#434655] uppercase tracking-[0.1em] mb-6 print:hidden">Supplier Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-6 print:gap-y-2 print:gap-x-4">
            {/* Supplier Name */}
            <div className="flex flex-col space-y-2 relative" ref={wrapperRef}>
              <label className="text-[0.65rem] font-bold text-[#434655] uppercase tracking-[0.05em]">Supplier Name</label>
              <div className="relative">
                <input
                  type="text" value={buyer}
                  onFocus={() => { setShowCustDropdown(true); setHighlightedCustIndex(0); }}
                  onChange={(e) => {
                    const name = e.target.value; setBuyer(name); setShowCustDropdown(true); setHighlightedCustIndex(0);
                    const cust = suppliers.find(c => c.name.toLowerCase() === name.toLowerCase());
                    if (cust) { setsupplierId(cust.supplier_id); setAddress(cust.address); setMobileNo(cust.mobile); } else { setsupplierId(''); setAddress(''); setMobileNo(''); }
                  }}
                  onKeyDown={(e) => {
                    if (!showCustDropdown) return;
                    const filteredSupps = suppliers.filter(c => c.name.toLowerCase().includes(buyer.toLowerCase()));
                    switch (e.key) {
                      case 'ArrowDown': e.preventDefault(); setHighlightedCustIndex(prev => Math.min(prev + 1, filteredSupps.length - 1)); break;
                      case 'ArrowUp': e.preventDefault(); setHighlightedCustIndex(prev => Math.max(prev - 1, 0)); break;
                      case 'Enter': e.preventDefault(); if (highlightedCustIndex >= 0 && filteredSupps[highlightedCustIndex]) { handleSelectsupplier(filteredSupps[highlightedCustIndex]); } break;
                      case 'Escape': e.preventDefault(); setShowCustDropdown(false); setHighlightedCustIndex(-1); break;
                    }
                  }}
                  className="w-full bg-[#F2F4F6] border-none rounded-lg py-2.5 px-3 focus:bg-white focus:ring-2 focus:ring-[#004AC6]/15 transition-all text-sm outline-none"
                  placeholder="Search supplier..."
                />
                {buyer ? (
                  <button type="button" tabIndex={-1} onClick={() => { setBuyer(''); setsupplierId(''); setAddress(''); setMobileNo(''); setShowCustDropdown(false); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#434655]/40 hover:text-[#BA1A1A] cursor-pointer transition-colors">
                    <X size={16} />
                  </button>
                ) : (
                  <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#434655]/40" />
                )}
              </div>
              {showCustDropdown && (
                <ul className="absolute z-50 w-full top-full mt-1 overflow-y-auto bg-white border border-[#C3C6D7]/20 rounded-lg shadow-lg" style={{ maxHeight: '9rem' }}>
                  {suppliers.filter((c) => c.name.toLowerCase().includes(buyer.toLowerCase())).map((c, idx) => (
                    <li key={c.supplier_id} data-so-cust-index={idx} className={`px-4 py-2.5 cursor-pointer text-sm font-medium transition-colors ${highlightedCustIndex === idx ? 'bg-[#EFF6FF]' : 'hover:bg-[#F2F4F6]'}`} onClick={() => handleSelectsupplier(c)} onMouseEnter={() => setHighlightedCustIndex(idx)}>{c.name}</li>
                  ))}
                  {suppliers.filter((c) => c.name.toLowerCase().includes(buyer.toLowerCase())).length === 0 && (
                    <li className="px-4 py-2.5 text-[#434655] text-sm">No suppliers found</li>
                  )}
                </ul>
              )}
            </div>

            {/* Mobile Number */}
            <div className="flex flex-col space-y-2">
              <label className="text-[10px] font-bold text-[#434655] uppercase mb-1.5 ml-1">Mobile Number</label>
              <input type="text" value={mobileNo} onChange={(e) => setMobileNo(e.target.value)} className="w-full bg-[#F2F4F6] border-none rounded-lg py-2.5 px-3 text-sm outline-none focus:bg-white focus:ring-2 focus:ring-[#004AC6]/15 transition-all" placeholder="Mobile number" />
            </div>

            {/* Address */}
            <div className="flex flex-col space-y-2">
              <label className="text-[10px] font-bold text-[#434655] uppercase mb-1.5 ml-1">Address</label>
              <textarea value={address} onChange={(e) => setAddress(e.target.value)} className="w-full bg-[#F2F4F6] border-none rounded-lg py-2.5 px-3 text-sm outline-none focus:bg-white focus:ring-2 focus:ring-[#004AC6]/15 transition-all resize-none" placeholder="Address" rows="1" />
            </div>
          </div>
        </section>

        {/* ─── Order Details ─── */}
        <section className="bg-white p-8 rounded-xl shadow-sm border border-[#C3C6D7]/10 print:hidden">
          <h3 className="text-xs font-bold text-[#434655] uppercase tracking-wider mb-6 print:hidden">Order Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-6 print:gap-y-2 print:gap-x-4">
            {/* Order Date */}
            <div className="flex flex-col space-y-2">
              <label className="text-[10px] font-bold text-[#434655] uppercase mb-1.5 ml-1">Order Date</label>
              <input type="date" value={orderDate} onChange={(e) => setorderDate(e.target.value)} className="w-full bg-[#F2F4F6] border-none rounded-lg py-2.5 px-3 text-sm outline-none focus:bg-white focus:ring-2 focus:ring-[#004AC6]/15 transition-all" />
            </div>

            {/* Status */}
            <div className="flex flex-col space-y-2">
              <label className="text-[10px] font-bold text-[#434655] uppercase mb-1.5 ml-1">Status</label>
              <div className="relative">
                <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full bg-[#F2F4F6] border-none rounded-lg py-2.5 px-3 pr-10 text-sm outline-none focus:bg-white focus:ring-2 focus:ring-[#004AC6]/15 appearance-none cursor-pointer transition-all print:bg-transparent">
                  <option>Placed</option><option>Confirmed</option><option>In Progress</option><option>Dispatched</option><option>Payment Pending</option><option>Paid</option><option>Cancelled</option>
                </select>
                <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#434655] pointer-events-none" />
              </div>
            </div>

            {/* Remark */}
            <div className="flex flex-col space-y-2">
              <label className="text-[10px] font-bold text-[#434655] uppercase mb-1.5 ml-1">Order Remark</label>
              <input type="text" value={remark} onChange={(e) => setRemark(e.target.value)} className="w-full bg-white border border-[#C3C6D7]/20 rounded-lg py-3 px-4 text-sm font-medium outline-none focus:ring-2 focus:ring-[#2563EB]/20" placeholder="Add notes or instructions..." />
            </div>
          </div>
        </section>

        {/* ─── Quick Add Item ─── */}
        <AddItemForm newItem={newItem} setNewItem={setNewItem} handleAddItem={handleAddItem} products={products} formErrors={formErrors} productNameInputRef={productNameInputRef} />

        {/* ─── Items Table ─── */}
        <section className="bg-white rounded-xl overflow-hidden border border-[#C3C6D7]/10 shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-[0.65rem] font-bold text-[#434655] uppercase tracking-widest border-b border-[#C3C6D7]/10">
                  <th className="px-8 py-5 w-16 print:px-2 print:py-1 print:text-[10px]">S.No</th>
                  <th className="px-8 py-5 print:px-2 print:py-1 print:text-[10px]">Item Name</th>
                  <th className="px-8 py-5 print:px-2 print:py-1 print:text-[10px]">Size</th>
                  <th className="px-8 py-5 text-right print:px-2 print:py-1 print:text-[10px]">Qty</th>
                  <th className="px-8 py-5 print:px-2 print:py-1 print:text-[10px]">Unit</th>
                  <th className="px-8 py-5 print:px-2 print:py-1 print:text-[10px]">Remark</th>
                  <th className="px-8 py-5 text-center print:hidden">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#C3C6D7]/5">
                {orderItems.map((item, index) => (
                  <tr key={index} className="hover:bg-[#F2F4F6]/50 transition-colors print:break-inside-avoid print:border-b print:border-gray-200">
                    <td className="px-8 py-5 text-sm text-[#434655] print:px-2 print:py-1 print:text-[10px]">{String(index + 1).padStart(2, '0')}</td>
                    <td className="px-8 py-5 text-sm font-bold text-[#191C1E] print:px-2 print:py-1 print:text-[10px]" style={{ maxWidth: '200px', wordWrap: 'break-word', whiteSpace: 'normal' }}>{item.productName}</td>
                    <td className="px-8 py-5 text-sm text-[#434655] print:px-2 print:py-1 print:text-[10px]">{item.size || '-'}</td>
                    <td className="px-8 py-5 text-sm font-medium text-[#191C1E] text-right print:px-2 print:py-1 print:text-[10px]">{(() => { const n = parseFloat(item.quantity) || 0; if (Number.isInteger(n)) return n.toString(); return n.toFixed(3); })()}</td>
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
        </section>

        {/* ─── Bottom: Payment + Actions ─── */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start print:hidden">
          <div className="bg-white p-8 rounded-xl shadow-sm border border-[#C3C6D7]/10 space-y-6">
            <h4 className="text-[0.65rem] font-bold text-[#434655] uppercase tracking-[0.1em]">Payment / Advance Made</h4>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-[#434655]">Date</span>
                <input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} className="w-40 text-right bg-white border border-[#C3C6D7]/20 rounded-lg py-2 px-3 text-sm font-medium outline-none focus:ring-2 focus:ring-[#2563EB]/20" />
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-[#434655]">Amount (₹)</span>
                <input type="number" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} className="w-32 text-right bg-white border border-[#C3C6D7]/20 rounded-lg py-2 px-3 text-sm font-medium outline-none focus:ring-2 focus:ring-[#2563EB]/20" placeholder="0.00" min="0" />
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-[#434655]">Type</span>
                <div className="relative">
                  <select value={paymentType} onChange={(e) => setPaymentType(e.target.value)} className="w-32 text-center bg-white border border-[#C3C6D7]/20 rounded-lg py-2 px-3 pr-8 text-sm font-medium outline-none focus:ring-2 focus:ring-[#2563EB]/20 appearance-none cursor-pointer">
                    {PAYMENT_TYPES.map(type => (<option key={type} value={type}>{type}</option>))}
                  </select>
                  <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-[#434655] pointer-events-none" />
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
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
              <button onClick={() => setShowDeleteModal(true)} className="w-full bg-[#DC2626] hover:bg-red-700 text-white py-4 rounded-xl font-bold text-base flex items-center justify-center gap-3 transition-all active:scale-[0.98] shadow-lg shadow-[#DC2626]/20 cursor-pointer">
                <Trash2 size={20} /><span>Delete Order</span>
              </button>
            )}
          </div>
        </section>
      </main>

      {/* ─── Delete Confirmation — Stitch Glass Overlay ─── */}
      {showDeleteModal && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 print:hidden outline-none"
          style={{ backdropFilter: 'blur(8px)', backgroundColor: 'rgba(255,255,255,0.7)' }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-order-heading"
          tabIndex={-1}
          ref={deleteModalRef}
          onKeyDown={(e) => { if (e.key === 'Escape') { setShowDeleteModal(false); setDeleteAlsoPayment(false); } }}
          onClick={(e) => { if (e.target === e.currentTarget) { setShowDeleteModal(false); setDeleteAlsoPayment(false); } }}
        >
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-[#C3C6D7]/20 p-8">
            <div className="w-12 h-12 rounded-full bg-red-100/50 flex items-center justify-center text-red-600 mb-6 mx-auto"><Trash2 size={28} /></div>
            <h2 id="delete-order-heading" className="text-2xl font-extrabold text-[#0F172A] tracking-tight mb-3 text-center">Delete Order?</h2>
            <p className="text-[#434655] leading-relaxed mb-6 text-center">Are you sure you want to delete this order? This action cannot be undone.</p>
            {/* Show payment checkbox only when there's a linked payment */}
            {parseFloat(originalOrderData?.payment_amount || 0) > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={deleteAlsoPayment}
                    onChange={(e) => setDeleteAlsoPayment(e.target.checked)}
                    className="w-5 h-5 mt-0.5 rounded border-amber-300 text-red-600 focus:ring-red-500/20 cursor-pointer shrink-0"
                  />
                  <div>
                    <span className="text-sm font-bold text-amber-800 block">Also delete ₹{parseFloat(originalOrderData.payment_amount).toLocaleString('en-IN')} payment from ledger (Jama)</span>
                    <span className="text-xs text-amber-600 mt-1 block">If unchecked, only the order will be deleted. The payment entry will remain in the supplier's account.</span>
                  </div>
                </label>
              </div>
            )}
            <div className="flex items-center gap-3">
              <button onClick={() => { setShowDeleteModal(false); setDeleteAlsoPayment(false); }} className="flex-1 px-6 py-3 bg-[#E6E8EA] text-[#191C1E] font-bold rounded-xl hover:bg-[#E0E3E5] transition-all text-sm cursor-pointer">Cancel</button>
              <button onClick={async () => { await handleDelete(); }} className="flex-1 px-6 py-3 bg-[#DC2626] text-white font-bold rounded-xl shadow-lg shadow-[#DC2626]/20 hover:bg-red-700 active:scale-95 transition-all text-sm cursor-pointer">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AddSupplierOrder;