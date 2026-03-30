import React, { useState, useEffect, useMemo } from 'react';
import { ArrowLeft, Save, Trash2, RefreshCw } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import {
  generateProductCode,
  capitalizeWords,
  ALLOWED_PACKING_TYPES,
  DEFAULT_PACKING_TYPE
} from '../../utils/productUtils';


const AddPriceListProduct = () => {
  const navigate = useNavigate();
  const { code: paramCode } = useParams();
  const editing = Boolean(paramCode);

  const [formData, setFormData] = useState({
    productName: '',
    size: '',
    code: '',
    packingType: DEFAULT_PACKING_TYPE,
    costPrice: '',
    sellingPrice: ''
  });

  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [originalCode, setOriginalCode] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Generate product code when productName or size changes
  useEffect(() => {
    if (!formData.productName) return;
    const code = generateProductCode(formData.productName, formData.size);
    setFormData(prev => ({ ...prev, code }));
  }, [formData.productName, formData.size]);

  // Fetch existing product when in edit mode
  useEffect(() => {
    if (!editing) return;
    const loadProduct = async () => {
      try {
        const data = await window.api.invoke('products:get', paramCode);
        setFormData({
          productName: data.name,
          size: data.size || '',
          code: data.code,
          packingType: ALLOWED_PACKING_TYPES.includes(data.packing_type)
            ? data.packing_type
            : DEFAULT_PACKING_TYPE,
          costPrice: data.cost_price?.toString() || '',
          sellingPrice: data.selling_price?.toString() || ''
        });
        setOriginalCode(data.code);
      } catch (err) {
        toast.error(err.message);
        console.error(err);
      }
    };
    loadProduct();
  }, [editing, paramCode]);

  // Profit margin calculation
  const profitMargin = useMemo(() => {
    const cost = Number(formData.costPrice) || 0;
    const sell = Number(formData.sellingPrice) || 0;
    const profit = sell - cost;
    const percent = cost > 0
      ? parseFloat(((profit / cost) * 100).toFixed(1))
      : sell > 0 ? Infinity : 0;
    return { profit, percent };
  }, [formData.costPrice, formData.sellingPrice]);

  const validateForm = () => {
    const newErrors = {};
    if (!formData.productName) newErrors.productName = 'Product name is required';
    if (!formData.code) newErrors.code = 'Product code is required';
    if (!formData.costPrice) newErrors.costPrice = 'Cost price is required';
    if (!formData.sellingPrice) newErrors.sellingPrice = 'Selling price is required';
    if (Number(formData.costPrice) >= Number(formData.sellingPrice)) {
      newErrors.sellingPrice = 'Selling price must be greater than cost price';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    setSubmitting(true);
    try {
      const allProducts = await window.api.getProducts();
      const codeExists = allProducts.some(p =>
        p.code.toLowerCase() === formData.code.toLowerCase() &&
        (!editing || p.code !== originalCode)
      );
      if (codeExists) {
        toast.error('Product code already exists. Please use a unique code.');
        setErrors(prev => ({ ...prev, code: 'This code is already in use' }));
        setSubmitting(false);
        return;
      }
      if (editing) {
        if (originalCode !== formData.code) {
          const newProductBody = {
            code: formData.code, name: formData.productName, size: formData.size,
            packing_type: formData.packingType, cost_price: Number(formData.costPrice),
            selling_price: Number(formData.sellingPrice)
          };
          await window.api.createProduct(newProductBody);
          await window.api.deleteProduct(originalCode);
          toast.success('Product updated successfully. Old product archived for historical records.');
        } else {
          const body = {
            code: formData.code, name: formData.productName, size: formData.size,
            packing_type: formData.packingType, cost_price: Number(formData.costPrice),
            selling_price: Number(formData.sellingPrice)
          };
          await window.api.updateProduct({ id: paramCode, ...body });
          toast.success('Product saved successfully');
        }
      } else {
        const body = {
          code: formData.code, name: formData.productName, size: formData.size,
          packing_type: formData.packingType, cost_price: Number(formData.costPrice),
          selling_price: Number(formData.sellingPrice)
        };
        await window.api.createProduct(body);
        toast.success('Product saved successfully');
        navigate('/price-list', { state: { editedProductCode: formData.code } });
        return;
      }
      navigate('/price-list', { state: { editedProductCode: formData.code } });
    } catch (error) {
      toast.error(error.message);
      console.error('Error saving product:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await window.api.deleteProduct(paramCode);
      toast.success('Product deleted successfully');
      navigate('/price-list');
    } catch (err) {
      toast.error(err.message);
      console.error(err);
    } finally {
      setDeleting(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'packingType') {
      if (value === 'custom') {
        setFormData(prev => ({ ...prev, packingType: value, customPackingType: '' }));
      } else {
        setFormData(prev => ({ ...prev, packingType: value, customPackingType: '' }));
      }
    } else if (name === 'productName') {
      const capitalizedValue = capitalizeWords(value);
      setFormData(prev => ({ ...prev, [name]: capitalizedValue }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const formatCurrency = (val) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(val || 0);

  return (
    <div className="min-h-screen bg-[#F7F9FB]">
      {/* ─── Content Area ─── */}
      <div className="flex-1 p-10 flex flex-col items-center">
        {/* ─── Page Header ─── */}
        <div className="w-full max-w-3xl mb-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/price-list')}
              className="w-10 h-10 rounded-full border border-[#C3C6D7] hover:bg-[#E6E8EA] flex items-center justify-center transition-colors cursor-pointer"
            >
              <ArrowLeft size={18} className="text-[#434655]" />
            </button>
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight text-[#191C1E]">
                {editing ? 'Edit Product' : 'Add New Product'}
              </h1>
              <p className="text-[#434655] text-sm mt-1">
                {editing ? 'Update the product details below.' : 'Populate the catalog with a new inventory item.'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-[#004AC6] rounded-full text-xs font-bold">
            PRICE LIST MODULE
          </div>
        </div>

        {/* ─── Main Form Card ─── */}
        <div className="w-full max-w-3xl bg-white rounded-xl shadow-[0px_4px_24px_rgba(25,28,30,0.06)] overflow-hidden">
          <div className="p-8 border-b border-[#ECEEF0]">
            <h2 className="text-lg font-bold text-[#191C1E]">Product Identity & Logistics</h2>
          </div>

          <form onSubmit={handleSubmit} autoComplete="off" className="p-8 space-y-8">
            {/* ─── Product Basic Info ─── */}
            <div className="grid grid-cols-2 gap-x-8 gap-y-6">
              {/* Product Name — full width */}
              <div className="col-span-2">
                <label className="block text-xs font-bold text-[#434655] uppercase tracking-wider mb-2">
                  Product Name <span className="text-[#BA1A1A]">*</span>
                </label>
                <input
                  type="text"
                  name="productName"
                  value={formData.productName}
                  onChange={handleChange}
                  placeholder="e.g. Sri Yantra"
                  className={`w-full bg-[#F2F4F6] border-none rounded-lg py-3 px-4 focus:bg-white focus:ring-2 focus:ring-[#004AC6]/15 transition-all text-sm placeholder:text-slate-400 outline-none ${errors.productName ? 'ring-2 ring-[#BA1A1A]/30' : ''}`}
                />
                {errors.productName && (
                  <p className="mt-1.5 text-xs text-[#BA1A1A] font-medium">{errors.productName}</p>
                )}
              </div>

              {/* Product Code */}
              <div className="col-span-1">
                <label className="block text-xs font-bold text-[#434655] uppercase tracking-wider mb-2">
                  Product Code
                </label>
                <div className="relative">
                  <input
                    type="text"
                    name="code"
                    value={formData.code}
                    readOnly
                    className={`w-full bg-[#F2F4F6] border-none rounded-lg py-3 px-4 focus:ring-2 focus:ring-[#004AC6]/15 transition-all text-sm font-mono text-[#004AC6] font-bold outline-none ${errors.code ? 'ring-2 ring-[#BA1A1A]/30' : ''}`}
                  />
                  <RefreshCw size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                </div>
                {errors.code && (
                  <p className="mt-1.5 text-xs text-[#BA1A1A] font-medium">{errors.code}</p>
                )}
              </div>

              {/* Packing Type */}
              <div className="col-span-1">
                <label className="block text-xs font-bold text-[#434655] uppercase tracking-wider mb-2">
                  Packing Type
                </label>
                <select
                  name="packingType"
                  value={formData.packingType}
                  onChange={handleChange}
                  className="w-full bg-[#F2F4F6] border-none rounded-lg py-3 px-4 focus:bg-white focus:ring-2 focus:ring-[#004AC6]/15 transition-all text-sm outline-none cursor-pointer"
                >
                  {ALLOWED_PACKING_TYPES.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>

              {/* Size / Weight */}
              <div className="col-span-1">
                <label className="block text-xs font-bold text-[#434655] uppercase tracking-wider mb-2">
                  Size / Weight
                </label>
                <input
                  type="text"
                  name="size"
                  value={formData.size}
                  onChange={handleChange}
                  placeholder="e.g. 1 No., 500g"
                  className="w-full bg-[#F2F4F6] border-none rounded-lg py-3 px-4 focus:bg-white focus:ring-2 focus:ring-[#004AC6]/15 transition-all text-sm placeholder:text-slate-400 outline-none"
                />
              </div>
            </div>

            {/* ─── Financials & Margin ─── */}
            <div className="pt-8 border-t border-[#ECEEF0]">
              <h3 className="text-xs font-black text-[#434655] uppercase tracking-[0.2em] mb-6">Financials & Margin</h3>
              <div className="grid grid-cols-3 gap-6 items-end">
                {/* Cost Price */}
                <div className="col-span-1">
                  <label className="block text-xs font-bold text-[#434655] uppercase tracking-wider mb-2">
                    Cost Price (₹)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400">₹</span>
                    <input
                      type="number"
                      name="costPrice"
                      value={formData.costPrice}
                      onChange={handleChange}
                      placeholder="0.00"
                      className={`w-full bg-[#F2F4F6] border-none rounded-lg py-3 pl-8 pr-4 focus:bg-white focus:ring-2 focus:ring-[#004AC6]/15 transition-all text-sm outline-none ${errors.costPrice ? 'ring-2 ring-[#BA1A1A]/30' : ''}`}
                    />
                  </div>
                  {errors.costPrice && (
                    <p className="mt-1.5 text-xs text-[#BA1A1A] font-medium">{errors.costPrice}</p>
                  )}
                </div>

                {/* Selling Price */}
                <div className="col-span-1">
                  <label className="block text-xs font-bold text-[#434655] uppercase tracking-wider mb-2">
                    Selling Price (₹) <span className="text-[#BA1A1A]">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-[#004AC6]">₹</span>
                    <input
                      type="number"
                      name="sellingPrice"
                      value={formData.sellingPrice}
                      onChange={handleChange}
                      placeholder="0.00"
                      className={`w-full bg-[#F2F4F6] border-none rounded-lg py-3 pl-8 pr-4 focus:bg-white focus:ring-2 focus:ring-[#004AC6]/15 transition-all text-sm font-semibold outline-none ${errors.sellingPrice ? 'ring-2 ring-[#BA1A1A]/30' : ''}`}
                    />
                  </div>
                  {errors.sellingPrice && (
                    <p className="mt-1.5 text-xs text-[#BA1A1A] font-medium">{errors.sellingPrice}</p>
                  )}
                </div>

                {/* Profit Margin Card */}
                <div className="col-span-1">
                  <div className={`p-3 rounded-lg flex flex-col ${profitMargin.profit > 0 ? 'bg-emerald-50 border border-emerald-100' : profitMargin.profit < 0 ? 'bg-red-50 border border-red-100' : 'bg-[#F2F4F6] border border-[#ECEEF0]'}`}>
                    <span className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${profitMargin.profit > 0 ? 'text-emerald-700' : profitMargin.profit < 0 ? 'text-red-700' : 'text-[#434655]'}`}>
                      Profit Margin
                    </span>
                    <div className="flex items-center gap-2">
                      <span className={`text-xl font-black ${profitMargin.profit > 0 ? 'text-emerald-600' : profitMargin.profit < 0 ? 'text-red-600' : 'text-[#191C1E]'}`}>
                        {formatCurrency(profitMargin.profit)}
                      </span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${profitMargin.profit > 0 ? 'bg-emerald-100 text-emerald-600' : profitMargin.profit < 0 ? 'bg-red-100 text-red-600' : 'bg-[#E6E8EA] text-[#434655]'}`}>
                        {profitMargin.percent === Infinity ? '∞' : profitMargin.percent}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ─── Actions ─── */}
            <div className="pt-10 flex items-center justify-between gap-4">
              <button
                type="button"
                onClick={() => navigate('/price-list')}
                className="px-8 py-3 text-sm font-bold text-[#434655] hover:bg-[#E6E8EA] transition-colors rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <div className="flex gap-4">
                {editing && (
                  <button
                    type="button"
                    disabled={deleting}
                    onClick={() => setShowDeleteModal(true)}
                    className="px-8 py-3 bg-red-600 text-white text-sm font-bold rounded-lg hover:bg-red-700 transition-all flex items-center gap-2 shadow-lg shadow-red-600/20 hover:scale-[1.01] active:scale-95 disabled:opacity-50 cursor-pointer"
                  >
                    <Trash2 size={16} />
                    {deleting ? 'Deleting...' : 'Delete'}
                  </button>
                )}
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-10 py-3 text-white text-sm font-bold rounded-lg shadow-lg shadow-[#004AC6]/20 hover:shadow-xl hover:scale-[1.01] active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                  style={{ background: 'linear-gradient(135deg, #004AC6 0%, #2563EB 100%)' }}
                >
                  <Save size={16} />
                  {submitting ? (editing ? 'Updating...' : 'Saving...') : (editing ? 'Update Product' : 'Save Product')}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>

      {/* ─── Delete Confirmation Modal — Stitch Glass Overlay ─── */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backdropFilter: 'blur(8px)', backgroundColor: 'rgba(255,255,255,0.7)' }}>
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-[#C3C6D7]/20 p-8">
            <div className="w-12 h-12 rounded-full bg-red-100/50 flex items-center justify-center text-red-600 mb-6 mx-auto">
              <Trash2 size={28} />
            </div>
            <h2 className="text-2xl font-extrabold text-[#0F172A] tracking-tight mb-3 text-center">Delete Product?</h2>
            <p className="text-[#434655] leading-relaxed mb-8 text-center">
              Are you sure you want to delete <span className="font-bold text-[#191C1E]">{formData.productName}</span>? This action cannot be undone.
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 px-6 py-3 bg-[#E6E8EA] text-[#191C1E] font-bold rounded-xl hover:bg-[#E0E3E5] transition-all text-sm cursor-pointer"
              >Cancel</button>
              <button
                onClick={async () => {
                  try {
                    await handleDelete();
                    setShowDeleteModal(false);
                  } catch {
                    // handleDelete shows error toast; keep modal open
                  }
                }}
                disabled={deleting}
                className="flex-1 px-6 py-3 bg-red-600 text-white font-bold rounded-xl shadow-lg shadow-red-600/20 hover:bg-red-700 hover:scale-[1.02] active:scale-95 transition-all text-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >{deleting ? 'Deleting...' : 'Delete'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AddPriceListProduct;