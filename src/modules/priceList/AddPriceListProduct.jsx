import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ArrowLeft, Save, Trash2, RefreshCw } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import DeleteConfirmModal from '../../components/DeleteConfirmModal';
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
    costPrice: '0',
    sellingPrice: ''
  });
  const [updatedAt, setUpdatedAt] = useState(null);

  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [originalCode, setOriginalCode] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Refs for tab navigation
  const productNameRef = useRef(null);
  const sizeRef = useRef(null);
  const packingTypeRef = useRef(null);
  const costPriceRef = useRef(null);
  const sellingPriceRef = useRef(null);
  const saveBtnRef = useRef(null);

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
          costPrice: data.cost_price?.toString() || '0',
          sellingPrice: data.selling_price?.toString() || ''
        });
        setOriginalCode(data.code);
        setUpdatedAt(data.updated_at || null);
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
      newErrors.sellingPrice = 'Selling price must be greater than Cost price';
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
        toast.error('Product already exists in the Catalog.');
        setErrors(prev => ({ ...prev, code: 'This code already exists' }));
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
      }
      navigate('/price-list', { state: { editedProductCode: formData.code, focusNext: false } });
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
      return true;
    } catch (err) {
      toast.error(err.message);
      console.error(err);
      return false;
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

  const formatTimestamp = (isoStr) => {
    if (!isoStr) return '—';
    try {
      const d = new Date(isoStr);
      if (isNaN(d.getTime())) return '—';
      return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
        + ', ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
    } catch { return '—'; }
  };

  return (
    <div className="min-h-screen bg-[#F7F9FB]">
      {/* ─── Top Bar ─── */}
      <header className="bg-[#F7F9FB] flex items-center gap-4 px-8 py-5">
        <button
          onClick={() => navigate('/price-list')}
          className="flex items-center gap-2 text-[#434655] hover:text-[#004AC6] transition-colors group cursor-pointer"
        >
          <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
          <span className="text-sm font-medium">Back to Price List</span>
        </button>
        <div className="bg-[#ECEEF0] h-6 w-[1px]"></div>
        <h1 className="text-lg font-bold text-[#191C1E]">
          {editing ? 'Edit Product' : 'Add New Product'}
        </h1>
      </header>

      {/* ─── Content Canvas ─── */}
      <main className="flex flex-col items-center px-4 py-8 md:py-12">
        {/* Main Form Card */}
        <div className="w-full max-w-3xl bg-white rounded-xl shadow-sm border border-[#C3C6D7]/10 overflow-hidden">

          <form onSubmit={handleSubmit} autoComplete="off" className="p-8 space-y-8">
            {/* ─── Product Basic Info ─── */}
            <div className="grid grid-cols-2 gap-x-8 gap-y-6">
              {/* Product Name — full width */}
              <div className="col-span-2">
                <label className="block text-[10px] font-bold text-[#434655] uppercase tracking-wider mb-1.5 ml-1">
                  Product Name <span className="text-[#BA1A1A]">*</span>
                </label>
                <input
                  type="text"
                  name="productName"
                  ref={productNameRef}
                  tabIndex={1}
                  value={formData.productName}
                  onChange={handleChange}
                  placeholder="e.g. Sri Yantra"
                  className={`w-full bg-[#F2F4F6] border-none rounded-lg py-2.5 px-3 focus:bg-white focus:ring-2 focus:ring-[#004AC6]/15 transition-all text-sm placeholder:text-slate-400 outline-none ${errors.productName ? 'ring-2 ring-[#BA1A1A]/30' : ''}`}
                />
                {errors.productName && (
                  <p className="mt-1.5 text-xs text-[#BA1A1A] font-medium">{errors.productName}</p>
                )}
              </div>

              {/* Product Code */}
              <div className="col-span-1">
                <label className="block text-[10px] font-bold text-[#434655] uppercase tracking-wider mb-1.5 ml-1">
                  Product Code
                </label>
                <div className="relative">
                  <input
                    type="text"
                    name="code"
                    value={formData.code}
                    readOnly
                    className={`w-full bg-[#F2F4F6] border-none rounded-lg py-2.5 px-3 focus:ring-2 focus:ring-[#004AC6]/15 transition-all text-sm font-mono text-[#004AC6] font-bold outline-none ${errors.code ? 'ring-2 ring-[#BA1A1A]/30' : ''}`}
                  />
                  <RefreshCw size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                </div>
                {errors.code && (
                  <p className="mt-1.5 text-xs text-[#BA1A1A] font-medium">{errors.code}</p>
                )}
              </div>

              {/* Size / Weight */}
              <div className="col-span-1">
                <label className="block text-[10px] font-bold text-[#434655] uppercase tracking-wider mb-1.5 ml-1">
                  Size / Weight
                </label>
                <input
                  type="text"
                  name="size"
                  ref={sizeRef}
                  tabIndex={2}
                  value={formData.size}
                  onChange={handleChange}
                  placeholder="e.g. 1 No., 500g"
                  className="w-full bg-[#F2F4F6] border-none rounded-lg py-2.5 px-3 focus:bg-white focus:ring-2 focus:ring-[#004AC6]/15 transition-all text-sm placeholder:text-slate-400 outline-none"
                />
              </div>
              
              {/* Packing Type */}
              <div className="col-span-1">
                <label className="block text-[10px] font-bold text-[#434655] uppercase tracking-wider mb-1.5 ml-1">
                  Packing Type
                </label>
                <select
                  name="packingType"
                  ref={packingTypeRef}
                  tabIndex={3}
                  value={formData.packingType}
                  onChange={handleChange}
                  className="w-full bg-[#F2F4F6] border-none rounded-lg py-2.5 px-3 focus:bg-white focus:ring-2 focus:ring-[#004AC6]/15 transition-all text-sm outline-none cursor-pointer"
                >
                  {ALLOWED_PACKING_TYPES.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>

              {/* Last Updated — read only, visible only in edit mode */}
              {editing && (
                <div className="col-span-1">
                  <label className="block text-[10px] font-bold text-[#434655] uppercase tracking-wider mb-1.5 ml-1">
                    Last Price Update
                  </label>
                  <div className="w-full bg-[#F2F4F6] rounded-lg py-2.5 px-3 text-sm text-[#64748B] select-none">
                    {formatTimestamp(updatedAt)}
                  </div>
                </div>
              )}
            </div>

            {/* ─── Financials & Margin ─── */}
            <div className="pt-8 border-t border-[#ECEEF0]">
              <h3 className="text-[10px] font-black text-[#434655] uppercase tracking-[0.2em] mb-6">Financials & Margin</h3>
              <div className="grid grid-cols-3 gap-6 items-start">
                {/* Cost Price */}
                <div className="col-span-1">
                  <label className="block text-[10px] font-bold text-[#434655] uppercase tracking-wider mb-1.5 ml-1">
                    Cost Price (₹) <span className="text-[#BA1A1A]">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-[#434655]">₹</span>
                    <input
                      type="number"
                      name="costPrice"
                      ref={costPriceRef}
                      tabIndex={4}
                      value={formData.costPrice}
                      onChange={handleChange}
                      placeholder="0.00"
                      className={`w-full bg-[#F2F4F6] border-none rounded-lg py-2.5 pl-8 pr-4 focus:bg-white focus:ring-2 focus:ring-[#004AC6]/15 transition-all text-sm outline-none ${errors.costPrice ? 'ring-2 ring-[#BA1A1A]/30' : ''}`}
                    />
                  </div>
                  <div className="h-5">
                    {errors.costPrice && (
                      <p className="mt-0.5 text-xs text-[#BA1A1A] font-medium">{errors.costPrice}</p>
                    )}
                  </div>
                </div>

                {/* Selling Price */}
                <div className="col-span-1">
                  <label className="block text-[10px] font-bold text-[#434655] uppercase tracking-wider mb-1.5 ml-1">
                    Selling Price (₹) <span className="text-[#BA1A1A]">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-[#004AC6]">₹</span>
                    <input
                      type="number"
                      name="sellingPrice"
                      ref={sellingPriceRef}
                      tabIndex={5}
                      value={formData.sellingPrice}
                      onChange={handleChange}
                      placeholder="0.00"
                      className={`w-full bg-[#F2F4F6] border-none rounded-lg py-2.5 pl-8 pr-4 focus:bg-white focus:ring-2 focus:ring-[#004AC6]/15 transition-all text-sm font-semibold outline-none ${errors.sellingPrice ? 'ring-2 ring-[#BA1A1A]/30' : ''}`}
                    />
                  </div>
                  <div className="h-5">
                    {errors.sellingPrice && (
                      <p className="mt-0.5 text-xs text-[#BA1A1A] font-medium">{errors.sellingPrice}</p>
                    )}
                  </div>
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
                className="px-8 py-2.5 text-sm font-bold text-[#434655] bg-[#E6E8EA] hover:bg-[#E0E3E5] transition-colors rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <div className="flex gap-4">
                {editing && (
                  <button
                    type="button"
                    disabled={deleting}
                    onClick={() => setShowDeleteModal(true)}
                    className="px-6 py-2.5 bg-[#DC2626] text-white text-sm font-bold rounded-xl hover:bg-red-700 transition-all flex items-center gap-2 shadow-lg shadow-red-600/20 active:scale-95 disabled:opacity-50 cursor-pointer"
                  >
                    <Trash2 size={16} />
                    {deleting ? 'Deleting...' : 'Delete'}
                  </button>
                )}
                <button
                  type="submit"
                  ref={saveBtnRef}
                  tabIndex={6}
                  disabled={submitting}
                  className="px-10 py-2.5 text-white text-sm font-bold rounded-xl shadow-lg shadow-[#004AC6]/20 hover:opacity-90 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                  style={{ background: 'linear-gradient(135deg, #004AC6 0%, #2563EB 100%)' }}
                >
                  <Save size={16} />
                  {submitting ? (editing ? 'Updating...' : 'Saving...') : (editing ? 'Update Product' : 'Save Product')}
                </button>
              </div>
            </div>
          </form>
        </div>
      </main>

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={showDeleteModal}
        onConfirm={async () => {
          const success = await handleDelete();
          if (success) setShowDeleteModal(false);
        }}
        onCancel={() => setShowDeleteModal(false)}
        title="Delete Product?"
        message={`Are you sure you want to delete ${formData.productName || 'this product'}? This action cannot be undone.`}
        confirmLabel="Delete"
        isLoading={deleting}
      />
    </div>
  );
};

export default AddPriceListProduct;