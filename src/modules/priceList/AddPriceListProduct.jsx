import React, { useState, useEffect } from 'react';
import { ArrowLeft, Save, Trash } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import Popup from 'reactjs-popup';
import 'reactjs-popup/dist/index.css';
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
  const [originalCode, setOriginalCode] = useState(''); // Track original code for edit mode

  // Generate product code when productName or size changes
  useEffect(() => {
    if (!formData.productName) return;

    // Always regenerate code based on name and size
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
        setOriginalCode(data.code); // Store original code for comparison
      } catch (err) {
        toast.error(err.message);
        console.error(err);
      }
    };
    loadProduct();
  }, [editing, paramCode]);

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

      // Check if code already exists (excluding current product in edit mode)
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
        // Check if code changed (name or size was modified)
        if (originalCode !== formData.code) {
          // Case 2: Code changed - Create NEW product, soft-delete OLD product
          // This preserves FK references for historical invoices

          // Step 1: Create new product with updated details
          const newProductBody = {
            code: formData.code,
            name: formData.productName,
            size: formData.size,
            packing_type: formData.packingType,
            cost_price: Number(formData.costPrice),
            selling_price: Number(formData.sellingPrice)
          };
          await window.api.createProduct(newProductBody);

          // Step 2: Soft-delete old product (keep for historical invoice references)
          await window.api.deleteProduct(originalCode);

          toast.success('Product updated successfully. Old product archived for historical records.');
        } else {
          // Case 1: Code didn't change - Simple UPDATE on same row
          // Only cleaning data (e.g., moving size from name to size column)
          const body = {
            code: formData.code,
            name: formData.productName,
            size: formData.size,
            packing_type: formData.packingType,
            cost_price: Number(formData.costPrice),
            selling_price: Number(formData.sellingPrice)
          };
          await window.api.updateProduct({ id: paramCode, ...body });
          toast.success('Product saved successfully');
        }
      } else {
        // Creating new product
        const body = {
          code: formData.code,
          name: formData.productName,
          size: formData.size,
          packing_type: formData.packingType,
          cost_price: Number(formData.costPrice),
          selling_price: Number(formData.sellingPrice)
        };
        await window.api.createProduct(body);
        toast.success('Product saved successfully');
        // Navigate without editedProductCode for new products
        navigate('/price-list', { state: { editedProductCode: formData.code } });
        return;
      }
      // Navigate with the product code for auto-scroll (editing case)
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

  // capitalizeWords now imported from productUtils

  const handleChange = (e) => {
    const { name, value } = e.target;

    if (name === 'packingType') {
      // If user selects 'Other', clear customPackingType so textbox starts blank
      if (value === 'custom') {
        setFormData(prev => ({ ...prev, packingType: value, customPackingType: '' }));
      } else {
        // Switching back to predefined option: clear any previous custom value
        setFormData(prev => ({ ...prev, packingType: value, customPackingType: '' }));
      }
    } else if (name === 'productName') {
      const capitalizedValue = capitalizeWords(value);
      setFormData(prev => ({ ...prev, [name]: capitalizedValue }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-[#caf0f8] p-4 md:p-6">
        <div className="max-w-3xl mx-auto flex items-center">
          <button
            onClick={() => navigate('/price-list')}
            className="flex items-center text-[#05014A] hover:text-[#03012e] cursor-pointer"
          >
            <ArrowLeft className="mr-2" size={20} />
            Back to Price List
          </button>
        </div>
      </header>

      <main className="p-4 md:p-6">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-2xl md:text-3xl font-bold text-[#05014A] mb-6">
            {editing ? 'Edit Product' : 'Add New Product'}
          </h1>

          <form onSubmit={handleSubmit} autoComplete="off" className="bg-white rounded-xl shadow-md p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Form fields */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Product Name
                </label>
                <input
                  type="text"
                  name="productName"
                  value={formData.productName}
                  onChange={handleChange}
                  className={`w-full p-2 border rounded-lg ${errors.productName ? 'border-red-500' : 'border-gray-300'
                    }`}
                />
                {errors.productName && (
                  <p className="mt-1 text-sm text-red-500">{errors.productName}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Size
                </label>
                <input
                  type="text"
                  name="size"
                  value={formData.size}
                  onChange={handleChange}
                  className={`w-full p-2 border rounded-lg ${errors.size ? 'border-red-500' : 'border-gray-300'
                    }`}
                />
                {errors.size && (
                  <p className="mt-1 text-sm text-red-500">{errors.size}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Product Code
                </label>
                <input
                  type="text"
                  name="code"
                  value={formData.code}
                  readOnly
                  className={`w-full p-2 border rounded-lg ${errors.code ? 'border-red-500' : 'border-gray-300'}`}
                  onChange={handleChange}
                />
                {errors.code && (
                  <p className="mt-1 text-sm text-red-500">{errors.code}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Packing Type
                </label>
                <select
                  name="packingType"
                  value={formData.packingType}
                  onChange={handleChange}
                  className="w-full p-2 border border-gray-300 rounded-lg"
                >
                  {ALLOWED_PACKING_TYPES.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cost Price (₹)
                </label>
                <input
                  type="number"
                  name="costPrice"
                  value={formData.costPrice}
                  onChange={handleChange}
                  className={`w-full p-2 border rounded-lg ${errors.costPrice ? 'border-red-500' : 'border-gray-300'
                    }`}
                />
                {errors.costPrice && (
                  <p className="mt-1 text-sm text-red-500">{errors.costPrice}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Selling Price (₹)
                </label>
                <input
                  type="number"
                  name="sellingPrice"
                  value={formData.sellingPrice}
                  onChange={handleChange}
                  className={`w-full p-2 border rounded-lg ${errors.sellingPrice ? 'border-red-500' : 'border-gray-300'
                    }`}
                />
                {errors.sellingPrice && (
                  <p className="mt-1 text-sm text-red-500">{errors.sellingPrice}</p>
                )}
              </div>
            </div>



            <div className="mt-8 flex justify-end">
              {editing && (
                <Popup
                  trigger={
                    <button
                      type="button"
                      disabled={deleting}
                      className="flex items-center bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed mr-4 cursor-pointer transform hover:scale-105 active:scale-95 shadow-md hover:shadow-lg"
                    >
                      <Trash className="mr-2" size={20} />
                      {deleting ? (
                        <span className="flex items-center">
                          <svg className="animate-spin h-4 w-4 mr-2" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          Deleting...
                        </span>
                      ) : (
                        'Delete'
                      )}
                    </button>
                  }
                  modal
                  nested
                  overlayStyle={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
                >
                  {close => (
                    <div className="relative transform transition-all duration-300 scale-100">
                      <div className="bg-white p-8 rounded-xl shadow-2xl mx-auto border border-gray-100">
                        <div className="mb-6">
                          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Trash className="text-red-600" size={24} />
                          </div>
                          <h2 className="text-2xl font-bold text-gray-800 text-center mb-2">
                            Confirm Delete
                          </h2>
                          <p className="text-gray-600 text-center">
                            Are you sure you want to delete this product? This action cannot be undone.
                          </p>
                        </div>

                        <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                          <button
                            onClick={close}
                            className="w-full sm:w-auto px-6 py-2.5 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-gray-300 cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => {
                              handleDelete();
                              close();
                            }}
                            className="w-full sm:w-auto px-6 py-2.5 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transform hover:scale-105 active:scale-95 cursor-pointer"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </Popup>
              )}
              <button
                type="submit"
                disabled={submitting}
                className="flex items-center bg-[#05014A] text-white px-6 py-2 rounded-lg hover:bg-[#03012e] disabled:opacity-50 cursor-pointer"
              >
                <Save className="mr-2" size={20} />
                {submitting ? (editing ? 'Updating...' : 'Saving...') : (editing ? 'Update Product' : 'Add Product')}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
};

export default AddPriceListProduct;