import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Printer, Plus, Trash2, Save, Edit, AlertTriangle, Languages, CircleX } from 'lucide-react';
import { useParams, useNavigate, useLocation, useBlocker } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import { Search } from 'lucide-react';
import { toast } from 'react-hot-toast';
import {
  generateProductCode,
  capitalizeWords,
  findProductByNameAndSize,
  findProductByCode,
  productCodeExists,
  normalizeProductCode,
  ALLOWED_PACKING_TYPES,
  DEFAULT_PACKING_TYPE,
  sortProducts
} from '../../utils/productUtils';

// Add Item Form Component
// Improved Add Item Form Component
const AddItemForm = ({ newItem, setNewItem, handleAddItem, products, formErrors, productNameInputRef, onProductSelected }) => {
  const [showProdDropdown, setShowProdDropdown] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
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
              className={`w-full py-2.5 px-3 bg-[#F2F4F6] border-none rounded-lg text-sm focus:bg-white focus:ring-2 focus:ring-[#004AC6]/15 transition-all pr-10 ${formErrors.productName ? 'ring-2 ring-red-500' : ''}`}
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
                        ₹{(p.selling_price ?? p.sellingPrice ?? 0).toFixed(2)}
                      </span>
                    </button>
                  ))
                ) : (
                  <div className="px-4 py-3 text-sm text-[#434655]/60 text-center italic">
                    No products found — will create new
                  </div>
                )}
              </div>
            )}
          </div>
          {formErrors.productName && (
            <p className="mt-1 text-xs text-red-600 flex items-center">
              <AlertCircle size={14} className="mr-1" />
              {formErrors.productName}
            </p>
          )}
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
        </div>

        {/* Qty + Unit — col-span-2 */}
        <div className="col-span-6 md:col-span-2">
          <div className="flex gap-1">
            <div className="w-2/3">
              <label className="block text-[10px] font-bold text-[#434655] uppercase mb-1.5 ml-1">Qty</label>
              <input
                ref={quantityInputRef}
                type="number"
                min="0.001"
                step="0.001"
                value={newItem.quantity}
                onChange={(e) => setNewItem({ ...newItem, quantity: e.target.value })}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddItem(); } }}
                className={`w-full py-2.5 px-3 bg-[#F2F4F6] border-none rounded-lg text-sm focus:bg-white focus:ring-2 focus:ring-[#004AC6]/15 transition-all ${formErrors.quantity ? 'ring-2 ring-red-500' : ''}`}
                placeholder="0"
              />
            </div>
            <div className="w-1/3">
              <label className="block text-[10px] font-bold text-[#434655] uppercase mb-1.5 ml-1">Unit</label>
              <select
                value={newItem.packingType}
                onChange={(e) => setNewItem({ ...newItem, packingType: e.target.value })}
                className="w-full py-2.5 px-1.5 bg-[#F2F4F6] border-none rounded-lg text-[11px] font-bold appearance-none"
              >
                {ALLOWED_PACKING_TYPES.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
          </div>
          {formErrors.quantity && (
            <p className="mt-1 text-xs text-red-600 flex items-center">
              <AlertCircle size={14} className="mr-1" />
              {formErrors.quantity}
            </p>
          )}
        </div>

        {/* Rate — col-span-2 */}
        <div className="col-span-6 md:col-span-2">
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
              className={`w-full pl-7 py-2.5 pr-3 bg-[#F2F4F6] border-none rounded-lg text-sm focus:bg-white focus:ring-2 focus:ring-[#004AC6]/15 transition-all ${formErrors.sellingPrice ? 'ring-2 ring-red-500' : ''}`}
              placeholder="0.00"
            />
          </div>
          {formErrors.sellingPrice && (
            <p className="mt-1 text-xs text-red-600 flex items-center">
              <AlertCircle size={14} className="mr-1" />
              {formErrors.sellingPrice}
            </p>
          )}
        </div>

        {/* Add Button — col-span-2 */}
        <div className="col-span-12 md:col-span-2">
          <button
            onClick={handleAddItem}
            className="cursor-pointer w-full py-2.5 bg-gradient-to-br from-[#004AC6] to-[#2563EB] text-white font-bold text-sm uppercase rounded-lg shadow-sm hover:opacity-90 transition-all flex items-center justify-center gap-2"
          >
            <Plus size={16} />
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
    size: '',
    quantity: '',
    packingType: DEFAULT_PACKING_TYPE,
    sellingPrice: '',
    originalProduct: null, // Track the originally selected product
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
  const [showNavigationWarning, setShowNavigationWarning] = useState(false);

  // Payment/Advance state
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentType, setPaymentType] = useState('Cash');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const PAYMENT_TYPES = ['Cash', 'UPI', 'Transfer', 'RTGS'];

  // Original invoice data for dirty state detection (when editing existing invoice)
  const [originalInvoiceData, setOriginalInvoiceData] = useState(null);
  const [isNewInvoice, setIsNewInvoice] = useState(true);

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
    if (parseFloat(paymentAmount || 0) !== parseFloat(originalInvoiceData.payment_amount || 0)) return true;
    if (paymentType !== (originalInvoiceData.payment_type || 'Cash')) return true;
    if (paymentDate !== (originalInvoiceData.payment_date || originalInvoiceData.invoice_date)) return true;

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
  }, [isNewInvoice, customerId, invoiceItems, originalInvoiceData, remark, invoiceDate, packing, freight, riksha, paymentAmount, paymentType, paymentDate]);

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
    setInvoiceDate(new Date().toISOString().split('T')[0]);
    setFormErrors({});
    setIsEditing(false);
    setIsSaved(true);
    setCurrentInvoiceId('');
    setEditIndex(-1);
    // Reset payment fields
    setPaymentAmount('');
    setPaymentType('Cash');
    setPaymentDate(new Date().toISOString().split('T')[0]);
    // Reset dirty state tracking
    setOriginalInvoiceData(null);
    setIsNewInvoice(true);

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

  // Reset state when navigating to /invoice without an invoiceNo (new invoice)
  useEffect(() => {
    if (!invoiceNo && location.pathname === '/invoice') {
      resetInvoiceState();
    }
  }, [invoiceNo, location.pathname, resetInvoiceState]);

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

            // Quantity (numeric, 3 dp)
            const quantity = parseFloat(item.quantity).toFixed(3);

            return {
              ...item,
              productName,
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

          // Load payment info if exists
          if (inv.payment_amount && inv.payment_amount > 0) {
            setPaymentAmount(inv.payment_amount.toString());
            setPaymentType(inv.payment_type || 'Cash');
            setPaymentDate(inv.payment_date || inv.invoice_date);
          } else {
            setPaymentAmount('');
            setPaymentType('Cash');
            setPaymentDate(inv.invoice_date);
          }

          // Store original data for dirty state detection
          setOriginalInvoiceData(inv);
          setIsNewInvoice(false);

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

  const handleAddItem = async () => {
    if (!validateForm()) return;

    const quantity = parseFloat(newItem.quantity);
    const sellingPrice = parseFloat(newItem.sellingPrice);

    if (isNaN(quantity) || isNaN(sellingPrice) || quantity <= 0 || sellingPrice <= 0) {
      toast.error('Please enter valid quantity and selling price');
      return;
    }

    const amount = quantity * sellingPrice;

    // Check if user selected an existing product and then modified the name/size
    const originalProduct = newItem.originalProduct;
    const nameChanged = originalProduct && originalProduct.name !== newItem.productName;
    const sizeChanged = originalProduct && (originalProduct.size || '') !== (newItem.size || '');

    let productCode = newItem.code;
    let isNewProduct = !newItem.code;

    // If name or size was changed, treat as new product
    if (nameChanged || sizeChanged) {
      // Check if a product with this new name+size combination exists
      const existingProduct = findProductByNameAndSize(newItem.productName, newItem.size, products);

      if (existingProduct) {
        // Use existing product's code
        productCode = existingProduct.code;
        isNewProduct = false;

        // Check if price is different - sync if needed
        const existingPrice = existingProduct.selling_price ?? existingProduct.sellingPrice ?? 0;
        if (existingPrice !== sellingPrice) {
          try {
            await window.api.invoke('products:update', {
              code: productCode,
              name: existingProduct.name,
              size: existingProduct.size || '',
              packing_type: existingProduct.packing_type || newItem.packingType,
              cost_price: existingProduct.cost_price || 0,
              selling_price: sellingPrice
            });
            toast.success('Price updated in Price List');

            // Refresh products list
            const updatedProducts = await window.api.getProducts();
            setProducts(updatedProducts);
          } catch (err) {
            console.error('Error updating product price:', err);
          }
        }
      } else {
        // New product - generate code
        productCode = generateProductCode(newItem.productName, newItem.size);
        isNewProduct = true;
      }
    } else if (newItem.code && originalProduct) {
      // Using existing product without name change - check if price changed
      const originalPrice = originalProduct.selling_price ?? originalProduct.sellingPrice ?? 0;
      if (originalPrice !== sellingPrice) {
        try {
          await window.api.invoke('products:update', {
            code: newItem.code,
            name: originalProduct.name,
            size: originalProduct.size || '',
            packing_type: originalProduct.packing_type || newItem.packingType,
            cost_price: originalProduct.cost_price || 0,
            selling_price: sellingPrice
          });
          toast.success('Price updated in Price List');

          // Refresh products list
          const updatedProducts = await window.api.getProducts();
          setProducts(updatedProducts);
        } catch (err) {
          console.error('Error updating product price:', err);
        }
      }
    } else if (!newItem.code) {
      // Completely new product typed in
      productCode = generateProductCode(newItem.productName, newItem.size);
      isNewProduct = true;
    }

    // Create new product if needed
    if (isNewProduct) {
      try {
        // Check if code already exists
        if (productCodeExists(productCode, products)) {
          toast.error('A product with this name and size already exists. Please use a different name or size.');
          return;
        }

        await window.api.invoke('products:create', {
          code: productCode,
          name: newItem.productName,
          size: newItem.size || '',
          packing_type: newItem.packingType,
          cost_price: 0,
          selling_price: sellingPrice
        });

        const updatedProducts = await window.api.getProducts();
        setProducts(updatedProducts);

        toast.success('New product created and added to invoice');
      } catch (err) {
        console.error('Error creating product:', err);
        toast.error('Error creating product');
        return;
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
      if (!isNewProduct) {
        toast.success('Item added successfully');
      }
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
      })),
      // Payment/Advance fields
      payment_amount: parseFloat(paymentAmount || 0),
      payment_type: paymentType,
      payment_date: paymentDate || invoiceDate
    };

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

      // Only on confirmed success
      toast.success(`Invoice saved successfully (ID: ${data.invoice_id || currentInvoiceId})`);

      const savedInvoiceId = data.invoice_id || currentInvoiceId;

      // if it was a create request, persist the returned id for future updates
      if (!currentInvoiceId && data.invoice_id) {
        setCurrentInvoiceId(data.invoice_id);
        setCustomInvoiceNo(data.invoice_id);
      }

      // Update original data to reflect saved state (makes isDirty = false)
      setOriginalInvoiceData({
        ...payload,
        invoice_id: savedInvoiceId,
        items: invoiceItems.map(i => ({
          product_code: i.code || i.product_code,
          quantity: parseFloat(i.quantity),
          selling_price: parseFloat(i.sellingPrice)
        }))
      });
      setIsNewInvoice(false);
      setIsSaved(true);
      setIsEditing(false);
    } catch (err) {
      console.error('Error saving invoice:', err);
      toast.error('An error occurred while saving. Please try again.');
      // Keep data, do NOT clear or navigate
    }
  };

  // Marathi print state
  const [printMarathi, setPrintMarathi] = useState(false);
  const [marathiNames, setMarathiNames] = useState({}); // code -> marathi_name
  const [isTranslating, setIsTranslating] = useState(false);

  const handlePrint = async () => {
    if (printMarathi) {
      // Validate Marathi names exist for all items
      const codes = invoiceItems.map(i => i.code || i.product_code);
      try {
        const { missing } = await window.api.invoke('translate:checkMissing', codes);
        if (missing.length > 0) {
          // Try to translate missing ones
          setIsTranslating(true);
          try {
            let allTranslated = true;
            for (const code of missing) {
              const res = await window.api.invoke('translate:toMarathi', code);
              if (!res.success) {
                allTranslated = false;
                break;
              }
            }
            if (!allTranslated) {
              toast.error('Marathi names missing. Please connect to internet for translation.');
              setIsTranslating(false);
              return;
            }
            toast.success('Ready to print in Marathi');
            setIsTranslating(false);
            // Don't auto-print — user must click again
            return;
          } catch (err) {
            toast.error('Marathi names missing. Please connect to internet for translation.');
            setIsTranslating(false);
            return;
          }
        }
        // All Marathi names exist — fetch them
        const { names } = await window.api.invoke('translate:getMarathiNames', codes);
        setMarathiNames(names);
        // Small delay to let state update before printing
        setTimeout(() => {
          const originalTitle = document.title;
          if (buyer && customInvoiceNo) {
            document.title = `${buyer} ${customInvoiceNo}`;
          }
          window.print();
          document.title = originalTitle;
        }, 100);
      } catch (err) {
        toast.error('Error checking Marathi translations');
      }
    } else {
      const originalTitle = document.title;
      if (buyer && customInvoiceNo) {
        document.title = `${buyer} ${customInvoiceNo}`;
      }
      window.print();
      document.title = originalTitle;
    }
  };

  const { roundOff, grandTotal } = calculateGrandTotal();
  return (
    <div className="p-2 sm:p-6 min-h-screen bg-[#F7F9FB] print:bg-white print:p-0 print:text-black">
      {/* Navigation Warning Modal */}
      {blocker.state === 'blocked' && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[100] print:hidden">
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
              This invoice is not saved. Do you want to leave this page?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => blocker.reset()}
                className="flex-1 px-4 py-2.5 rounded-lg bg-[#2563EB] text-white font-medium hover:bg-[#1D4ED8] transition-colors cursor-pointer"
              >
                Stay on Page
              </button>
              <button
                onClick={() => blocker.proceed()}
                className="flex-1 px-4 py-2.5 rounded-lg border border-[#E2E8F0] text-[#64748B] font-medium hover:bg-[#F1F5F9] transition-colors cursor-pointer"
              >
                Leave Without Saving
              </button>
            </div>
          </div>
        </div>
      )}

      <div
        ref={printRef}
        className="max-w-[1040px] mx-auto bg-white shadow-sm rounded-xl border border-[#E2E8F0] overflow-hidden print:shadow-none print:rounded-none print:border-none print:w-[210mm] print:min-h-[297mm]"
      >
        {/* Top Bar — Estimate ID / Title / Date */}
        <div className="px-4 sm:px-6 py-4 border-b border-[#E2E8F0] bg-[#F8FAFC] print:bg-white print:py-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-[#64748B] uppercase tracking-wider">Reference</p>
              <p className="text-sm font-bold text-[#2563EB]">{customInvoiceNo || '...'}</p>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-[#0F172A] tracking-wide">ESTIMATE</h1>
            <div className="text-right">
              <p className="text-xs font-medium text-[#64748B] uppercase tracking-wider">Transaction Date</p>
              <input
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
                className="text-sm font-semibold text-[#0F172A] border border-[#E2E8F0] rounded-md px-2 py-1 focus:ring-2 focus:ring-[#2563EB] focus:border-transparent print:border-none print:bg-transparent print:p-0"
              />
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
                      setAddress('');
                      setMobileNo('');
                    }
                  }}
                  className="w-full pl-10 pr-10 py-3 bg-[#F2F4F6] border-none rounded-lg text-sm focus:bg-white focus:ring-2 focus:ring-[#004AC6]/15 transition-all"
                  placeholder="Search customer name..."
                />
                {buyer && (
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => { setBuyer(''); setCustomerId(''); setAddress(''); setMobileNo(''); }}
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
                    .map((c) => (
                      <li
                        key={c.customer_id}
                        className="px-4 py-3 hover:bg-[#EFF6FF] cursor-pointer text-sm transition-colors"
                        onClick={() => handleSelectCustomer(c)}
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
                placeholder="+91 98765 43210"
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
                      {item.quantity} {item.packingType}
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
              {/* Payment Details */}
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
                    <select
                      value={paymentType}
                      onChange={(e) => setPaymentType(e.target.value)}
                      className="w-full py-2.5 px-3 bg-[#F2F4F6] border-none rounded-lg text-sm appearance-none"
                    >
                      {PAYMENT_TYPES.map(type => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>
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

              {/* Remarks / Notes */}
              <div>
                <label className="block text-xs font-bold text-[#434655] uppercase mb-2 ml-1">Remarks / Notes</label>
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
                      <span className="text-2xl font-black text-[#004AC6]">₹ {grandTotal.toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Balance Due (if payment made) */}
                  {parseFloat(paymentAmount || 0) > 0 && (
                    <div className="flex justify-between pt-3 border-t border-dashed border-[#ECEEF0] print:hidden">
                      <span className="text-sm font-semibold text-green-700">Balance Due</span>
                      <span className="text-sm font-semibold text-green-700">₹ {(grandTotal - parseFloat(paymentAmount || 0)).toFixed(2)}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Print-only: Payment & Balance Due (read-only text for print) */}
        {parseFloat(paymentAmount || 0) > 0 && (
          <div className="hidden print:block px-6 pb-4">
            <div className="border-t border-gray-200 pt-3">
              <div className="flex justify-between mb-2">
                <span className="text-sm text-gray-600">Payment / Advance Received ({paymentType}):</span>
                <span className="text-sm font-medium">₹{parseFloat(paymentAmount || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-semibold text-green-700">
                <span>Balance Due:</span>
                <span>₹{(grandTotal - parseFloat(paymentAmount || 0)).toFixed(2)}</span>
              </div>
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
                  <Languages size={20} />
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
                  <p className="text-[11px] text-[#434655]/70 leading-relaxed">System will automatically fetch translated names from the catalog master if available.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Footer Action Buttons */}
          <div className="pt-8 border-t border-[#C3C6D7]/10 flex justify-end gap-4 mt-6">
            <button
              onClick={handlePrint}
              disabled={isTranslating}
              className={`cursor-pointer px-8 py-3 bg-[#E6E8EA] text-[#191C1E] font-bold text-xs uppercase rounded-xl hover:bg-[#E0E3E5] transition-all flex items-center gap-2 ${isTranslating ? 'opacity-50' : ''}`}
            >
              <Printer size={18} />
              {isTranslating ? 'Translating...' : 'Print Estimate'}
            </button>
            {isDirty && (
              <button
                onClick={handleSave}
                className="cursor-pointer px-12 py-3 bg-gradient-to-br from-[#004AC6] to-[#2563EB] text-white font-bold text-xs uppercase rounded-xl shadow-lg shadow-[#004AC6]/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center gap-2"
              >
                <Save size={18} />
                Save & Confirm
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Invoice;