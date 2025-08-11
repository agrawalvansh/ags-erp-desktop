import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, Trash } from 'lucide-react';
import { toast } from 'react-hot-toast';
import Popup from 'reactjs-popup';
import 'reactjs-popup/dist/index.css';

const AddAccountEntry = () => {
  const { slug, type, id } = useParams(); // type => 'maal' | 'jama'; id present when editing
  const navigate = useNavigate();
  const isEditing = Boolean(id);

  // Guard against invalid type
  if (type !== 'maal' && type !== 'jama') {
    navigate(-1);
    return null;
  }

  const [formData, setFormData] = useState({
    date: '',
    invoiceNumber: '',
    txnType: '',
    amount: '',
    remark: '',
  });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Load existing entry when editing
  useEffect(() => {
    if (!isEditing) return;
    const load = async () => {
      try {
        const data = await (type === 'maal'
            ? window.api.invoke('maal:get', id)
            : window.api.invoke('transactions:get', id));
        setFormData({
          date: data.date || data.invoice_date || '',
          invoiceNumber: data.invoice_number || '',
          txnType: data.txn_type || '',
          amount: data.amount || data.grand_total || '',
          remark: data.remark || '',
        });
      } catch (err) {
        console.error('Load entry error', err);
      }
    };
    load();
  }, [id, isEditing, type]);

  const validateForm = () => {
    const newErrors = {};
    if (!formData.date) newErrors.date = 'Date is required';
    if (!formData.amount) {
      newErrors.amount = 'Amount is required';
    } else if (Number(formData.amount) <= 0) {
      newErrors.amount = 'Amount must be greater than 0';
    }

    if (type === 'maal') {
      if (!formData.invoiceNumber) newErrors.invoiceNumber = 'Invoice number is required';
    } else if (!formData.txnType) {
      newErrors.txnType = 'Transaction type is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setSubmitting(true);
    try {
      const payload = {
        customer_id: slug,
        date: formData.date,
        amount: Number(formData.amount),
        remark: formData.remark,
      };
      let channel;
      if (type === 'maal') {
        channel = isEditing ? 'maal:update' : 'maal:create';
        payload.invoice_number = formData.invoiceNumber;
      } else {
        channel = isEditing ? 'transactions:update' : 'transactions:create';
        payload.txn_type = formData.txnType;
      }
      await window.api.invoke(channel, isEditing ? { id, ...payload } : payload );
      toast.success(isEditing ? 'Entry updated successfully' : 'Entry added successfully');
      // On success, navigate back to buyer account detail
      navigate(`/accounts/customers/${slug}`);
    } catch (err) {
      toast.error(err.message);
      console.error('Error saving entry:', err);
    } finally {
      setSubmitting(false);
    }
  };

  // Delete existing entry
  const handleDelete = async () => {
    if (!isEditing) return;

    setDeleting(true);
    try {
      const channel = type === 'maal' ? 'maal:delete' : 'transactions:delete';
      await window.api.invoke(channel, id);
      toast.success('Entry deleted successfully');
      navigate(`/accounts/customers/${slug}`);
    } catch (err) {
      toast.error(err.message);
      console.error('Delete error:', err);
    } finally {
      setDeleting(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="w-full">
        <header className="bg-[#caf0f8] p-4 md:p-6">
          <div className="max-w-3xl mx-auto flex items-center">
            <button
              onClick={() => navigate(`/accounts/customers/${slug}`)}
              className="flex items-center text-[#05014A] hover:text-[#03012e] cursor-pointer"
            >
              <ArrowLeft className="mr-2" size={20} />
              Back to Customer Account
            </button>
          </div>
        </header>
      </div>

      <div className="p-4 md:p-6 max-w-xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">
          {isEditing ? 'Edit' : 'Add'} {type === 'maal' ? 'Maal' : 'Jama'} Entry
        </h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Date */}
          <div>
            <label className="block text-sm font-medium mb-1">Date</label>
            <input
              type="date"
              name="date"
              value={formData.date}
              onChange={handleChange}
              className={`w-full border rounded px-3 py-2 ${errors.date ? 'border-red-500' : 'border-gray-300'}`}
              required
            />
            {errors.date && <p className="text-sm text-red-500 mt-1">{errors.date}</p>}
          </div>

          {type === 'maal' ? (
            <div>
              <label className="block text-sm font-medium mb-1">Invoice Number</label>
              <input
                type="text"
                name="invoiceNumber"
                value={formData.invoiceNumber}
                onChange={handleChange}
                className={`w-full border rounded px-3 py-2 ${errors.invoiceNumber ? 'border-red-500' : 'border-gray-300'}`}
                required
                placeholder='Enter invoice number'
                autoComplete="off"
              />
              {errors.invoiceNumber && <p className="text-sm text-red-500 mt-1">{errors.invoiceNumber}</p>}
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium mb-1">Transaction Type</label>
              <select
                name="txnType"
                value={formData.txnType}
                onChange={handleChange}
                className={`w-full border rounded px-3 py-2 ${errors.txnType ? 'border-red-500' : 'border-gray-300'}`}
                required
              >
                <option value="">Select Transaction Type</option>
                <option value="Cash">Cash</option>
                <option value="Online">Online</option>
                <option value="Transfer">Transfer</option>
                <option value="RTGS">RTGS</option>
              </select>
              {errors.txnType && <p className="text-sm text-red-500 mt-1">{errors.txnType}</p>}
            </div>
          )}

          {/* Amount */}
          <div>
            <label className="block text-sm font-medium mb-1">Amount (₹)</label>
            <input
              type="number"
              name="amount"
              value={formData.amount}
              onChange={handleChange}
              className={`w-full border rounded px-3 py-2 ${errors.amount ? 'border-red-500' : 'border-gray-300'}`}
              required
              placeholder="Enter amount"
            />
            {errors.amount && <p className="text-sm text-red-500 mt-1">{errors.amount}</p>}
          </div>

          {/* Remark */}
          <div>
            <label className="block text-sm font-medium mb-1">Remark</label>
            <input
              type="text"
              name="remark"
              value={formData.remark}
              onChange={handleChange}
              className="w-full border rounded px-3 py-2"
              placeholder="Enter remark"
              autoComplete="off"
            />
          </div>

          <div className="mt-8 flex justify-end">
            {isEditing && (
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
              disabled={isLoading}
              className="flex items-center bg-[#05014A] text-white px-6 py-2 rounded-lg hover:bg-[#03012e] disabled:opacity-50 cursor-pointer"
            >
              <Save className="mr-2" size={20} />
              {isLoading ? (isEditing ? 'Updating...' : 'Saving...') : (isEditing ? 'Update Entry' : 'Add Entry')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddAccountEntry;
