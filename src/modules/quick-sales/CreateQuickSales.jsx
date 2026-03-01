import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Printer, Plus, Trash2, Save, Edit, AlertTriangle } from 'lucide-react';
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

    const filteredProducts = useMemo(() => {
        const filtered = products.filter(p =>
            (p.name || '').toLowerCase().includes(newItem.productName.toLowerCase())
        );
        return sortProducts(filtered, 'name', 'size');
    }, [products, newItem.productName]);

    const handleKeyDown = (e) => {
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
            case 'Escape':
                setShowProdDropdown(false);
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
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
            <h3 className="text-lg font-semibold text-[#05014A] mb-4 flex items-center">
                <Plus size={20} className="mr-2" />
                Add New Item
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Product Search */}
                <div className="relative" ref={prodWrapperRef}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Product Name</label>
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
                            className={`w-full px-4 py-2.5 border ${formErrors.productName ? 'border-red-500' : 'border-gray-300'} rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all pr-10`}
                            placeholder="Search for a product..."
                        />
                        <Search className="absolute right-3 top-3 text-gray-400" size={18} />
                        {showProdDropdown && (
                            <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                                {filteredProducts.length > 0 ? (
                                    filteredProducts.map((p, index) => (
                                        <button
                                            key={p.code}
                                            className={`cursor-pointer w-full text-left px-4 py-3 transition-colors flex items-center justify-between ${highlightedIndex === index ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
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
                                ) : null}
                            </div>
                        )}
                    </div>
                    {formErrors.productName && (
                        <p className="mt-1.5 text-sm text-red-600 flex items-center">
                            <AlertCircle size={16} className="mr-1" />{formErrors.productName}
                        </p>
                    )}
                </div>

                {/* Size */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Size</label>
                    <input
                        type="text"
                        value={newItem.size || ''}
                        onChange={(e) => setNewItem({ ...newItem, size: e.target.value })}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="e.g., 1 L, 500g"
                    />
                </div>

                {/* Quantity + Unit */}
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
                        <input
                            type="number" min="0.001" step="0.001"
                            value={newItem.quantity}
                            onChange={(e) => setNewItem({ ...newItem, quantity: e.target.value })}
                            className={`w-full px-4 py-2.5 border ${formErrors.quantity ? 'border-red-500' : 'border-gray-300'} rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                            placeholder="0.000"
                        />
                        {formErrors.quantity && (
                            <p className="mt-1.5 text-sm text-red-600 flex items-center">
                                <AlertCircle size={16} className="mr-1" />{formErrors.quantity}
                            </p>
                        )}
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
                        <select
                            value={newItem.packingType}
                            onChange={(e) => setNewItem({ ...newItem, packingType: e.target.value })}
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none bg-white"
                        >
                            {ALLOWED_PACKING_TYPES.map(type => (
                                <option key={type} value={type}>{type}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Rate */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Rate (₹)</label>
                    <div className="relative">
                        <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">₹</span>
                        <input
                            type="number" min="0.01" step="0.01"
                            value={newItem.sellingPrice}
                            onChange={(e) => setNewItem({ ...newItem, sellingPrice: e.target.value })}
                            className={`w-full pl-8 pr-4 py-2.5 border ${formErrors.sellingPrice ? 'border-red-500' : 'border-gray-300'} rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                            placeholder="0.00"
                        />
                    </div>
                    {formErrors.sellingPrice && (
                        <p className="mt-1.5 text-sm text-red-600 flex items-center">
                            <AlertCircle size={16} className="mr-1" />{formErrors.sellingPrice}
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

    // Dirty state detection
    const isDirty = useMemo(() => {
        if (isNewSale) return invoiceItems.length > 0;
        if (!originalData) return false;
        if (saleDate !== originalData.qs_date) return true;
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
    }, [isNewSale, invoiceItems, originalData, saleDate]);

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
                    const baseName = prod.name || item.product_code;
                    const productName = formatName(baseName);
                    return {
                        ...item,
                        productName,
                        code: item.product_code,
                        size: prod.size || '',
                        quantity: parseFloat(item.quantity).toFixed(3),
                        packingType: prod.packing_type || '',
                        sellingPrice: parseFloat(item.selling_price).toFixed(3),
                        amount: (item.quantity * item.selling_price).toFixed(3),
                    };
                });

                setInvoiceItems(processedItems);
                setCurrentQsId(qs.qs_id);
                setSaleDate(qs.qs_date);
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

    // Add / edit item (same product-creation logic as Invoice)
    const handleAddItem = async () => {
        if (!validateForm()) return;
        const quantity = parseFloat(newItem.quantity);
        const sellingPrice = parseFloat(newItem.sellingPrice);
        if (isNaN(quantity) || isNaN(sellingPrice) || quantity <= 0 || sellingPrice <= 0) {
            toast.error('Please enter valid quantity and selling price');
            return;
        }
        const amount = quantity * sellingPrice;
        const originalProduct = newItem.originalProduct;
        const nameChanged = originalProduct && originalProduct.name !== newItem.productName;
        const sizeChanged = originalProduct && (originalProduct.size || '') !== (newItem.size || '');
        let productCode = newItem.code;
        let isNewProduct = !newItem.code;

        if (nameChanged || sizeChanged) {
            const existingProduct = findProductByNameAndSize(newItem.productName, newItem.size, products);
            if (existingProduct) {
                productCode = existingProduct.code;
                isNewProduct = false;
                const existingPrice = existingProduct.selling_price ?? existingProduct.sellingPrice ?? 0;
                if (existingPrice !== sellingPrice) {
                    try {
                        await window.api.invoke('products:update', {
                            code: productCode, name: existingProduct.name, size: existingProduct.size || '',
                            packing_type: existingProduct.packing_type || newItem.packingType, cost_price: existingProduct.cost_price || 0,
                            selling_price: sellingPrice
                        });
                        toast.success('Price updated in Price List');
                        setProducts(await window.api.getProducts());
                    } catch (err) { console.error('Error updating product price:', err); }
                }
            } else {
                productCode = generateProductCode(newItem.productName, newItem.size);
                isNewProduct = true;
            }
        } else if (newItem.code && originalProduct) {
            const originalPrice = originalProduct.selling_price ?? originalProduct.sellingPrice ?? 0;
            if (originalPrice !== sellingPrice) {
                try {
                    await window.api.invoke('products:update', {
                        code: newItem.code, name: originalProduct.name, size: originalProduct.size || '',
                        packing_type: originalProduct.packing_type || newItem.packingType, cost_price: originalProduct.cost_price || 0,
                        selling_price: sellingPrice
                    });
                    toast.success('Price updated in Price List');
                    setProducts(await window.api.getProducts());
                } catch (err) { console.error('Error updating product price:', err); }
            }
        } else if (!newItem.code) {
            productCode = generateProductCode(newItem.productName, newItem.size);
            isNewProduct = true;
        }

        if (isNewProduct) {
            try {
                if (productCodeExists(productCode, products)) {
                    toast.error('A product with this name and size already exists.');
                    return;
                }
                await window.api.invoke('products:create', {
                    code: productCode, name: newItem.productName, size: newItem.size || '',
                    packing_type: newItem.packingType, cost_price: 0, selling_price: sellingPrice
                });
                setProducts(await window.api.getProducts());
                toast.success('New product created');
            } catch (err) { console.error('Error creating product:', err); toast.error('Error creating product'); return; }
        }

        const newInvoiceItem = {
            code: productCode, product_code: productCode, productName: newItem.productName,
            size: newItem.size || '', quantity: quantity.toFixed(3), packingType: newItem.packingType,
            sellingPrice: sellingPrice.toFixed(3), amount: amount.toFixed(3)
        };

        if (editIndex > -1) {
            const updated = [...invoiceItems]; updated[editIndex] = newInvoiceItem;
            setInvoiceItems(updated); setEditIndex(-1); toast.success('Item updated');
        } else {
            setInvoiceItems([...invoiceItems, newInvoiceItem]);
            if (!isNewProduct) toast.success('Item added');
        }
        setNewItem({ code: '', productName: '', size: '', quantity: '', packingType: DEFAULT_PACKING_TYPE, sellingPrice: '', originalProduct: null });
        setFormErrors({});
        window.scrollTo({ top: 0, behavior: 'smooth' });
        setTimeout(() => { if (productNameInputRef.current) productNameInputRef.current.focus(); }, 100);
    };

    const handleEditItem = (index) => {
        const item = invoiceItems[index];
        const originalProduct = products.find(p => p.code === item.code) || null;
        setNewItem({
            code: item.code, productName: item.productName, size: item.size || '',
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
            items: invoiceItems.map(i => ({
                product_code: i.code || i.product_code,
                quantity: parseFloat(i.quantity),
                selling_price: parseFloat(i.sellingPrice)
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

    const handlePrint = () => {
        const originalTitle = document.title;
        if (customQsId) document.title = `Quick Sale ${customQsId}`;
        window.print();
        document.title = originalTitle;
    };

    const { roundOff, grandTotal } = calculateGrandTotal();

    return (
        <div className="p-2 sm:p-6 min-h-screen bg-gray-50 print:bg-white print:p-0 print:text-black">
            {/* Navigation Warning Modal */}
            {blocker.state === 'blocked' && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100] print:hidden">
                    <div className="bg-white rounded-xl shadow-2xl p-6 max-w-md mx-4">
                        <div className="flex items-center justify-center mb-4">
                            <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
                                <AlertTriangle className="text-yellow-600" size={24} />
                            </div>
                        </div>
                        <h2 className="text-xl font-bold text-gray-800 text-center mb-2">Unsaved Changes</h2>
                        <p className="text-gray-600 text-center mb-6">This quick sale is not saved. Do you want to leave?</p>
                        <div className="flex flex-col sm:flex-row gap-3">
                            <button onClick={() => blocker.reset()} className="flex-1 px-4 py-2.5 rounded-lg bg-[#05014A] text-white font-medium hover:bg-[#0A0A47] cursor-pointer">Stay on Page</button>
                            <button onClick={() => blocker.proceed()} className="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 cursor-pointer">Leave Without Saving</button>
                        </div>
                    </div>
                </div>
            )}

            <div ref={printRef} className="max-w-[1040px] mx-auto bg-white shadow-lg rounded-lg overflow-hidden print:shadow-none print:rounded-none print:w-[210mm] print:min-h-[297mm]">
                {/* Header */}
                <div className="p-3 sm:p-6 border-b print:p-4">
                    <div className="text-center mb-4">
                        <h1 className="text-2xl sm:text-3xl font-bold text-[#05014A]">QUICK SALE</h1>
                    </div>
                    <div className="flex flex-col sm:flex-row justify-between mb-4">
                        <div className="mb-2 sm:mb-0">
                            <p className="font-semibold">
                                <span className="text-gray-600">Quick Sale No.: </span>
                                {customQsId || '...'}
                            </p>
                        </div>
                        <div>
                            <p className="font-semibold">
                                <span className="text-gray-600">Date: </span>
                                <input
                                    type="date" value={saleDate}
                                    onChange={(e) => setSaleDate(e.target.value)}
                                    className="border rounded px-2 py-1 print:border-none print:bg-transparent"
                                />
                            </p>
                        </div>
                    </div>
                </div>

                {/* Items Table Section */}
                <div className="p-3 sm:p-6">
                    {/* Add New Item Form */}
                    <div className="print:hidden">
                        <AddItemForm
                            newItem={newItem} setNewItem={setNewItem} handleAddItem={handleAddItem}
                            products={products} formErrors={formErrors} productNameInputRef={productNameInputRef}
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
                                        <td className="border p-3 text-sm text-gray-600 text-center">{item.size || '-'}</td>
                                        <td className="border p-3 text-sm text-gray-600 text-center">{item.quantity} {item.packingType}</td>
                                        <td className="border p-3 text-sm text-gray-600 text-center">₹{formatNumber(item.sellingPrice)}</td>
                                        <td className="border p-3 text-sm text-gray-800 font-medium text-center">₹{formatNumber(item.amount)}</td>
                                        <td className="border p-3 text-center print:hidden">
                                            <div className="flex items-center justify-center space-x-3">
                                                <button onClick={() => handleEditItem(index)} className="cursor-pointer text-blue-500 hover:text-blue-700"><Edit size={16} /></button>
                                                <button onClick={() => handleDeleteItem(index)} className="cursor-pointer text-red-500 hover:text-red-700"><Trash2 size={16} /></button>
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
                            <h3 className="font-semibold text-lg text-gray-800 mb-4">Sale Summary</h3>
                            <div className="space-y-3">
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Subtotal:</span>
                                    <span className="font-medium">₹{formatNumber(total)}</span>
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
                                {isDirty ? (
                                    <button onClick={handleSave} className="cursor-pointer mt-6 w-full bg-[#05014A] hover:bg-[#0A0A47] text-white py-3 rounded-lg font-medium flex items-center justify-center transition-colors">
                                        <Save className="mr-2" size={20} />Save Quick Sale
                                    </button>
                                ) : (
                                    <button onClick={handlePrint} className="cursor-pointer mt-6 w-full bg-[#05014A] hover:bg-[#0A0A47] text-white py-3 rounded-lg font-medium flex items-center justify-center transition-colors">
                                        <Printer className="mr-2" size={20} />Print Quick Sale
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

export default CreateQuickSale;