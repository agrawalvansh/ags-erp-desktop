import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, Trash } from 'lucide-react';
import { toast } from 'react-hot-toast';
import Popup from 'reactjs-popup';
import 'reactjs-popup/dist/index.css';

// Reusable form for creating supplier maal / jama entries
const AddSupplierAccountEntry = () => {
  const { slug, type, id } = useParams(); // type => 'maal' | 'jama', id present when editing
  const navigate = useNavigate();
  const isEditing = Boolean(id);

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
  const [recordId, setRecordId] = useState(id);
  const [loading, setLoading] = useState(false);

  // Load existing entry for editing
  useEffect(() => {
    if (!isEditing) return;
    const load = async () => {
      try {
        const arr = await (type === 'maal'
          ? window.api.invoke('suppliersMaal:getBySupplier', slug)
          : window.api.invoke('supplierTransactions:getBySupplier', slug));
        const record = arr.find((r) => {
          if (type === 'maal') {
            return String(r.id ?? r.maal_id ?? r.invoice_id) === id;
          }
          return String(r.transaction_id ?? r.id) === id;
        });
        if (!record) return;
        setRecordId(record.id ?? record.transaction_id);
        if (type === 'maal') {
          setFormData({
            date: record.maal_date || record.invoice_date || '',
            invoiceNumber: record.maal_invoice_no || record.invoice_id || '',
            txnType: '',
            amount: record.maal_amount || record.grand_total || '',
            remark: record.maal_remark || record.remark || '',
          });
        } else {
          setFormData({
            date: record.date || record.jama_date || '',
            invoiceNumber: '',
            txnType: record.txn_type || record.jama_txn_type || '',
            amount: record.amount || record.jama_amount || '',
            remark: record.remark || record.jama_remark || '',
          });
        }
      } catch (err) {
        console.error('Load entry error', err);
      }
    };
    load();
  }, [isEditing, id, slug, type]);

  const validate = () => {
    const e = {};
    if (!formData.date) e.date = 'Date required';
    if (!formData.amount) e.amount = 'Amount required';
    if (Number(formData.amount) <= 0) e.amount = 'Amount must be > 0';
    if (type === 'maal' && !formData.invoiceNumber) e.invoiceNumber = 'Invoice number required';
    if (type === 'jama' && !formData.txnType) e.txnType = 'Txn type required';
    setErrors(e);
    return !Object.keys(e).length;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      const payload = {
        supplier_id: slug,
        date: formData.date,
        amount: Number(formData.amount),
        remark: formData.remark,
      };
      let channel = '';
      if (type === 'maal') {
        channel = isEditing ? 'suppliersMaal:update' : 'suppliersMaal:create';
        payload.invoice_number = formData.invoiceNumber;
      } else {
        channel = isEditing ? 'supplierTransactions:update' : 'supplierTransactions:create';
        payload.txn_type = formData.txnType;
      }
      const result = await window.api.invoke(channel, isEditing ? { id: recordId, ...payload } : payload);

      // Explicit success check - only proceed if backend confirms success
      if (!result || result.error || result.success === false) {
        toast.error(result?.error || 'An error occurred while saving. Please try again.');
        return; // Keep data, do NOT navigate
      }

      // Only on confirmed success
      toast.success(isEditing ? 'Entry updated successfully' : 'Entry added successfully');
      navigate(`/accounts/suppliers/${slug}`);
    } catch (err) {
      toast.error('An error occurred while saving. Please try again.');
      // Keep data, do NOT navigate
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!isEditing) return;

    setDeleting(true);
    try {
      const channelDel = type === 'maal' ? 'suppliersMaal:delete' : 'supplierTransactions:delete';
      const result = await window.api.invoke(channelDel, recordId);

      // Explicit success check
      if (!result || result.error || result.success === false) {
        toast.error(result?.error || 'An error occurred while deleting. Please try again.');
        return; // Keep UI state, do NOT navigate
      }

      // Only on confirmed success
      toast.success('Entry deleted successfully');
      navigate(`/accounts/suppliers/${slug}`);
    } catch (err) {
      toast.error('An error occurred while deleting. Please try again.');
      // Keep UI state, do NOT navigate
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="w-full">
        <header className="bg-[#caf0f8] p-4 md:p-6">
          <div className="max-w-3xl mx-auto flex items-center">
            <button
              onClick={() => navigate(`/accounts/suppliers/${slug}`)}
              className="flex items-center text-[#05014A] hover:text-[#03012e] cursor-pointer"
            >
              <ArrowLeft className="mr-2" size={20} />
              Back to Supplier Account
            </button>
          </div>
        </header>
      </div>

      <div className="p-4 md:p-6 max-w-xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Add {type === 'maal' ? 'Maal' : 'Jama'} Entry</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* date */}
          <div>
            <label className="block text-sm font-medium mb-1">Date</label>
            <input
              type="date"
              name="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
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
                onChange={(e) => setFormData({ ...formData, invoiceNumber: e.target.value })}
                className={`w-full border rounded px-3 py-2 ${errors.invoiceNumber ? 'border-red-500' : 'border-gray-300'}`}
                required
                placeholder="Enter invoice number"
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
                onChange={(e) => setFormData({ ...formData, txnType: e.target.value })}
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
          {/* amount */}
          <div>
            <label className="block text-sm font-medium mb-1">Amount (₹)</label>
            <input
              type="number"
              name="amount"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              className={`w-full border rounded px-3 py-2 ${errors.amount ? 'border-red-500' : 'border-gray-300'}`}
              required
              placeholder="Enter amount"
            />
            {errors.amount && <p className="text-sm text-red-500 mt-1">{errors.amount}</p>}
          </div>
          {/* remark */}
          <div>
            <label className="block text-sm font-medium mb-1">Remark</label>
            <input
              type="text"
              name="remark"
              value={formData.remark}
              onChange={(e) => setFormData({ ...formData, remark: e.target.value })}
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
              disabled={loading}
              className="flex items-center bg-[#05014A] text-white px-6 py-2 rounded-lg hover:bg-[#03012e] disabled:opacity-50 cursor-pointer"
            >
              <Save className="mr-2" size={20} />
              {loading ? (isEditing ? 'Updating...' : 'Saving...') : (isEditing ? 'Update Entry' : 'Add Entry')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddSupplierAccountEntry;
