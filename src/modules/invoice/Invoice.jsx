import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Printer, Plus, Trash2, Save, Edit, AlertTriangle, Languages, CircleX, ArrowLeft, Calculator, SquarePen } from 'lucide-react';
import { useParams, useNavigate, useLocation, useBlocker } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import { Search } from 'lucide-react';
import { toast } from 'react-hot-toast';
import PageLoader from '../../components/PageLoader';
import RecordNotFound from '../../components/RecordNotFound';
import NavigationWarningModal from '../../components/NavigationWarningModal';
import { getLocalDateString } from '../../utils/dateUtils';
import PrinterSelectionModal from '../../components/PrinterSelectionModal';
import { generateInvoicePDF } from './generateInvoicePDF';
import WeightCalculator from '../../utils/WeightCalculator';
import {
  generateProductCode,
  capitalizeWords,
  findProductByNameAndSize,
  ALLOWED_PACKING_TYPES,
  DEFAULT_PACKING_TYPE,
  sortProducts
} from '../../utils/productUtils';
import SelectDropdown from '../../components/SelectDropdown';

// Add Item Form Component
// Improved Add Item Form Component
const AddItemForm = ({ newItem, setNewItem, handleAddItem, products, formErrors, productNameInputRef, onProductSelected }) => {
  const [showProdDropdown, setShowProdDropdown] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [showWeightCalc, setShowWeightCalc] = useState(false);

  // Auto-scroll highlighted item into view
  useEffect(() => {
    if (highlightedIndex >= 0 && showProdDropdown) {
      const el = document.querySelector(`[data-prod-index="${highlightedIndex}"]`);
      el?.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightedIndex, showProdDropdown]);
  const prodWrapperRef = useRef(null);
  const sizeInputRef = useRef(null);
  const quantityInputRef = useRef(null);
  const rateInputRef = useRef(null);


  // Filter and sort products with smart sorting (name A-Z, then numeric size)
  const filteredProducts = useMemo(() => {
    const filtered = products.filter(p =>
      (p.name || '').toLowerCase().includes(newItem.productName.toLowerCase())
    );
    // Use smart sorting: name A-Z, then numeric size value
    return sortProducts(filtered, 'name', 'size');
  }, [products, newItem.productName]);

  // Handle keyboard navigation
  const handleKeyDown = (e) => {
    if (showProdDropdown) {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setHighlightedIndex(prev =>
            Math.min(prev + 1, filteredProducts.length - 1)
          );
          return;
        case 'ArrowUp':
          e.preventDefault();
          setHighlightedIndex(prev => Math.max(prev - 1, 0));
          return;
        case 'Enter':
          e.preventDefault();
          if (highlightedIndex >= 0 && filteredProducts[highlightedIndex]) {
            handleProductSelect(filteredProducts[highlightedIndex]);
          }
          return;
        case 'Escape':
          setShowProdDropdown(false);
          return;
      }
    }
    // Tab from Product Name: DB product → Qty, ad-hoc → Size
    if (e.key === 'Tab' && !e.shiftKey) {
      const isAdHoc = !newItem.code;
      if (isAdHoc) {
        e.preventDefault();
        sizeInputRef.current?.focus();
      } else {
        e.preventDefault();
        quantityInputRef.current?.focus();
      }
    }
  };

  // Use packing type directly from product (no mapping)

  const handleProductSelect = (product) => {
    const productData = {
      ...newItem,
      code: product.code,
      productName: product.name,
      size: product.size || '',
      sellingPrice: (product.selling_price ?? product.sellingPrice ?? 0).toString(),
      packingType: product.packing_type || product.packingType || DEFAULT_PACKING_TYPE,
      originalProduct: product, // Track the originally selected product
    };
    setNewItem(productData);
    if (onProductSelected) {
      onProductSelected(product);
    }
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
    <div className="bg-white p-6 rounded-xl border border-[#2563EB]/20 shadow-[0_8px_30px_rgb(37,99,235,0.04)] mb-8">
      <div className="flex items-center gap-2 mb-5">
        <Plus size={20} className="text-[#2563EB]" />
        <h2 className="text-sm font-bold text-[#191C1E] uppercase tracking-tight">Add New Item</h2>
      </div>

      <div className="grid grid-cols-12 gap-3 items-end">
        {/* Product Name — col-span-4 */}
        <div className="col-span-12 md:col-span-4 relative" ref={prodWrapperRef}>
          <label className="block text-[10px] font-bold text-[#434655] uppercase mb-1.5 ml-1">Product Name</label>
          <div className="relative">
            <input
              ref={productNameInputRef}
              type="text"
              value={newItem.productName}
              onFocus={() => {
                setShowProdDropdown(true);
                setHighlightedIndex(0);
              }}
              onChange={(e) => {
                const capitalizedValue = capitalizeWords(e.target.value);
                setNewItem({ ...newItem, productName: capitalizedValue, code: '' });
                setShowProdDropdown(true);
                setHighlightedIndex(0);
              }}
              onKeyDown={handleKeyDown}
              className={`w-full py-2.5 px-3 bg-[#F2F4F6] border-none rounded-lg text-sm focus:bg-white focus:ring-2 focus:ring-[#004AC6]/15 transition-all pr-10 ${formErrors.productName ? 'ring-2 ring-[#BA1A1A]/30' : ''}`}
              placeholder="Search product..."
              aria-autocomplete="list"
              aria-expanded={showProdDropdown}
              aria-controls="product-options"
            />
            {newItem.productName && (
              <button
                type="button"
                tabIndex={-1}
                onClick={() => {
                  setNewItem({ ...newItem, productName: '', code: '', size: '', sellingPrice: '', packingType: newItem.packingType, originalProduct: null });
                  productNameInputRef.current?.focus();
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#434655] hover:text-red-500 cursor-pointer transition-colors"
                aria-label="Clear product"
              >
                <CircleX size={16} />
              </button>
            )}
            {!newItem.productName && (
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-[#434655]" size={16} />
            )}

            {/* Product Dropdown */}
            {showProdDropdown && (
              <div
                className="absolute z-50 w-full mt-1 bg-white border border-[#C3C6D7]/30 rounded-lg shadow-lg max-h-60 overflow-y-auto"
                role="listbox"
              >
                {filteredProducts.length > 0 ? (
                  filteredProducts.map((p, index) => (
                    <button
                      key={p.code}
                      data-prod-index={index}
                      role="option"
                      aria-selected={highlightedIndex === index}
                      className={`cursor-pointer w-full text-left px-4 py-3 transition-colors flex items-center justify-between text-sm ${highlightedIndex === index
                        ? 'bg-[#EFF6FF]'
                        : 'hover:bg-[#F2F4F6]'
                        } ${index === 0 ? 'rounded-t-lg' : ''} ${index === filteredProducts.length - 1 ? 'rounded-b-lg' : ''}`}
                      onClick={() => handleProductSelect(p)}
                      onMouseEnter={() => setHighlightedIndex(index)}
                    >
                      <div>
                        <span className="font-semibold block text-[#191C1E]">{p.name}</span>
                        {p.size && <span className="text-xs text-[#434655] mt-0.5">{p.size}</span>}
                      </div>
                      <span className="text-xs font-semibold text-[#434655]">
                        ₹{(() => { const v = parseFloat(p.selling_price ?? p.sellingPrice ?? 0); return Number.isInteger(v) ? v.toString() : v.toFixed(2); })()}
                      </span>
                    </button>
                  ))
                ) : newItem.productName.trim() ? (
                  <div className="px-4 py-3 text-sm text-[#2563EB] text-center flex items-center justify-center gap-1.5">
                    <Plus size={14} />
                    <span className="font-medium">New item — will be added to Price List</span>
                  </div>
                ) : null}
              </div>
            )}
          </div>
          <div className="h-5">
            {formErrors.productName && (
              <p className="text-xs text-[#BA1A1A] flex items-center mt-0.5">
                <AlertCircle size={14} className="mr-1" />
                {formErrors.productName}
              </p>
            )}
          </div>
        </div>

        {/* Size — col-span-2 */}
        <div className="col-span-6 md:col-span-2">
          <label className="block text-[10px] font-bold text-[#434655] uppercase mb-1.5 ml-1">Size / Variant</label>
          <input
            ref={sizeInputRef}
            type="text"
            value={newItem.size || ''}
            onChange={(e) => setNewItem({ ...newItem, size: e.target.value })}
            className="w-full py-2.5 px-3 bg-[#F2F4F6] border-none rounded-lg text-sm focus:bg-white focus:ring-2 focus:ring-[#004AC6]/15 transition-all"
            placeholder="e.g. 500g"
          />
          <div className="h-5"></div>
        </div>

        {/* Qty + Unit + Rate — col-span-4 */}
        <div className="col-span-12 md:col-span-4">
          <div className="grid grid-cols-5 gap-2">
            {/* Qty (40%) */}
            <div className="col-span-2">
              <label className="block text-[10px] font-bold text-[#434655] uppercase mb-1.5 ml-1">Qty</label>
              <div className="relative">
                <input
                  ref={quantityInputRef}
                  type="number"
                  min="0.001"
                  step="0.001"
                  value={newItem.quantity}
                  onChange={(e) => setNewItem({ ...newItem, quantity: e.target.value })}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddItem(); } }}
                  className={`w-full py-2.5 px-3 pr-8 bg-[#F2F4F6] border-none rounded-lg text-sm focus:bg-white focus:ring-2 focus:ring-[#004AC6]/15 transition-all ${formErrors.quantity ? 'ring-2 ring-[#BA1A1A]/30' : ''}`}
                  placeholder="0"
                />
                {/* Weight Calculator trigger */}
                <button
                  type="button"
                  onClick={() => setShowWeightCalc(true)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-[#E6E8EA] text-[#434655] hover:text-[#004AC6] transition-colors cursor-pointer"
                  title="Multi-weight calculator"
                >
                  <Calculator size={14} />
                </button>
                <WeightCalculator
                  isOpen={showWeightCalc}
                  onClose={() => setShowWeightCalc(false)}
                  initialValue={newItem.quantity}
                  onComplete={(total) => {
                    setNewItem({ ...newItem, quantity: String(total) });
                    setShowWeightCalc(false);
                    setTimeout(() => quantityInputRef.current?.focus(), 50);
                  }}
                />
              </div>
            </div>

            {/* Unit (20%) */}
            <div className="col-span-1">
              <SelectDropdown
                label="Unit"
                value={newItem.packingType}
                onChange={(e) => setNewItem({ ...newItem, packingType: e.target.value })}
                options={ALLOWED_PACKING_TYPES}
                selectClassName="text-[11px] font-bold text-center"
              />
            </div>

            {/* Rate (40%) */}
            <div className="col-span-2">
              <label className="block text-[10px] font-bold text-[#434655] uppercase mb-1.5 ml-1">Rate (₹)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#434655] text-xs font-bold">₹</span>
                <input
                  ref={rateInputRef}
                  type="number"
                  min="1"
                  step="1"
                  value={newItem.sellingPrice}
                  onChange={(e) => setNewItem({ ...newItem, sellingPrice: e.target.value })}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddItem(); } }}
                  className={`w-full pl-7 py-2.5 pr-2 bg-[#F2F4F6] border-none rounded-lg text-sm focus:bg-white focus:ring-2 focus:ring-[#004AC6]/15 transition-all ${formErrors.sellingPrice ? 'ring-2 ring-[#BA1A1A]/30' : ''}`}
                  placeholder="0.00"
                />
                {newItem.code && (newItem.originalProduct?.updated_at || newItem.originalProduct?.updatedAt) && (
                  <p className="absolute left-1 top-full mt-1 text-[10px] text-[#64748B] font-semibold whitespace-nowrap">
                    Updated: {(() => {
                      const rawDate = newItem.originalProduct?.updated_at || newItem.originalProduct?.updatedAt;
                      if (!rawDate) return '—';
                      try {
                        const d = new Date(rawDate);
                        if (!isNaN(d.getTime())) {
                          return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
                        }
                      } catch {}
                      return '—';
                    })()}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="h-5 flex gap-4 mt-0.5">
            {formErrors.quantity && (
              <p className="text-xs text-[#BA1A1A] flex items-center truncate" title={formErrors.quantity}>
                <AlertCircle size={14} className="mr-1 flex-shrink-0" />
                <span className="truncate">{formErrors.quantity}</span>
              </p>
            )}
            {formErrors.sellingPrice && (
              <p className="text-xs text-[#BA1A1A] flex items-center truncate" title={formErrors.sellingPrice}>
                <AlertCircle size={14} className="mr-1 flex-shrink-0" />
                <span className="truncate">{formErrors.sellingPrice}</span>
              </p>
            )}
          </div>
        </div>



        {/* Add Button — col-span-2 */}
        <div className="col-span-12 md:col-span-2 md:col-start-11">
          <button
            onClick={handleAddItem}
            className="cursor-pointer w-full py-2.5 bg-gradient-to-br from-[#004AC6] to-[#2563EB] text-white font-bold text-sm uppercase rounded-lg shadow-sm hover:opacity-90 transition-all flex items-center justify-center gap-2"
          >
            <Plus size={16} />
            <span>Add Item</span>
          </button>
          <div className="h-5"></div>
        </div>
      </div>
    </div>
  );
};
const Invoice = () => {
  const wrapperRef = useRef(null);
  const printRef = useRef(null);
  const productNameInputRef = useRef(null);
  const { invoiceNo } = useParams();

  // State declarations
  const [invoiceItems, setInvoiceItems] = useState([]);
  const [newItem, setNewItem] = useState({
    code: '',
    productName: '',
    size: '',
    quantity: '',
    packingType: DEFAULT_PACKING_TYPE,
    sellingPrice: '',
    originalProduct: null,
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
  const [highlightedCustIndex, setHighlightedCustIndex] = useState(-1);
  const [mobileNo, setMobileNo] = useState('');
  const [address, setAddress] = useState('');
  const [remark, setRemark] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(getLocalDateString());
  const [customInvoiceNo, setCustomInvoiceNo] = useState('');
  const [formErrors, setFormErrors] = useState({});
  const [isEditing, setIsEditing] = useState(false);
  const [isSaved, setIsSaved] = useState(true); // Start with true to show Print by default
  const [currentInvoiceId, setCurrentInvoiceId] = useState(invoiceNo || '');
  const [editIndex, setEditIndex] = useState(-1);
  const [showNavigationWarning, setShowNavigationWarning] = useState(false);
  const [showCustUpdateModal, setShowCustUpdateModal] = useState(false);
  const pendingSaveRef = useRef(false);
  const custActionRef = useRef(false); // Prevent new-customer modal when selecting/clearing
  const [showNewCustModal, setShowNewCustModal] = useState(false);
  const [similarCustomers, setSimilarCustomers] = useState([]);


  // Payment/Advance state (create flow — single optional payment)
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentType, setPaymentType] = useState('Cash');
  const [paymentDate, setPaymentDate] = useState(getLocalDateString());
  const PAYMENT_TYPES = ['Cash', 'UPI', 'Transfer', 'RTGS'];

  // Multi-payment state (edit flow)
  const [payments, setPayments] = useState([]);
  const [totalPaid, setTotalPaid] = useState(0);
  const [balanceDue, setBalanceDue] = useState(0);
  const [invoiceStatus, setInvoiceStatus] = useState('awaiting_payment');
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [editingPayment, setEditingPayment] = useState(null);
  const [payForm, setPayForm] = useState({
    payment_amount: '',
    payment_type: 'Cash',
    payment_date: getLocalDateString(),
    remark: ''
  });
  const [paymentDueDays, setPaymentDueDays] = useState(0);

  // Time field state
  const [invoiceTime, setInvoiceTime] = useState(new Date().toTimeString().slice(0, 5));

  // Private note checkbox state
  const [isPrivateNote, setIsPrivateNote] = useState(false);

  // ForceNew modal state (when user clicks nav to create new while current has unsaved changes)
  const [showForceNewModal, setShowForceNewModal] = useState(false);

  // Delete modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeletePending, setIsDeletePending] = useState(false);
  const deleteModalRef = useRef(null);

  // Original invoice data for dirty state detection (when editing existing invoice)
  const [originalInvoiceData, setOriginalInvoiceData] = useState(null);
  const [isNewInvoice, setIsNewInvoice] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();

  // Check if there are unsaved changes by comparing current state with original
  const isDirty = useMemo(() => {
    // New invoice with items is always dirty until saved
    if (isNewInvoice) {
      return customerId && invoiceItems.length > 0;
    }

    // Existing invoice - compare with original data
    if (!originalInvoiceData) return false;

    // Compare key fields
    if (remark !== (originalInvoiceData.remark || '')) return true;
    if (invoiceDate !== originalInvoiceData.invoice_date) return true;
    if (parseFloat(packing || 0) !== parseFloat(originalInvoiceData.packing || 0)) return true;
    if (parseFloat(freight || 0) !== parseFloat(originalInvoiceData.freight || 0)) return true;
    if (parseFloat(riksha || 0) !== parseFloat(originalInvoiceData.riksha || 0)) return true;
    if (paymentDueDays !== (originalInvoiceData.payment_due_days || 0)) return true;
    if (invoiceTime !== (originalInvoiceData.invoice_time || '')) return true;
    if ((isPrivateNote ? 1 : 0) !== (originalInvoiceData.is_private_note || 0)) return true;

    // Compare items (simplified - check count and basic values)
    if (invoiceItems.length !== originalInvoiceData.items.length) return true;
    for (let i = 0; i < invoiceItems.length; i++) {
      const curr = invoiceItems[i];
      const orig = originalInvoiceData.items[i];
      if (!orig) return true;
      if (curr.code !== orig.product_code) return true;
      if (parseFloat(curr.quantity) !== parseFloat(orig.quantity)) return true;
      if (parseFloat(curr.sellingPrice) !== parseFloat(orig.selling_price)) return true;
    }

    return false;
  }, [isNewInvoice, customerId, invoiceItems, originalInvoiceData, remark, invoiceDate, packing, freight, riksha, paymentDueDays, invoiceTime, isPrivateNote]);

  // Backward compatibility - keep hasUnsavedChanges for navigation blocker
  const hasUnsavedChanges = useCallback(() => {
    return isDirty;
  }, [isDirty]);

  // Navigation blocker for unsaved invoices
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      hasUnsavedChanges() && currentLocation.pathname !== nextLocation.pathname
  );

  // Reset invoice state to blank
  const resetInvoiceState = useCallback(async () => {
    setInvoiceItems([]);
    setNewItem({
      code: '',
      productName: '',
      size: '',
      quantity: '',
      packingType: DEFAULT_PACKING_TYPE,
      sellingPrice: '',
      originalProduct: null,
    });
    setTotal(0);
    setPacking('');
    setFreight('');
    setRiksha('');
    setBuyer('');
    setCustomerId('');
    setMobileNo('');
    setAddress('');
    setRemark('');
    setInvoiceDate(getLocalDateString());
    setFormErrors({});
    setIsEditing(false);
    setIsSaved(true);
    setCurrentInvoiceId('');
    setEditIndex(-1);

    // Reset payment fields
    setPaymentAmount('');
    setPaymentType('Cash');
    setPaymentDate(getLocalDateString());
    // Reset time and private note
    setInvoiceTime(new Date().toTimeString().slice(0, 5));
    setIsPrivateNote(false);
    // Reset dirty state tracking
    setOriginalInvoiceData(null);
    setIsNewInvoice(true);
    setNotFound(false);

    // Fetch new invoice ID
    try {
      const data = await window.api.getNextInvoiceId();
      const nextId = typeof data === 'object' && data !== null ? data.next_id : data;
      setCustomInvoiceNo(nextId);
    } catch (err) {
      console.error('Error fetching next invoice id', err);
    }
  }, []);

  // Helper Functions
  const formatNumber = (value) => {
    const num = parseFloat(value) || 0;
    if (Number.isInteger(num)) return num.toString();
    return num.toFixed(2);
  };

  const formatQty = (val) => {
    const n = parseFloat(val) || 0;
    if (Number.isInteger(n)) return n.toString();
    return n.toFixed(3);
  };

  const formatIndian = (num) => {
    const n = Number(num);
    if (isNaN(n)) return '0';
    return n.toLocaleString('en-IN');
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

  // Reset state when navigating to /invoice without an invoiceNo (new invoice)
  useEffect(() => {
    if (!invoiceNo && location.pathname === '/invoice') {
      resetInvoiceState();
    }
  }, [invoiceNo, location.pathname, resetInvoiceState]);

  // Scroll to top when opening an invoice (e.g. from account page)
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [invoiceNo, location.pathname]);

  // Handle forceNew: when user clicks Estimate in nav while already on invoice page
  useEffect(() => {
    if (location.state?.forceNew) {
      // Clear the forceNew flag from navigation state to prevent re-triggering
      window.history.replaceState({}, '');
      if (isDirty) {
        // Show confirmation modal
        setShowForceNewModal(true);
      } else {
        // No unsaved changes — just reset to new invoice
        resetInvoiceState();
      }
    }
  }, [location.state?.forceNew, location.state?._ts]);

  // Sync local state when route param changes
  useEffect(() => {
    setCurrentInvoiceId(invoiceNo || '');
  }, [invoiceNo]);

  // Fetch initial data (customers & products) + set invoice ID when editing
  useEffect(() => {
    // If editing existing invoice, set the custom invoice number
    if (invoiceNo) {
      setCustomInvoiceNo(invoiceNo);
    }
    // Note: getNextInvoiceId is handled by resetInvoiceState() via the pathname effect

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
    setNotFound(false);
    if (invoiceNo) {
      const fetchInvoice = async () => {
        try {
          const inv = await window.api.getInvoice(invoiceNo);
          if (!inv || inv.error) { setNotFound(true); return; }
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

            // Build product name → Title-cased (WITHOUT size — size is a separate field)
            const baseName = prod.name || item.product_name || item.product_code;
            const nameWithSpaces = formatName(baseName);

            // Quantity (numeric, 3 dp)
            const quantity = parseFloat(item.quantity).toFixed(3);

            return {
              ...item,
              productName: nameWithSpaces,
              size: prod.size || item.size || '',
              code: item.product_code,
              quantity,               // keep numeric text only
              packingType: prod.packing_type || item.packing_type || '',
              sellingPrice: parseFloat(item.selling_price).toFixed(3),
              amount: (item.quantity * item.selling_price).toFixed(3),
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

          // Load time and private note
          setInvoiceTime(inv.invoice_time || '');
          setIsPrivateNote(inv.is_private_note === 1);

          // Load payment info — multi-payment system
          setPayments(inv.payments || []);
          setTotalPaid(inv.total_paid || 0);
          setBalanceDue(inv.balance_due || 0);
          setInvoiceStatus(inv.status || 'awaiting_payment');
          setPaymentDueDays(inv.payment_due_days || 0);

          // Store original data for dirty state detection
          setOriginalInvoiceData(inv);
          setIsNewInvoice(false);

          // Try to fetch full customer details
          let cust = customers.find(c => c.customer_id === inv.customer_id);
          if (cust) {
            // Found locally — set buyer details from local cache
            setBuyer(cust.name);
            setAddress(cust.address || '');
            setMobileNo(cust.mobile || '');
          } else {
            // Not in local cache — fetch from DB
            try {
              cust = await window.api.invoke('customers:get', inv.customer_id);
            } catch (err) {
              console.error('Error fetching customer details:', err);
            }
            if (cust && !cust.error) {
              setBuyer(cust.name);
              setAddress(cust.address || '');
              setMobileNo(cust.mobile || '');
            } else {
              setBuyer(inv.customer_id); // fallback to ID
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
        setHighlightedCustIndex(-1);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Auto-scroll highlighted customer into view
  useEffect(() => {
    if (highlightedCustIndex >= 0 && showCustDropdown) {
      const el = document.querySelector(`[data-inv-cust-index="${highlightedCustIndex}"]`);
      el?.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightedCustIndex, showCustDropdown]);

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
    if (!newItem.quantity) {
      errors.quantity = 'Quantity is required';
    } else if (parseFloat(newItem.quantity) <= 0) {
      errors.quantity = 'Please enter valid quantity';
    }
    if (!newItem.sellingPrice) {
      errors.sellingPrice = 'Price is required';
    } else if (parseFloat(newItem.sellingPrice) <= 0) {
      errors.sellingPrice = 'Please enter selling price';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleAddItem = async () => {
    if (!validateForm()) return;

    const quantity = parseFloat(newItem.quantity);
    const sellingPrice = parseFloat(newItem.sellingPrice);

    if (isNaN(quantity) || quantity <= 0) {
      toast.error('Please enter valid quantity');
      return;
    }
    if (isNaN(sellingPrice) || sellingPrice <= 0) {
      toast.error('Please enter selling price');
      return;
    }

    const amount = quantity * sellingPrice;

    // Check if user selected an existing product and then modified the name/size
    const originalProduct = newItem.originalProduct;
    const nameChanged = originalProduct && originalProduct.name !== newItem.productName;
    const sizeChanged = originalProduct && (originalProduct.size || '') !== (newItem.size || '');

    let productCode = newItem.code;

    // If name or size was changed, check if another DB product matches
    if (nameChanged || sizeChanged) {
      const existingProduct = findProductByNameAndSize(newItem.productName, newItem.size, products);

      if (existingProduct) {
        // Use existing product's code
        productCode = existingProduct.code;

        // Detect price and packing type changes
        const existingPrice = parseFloat(existingProduct.selling_price ?? existingProduct.sellingPrice ?? 0) || 0;
        const existingPacking = (existingProduct.packing_type || '').trim().toLowerCase();
        const formPacking = (newItem.packingType || '').trim().toLowerCase();
        const priceChanged = existingPrice !== sellingPrice;
        const packingChanged = existingPacking !== formPacking;

        if (priceChanged || packingChanged) {
          try {
            await window.api.invoke('products:update', {
              code: productCode,
              name: existingProduct.name,
              size: existingProduct.size || '',
              packing_type: newItem.packingType || existingProduct.packing_type,
              cost_price: existingProduct.cost_price || 0,
              selling_price: sellingPrice
            });
            const updates = [];
            if (priceChanged) updates.push('price');
            if (packingChanged) updates.push('packing type');
            toast.success(`Product ${updates.join(' & ')} updated in Price List`);
            const updatedProducts = await window.api.getProducts();
            setProducts(updatedProducts);
          } catch (err) {
            console.error('Error updating product:', err);
          }
        }
      } else {
        // No matching DB product — create in price list
        productCode = generateProductCode(newItem.productName, newItem.size);
        try {
          await window.api.invoke('products:create', {
            code: productCode,
            name: newItem.productName,
            size: newItem.size || '',
            packing_type: newItem.packingType || DEFAULT_PACKING_TYPE,
            cost_price: 0,
            selling_price: sellingPrice
          });
          toast.success('New product added to Price List');
          const updatedProducts = await window.api.getProducts();
          setProducts(updatedProducts);
        } catch (err) {
          console.error('Error creating product:', err);
        }
      }
    } else if (newItem.code && originalProduct) {
      // Using existing DB product without name/size change — sync price and/or packing type if different
      const originalPrice = parseFloat(originalProduct.selling_price ?? originalProduct.sellingPrice ?? 0) || 0;
      const originalPacking = (originalProduct.packing_type || '').trim().toLowerCase();
      const formPacking = (newItem.packingType || '').trim().toLowerCase();
      const priceChanged = originalPrice !== sellingPrice;
      const packingChanged = originalPacking !== formPacking;

      if (priceChanged || packingChanged) {
        try {
          await window.api.invoke('products:update', {
            code: newItem.code,
            name: originalProduct.name,
            size: originalProduct.size || '',
            packing_type: newItem.packingType || originalProduct.packing_type,
            cost_price: originalProduct.cost_price || 0,
            selling_price: sellingPrice
          });
          const updates = [];
          if (priceChanged) updates.push('price');
          if (packingChanged) updates.push('packing type');
          toast.success(`Product ${updates.join(' & ')} updated in Price List`);
          const updatedProducts = await window.api.getProducts();
          setProducts(updatedProducts);
        } catch (err) {
          console.error('Error updating product:', err);
        }
      }
    } else if (!newItem.code) {
      // New product typed in — create in price list
      productCode = generateProductCode(newItem.productName, newItem.size);
      try {
        await window.api.invoke('products:create', {
          code: productCode,
          name: newItem.productName,
          size: newItem.size || '',
          packing_type: newItem.packingType || DEFAULT_PACKING_TYPE,
          cost_price: 0,
          selling_price: sellingPrice
        });
        toast.success('New product added to Price List');
        const updatedProducts = await window.api.getProducts();
        setProducts(updatedProducts);
      } catch (err) {
        console.error('Error creating product:', err);
      }
    }

    const newInvoiceItem = {
      code: productCode,
      product_code: productCode,
      productName: newItem.productName,
      size: newItem.size || '',
      quantity: quantity.toFixed(3),
      packingType: newItem.packingType,
      sellingPrice: sellingPrice.toFixed(3),
      amount: amount.toFixed(3)
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
      size: '',
      quantity: '',
      packingType: DEFAULT_PACKING_TYPE,
      sellingPrice: '',
      originalProduct: null,
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
    // Find the original product in the products list to track changes
    const originalProduct = products.find(p => p.code === item.code) || null;
    setNewItem({
      code: item.code,
      productName: item.productName,
      size: item.size || '',
      quantity: item.quantity,
      packingType: item.packingType,
      sellingPrice: item.sellingPrice,
      originalProduct: originalProduct,
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
    custActionRef.current = true;
    setBuyer(cust.name);
    setCustomerId(cust.customer_id);
    setAddress(cust.address);
    setMobileNo(cust.mobile);
    setShowCustDropdown(false);
    setHighlightedCustIndex(-1);
    // Pre-fill due days from customer's reminder_days (regardless of reminder_enabled)
    if (isNewInvoice) {
      setPaymentDueDays(cust.reminder_days || 0);
    }
  };

  // Handle customer input blur — detect unmatched customer name
  const handleCustomerBlur = () => {
    const currentBuyer = buyer.trim();
    const currentCustId = customerId;
    setTimeout(() => {
      if (custActionRef.current) {
        custActionRef.current = false;
        return;
      }
      if (currentBuyer && !currentCustId) {
        // Word-level fuzzy matching: split into words and check overlap
        const inputWords = currentBuyer.toLowerCase().split(/\s+/).filter(Boolean);
        const similar = customers.filter(c => {
          const custWords = (c.name || '').toLowerCase().split(/\s+/).filter(Boolean);
          // Match if ANY word from input matches ANY word in customer name
          return inputWords.some(iw =>
            custWords.some(cw => cw.includes(iw) || iw.includes(cw))
          );
        });
        setSimilarCustomers(similar);
        setShowNewCustModal(true);
        setShowCustDropdown(false);
      }
    }, 250);
  };

  const handleCreateNewCustomer = async () => {
    const trimmedName = buyer.trim();
    if (!trimmedName) return;
    // Derive next ID from max existing numeric suffix to avoid collisions after deletions
    const maxNum = customers.reduce((max, c) => {
      const m = c.customer_id?.match(/^AGS-C-(\d+)$/);
      return m ? Math.max(max, parseInt(m[1], 10)) : max;
    }, 0);
    const newCustId = `AGS-C-${maxNum + 1}`;
    try {
      await window.api.invoke('customers:create', {
        customer_id: newCustId,
        name: trimmedName,
        address: address || '',
        mobile: mobileNo || ''
      });
      setCustomerId(newCustId);
      const updatedCustomers = await window.api.getCustomers();
      setCustomers(updatedCustomers);
      toast.success(`New customer "${trimmedName}" created`);
    } catch (err) {
      console.error('Error creating customer:', err);
      toast.error('Failed to create customer');
    }
    setShowNewCustModal(false);
    setSimilarCustomers([]);
  };

  const handleCancelNewCustomer = () => {
    setBuyer('');
    setCustomerId('');
    setAddress('');
    setMobileNo('');
    setShowNewCustModal(false);
    setSimilarCustomers([]);
  };

  const handleSelectSimilarCustomer = (cust) => {
    handleSelectCustomer(cust);
    setShowNewCustModal(false);
    setSimilarCustomers([]);
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

    // Validate payment amount
    const payAmt = parseFloat(paymentAmount || 0);
    if (payAmt < 0) {
      toast.error('Payment amount must be positive');
      return;
    }

    // Check if customer details changed — if so, prompt user via styled modal
    const existingCust = customers.find(c => c.customer_id === customerId);
    if (existingCust) {
      const custChanged =
        (existingCust.mobile || '') !== (mobileNo || '') ||
        (existingCust.address || '') !== (address || '');
      if (custChanged) {
        pendingSaveRef.current = true;
        setShowCustUpdateModal(true);
        return; // pause — modal callbacks will continue the save
      }
    }

    await performInvoiceSave();
  };

  const handleCustUpdateConfirm = async () => {
    setShowCustUpdateModal(false);
    try {
      await window.api.invoke('customers:update', {
        customer_id: customerId,
        name: buyer,
        address: address,
        mobile: mobileNo
      });
      const updatedCustomers = await window.api.getCustomers();
      setCustomers(updatedCustomers);
    } catch (err) {
      console.error('Error updating customer:', err);
      toast.error('Failed to update customer profile');
    }
    if (pendingSaveRef.current) {
      pendingSaveRef.current = false;
      await performInvoiceSave();
    }
  };

  const handleCustUpdateSkip = async () => {
    setShowCustUpdateModal(false);
    if (pendingSaveRef.current) {
      pendingSaveRef.current = false;
      await performInvoiceSave();
    }
  };

  const performInvoiceSave = async () => {
    // Always stamp current time on save
    const currentTime = new Date().toTimeString().slice(0, 5);
    setInvoiceTime(currentTime);
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
      })),
      // Time and private note
      invoice_time: currentTime,
      is_private_note: isPrivateNote ? 1 : 0,
      payment_due_days: paymentDueDays
    };

    // Only include initial payment fields on CREATE (not update)
    if (!currentInvoiceId) {
      payload.payment_amount = parseFloat(paymentAmount || 0);
      payload.payment_type = paymentType;
      payload.payment_date = paymentDate || invoiceDate;
    }

    try {
      const data = await window.api.invoke(
        currentInvoiceId ? 'invoices:update' : 'invoices:create',
        currentInvoiceId ? { id: currentInvoiceId, ...payload } : payload
      );

      // Explicit success check - only proceed if backend confirms success
      if (!data || data.error || data.success === false) {
        toast.error(data?.error || 'An error occurred while saving. Please try again.');
        return; // Keep data, do NOT clear or navigate
      }

      const savedInvoiceId = data.invoice_id || currentInvoiceId;

      // if it was a create request, persist the returned id for future updates
      if (!currentInvoiceId && data.invoice_id) {
        setCurrentInvoiceId(data.invoice_id);
        setCustomInvoiceNo(data.invoice_id);
      }

      // Refresh payment/status state from the database (critical after create)
      await loadInvoice(savedInvoiceId);

      toast.success(`Invoice saved successfully (ID: ${savedInvoiceId})`);

      setIsNewInvoice(false);
      setIsSaved(true);
      setIsEditing(false);
    } catch (err) {
      console.error('Error saving invoice:', err);
      toast.error('An error occurred while saving. Please try again.');
      // Keep data, do NOT clear or navigate
    }
  };

  // Ctrl+S save shortcut (ref-based to avoid stale closure)
  const handleSaveRef = useRef(handleSave);
  handleSaveRef.current = handleSave;
  useEffect(() => {
    const onKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        // Don't save if a modal/popup requiring input is active
        if (showForceNewModal || showNavigationWarning || showNewCustModal || showCustUpdateModal || showDeleteModal) return;
        handleSaveRef.current();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [showForceNewModal, showNavigationWarning, showNewCustModal, showCustUpdateModal, showDeleteModal]);

  // Focus the delete modal when it opens
  useEffect(() => {
    if (showDeleteModal) deleteModalRef.current?.focus();
  }, [showDeleteModal]);

  // Delete entire invoice (permanent, no rollback)
  const handleDeleteInvoice = async () => {
    if (!currentInvoiceId) { toast.error('No invoice to delete'); return; }
    setIsDeletePending(true);
    try {
      const result = await window.api.invoke('invoices:delete', { invoice_id: currentInvoiceId });
      if (!result || result.error || result.success === false) {
        toast.error(result?.error || 'Failed to delete invoice');
        return;
      }
      // Clear dirty state BEFORE navigating so useBlocker allows navigation
      resetInvoiceState();
      setShowDeleteModal(false);
      toast.success('Invoice deleted successfully');
      // Navigate to create new invoice after short delay
      setTimeout(() => { navigate('/invoice'); }, 500);
    } catch (err) {
      console.error('Error deleting invoice:', err);
      toast.error('Failed to delete invoice');
    } finally {
      setIsDeletePending(false);
    }
  };

  // Load / reload invoice data (used after payment changes)
  const loadInvoice = async (id) => {
    try {
      const inv = await window.api.getInvoice(id);
      if (!inv || inv.error) return;
      setPayments(inv.payments || []);
      setTotalPaid(inv.total_paid || 0);
      setBalanceDue(inv.balance_due || 0);
      setInvoiceStatus(inv.status || 'awaiting_payment');
      setPaymentDueDays(inv.payment_due_days || 0);
      setOriginalInvoiceData(inv);
    } catch (err) {
      console.error('Error reloading invoice:', err);
    }
  };

  // Multi-payment: save (add or edit)
  async function handleSavePayment() {
    const amt = parseFloat(payForm.payment_amount);
    if (!amt || amt <= 0) { toast.error('Enter a valid amount'); return; }

    if (editingPayment) {
      const res = await window.api.invoiceUpdatePayment({
        payment_id: editingPayment.id,
        invoice_id: currentInvoiceId,
        ...payForm,
        payment_amount: amt
      });
      if (res.error) { toast.error(res.error); return; }
      toast.success('Payment updated successfully');
    } else {
      const res = await window.api.invoiceAddPayment({
        invoice_id: currentInvoiceId,
        customer_id: customerId,
        ...payForm,
        payment_amount: amt
      });
      if (res.error) { toast.error(res.error); return; }
      toast.success('Payment saved successfully');
    }

    setShowPaymentForm(false);
    setEditingPayment(null);
    // Reload invoice to refresh payment list and status
    await loadInvoice(currentInvoiceId);
  }

  // Multi-payment: delete
  async function handleDeletePayment(payment_id) {
    const res = await window.api.invoiceDeletePayment({ payment_id, invoice_id: currentInvoiceId });
    if (res.error) { toast.error(res.error); return; }
    toast.success('Payment deleted successfully');
    await loadInvoice(currentInvoiceId);
  }

  // Marathi print state
  const [printMarathi, setPrintMarathi] = useState(false);
  const [marathiNames, setMarathiNames] = useState({}); // code -> marathi_name
  const [isTranslating, setIsTranslating] = useState(false);

  // Printer selection state
  const [showPrinterModal, setShowPrinterModal] = useState(false);
  const [printerList, setPrinterList] = useState([]);
  const [selectedPrinter, setSelectedPrinter] = useState('');
  const [pendingPDFData, setPendingPDFData] = useState(null);
  const [isPrinting, setIsPrinting] = useState(false);

  const handlePrint = async () => {
    const { roundOff: ro, grandTotal: gt } = calculateGrandTotal();
    const buildPDFData = (marathiNamesMap = {}) => ({
      invoiceNo: customInvoiceNo,
      invoiceDate,
      buyer,
      customerId,
      address,
      mobileNo,
      invoiceItems,
      total,
      packing,
      freight,
      riksha,
      roundOff: ro,
      grandTotal: gt,
      remark,
      paymentAmount,
      paymentType,
      payments,
      totalPaid,
      balanceDue,
      printMarathi,
      marathiNames: marathiNamesMap,
      isPrivateNote,
    });

    const showPrinterSelection = (pdfResult) => {
      setPendingPDFData(pdfResult);
      // Fetch available printers
      window.api.invoke('print:listPrinters').then((res) => {
        setPrinterList(res.success ? res.printers.filter(p => p && p.trim()) : []);
        setSelectedPrinter(''); // default printer
        setShowPrinterModal(true);
      }).catch(() => {
        setPrinterList([]);
        setSelectedPrinter('');
        setShowPrinterModal(true);
      });
    };

    if (printMarathi) {
      const codes = invoiceItems.map(i => i.code || i.product_code).filter(Boolean);
      setIsTranslating(true);
      try {
        const allNames = {};

        // Step 1: Handle products that exist in DB
        if (codes.length > 0) {
          const { missing } = await window.api.invoke('translate:checkMissing', codes);

          // Translate missing DB product names
          if (missing.length > 0) {
            for (const code of missing) {
              const res = await window.api.invoke('translate:toMarathi', code);
              if (!res.success) {
                toast.error('Please connect to the internet to generate Marathi product names.');
                setPrintMarathi(false);
                setIsTranslating(false);
                return;
              }
            }
          }

          // Fetch all DB Marathi names
          const { names } = await window.api.invoke('translate:getMarathiNames', codes);
          Object.assign(allNames, names);
        }

        // Step 2: Fallback for items whose codes have no Marathi name yet
        // (e.g. products not in DB, or DB transliteration failed silently)
        for (const item of invoiceItems) {
          const code = item.code || item.product_code;
          if (!code || allNames[code]) continue; // already have name

          const name = item.productName;
          if (!name) continue;

          const res = await window.api.invoke('translate:nameToMarathi', name);
          if (!res.success) {
            toast.error('Please connect to the internet to generate Marathi product names.');
            setPrintMarathi(false);
            setIsTranslating(false);
            return;
          }
          allNames[code] = res.marathi_name;
        }

        // Step 3: All names ready — generate PDF
        setMarathiNames(allNames);
        setIsTranslating(false);
        const result = generateInvoicePDF(buildPDFData(allNames));
        showPrinterSelection(result);
      } catch {
        toast.error('Please connect to the internet to generate Marathi product names.');
        setPrintMarathi(false);
        setIsTranslating(false);
      }
    } else {
      const result = generateInvoicePDF(buildPDFData());
      showPrinterSelection(result);
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
    // Convert base64 to blob and download
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

  if (notFound) {
    return (
      <RecordNotFound
        recordType="Invoice"
        recordId={invoiceNo}
        backPath="/invoice"
        backLabel="Back to Invoice"
      />
    );
  }

  const { roundOff, grandTotal } = calculateGrandTotal();
  return (
    <div className="p-2 sm:p-6 min-h-screen bg-[#F7F9FB] print:bg-white print:p-0 print:text-black">
      {/* Navigation Warning Modal */}
      <NavigationWarningModal blocker={blocker} />

      {/* Force New Invoice Modal — shown when clicking Estimate in nav with unsaved changes */}
      {showForceNewModal && (
        <div className="fixed inset-0 flex items-center justify-center z-[100] print:hidden" style={{ background: 'rgba(255, 255, 255, 0.7)', backdropFilter: 'blur(8px)' }}>
          <div className="bg-white rounded-xl shadow-2xl p-6 max-w-md mx-4">
            <div className="flex items-center justify-center mb-4">
              <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
                <AlertTriangle className="text-yellow-600" size={24} />
              </div>
            </div>
            <h2 className="text-xl font-bold text-[#0F172A] text-center mb-2">
              Unsaved Changes
            </h2>
            <p className="text-[#64748B] text-center mb-6">
              This invoice has unsaved changes. Creating a new one will discard them.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowForceNewModal(false)}
                className="flex-1 px-4 py-2.5 rounded-lg bg-[#2563EB] text-white font-medium hover:bg-[#1D4ED8] transition-colors cursor-pointer"
              >
                Keep Editing
              </button>
              <button
                onClick={() => { setShowForceNewModal(false); resetInvoiceState(); }}
                className="flex-1 px-4 py-2.5 rounded-lg border border-[#E2E8F0] text-[#64748B] font-medium hover:bg-[#F1F5F9] transition-colors cursor-pointer"
              >
                Discard & New
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Customer Update Confirmation Modal */}
      {showCustUpdateModal && (
        <div className="fixed inset-0 flex items-center justify-center z-[100] print:hidden" style={{ background: 'rgba(255, 255, 255, 0.7)', backdropFilter: 'blur(8px)' }}>
          <div className="bg-white rounded-xl shadow-2xl p-6 max-w-md mx-4">
            <div className="flex items-center justify-center mb-4">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <AlertTriangle className="text-[#2563EB]" size={24} />
              </div>
            </div>
            <h2 className="text-xl font-bold text-[#0F172A] text-center mb-2">
              Update Customer Profile?
            </h2>
            <p className="text-[#64748B] text-center mb-6">
              Customer mobile or address has changed. Save these changes to the customer profile?
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleCustUpdateConfirm}
                className="flex-1 px-4 py-2.5 rounded-lg bg-[#2563EB] text-white font-medium hover:bg-[#1D4ED8] transition-colors cursor-pointer"
              >
                Yes, Update
              </button>
              <button
                onClick={handleCustUpdateSkip}
                className="flex-1 px-4 py-2.5 rounded-lg border border-[#E2E8F0] text-[#64748B] font-medium hover:bg-[#F1F5F9] transition-colors cursor-pointer"
              >
                Skip
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Customer Modal — shown when typed name doesn't match any DB customer */}
      {showNewCustModal && (
        <div className="fixed inset-0 flex items-center justify-center z-[100] print:hidden" style={{ background: 'rgba(255, 255, 255, 0.7)', backdropFilter: 'blur(8px)' }}>
          <div className="bg-white rounded-xl shadow-2xl p-6 max-w-md mx-4 w-full">
            <div className="flex items-center justify-center mb-4">
              <div className="w-12 h-12 bg-amber-50 rounded-full flex items-center justify-center">
                <AlertTriangle className="text-amber-500" size={24} />
              </div>
            </div>
            <h2 className="text-xl font-bold text-[#0F172A] text-center mb-2">
              Customer Not Found
            </h2>
            <p className="text-[#64748B] text-center mb-1">
              <span className="font-semibold text-[#0F172A]">&ldquo;{buyer.trim()}&rdquo;</span> is not in the database.
            </p>

            {similarCustomers.length > 0 && (
              <div className="mt-4 mb-2">
                <p className="text-xs font-bold text-[#434655] uppercase tracking-wider mb-2">Did you mean one of these?</p>
                <div className="max-h-36 overflow-y-auto rounded-lg border border-[#E2E8F0]">
                  {similarCustomers.map((c) => (
                    <button
                      key={c.customer_id}
                      onClick={() => handleSelectSimilarCustomer(c)}
                      className="w-full text-left px-4 py-3 text-sm hover:bg-[#EFF6FF] transition-colors flex items-center justify-between border-b border-[#F1F5F9] last:border-b-0 cursor-pointer"
                    >
                      <div>
                        <span className="font-semibold text-[#0F172A] block">{c.name}</span>
                        {c.mobile && <span className="text-xs text-[#64748B]">{c.mobile}</span>}
                      </div>
                      <span className="text-xs font-medium text-[#2563EB]">Use this</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {similarCustomers.length === 0 && (
              <p className="text-[#64748B] text-center text-sm mt-1 mb-4">
                No similar customers found. Would you like to create a new one?
              </p>
            )}

            <div className={`flex gap-3 ${similarCustomers.length > 0 ? 'mt-4' : ''}`}>
              <button
                onClick={handleCreateNewCustomer}
                className="flex-1 px-4 py-2.5 rounded-lg bg-[#2563EB] text-white font-medium hover:bg-[#1D4ED8] transition-colors cursor-pointer flex items-center justify-center gap-2"
              >
                <Plus size={16} />
                Add New Customer
              </button>
              <button
                onClick={handleCancelNewCustomer}
                className="flex-1 px-4 py-2.5 rounded-lg border border-[#E2E8F0] text-[#64748B] font-medium hover:bg-[#F1F5F9] transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

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
        title="Print Invoice"
        subtitle={pendingPDFData?.fileName || 'Estimate'}
      />

      {/* Full-Screen Marathi Translation Loader */}
      {isTranslating && (
        <PageLoader variant="overlay" message="Preparing Marathi print..." subtitle="Translating product names, please wait" />
      )}

      <div
        ref={printRef}
        className="max-w-[1040px] mx-auto bg-white shadow-sm rounded-xl border border-[#E2E8F0] overflow-hidden print:shadow-none print:rounded-none print:border-none print:w-[210mm] print:min-h-[297mm]"
      >
        {/* Top Bar — Estimate ID / Title / Date / Time */}
        <div className="px-4 sm:px-6 py-4 border-b border-[#E2E8F0] bg-[#F8FAFC] print:bg-white print:py-3">
          <div className="flex items-center justify-between">
            <div>
              {/* Back button — shown when opened from an account page */}
              {location.state?.fromAccount && (
                <button
                  onClick={() => navigate(location.state.fromAccount)}
                  className="mb-2 flex items-center gap-1 text-xs font-medium text-[#64748B] hover:text-[#004AC6] transition-colors cursor-pointer print:hidden"
                >
                  <ArrowLeft size={14} />
                  Back to Account
                </button>
              )}
              <p className="text-xs font-medium text-[#64748B] uppercase tracking-wider">Reference</p>
              <p className="text-sm font-bold text-[#2563EB]">{customInvoiceNo || '...'}</p>
              {currentInvoiceId && invoiceStatus && (
                <span className={`
                  mt-1 inline-block px-2.5 py-1 rounded-full text-xs font-bold
                  ${invoiceStatus === 'paid'
                    ? 'bg-emerald-100 text-emerald-700'
                    : invoiceStatus === 'partially_paid'
                      ? 'bg-amber-100 text-amber-700'
                      : invoiceStatus === 'overdue'
                        ? 'bg-red-100 text-[#BA1A1A]'
                        : 'bg-blue-100 text-blue-700'}
                `}>
                  {invoiceStatus === 'awaiting_payment' ? 'Awaiting Payment'
                    : invoiceStatus === 'partially_paid' ? 'Partially Paid'
                      : invoiceStatus === 'paid' ? 'Paid'
                        : 'Overdue'}
                </span>
              )}
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-[#0F172A] tracking-wide">ESTIMATE</h1>
            <div className="flex items-center gap-4 text-right">
              {customerId && (
                <div className="print:hidden">
                  <p className="text-xs font-medium text-[#64748B] uppercase tracking-wider mb-1 text-left">Due Days</p>
                  <input
                    type="number"
                    min={0}
                    value={paymentDueDays}
                    onChange={e => setPaymentDueDays(parseInt(e.target.value) || 0)}
                    className="w-16 text-sm font-semibold text-[#0F172A] border border-[#E2E8F0] rounded-md px-2 py-1 text-center focus:ring-2 focus:ring-[#2563EB] focus:border-transparent"
                  />
                </div>
              )}
              <div>
                <p className="text-xs font-medium text-[#64748B] uppercase tracking-wider mb-1 text-left">Date</p>
                <input
                  type="date"
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                  className="text-sm font-semibold text-[#0F172A] border border-[#E2E8F0] rounded-md px-2 py-1 focus:ring-2 focus:ring-[#2563EB] focus:border-transparent print:border-none print:bg-transparent print:p-0 w-[125px]"
                />
              </div>
              <div>
                <p className="text-xs font-medium text-[#64748B] uppercase tracking-wider mb-1 text-left">Time</p>
                <input
                  type="time"
                  value={invoiceTime}
                  onChange={(e) => setInvoiceTime(e.target.value)}
                  className="text-sm font-semibold text-[#0F172A] border border-[#E2E8F0] rounded-md px-2 py-1 focus:ring-2 focus:ring-[#2563EB] focus:border-transparent print:border-none print:bg-transparent print:p-0 w-[100px]"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Customer Details Section */}
        <section className="px-4 sm:px-8 py-6 print:py-3">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-[#C3C6D7]/10 flex flex-wrap gap-6 items-end">
            {/* Customer Search */}
            <div className="flex-1 min-w-[280px] relative" ref={wrapperRef}>
              <label className="block text-xs font-semibold text-[#434655] uppercase mb-2 ml-1">Customer Search</label>
              <div className="relative group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#434655]" size={16} />
                <input
                  type="text"
                  value={buyer}
                  onFocus={() => { setShowCustDropdown(true); setHighlightedCustIndex(0); }}
                  onChange={(e) => {
                    const name = e.target.value;
                    setBuyer(name);
                    setShowCustDropdown(true);
                    setHighlightedCustIndex(0);
                    const cust = customers.find(c => c.name.toLowerCase() === name.toLowerCase());
                    if (cust) {
                      setCustomerId(cust.customer_id);
                      setAddress(cust.address);
                      setMobileNo(cust.mobile);
                      if (isNewInvoice) setPaymentDueDays(cust.reminder_days || 0);
                    } else {
                      setCustomerId('');
                      setAddress('');
                      setMobileNo('');
                    }
                  }}
                  onKeyDown={(e) => {
                    if (!showCustDropdown) return;
                    const filteredCusts = customers.filter(c => c.name.toLowerCase().includes(buyer.toLowerCase()));
                    switch (e.key) {
                      case 'ArrowDown': e.preventDefault(); setHighlightedCustIndex(prev => Math.min(prev + 1, filteredCusts.length - 1)); break;
                      case 'ArrowUp': e.preventDefault(); setHighlightedCustIndex(prev => Math.max(prev - 1, 0)); break;
                      case 'Enter': e.preventDefault(); if (highlightedCustIndex >= 0 && filteredCusts[highlightedCustIndex]) { handleSelectCustomer(filteredCusts[highlightedCustIndex]); } break;
                      case 'Escape': e.preventDefault(); setShowCustDropdown(false); setHighlightedCustIndex(-1); break;
                    }
                  }}
                  onBlur={handleCustomerBlur}
                  className="w-full pl-10 pr-10 py-3 bg-[#F2F4F6] border-none rounded-lg text-sm focus:bg-white focus:ring-2 focus:ring-[#004AC6]/15 transition-all"
                  placeholder="Search customer name..."
                />
                {buyer && (
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => { custActionRef.current = true; setBuyer(''); setCustomerId(''); setAddress(''); setMobileNo(''); }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#434655] hover:text-red-500 cursor-pointer transition-colors"
                  >
                    <CircleX size={16} />
                  </button>
                )}
              </div>
              {showCustDropdown && (
                <ul className="absolute z-50 w-full mt-1 bg-white border border-[#C3C6D7]/30 rounded-lg shadow-lg overflow-y-auto" style={{ maxHeight: '9rem' }}>
                  {customers
                    .filter((c) => c.name.toLowerCase().includes(buyer.toLowerCase()))
                    .map((c, idx) => (
                      <li
                        key={c.customer_id}
                        data-inv-cust-index={idx}
                        className={`px-4 py-3 cursor-pointer text-sm transition-colors ${highlightedCustIndex === idx ? 'bg-[#EFF6FF]' : 'hover:bg-[#EFF6FF]'}`}
                        onClick={() => handleSelectCustomer(c)}
                        onMouseEnter={() => setHighlightedCustIndex(idx)}
                      >
                        {c.name}
                      </li>
                    ))}
                  {customers.filter((c) => c.name.toLowerCase().includes(buyer.toLowerCase())).length === 0 && (
                    <li className="px-4 py-3 text-[#434655] text-sm">No customers found</li>
                  )}
                </ul>
              )}
            </div>

            {/* Mobile Number */}
            <div className="w-48">
              <label className="block text-xs font-semibold text-[#434655] uppercase mb-2 ml-1">Mobile Number</label>
              <input
                type="text"
                value={mobileNo}
                onChange={(e) => setMobileNo(e.target.value)}
                className="w-full py-3 px-4 bg-[#ECEEF0] border-none rounded-lg text-sm text-[#434655] font-medium"
                placeholder="Enter mobile number"
              />
            </div>

            {/* Address */}
            <div className="flex-[2] min-w-[320px]">
              <label className="block text-xs font-semibold text-[#434655] uppercase mb-2 ml-1">Shipping Address</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full py-3 px-4 bg-[#ECEEF0] border-none rounded-lg text-sm text-[#434655] font-medium"
                placeholder="Enter address"
              />
            </div>
          </div>
        </section>

        {/* Add New Item Form */}
        <div className="p-4 sm:p-6 print:hidden">
          <div className="relative">
            {!customerId && (
              <div className="absolute inset-0 z-10 bg-white/70 backdrop-blur-[2px] rounded-xl flex items-center justify-center cursor-not-allowed">
                <div className="bg-white px-6 py-3 rounded-lg shadow-md border border-[#E2E8F0] flex items-center gap-2">
                  <AlertCircle size={16} className="text-[#64748B]" />
                  <span className="text-sm font-medium text-[#64748B]">Select a customer first to add items</span>
                </div>
              </div>
            )}
            <AddItemForm
              newItem={newItem}
              setNewItem={setNewItem}
              handleAddItem={handleAddItem}
              products={products}
              formErrors={formErrors}
              productNameInputRef={productNameInputRef}
              onProductSelected={() => { }}
            />
          </div>
        </div>

        {/* Items Table */}
        <section className="px-4 sm:px-8 pb-6">
          <div className="overflow-hidden rounded-xl border border-[#C3C6D7]/10 shadow-sm bg-white">
            <table className="w-full min-w-[700px] text-left">
              <thead className="bg-[#F2F4F6] text-[10px] font-extrabold uppercase text-[#434655] tracking-wider">
                <tr>
                  <th className="py-4 px-6 w-16">S.No</th>
                  <th className="py-4 px-6">Item Name</th>
                  <th className="py-4 px-6 w-32 text-center">Size</th>
                  <th className="py-4 px-6 w-32 text-center">Qty</th>
                  <th className="py-4 px-6 w-32 text-right">Rate (₹)</th>
                  <th className="py-4 px-6 w-40 text-right">Amount (₹)</th>
                  <th className="py-4 px-6 w-24 text-center print:hidden">Actions</th>
                </tr>
              </thead>
              <tbody className="text-sm divide-y divide-[#ECEEF0]">
                {invoiceItems.map((item, index) => (
                  <tr key={index} className="hover:bg-[#F2F4F6]/50 transition-colors">
                    <td className="px-4 py-3 text-sm text-[#64748B]">{String(index + 1).padStart(2, '0')}</td>
                    <td className="px-4 py-3 text-sm text-[#0F172A] font-medium" style={{ maxWidth: '200px', wordWrap: 'break-word', whiteSpace: 'normal' }}>
                      <span className="print:hidden">{item.productName}</span>
                      <span className="hidden print:inline">
                        {printMarathi && marathiNames[item.code || item.product_code]
                          ? marathiNames[item.code || item.product_code]
                          : item.productName}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-[#64748B] text-center">{item.size || '-'}</td>
                    <td className="px-4 py-3 text-sm text-[#64748B] text-center">
                      {formatQty(item.quantity)} {item.packingType}
                    </td>
                    <td className="px-4 py-3 text-sm text-[#64748B] text-right">
                      {formatNumber(item.sellingPrice)}
                    </td>
                    <td className="px-4 py-3 text-sm text-[#2563EB] font-semibold text-right">
                      {formatNumber(item.amount)}
                    </td>
                    <td className="px-4 py-3 text-center print:hidden">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleEditItem(index)}
                          className="cursor-pointer p-1.5 rounded-md text-[#64748B] hover:text-[#2563EB] hover:bg-[#EFF6FF] transition-colors"
                          aria-label="Edit item"
                        >
                          <Edit size={15} />
                        </button>
                        <button
                          onClick={() => handleDeleteItem(index)}
                          className="cursor-pointer p-1.5 rounded-md text-[#64748B] hover:text-[#DC2626] hover:bg-red-50 transition-colors"
                          aria-label="Delete item"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {invoiceItems.length === 0 && (
                  <tr>
                    <td colSpan="7" className="px-4 py-8 text-center text-[#94A3B8] text-sm">
                      No items added yet. Use the form above to add items.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Bottom Section: Payment + Summary — 7/5 grid */}
        <div className="px-4 sm:px-8 pb-6">
          <div className="grid grid-cols-12 gap-8">
            {/* Left Column (col-span-7) — Payment Details + Remarks */}
            <div className="col-span-12 md:col-span-7 space-y-6">
              {/* Payment Details — CREATE flow: single optional payment */}
              {isNewInvoice && (
                <div className="print:hidden">
                  <label className="block text-xs font-bold text-[#434655] uppercase mb-2 ml-1">Payment Details</label>
                  <div className="bg-white p-6 rounded-xl border border-[#C3C6D7]/10 grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-[10px] text-[#434655] font-bold mb-1">Paid Amount</label>
                      <input
                        type="number"
                        value={paymentAmount}
                        onChange={(e) => setPaymentAmount(e.target.value)}
                        className="w-full py-2.5 px-3 bg-[#F2F4F6] border-none rounded-lg text-sm font-bold text-[#004AC6] focus:bg-white focus:ring-2 focus:ring-[#004AC6]/15 transition-all"
                        placeholder="₹ 0.00"
                        min="0"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-[#434655] font-bold mb-1">Payment Type</label>
                      <SelectDropdown
                        value={paymentType}
                        onChange={(e) => setPaymentType(e.target.value)}
                        options={PAYMENT_TYPES}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-[#434655] font-bold mb-1">Pay Date</label>
                      <input
                        type="date"
                        value={paymentDate}
                        onChange={(e) => setPaymentDate(e.target.value)}
                        className="w-full py-2.5 px-3 bg-[#F2F4F6] border-none rounded-lg text-sm"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Payment History — EDIT flow: multi-payment system */}
              {!isNewInvoice && currentInvoiceId && (
                <section className="bg-white rounded-xl border border-[#C3C6D7]/10 shadow-sm overflow-hidden print:hidden">
                  {/* Header */}
                  <div className="px-6 py-4 bg-[#F2F4F6]/50 border-b border-[#C3C6D7]/10
                                  flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-[#191C1E]">Payment History</h3>
                      <p className="text-xs text-[#64748B] mt-0.5">
                        Paid: <strong className="text-[#0F172A]">₹{totalPaid.toFixed(2)}</strong>
                        {' · '}
                        Balance: <strong className={balanceDue > 0 ? 'text-[#BA1A1A]' : 'text-emerald-600'}>
                          ₹{balanceDue.toFixed(2)}
                        </strong>
                      </p>
                    </div>
                    {invoiceStatus !== 'paid' && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingPayment(null);
                          setPayForm({
                            payment_amount: balanceDue > 0 ? balanceDue.toFixed(2) : '',
                            payment_type: 'Cash',
                            payment_date: getLocalDateString(),
                            remark: ''
                          });
                          setShowPaymentForm(true);
                        }}
                        className="px-4 py-2 text-white text-xs font-bold rounded-lg
                                   shadow-lg shadow-[#004AC6]/20 active:scale-95 transition-all cursor-pointer"
                        style={{ background: 'linear-gradient(135deg, #004AC6 0%, #2563EB 100%)' }}
                      >
                        + Add Payment
                      </button>
                    )}
                  </div>

                  {/* Payment list */}
                  {payments.length === 0 ? (
                    <div className="px-6 py-8 text-center">
                      <p className="text-sm text-[#64748B]">No payments recorded yet</p>
                    </div>
                  ) : (
                    <table className="w-full">
                      <thead>
                        <tr className="bg-[#F2F4F6]">
                          <th className="py-3 px-6 text-left text-[10px] font-extrabold text-[#434655] uppercase tracking-wider">Date</th>
                          <th className="py-3 px-6 text-left text-[10px] font-extrabold text-[#434655] uppercase tracking-wider">Type</th>
                          <th className="py-3 px-6 text-right text-[10px] font-extrabold text-[#434655] uppercase tracking-wider">Amount</th>
                          <th className="py-3 px-6 text-left text-[10px] font-extrabold text-[#434655] uppercase tracking-wider">Remark</th>
                          <th className="py-3 px-6" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#ECEEF0]">
                        {payments.map(pay => (
                          <tr key={pay.id} className="hover:bg-[#F2F4F6]/50 transition-colors">
                            <td className="py-3 px-6 text-sm text-[#64748B]">{pay.payment_date}</td>
                            <td className="py-3 px-6">
                              <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5
                                               rounded text-[10px] font-bold">
                                {pay.payment_type}
                              </span>
                            </td>
                            <td className="py-3 px-6 text-right text-sm font-semibold text-[#2563EB]">
                              ₹{(parseFloat(pay.payment_amount) || 0).toFixed(2)}
                            </td>
                            <td className="py-3 px-6 text-sm text-[#64748B]">{pay.remark}</td>
                            <td className="py-3 px-6">
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingPayment(pay);
                                    setPayForm({
                                      payment_amount: pay.payment_amount.toString(),
                                      payment_type: pay.payment_type,
                                      payment_date: pay.payment_date,
                                      remark: pay.remark || ''
                                    });
                                    setShowPaymentForm(true);
                                  }}
                                  className="p-2 rounded-full text-[#434655] hover:text-[#004AC6]
                                             hover:bg-white hover:shadow-sm transition-all cursor-pointer"
                                >
                                  <SquarePen size={14} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeletePayment(pay.id)}
                                  className="p-2 rounded-full text-[#434655] hover:text-[#DC2626]
                                             hover:bg-white hover:shadow-sm transition-all cursor-pointer"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                  {/* Add/Edit payment inline form */}
                  {showPaymentForm && (
                    <div className="px-6 py-4 bg-[#F8FAFC] border-t border-[#E2E8F0]">
                      <p className="text-xs font-bold text-[#434655] uppercase tracking-wider mb-3">
                        {editingPayment ? 'Edit Payment' : 'New Payment'}
                      </p>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div>
                          <label className="text-[10px] font-bold text-[#434655] uppercase mb-1.5 ml-1 block">
                            Amount
                          </label>
                          <input
                            type="number"
                            value={payForm.payment_amount}
                            onChange={e => setPayForm(p => ({ ...p, payment_amount: e.target.value }))}
                            className="w-full py-2.5 px-3 bg-[#F2F4F6] border-none rounded-lg text-sm
                                       focus:bg-white focus:ring-2 focus:ring-[#004AC6]/15 transition-all"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-[#434655] uppercase mb-1.5 ml-1 block">
                            Type
                          </label>
                          <SelectDropdown
                            value={payForm.payment_type}
                            onChange={e => setPayForm(p => ({ ...p, payment_type: e.target.value }))}
                            options={['Cash', 'UPI', 'Transfer', 'RTGS']}
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-[#434655] uppercase mb-1.5 ml-1 block">
                            Date
                          </label>
                          <input
                            type="date"
                            value={payForm.payment_date}
                            onChange={e => setPayForm(p => ({ ...p, payment_date: e.target.value }))}
                            className="w-full py-2.5 px-3 bg-[#F2F4F6] border-none rounded-lg text-sm
                                       focus:bg-white focus:ring-2 focus:ring-[#004AC6]/15 transition-all"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-[#434655] uppercase mb-1.5 ml-1 block">
                            Remark
                          </label>
                          <input
                            type="text"
                            value={payForm.remark}
                            onChange={e => setPayForm(p => ({ ...p, remark: e.target.value }))}
                            placeholder="Optional"
                            className="w-full py-2.5 px-3 bg-[#F2F4F6] border-none rounded-lg text-sm
                                       focus:bg-white focus:ring-2 focus:ring-[#004AC6]/15 transition-all"
                          />
                        </div>
                      </div>
                      <div className="flex gap-2 mt-3">
                        <button
                          type="button"
                          onClick={handleSavePayment}
                          className="px-5 py-2 text-white font-bold text-xs rounded-lg
                                     shadow-lg shadow-[#004AC6]/20 active:scale-95 transition-all cursor-pointer"
                          style={{ background: 'linear-gradient(135deg, #004AC6 0%, #2563EB 100%)' }}
                        >
                          {editingPayment ? 'Update Payment' : 'Save Payment'}
                        </button>
                        <button
                          type="button"
                          onClick={() => { setShowPaymentForm(false); setEditingPayment(null); }}
                          className="px-5 py-2 bg-[#E6E8EA] text-[#191C1E] font-bold text-xs
                                     rounded-lg hover:bg-[#E0E3E5] transition-colors cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </section>
              )}

              {/* Remarks / Notes */}
              <div>
                <div className="flex items-center justify-between mb-2 ml-1">
                  <label className="block text-xs font-bold text-[#434655] uppercase">Remarks / Notes</label>
                  <label className="flex items-center gap-2 cursor-pointer print:hidden">
                    <input
                      type="checkbox"
                      checked={isPrivateNote}
                      onChange={(e) => setIsPrivateNote(e.target.checked)}
                      className="w-4 h-4 rounded border-[#C3C6D7] text-[#004AC6] focus:ring-[#004AC6]/20 cursor-pointer"
                    />
                    <span className="text-xs font-medium text-[#434655]">Private Note — hidden in PDF</span>
                  </label>
                </div>
                <textarea
                  value={remark}
                  onChange={(e) => setRemark(e.target.value)}
                  className="w-full p-4 bg-white border-none rounded-xl text-sm shadow-sm focus:ring-2 focus:ring-[#004AC6]/10"
                  placeholder="Add any special instructions or remarks here..."
                  rows="3"
                />
              </div>
            </div>

            {/* Right Column (col-span-5) — Calculation Summary */}
            <div className="col-span-12 md:col-span-5">
              <div className="bg-white p-8 rounded-2xl shadow-[0_20px_50px_rgba(25,28,30,0.04)] border border-[#C3C6D7]/10">
                <h3 className="text-xs font-extrabold text-[#434655] uppercase tracking-widest mb-6 pb-4 border-b border-[#ECEEF0]">Calculation Summary</h3>

                <div className="space-y-4 text-sm">
                  <div className="flex justify-between items-center text-[#434655]">
                    <span>Subtotal</span>
                    <span className="font-semibold text-[#191C1E]">₹ {formatNumber(total)}</span>
                  </div>

                  <div className="flex justify-between items-center text-[#434655]">
                    <span>Packing Charges</span>
                    <div className="w-24">
                      <input
                        type="number"
                        value={packing}
                        onChange={(e) => setPacking(e.target.value)}
                        className="w-full text-right p-1 bg-[#F2F4F6] border-none rounded text-xs font-medium"
                        placeholder="0.00"
                      />
                    </div>
                  </div>

                  <div className="flex justify-between items-center text-[#434655]">
                    <span>Freight / Delivery</span>
                    <div className="w-24">
                      <input
                        type="number"
                        value={freight}
                        onChange={(e) => setFreight(e.target.value)}
                        className="w-full text-right p-1 bg-[#F2F4F6] border-none rounded text-xs font-medium"
                        placeholder="0.00"
                      />
                    </div>
                  </div>

                  <div className="flex justify-between items-center text-[#434655]">
                    <span>Riksha Charges</span>
                    <div className="w-24">
                      <input
                        type="number"
                        value={riksha}
                        onChange={(e) => setRiksha(e.target.value)}
                        className="w-full text-right p-1 bg-[#F2F4F6] border-none rounded text-xs font-medium"
                        placeholder="0.00"
                      />
                    </div>
                  </div>

                  <div className="flex justify-between items-center text-[#434655]">
                    <span>Round Off</span>
                    <span className="text-[#BA1A1A] font-medium">₹ {roundOff.toFixed(2)}</span>
                  </div>

                  {/* Grand Total */}
                  <div className="pt-6 mt-2 border-t border-[#ECEEF0]">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-extrabold text-[#191C1E] uppercase">Grand Total</span>
                      <span className="text-2xl font-black text-[#004AC6]">₹ {formatIndian(grandTotal)}</span>
                    </div>
                  </div>

                  {/* Payment entries below Grand Total */}
                  {/* CREATE flow: single payment entry */}
                  {isNewInvoice && parseFloat(paymentAmount || 0) > 0 && (
                    <>
                      <div className="flex justify-between items-center pt-3 border-t border-dashed border-[#ECEEF0]">
                        <span className="text-sm text-[#434655]">
                          Payment ({paymentType})
                        </span>
                        <span className="text-sm font-semibold text-emerald-600">
                          − ₹ {formatIndian(parseFloat(paymentAmount || 0))}
                        </span>
                      </div>
                      {grandTotal - parseFloat(paymentAmount || 0) > 0 && (
                        <div className="flex justify-between items-center pt-2">
                          <span className="text-sm font-extrabold text-[#191C1E] uppercase">Pending</span>
                          <span className="text-lg font-black text-[#BA1A1A]">
                            ₹ {formatIndian(grandTotal - parseFloat(paymentAmount || 0))}
                          </span>
                        </div>
                      )}
                    </>
                  )}

                  {/* EDIT flow: multi-payment entries */}
                  {!isNewInvoice && payments.length > 0 && (
                    <>
                      {payments.map((pay, idx) => (
                        <div key={pay.id || idx} className="flex justify-between items-center pt-3 border-t border-dashed border-[#ECEEF0]">
                          <span className="text-sm text-[#434655]">
                            {pay.remark || pay.payment_type || 'Payment'}
                            <span className="text-[10px] text-[#94A3B8] ml-1.5">({pay.payment_date})</span>
                          </span>
                          <span className="text-sm font-semibold text-emerald-600">
                            − ₹ {formatIndian(pay.payment_amount)}
                          </span>
                        </div>
                      ))}
                      {balanceDue > 0 && (
                        <div className="flex justify-between items-center pt-3 border-t border-[#ECEEF0]">
                          <span className="text-sm font-extrabold text-[#191C1E] uppercase">Pending</span>
                          <span className="text-lg font-black text-[#BA1A1A]">
                            ₹ {formatIndian(balanceDue)}
                          </span>
                        </div>
                      )}
                      {balanceDue <= 0 && (
                        <div className="flex justify-between items-center pt-3 border-t border-[#ECEEF0]">
                          <span className="text-sm font-extrabold text-emerald-700 uppercase">Fully Paid</span>
                          <span className="text-sm font-bold text-emerald-700">✓</span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Print-only: Payment & Balance Due */}
        {totalPaid > 0 && (
          <div className="hidden print:block px-6 pb-4">
            <div className="border-t border-gray-200 pt-3">
              {payments.map((pay, idx) => (
                <div key={pay.id || idx} className="flex justify-between mb-1">
                  <span className="text-sm text-gray-600">
                    {pay.remark || pay.payment_type || 'Payment'} ({pay.payment_date}):
                  </span>
                  <span className="text-sm font-medium">− ₹{formatNumber(pay.payment_amount)}</span>
                </div>
              ))}
              {balanceDue > 0 && (
                <div className="flex justify-between font-semibold text-green-700 mt-2 pt-2 border-t border-gray-200">
                  <span>Balance Due:</span>
                  <span>₹{formatIndian(balanceDue)}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Output Preferences + Action Buttons — aligned right under summary */}
        <div className="px-4 sm:px-8 pb-8 print:hidden">
          <div className="grid grid-cols-12 gap-8">
            <div className="col-span-7"></div>
            <div className="col-span-12 md:col-span-5 space-y-4">
              {/* Output Preferences */}
              <label className="block text-xs font-bold text-[#434655] uppercase mb-2 ml-1">Output Preferences</label>
              <div className="bg-white p-6 rounded-xl border border-[#C3C6D7]/10 flex items-start gap-4 shadow-sm">
                <div className="bg-[#004AC6] text-white p-2 rounded-lg shrink-0">
                  <Languages size={16} />
                </div>
                <div className="flex-1">
                  <label className="flex items-center gap-3 cursor-pointer group mb-1">
                    <input
                      type="checkbox"
                      checked={printMarathi}
                      onChange={(e) => setPrintMarathi(e.target.checked)}
                      className="w-5 h-5 rounded border-[#C3C6D7] text-[#004AC6] focus:ring-[#004AC6]/20 cursor-pointer"
                    />
                    <span className="text-sm font-medium text-[#434655] group-hover:text-[#191C1E] transition-colors">Print Product Names in Marathi</span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Footer Action Buttons — mutually exclusive Save / Print + Delete */}
          <div className="pt-8 border-t border-[#C3C6D7]/10 flex justify-between items-center mt-6">
            {/* Delete button (left side) — only for existing invoices */}
            <div>
              {(currentInvoiceId && !isNewInvoice) && (
                <button
                  onClick={() => setShowDeleteModal(true)}
                  className="cursor-pointer px-6 py-3 bg-[#DC2626] text-white font-bold text-xs uppercase rounded-xl shadow-lg shadow-[#DC2626]/20 hover:bg-red-700 active:scale-95 transition-all flex items-center gap-2"
                >
                  <Trash2 size={18} />
                  Delete Estimate
                </button>
              )}
            </div>
            {/* Save / Print button (right side) */}
            <div>
              {isDirty ? (
                <button
                  onClick={handleSave}
                  className="cursor-pointer px-12 py-3 bg-gradient-to-br from-[#004AC6] to-[#2563EB] text-white font-bold text-xs uppercase rounded-xl shadow-lg shadow-[#004AC6]/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center gap-2"
                >
                  <Save size={18} />
                  Save & Confirm
                </button>
              ) : (currentInvoiceId || !isNewInvoice) && (
                <button
                  onClick={handlePrint}
                  disabled={isTranslating}
                  className={`cursor-pointer px-8 py-3 bg-[#E6E8EA] text-[#191C1E] font-bold text-xs uppercase rounded-xl hover:bg-[#E0E3E5] transition-all flex items-center gap-2 ${isTranslating ? 'opacity-50' : ''}`}
                >
                  <Printer size={18} />
                  {isTranslating ? 'Translating...' : 'Print Estimate'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ─── Delete Invoice Confirmation Modal — Stitch Glass Overlay ─── */}
      {showDeleteModal && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 print:hidden outline-none"
          style={{ backdropFilter: 'blur(8px)', backgroundColor: 'rgba(255,255,255,0.7)' }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-invoice-heading"
          tabIndex={-1}
          ref={deleteModalRef}
          onKeyDown={(e) => { if (e.key === 'Escape' && !isDeletePending) { setShowDeleteModal(false); } }}
          onClick={(e) => { if (e.target === e.currentTarget && !isDeletePending) { setShowDeleteModal(false); } }}
        >
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-[#C3C6D7]/20 p-8">
            <div className="w-12 h-12 rounded-full bg-red-100/50 flex items-center justify-center text-red-600 mb-6 mx-auto">
              <AlertTriangle size={28} />
            </div>
            <h2 id="delete-invoice-heading" className="text-2xl font-extrabold text-[#0F172A] tracking-tight mb-3 text-center">
              Delete Estimate?
            </h2>
            <p className="text-[#434655] leading-relaxed mb-6 text-center">
              Are you sure you want to permanently delete <span className="font-bold text-[#191C1E]">"{currentInvoiceId}"</span>? All items, maal entries, and linked payments will be removed. This action cannot be undone.
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={() => { setShowDeleteModal(false); }}
                disabled={isDeletePending}
                className="flex-1 px-6 py-3 bg-[#E6E8EA] text-[#191C1E] font-bold rounded-xl hover:bg-[#E0E3E5] transition-all text-sm cursor-pointer disabled:opacity-50"
              >Cancel</button>
              <button
                onClick={handleDeleteInvoice}
                disabled={isDeletePending}
                className="flex-1 px-6 py-3 bg-[#DC2626] text-white font-bold rounded-xl shadow-lg shadow-[#DC2626]/20 hover:bg-red-700 active:scale-95 transition-all text-sm cursor-pointer disabled:opacity-50"
              >
                {isDeletePending ? 'Deleting...' : 'Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Invoice;