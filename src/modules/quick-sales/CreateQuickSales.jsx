import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Printer, Plus, Trash2, Save, Edit, AlertTriangle, Languages, CircleX } from 'lucide-react';
import { useParams, useNavigate, useLocation, useBlocker } from 'react-router-dom';
import { AlertCircle, Search } from 'lucide-react';
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

// Add Item Form Component (shared with Invoice)
const AddItemForm = ({ newItem, setNewItem, handleAddItem, products, formErrors, productNameInputRef }) => {
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

    const clearProductSearch = () => {
        setNewItem({ ...newItem, productName: '', code: '', size: '', sellingPrice: '', originalProduct: null });
        setShowProdDropdown(false);
        setHighlightedIndex(-1);
        if (productNameInputRef?.current) productNameInputRef.current.focus();
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Escape') {
            e.preventDefault();
            clearProductSearch();
            return;
        }
        if (e.key === 'Tab' && !e.shiftKey) {
            // Tab from product name: go to Qty if DB product, Size if ad-hoc
            e.preventDefault();
            setShowProdDropdown(false);
            if (newItem.code) {
                quantityInputRef.current?.focus();
            } else {
                sizeInputRef.current?.focus();
            }
            return;
        }
        if (!showProdDropdown) return;
        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setHighlightedIndex(prev => Math.min(prev + 1, filteredProducts.length - 1));
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
        }
    };

    const handleProductSelect = (product) => {
        setNewItem({
            ...newItem,
            code: product.code,
            productName: product.name,
            size: product.size || '',
            sellingPrice: (product.selling_price ?? product.sellingPrice ?? 0).toString(),
            packingType: product.packing_type || product.packingType || DEFAULT_PACKING_TYPE,
            originalProduct: product,
        });
        setShowProdDropdown(false);
        setHighlightedIndex(-1);
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
        <div className="bg-white p-6 rounded-xl border border-[#2563EB]/20 shadow-[0_8px_30px_rgb(37,99,235,0.04)] mb-8">
            <div className="flex items-center gap-2 mb-5">
                <Plus size={20} className="text-[#2563EB]" />
                <h2 className="text-sm font-bold text-[#191C1E] uppercase tracking-tight">Fast Entry Console</h2>
            </div>

            <div className="grid grid-cols-12 gap-3 items-end">
                {/* Product Name — col-span-3 */}
                <div className="col-span-12 md:col-span-3 relative" ref={prodWrapperRef}>
                    <label className="block text-[10px] font-bold text-[#434655] uppercase mb-1.5 ml-1">Product Name</label>
                    <div className="relative">
                        <input
                            ref={productNameInputRef}
                            type="text"
                            value={newItem.productName}
                            onFocus={() => { setShowProdDropdown(true); setHighlightedIndex(0); }}
                            onChange={(e) => {
                                const capitalizedValue = capitalizeWords(e.target.value);
                                setNewItem({ ...newItem, productName: capitalizedValue, code: '' });
                                setShowProdDropdown(true);
                                setHighlightedIndex(0);
                            }}
                            onKeyDown={handleKeyDown}
                            className={`w-full py-2.5 px-3 bg-[#F2F4F6] border-none rounded-lg text-sm focus:bg-white focus:ring-2 focus:ring-[#004AC6]/15 transition-all pr-10 ${formErrors.productName ? 'ring-2 ring-red-500' : ''}`}
                            placeholder="Search product..."
                        />
                        {newItem.productName ? (
                            <button
                                type="button"
                                onClick={clearProductSearch}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#434655] hover:text-red-500 cursor-pointer transition-colors"
                                aria-label="Clear product search"
                                tabIndex={-1}
                            >
                                <CircleX size={16} />
                            </button>
                        ) : (
                            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-[#434655]" size={16} />
                        )}
                        {showProdDropdown && (
                            <div className="absolute z-50 w-full mt-1 bg-white border border-[#C3C6D7]/30 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                                {filteredProducts.length > 0 ? (
                                    filteredProducts.map((p, index) => (
                                        <button
                                            key={p.code}
                                            className={`cursor-pointer w-full text-left px-4 py-3 transition-colors flex items-center justify-between text-sm ${highlightedIndex === index ? 'bg-[#EFF6FF]' : 'hover:bg-[#F2F4F6]'} ${index === 0 ? 'rounded-t-lg' : ''} ${index === filteredProducts.length - 1 ? 'rounded-b-lg' : ''}`}
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
                                ) : null}
                            </div>
                        )}
                    </div>
                    {formErrors.productName && (
                        <p className="mt-1 text-xs text-red-600 flex items-center">
                            <AlertCircle size={14} className="mr-1" />{formErrors.productName}
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

                {/* Qty — col-span-1 */}
                <div className="col-span-3 md:col-span-1">
                    <label className="block text-[10px] font-bold text-[#434655] uppercase mb-1.5 ml-1">Qty</label>
                    <input
                        ref={quantityInputRef}
                        type="number" min="0.001" step="0.001"
                        value={newItem.quantity}
                        onChange={(e) => setNewItem({ ...newItem, quantity: e.target.value })}
                        className={`w-full py-2.5 px-3 bg-[#F2F4F6] border-none rounded-lg text-sm focus:bg-white focus:ring-2 focus:ring-[#004AC6]/15 transition-all ${formErrors.quantity ? 'ring-2 ring-red-500' : ''}`}
                        placeholder="0"
                    />
                    {formErrors.quantity && (
                        <p className="mt-1 text-xs text-red-600 flex items-center">
                            <AlertCircle size={14} className="mr-1" />{formErrors.quantity}
                        </p>
                    )}
                </div>

                {/* Unit — col-span-2 */}
                <div className="col-span-3 md:col-span-2">
                    <label className="block text-[10px] font-bold text-[#434655] uppercase mb-1.5 ml-1">Unit</label>
                    <select
                        value={newItem.packingType}
                        onChange={(e) => setNewItem({ ...newItem, packingType: e.target.value })}
                        className="w-full py-2.5 px-3 bg-[#F2F4F6] border-none rounded-lg text-sm appearance-none"
                    >
                        {ALLOWED_PACKING_TYPES.map(type => (
                            <option key={type} value={type}>{type}</option>
                        ))}
                    </select>
                </div>

                {/* Rate — col-span-2 */}
                <div className="col-span-6 md:col-span-2">
                    <label className="block text-[10px] font-bold text-[#434655] uppercase mb-1.5 ml-1">Rate (₹)</label>
                    <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#434655] text-xs font-bold">₹</span>
                        <input
                            type="number" min="1" step="1"
                            value={newItem.sellingPrice}
                            onChange={(e) => setNewItem({ ...newItem, sellingPrice: e.target.value })}
                            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddItem(); } }}
                            className={`w-full pl-7 py-2.5 px-3 bg-[#F2F4F6] border-none rounded-lg text-sm focus:bg-white focus:ring-2 focus:ring-[#004AC6]/15 transition-all ${formErrors.sellingPrice ? 'ring-2 ring-red-500' : ''}`}
                            placeholder="0.00"
                        />
                    </div>
                    {formErrors.sellingPrice && (
                        <p className="mt-1 text-xs text-red-600 flex items-center">
                            <AlertCircle size={14} className="mr-1" />{formErrors.sellingPrice}
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

// ============================================================
// Main Quick Sale Component
// ============================================================
const CreateQuickSale = () => {
    const printRef = useRef(null);
    const productNameInputRef = useRef(null);
    const { qsId } = useParams(); // set when editing an existing quick sale
    const navigate = useNavigate();
    const location = useLocation();

    // State
    const [invoiceItems, setInvoiceItems] = useState([]);
    const [newItem, setNewItem] = useState({
        code: '', productName: '', size: '', quantity: '',
        packingType: DEFAULT_PACKING_TYPE, sellingPrice: '', originalProduct: null,
    });
    const [total, setTotal] = useState(0);
    const [products, setProducts] = useState([]);
    const [saleDate, setSaleDate] = useState(new Date().toISOString().split('T')[0]);
    const [customQsId, setCustomQsId] = useState('');
    const [formErrors, setFormErrors] = useState({});
    const [isSaved, setIsSaved] = useState(true);
    const [currentQsId, setCurrentQsId] = useState(qsId || '');
    const [editIndex, setEditIndex] = useState(-1);
    const [originalData, setOriginalData] = useState(null);
    const [isNewSale, setIsNewSale] = useState(true);
    const [remark, setRemark] = useState('');

    // Dirty state detection
    const isDirty = useMemo(() => {
        if (isNewSale) return invoiceItems.length > 0;
        if (!originalData) return false;
        if (saleDate !== originalData.qs_date) return true;
        if (remark !== (originalData.remark || '')) return true;
        if (invoiceItems.length !== originalData.items.length) return true;
        for (let i = 0; i < invoiceItems.length; i++) {
            const curr = invoiceItems[i];
            const orig = originalData.items[i];
            if (!orig) return true;
            if (curr.code !== orig.product_code) return true;
            if (parseFloat(curr.quantity) !== parseFloat(orig.quantity)) return true;
            if (parseFloat(curr.sellingPrice) !== parseFloat(orig.selling_price)) return true;
        }
        return false;
    }, [isNewSale, invoiceItems, originalData, saleDate, remark]);

    const hasUnsavedChanges = useCallback(() => isDirty, [isDirty]);

    const blocker = useBlocker(
        ({ currentLocation, nextLocation }) =>
            hasUnsavedChanges() && currentLocation.pathname !== nextLocation.pathname
    );

    // Reset state
    const resetState = useCallback(async () => {
        setInvoiceItems([]);
        setNewItem({ code: '', productName: '', size: '', quantity: '', packingType: DEFAULT_PACKING_TYPE, sellingPrice: '', originalProduct: null });
        setTotal(0);
        setSaleDate(new Date().toISOString().split('T')[0]);
        setRemark('');
        setFormErrors({});
        setIsSaved(true);
        setCurrentQsId('');
        setEditIndex(-1);
        setOriginalData(null);
        setIsNewSale(true);
        try {
            const data = await window.api.invoke('quickSales:getNextId');
            setCustomQsId(data.next_id);
        } catch (err) {
            console.error('Error fetching next QS id', err);
        }
    }, []);

    const formatNumber = (value) => (parseFloat(value) || 0).toFixed(2);

    const calculateGrandTotal = () => {
        const roundedTotal = Math.round(total);
        const roundOff = roundedTotal - total;
        return { subtotal: total, roundOff, grandTotal: roundedTotal };
    };

    // Reset when navigating to /quick-sales/create without a qsId
    useEffect(() => {
        if (!qsId && location.pathname === '/quick-sales/create') resetState();
    }, [qsId, location.pathname, resetState]);

    useEffect(() => { setCurrentQsId(qsId || ''); }, [qsId]);

    // Fetch products + next ID
    useEffect(() => {
        const init = async () => {
            try {
                const productsData = await window.api.getProducts();
                setProducts(productsData);
            } catch (err) { console.error('Error fetching products:', err); }

            if (!qsId) {
                try {
                    const data = await window.api.invoke('quickSales:getNextId');
                    setCustomQsId(data.next_id);
                } catch (err) { console.error('Error fetching next QS id', err); }
            } else {
                setCustomQsId(qsId);
            }
        };
        init();
    }, [qsId]);

    // Load existing quick sale for editing
    useEffect(() => {
        if (!qsId) return;
        const load = async () => {
            try {
                const qs = await window.api.invoke('quickSales:get', qsId);
                if (!qs || qs.error) return;

                const formatName = (name) => {
                    if (!name) return '';
                    return name.replace(/-/g, ' ').split(' ')
                        .map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
                };

                const processedItems = qs.items.map(item => {
                    const prod = products.find(p => p.code === item.product_code) || {};
                    // Use stored product_name for ad-hoc, resolved_name from JOIN, or fall back to product_code
                    const baseName = item.product_name || item.resolved_name || prod.name || item.product_code || '';
                    const productName = formatName(baseName);
                    return {
                        ...item,
                        productName,
                        code: item.product_code || null,
                        size: item.product_size || item.resolved_size || prod.size || '',
                        quantity: parseFloat(item.quantity).toFixed(3),
                        packingType: item.packing_type || item.resolved_packing_type || prod.packing_type || '',
                        sellingPrice: parseFloat(item.selling_price).toFixed(3),
                        amount: (item.quantity * item.selling_price).toFixed(3),
                        isTemporary: item.is_temporary === 1,
                    };
                });

                setInvoiceItems(processedItems);
                setCurrentQsId(qs.qs_id);
                setSaleDate(qs.qs_date);
                setRemark(qs.remark || '');
                setOriginalData(qs);
                setIsNewSale(false);
                setIsSaved(true);
            } catch (err) { console.error('Error loading quick sale:', err); }
        };
        load();
    }, [qsId, products]);

    // Recalc total
    useEffect(() => {
        setTotal(invoiceItems.reduce((acc, item) => acc + (parseFloat(item.amount) || 0), 0));
    }, [invoiceItems]);

    // Form validation
    const validateForm = () => {
        const errors = {};
        if (!newItem.productName) errors.productName = 'Product is required';
        if (!newItem.quantity) errors.quantity = 'Quantity is required';
        if (!newItem.sellingPrice) errors.sellingPrice = 'Price is required';
        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    };

    // Add / edit item — Quick Sale does NOT create/update products (ad-hoc items supported)
    const handleAddItem = async () => {
        if (!validateForm()) return;
        const quantity = parseFloat(newItem.quantity);
        const sellingPrice = parseFloat(newItem.sellingPrice);
        if (isNaN(quantity) || isNaN(sellingPrice) || quantity <= 0 || sellingPrice <= 0) {
            toast.error('Please enter valid quantity and selling price');
            return;
        }
        const amount = quantity * sellingPrice;

        // Determine if this is a known product or an ad-hoc item
        const isAdHoc = !newItem.code; // no product code means ad-hoc
        // Generate a product_code for ad-hoc items using the same pattern as Price List
        const productCode = isAdHoc
            ? generateProductCode(newItem.productName, newItem.size)
            : newItem.code;

        const newInvoiceItem = {
            code: productCode || null,
            product_code: productCode || null,
            productName: newItem.productName,
            size: newItem.size || '',
            quantity: quantity.toFixed(3),
            packingType: newItem.packingType,
            sellingPrice: sellingPrice.toFixed(3),
            amount: amount.toFixed(3),
            isTemporary: isAdHoc,
        };

        if (editIndex > -1) {
            const updated = [...invoiceItems]; updated[editIndex] = newInvoiceItem;
            setInvoiceItems(updated); setEditIndex(-1); toast.success('Item updated');
        } else {
            setInvoiceItems([...invoiceItems, newInvoiceItem]);
            toast.success(isAdHoc ? 'Ad-hoc item added' : 'Item added');
        }
        setNewItem({ code: '', productName: '', size: '', quantity: '', packingType: DEFAULT_PACKING_TYPE, sellingPrice: '', originalProduct: null });
        setFormErrors({});
        window.scrollTo({ top: 0, behavior: 'smooth' });
        setTimeout(() => { if (productNameInputRef.current) productNameInputRef.current.focus(); }, 100);
    };

    const handleEditItem = (index) => {
        const item = invoiceItems[index];
        const originalProduct = item.code ? (products.find(p => p.code === item.code) || null) : null;
        setNewItem({
            code: item.code || '', productName: item.productName, size: item.size || '',
            quantity: item.quantity, packingType: item.packingType, sellingPrice: item.sellingPrice,
            originalProduct,
        });
        setEditIndex(index);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleDeleteItem = (indexToDelete) => {
        setInvoiceItems(invoiceItems.filter((_, i) => i !== indexToDelete));
        setIsSaved(false);
        toast.success('Item deleted');
    };

    // Save handler
    const handleSave = async () => {
        if (invoiceItems.length === 0) { toast.error('Add at least one item'); return; }

        const payload = {
            qs_date: saleDate,
            remark,
            items: invoiceItems.map(i => ({
                product_code: i.code || i.product_code || null,
                product_name: i.productName || '',
                product_size: i.size || '',
                packing_type: i.packingType || '',
                quantity: parseFloat(i.quantity),
                selling_price: parseFloat(i.sellingPrice),
                is_temporary: i.isTemporary ? 1 : 0
            })),
        };

        try {
            let data;
            if (currentQsId) {
                data = await window.api.invoke('quickSales:update', { qs_id: currentQsId, ...payload });
            } else {
                data = await window.api.invoke('quickSales:create', payload);
            }

            if (!data || data.error || data.success === false) {
                toast.error(data?.error || 'An error occurred while saving.');
                return;
            }

            const savedId = data.qs_id || currentQsId;
            toast.success(`Quick Sale saved (ID: ${savedId})`);

            if (!currentQsId && data.qs_id) {
                setCurrentQsId(data.qs_id);
                setCustomQsId(data.qs_id);
            }
            setOriginalData({
                ...payload, qs_id: savedId, qs_date: saleDate,
                items: invoiceItems.map(i => ({
                    product_code: i.code || i.product_code,
                    quantity: parseFloat(i.quantity),
                    selling_price: parseFloat(i.sellingPrice)
                }))
            });
            setIsNewSale(false);
            setIsSaved(true);
        } catch (err) {
            console.error('Error saving quick sale:', err);
            toast.error('An error occurred while saving.');
        }
    };

    // Marathi print state
    const [printMarathi, setPrintMarathi] = useState(false);
    const [marathiNames, setMarathiNames] = useState({});
    const [isTranslating, setIsTranslating] = useState(false);

    const handlePrint = async () => {
        if (printMarathi) {
            const codes = invoiceItems.map(i => i.code || i.product_code);
            try {
                const { missing } = await window.api.invoke('translate:checkMissing', codes);
                if (missing.length > 0) {
                    setIsTranslating(true);
                    try {
                        let allTranslated = true;
                        for (const code of missing) {
                            const res = await window.api.invoke('translate:toMarathi', code);
                            if (!res.success) { allTranslated = false; break; }
                        }
                        if (!allTranslated) {
                            toast.error('Marathi names missing. Please connect to internet for translation.');
                            setIsTranslating(false);
                            return;
                        }
                        toast.success('Ready to print in Marathi');
                        setIsTranslating(false);
                        return;
                    } catch (err) {
                        toast.error('Marathi names missing. Please connect to internet for translation.');
                        setIsTranslating(false);
                        return;
                    }
                }
                const { names } = await window.api.invoke('translate:getMarathiNames', codes);
                setMarathiNames(names);
                setTimeout(() => {
                    const originalTitle = document.title;
                    if (customQsId) document.title = `Quick Sale ${customQsId}`;
                    window.print();
                    document.title = originalTitle;
                }, 100);
            } catch (err) {
                toast.error('Error checking Marathi translations');
            }
        } else {
            const originalTitle = document.title;
            if (customQsId) document.title = `Quick Sale ${customQsId}`;
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
                        <h2 className="text-xl font-bold text-[#0F172A] text-center mb-2">Unsaved Changes</h2>
                        <p className="text-[#64748B] text-center mb-6">This quick sale is not saved. Do you want to leave?</p>
                        <div className="flex gap-3">
                            <button onClick={() => blocker.reset()} className="flex-1 px-4 py-2.5 rounded-lg bg-[#2563EB] text-white font-medium hover:bg-[#1D4ED8] cursor-pointer">Stay on Page</button>
                            <button onClick={() => blocker.proceed()} className="flex-1 px-4 py-2.5 rounded-lg border border-[#E2E8F0] text-[#64748B] font-medium hover:bg-[#F1F5F9] cursor-pointer">Leave Without Saving</button>
                        </div>
                    </div>
                </div>
            )}

            <div ref={printRef} className="max-w-[1040px] mx-auto bg-white shadow-sm rounded-xl border border-[#E2E8F0] overflow-hidden print:shadow-none print:rounded-none print:border-none print:w-[100%] print:m-0">
                {/* Top Bar — Reference / Title / Date */}
                <div className="px-4 sm:px-6 py-4 border-b border-[#E2E8F0] bg-[#F8FAFC] print:bg-white print:py-3">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs font-medium text-[#64748B] uppercase tracking-wider">Reference</p>
                            <p className="text-sm font-bold text-[#2563EB]">{customQsId || '...'}</p>
                        </div>
                        <h1 className="text-xl sm:text-2xl font-bold text-[#0F172A] tracking-wide">QUICK SALE</h1>
                        <div className="text-right">
                            <p className="text-xs font-medium text-[#64748B] uppercase tracking-wider">Transaction Date</p>
                            <input
                                type="date" value={saleDate}
                                onChange={(e) => setSaleDate(e.target.value)}
                                className="text-sm font-semibold text-[#0F172A] border border-[#E2E8F0] rounded-md px-2 py-1 focus:ring-2 focus:ring-[#2563EB] focus:border-transparent print:border-none print:bg-transparent print:p-0"
                            />
                        </div>
                    </div>
                </div>

                {/* Fast Entry Console (Add Item Form) */}
                <div className="p-4 sm:p-6 print:hidden">
                    <AddItemForm
                        newItem={newItem} setNewItem={setNewItem} handleAddItem={handleAddItem}
                        products={products} formErrors={formErrors} productNameInputRef={productNameInputRef}
                    />
                </div>

                {/* Items Table */}
                <section className="px-4 sm:px-8 pb-6">
                    <div className="overflow-hidden rounded-xl border border-[#C3C6D7]/10 shadow-sm bg-white">
                        <table className="w-full min-w-[700px] text-left border-collapse">
                            <thead className="bg-[#F2F4F6] text-[10px] font-extrabold uppercase text-[#434655] tracking-wider">
                                <tr>
                                    <th className="py-4 px-6 w-16 print:py-1 print:px-2 print:text-[10px]">S.No</th>
                                    <th className="py-4 px-6 print:py-1 print:px-2 print:text-[10px]">Item Name</th>
                                    <th className="py-4 px-6 w-32 text-center print:py-1 print:px-2 print:text-[10px]">Size</th>
                                    <th className="py-4 px-6 w-32 text-right print:py-1 print:px-2 print:text-[10px]">Qty</th>
                                    <th className="py-4 px-6 w-32 text-right print:py-1 print:px-2 print:text-[10px]">Rate (₹)</th>
                                    <th className="py-4 px-6 w-40 text-right print:py-1 print:px-2 print:text-[10px]">Amount (₹)</th>
                                    <th className="py-4 px-6 w-24 text-center print:hidden">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="text-sm divide-y divide-[#ECEEF0]">
                                {invoiceItems.map((item, index) => (
                                    <tr key={index} className="hover:bg-[#F2F4F6]/50 transition-colors print:break-inside-avoid print:border-b print:border-gray-200 print:text-[10px]">
                                        <td className="py-4 px-6 text-[#434655] font-medium print:py-1 print:px-2 text-xs">{String(index + 1).padStart(2, '0')}</td>
                                        <td className="py-4 px-6 font-bold text-[#191C1E] print:py-1 print:px-2 text-xs" style={{ maxWidth: '200px', wordWrap: 'break-word', whiteSpace: 'normal' }}>
                                            <span className="print:hidden">{item.productName}</span>
                                            <span className="hidden print:inline">
                                                {printMarathi && marathiNames[item.code || item.product_code]
                                                    ? marathiNames[item.code || item.product_code]
                                                    : item.productName}
                                            </span>
                                        </td>
                                        <td className="py-4 px-6 text-[#434655] text-center print:py-1 print:px-2 text-xs">{item.size || '-'}</td>
                                        <td className="py-4 px-6 text-right text-[#191C1E] print:py-1 print:px-2 text-xs">{item.quantity} {item.packingType}</td>
                                        <td className="py-4 px-6 text-right font-medium print:py-1 print:px-2 text-xs">{formatNumber(item.sellingPrice)}</td>
                                        <td className="py-4 px-6 text-right font-bold text-[#004AC6] print:py-1 print:px-2 text-xs">{formatNumber(item.amount)}</td>
                                        <td className="py-4 px-6 text-center print:hidden">
                                            <div className="flex items-center justify-center gap-2">
                                                <button onClick={() => handleEditItem(index)} className="cursor-pointer p-1.5 rounded-md text-[#434655] hover:text-[#004AC6] hover:bg-white transition-colors"><Edit size={15} /></button>
                                                <button onClick={() => handleDeleteItem(index)} className="cursor-pointer p-1.5 rounded-md text-[#434655] hover:text-[#BA1A1A] hover:bg-white transition-colors"><Trash2 size={15} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {invoiceItems.length === 0 && (
                                    <tr>
                                        <td colSpan="7" className="px-6 py-8 text-center text-[#434655] text-sm">
                                            No items added yet. Use the form above to add items.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                        {invoiceItems.length > 0 && (
                            <div className="p-4 bg-[#F2F4F6]/30 border-t border-[#ECEEF0]">
                                <p className="text-xs text-[#434655] font-medium italic">Showing all {invoiceItems.length} items in current draft.</p>
                            </div>
                        )}
                    </div>
                </section>

                {/* Bottom Section: Remarks + Summary — 7/5 grid */}
                <div className="px-4 sm:px-8 pb-6">
                    <div className="grid grid-cols-12 gap-8">
                        {/* Left Column (col-span-7) — Remarks */}
                        <div className="col-span-12 md:col-span-7 space-y-6">
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
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

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
                            {isTranslating ? 'Translating...' : 'Print Quick Sale'}
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

export default CreateQuickSale;