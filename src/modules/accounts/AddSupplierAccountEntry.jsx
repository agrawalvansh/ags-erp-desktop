import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Trash2, Check } from 'lucide-react';
import { toast } from 'react-hot-toast';

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
  const [showDeleteModal, setShowDeleteModal] = useState(false);

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
      setShowDeleteModal(false);
      navigate(`/accounts/suppliers/${slug}`);
    } catch (err) {
      toast.error('An error occurred while deleting. Please try again.');
      // Keep UI state, do NOT navigate
    } finally {
      setDeleting(false);
    }
  };

  const isMaal = type === 'maal';
  const entryLabel = isMaal ? 'Maal' : 'Jama';
  const categoryLabel = isMaal ? 'Supplier Debit (Maal)' : 'Supplier Credit (Jama)';

  return (
    <div className="min-h-screen bg-[#F7F9FB]">
      {/* ─── Top Bar ─── */}
      <header className="bg-[#F7F9FB] flex items-center gap-4 px-8 py-5">
        <button
          onClick={() => navigate(`/accounts/suppliers/${slug}`)}
          className="flex items-center gap-2 text-[#434655] hover:text-[#004AC6] transition-colors group cursor-pointer"
        >
          <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" />
          <span className="text-sm font-medium">Back to Supplier Account</span>
        </button>
        <div className="bg-[#ECEEF0] h-6 w-[1px]"></div>
        <h1 className="text-lg font-bold text-[#191C1E]">
          {isEditing ? 'Edit' : 'Add'} {entryLabel} Entry
        </h1>
      </header>

      {/* ─── Content Canvas ─── */}
      <main className="flex flex-col items-center px-4 py-8 md:py-12">
        {/* Form Container */}
        <div className="w-full max-w-xl bg-white rounded-xl shadow-sm border border-[#C3C6D7]/10 overflow-hidden">
          {/* Gradient Accent Bar */}
          <div className="h-1.5 rounded-t-xl" style={{ background: 'linear-gradient(135deg, #004AC6 0%, #2563EB 100%)' }}></div>

          <form onSubmit={handleSubmit} className="p-8 md:p-10 space-y-8">
            {/* Header Info */}
            <div className="mb-2 border-b border-[#ECEEF0] pb-6">
              <p className="text-[10px] font-bold uppercase text-[#434655] tracking-widest mb-1">Transaction Category</p>
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-black text-[#191C1E] tracking-tight">{categoryLabel}</h2>
                <span className="px-3 py-1 bg-[#004AC6]/10 text-[#004AC6] text-xs font-bold rounded-full">
                  {isEditing ? 'Edit Voucher' : 'New Voucher'}
                </span>
              </div>
            </div>

            {/* Form Fields Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Date */}
              <div className="space-y-2">
                <label className="block text-[10px] font-bold uppercase text-[#434655] tracking-wider ml-1">
                  Date <span className="text-[#BA1A1A]">*</span>
                </label>
                <input
                  type="date"
                  name="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className={`w-full bg-[#F2F4F6] border-none rounded-lg px-4 py-3 text-sm font-medium focus:bg-white focus:ring-2 focus:ring-[#004AC6]/15 transition-all outline-none ${errors.date ? 'ring-2 ring-[#BA1A1A]/30' : ''}`}
                  required
                />
                {errors.date && <p className="text-xs text-[#BA1A1A] ml-1">{errors.date}</p>}
              </div>

              {/* Transaction Type (Jama) or Invoice Number (Maal) */}
              {isMaal ? (
                <div className="space-y-2">
                  <label className="block text-[10px] font-bold uppercase text-[#434655] tracking-wider ml-1">
                    Invoice Number <span className="text-[#BA1A1A]">*</span>
                  </label>
                  <input
                    type="text"
                    name="invoiceNumber"
                    value={formData.invoiceNumber}
                    onChange={(e) => setFormData({ ...formData, invoiceNumber: e.target.value })}
                    className={`w-full bg-[#F2F4F6] border-none rounded-lg px-4 py-3 text-sm font-medium focus:bg-white focus:ring-2 focus:ring-[#004AC6]/15 transition-all outline-none ${errors.invoiceNumber ? 'ring-2 ring-[#BA1A1A]/30' : ''}`}
                    required
                    placeholder="Enter invoice number"
                    autoComplete="off"
                  />
                  {errors.invoiceNumber && <p className="text-xs text-[#BA1A1A] ml-1">{errors.invoiceNumber}</p>}
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="block text-[10px] font-bold uppercase text-[#434655] tracking-wider ml-1">
                    Transaction Type <span className="text-[#BA1A1A]">*</span>
                  </label>
                  <select
                    name="txnType"
                    value={formData.txnType}
                    onChange={(e) => setFormData({ ...formData, txnType: e.target.value })}
                    className={`w-full bg-[#F2F4F6] border-none rounded-lg px-4 py-3 text-sm font-medium focus:bg-white focus:ring-2 focus:ring-[#004AC6]/15 transition-all outline-none appearance-none ${errors.txnType ? 'ring-2 ring-[#BA1A1A]/30' : ''}`}
                    required
                  >
                    <option value="">Select Transaction Type</option>
                    <option value="Cash">Cash</option>
                    <option value="UPI">UPI</option>
                    <option value="Transfer">Transfer</option>
                    <option value="RTGS">RTGS</option>
                  </select>
                  {errors.txnType && <p className="text-xs text-[#BA1A1A] ml-1">{errors.txnType}</p>}
                </div>
              )}

              {/* Amount */}
              <div className="md:col-span-2 space-y-2">
                <label className="block text-[10px] font-bold uppercase text-[#434655] tracking-wider ml-1">
                  Amount (₹) <span className="text-[#BA1A1A]">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#434655] font-bold">₹</span>
                  <input
                    type="number"
                    name="amount"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    className={`w-full bg-[#F2F4F6] border-none rounded-lg pl-8 pr-4 py-4 text-2xl font-black text-[#004AC6] focus:bg-white focus:ring-2 focus:ring-[#004AC6]/15 transition-all outline-none placeholder:text-[#C3C6D7] ${errors.amount ? 'ring-2 ring-[#BA1A1A]/30' : ''}`}
                    required
                    placeholder="0.00"
                  />
                </div>
                {errors.amount && <p className="text-xs text-[#BA1A1A] ml-1">{errors.amount}</p>}
              </div>

              {/* Remark */}
              <div className="md:col-span-2 space-y-2">
                <label className="block text-[10px] font-bold uppercase text-[#434655] tracking-wider ml-1">
                  Remark
                </label>
                <textarea
                  name="remark"
                  value={formData.remark}
                  onChange={(e) => setFormData({ ...formData, remark: e.target.value })}
                  className="w-full bg-[#F2F4F6] border-none rounded-lg px-4 py-3 text-sm font-medium focus:bg-white focus:ring-2 focus:ring-[#004AC6]/15 transition-all outline-none resize-none placeholder:text-[#C3C6D7]"
                  placeholder="Enter transaction details or reference numbers..."
                  rows={3}
                  autoComplete="off"
                />
              </div>
            </div>

            {/* Action Footer */}
            <div className="flex items-center justify-between pt-8 border-t border-[#ECEEF0]">
              {isEditing ? (
                <button
                  type="button"
                  disabled={deleting}
                  onClick={() => setShowDeleteModal(true)}
                  className="px-6 py-3 bg-[#DC2626] text-white font-bold rounded-xl text-sm hover:bg-red-700 transition-colors active:scale-95 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {deleting ? 'Deleting...' : 'Delete'}
                </button>
              ) : (
                <div></div>
              )}
              <button
                type="submit"
                disabled={loading}
                className="px-10 py-3 text-white font-bold rounded-xl text-sm shadow-lg shadow-[#004AC6]/20 hover:opacity-90 transition-all active:scale-95 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                style={{ background: 'linear-gradient(135deg, #004AC6 0%, #2563EB 100%)' }}
              >
                <span>{loading ? (isEditing ? 'Updating...' : 'Saving...') : 'Save Entry'}</span>
                {!loading && <Check size={16} />}
              </button>
            </div>
          </form>
        </div>
      </main>

      {/* ─── Delete Confirmation — Stitch Glass Overlay ─── */}
      {showDeleteModal && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          style={{ backdropFilter: 'blur(8px)', backgroundColor: 'rgba(255,255,255,0.7)' }}
        >
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl border border-[#C3C6D7]/20 p-8 text-center">
            <div className="w-16 h-16 bg-red-100/50 rounded-full flex items-center justify-center mx-auto mb-6">
              <Trash2 size={28} className="text-[#DC2626]" />
            </div>
            <h3 className="text-lg font-bold text-[#0F172A] mb-2">Delete Entry?</h3>
            <p className="text-sm text-[#434655] mb-8 px-4">
              This action cannot be undone. This {entryLabel.toLowerCase()} entry will be permanently removed.
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => handleDelete()}
                disabled={deleting}
                className="w-full py-3 bg-[#DC2626] text-white font-bold rounded-xl text-sm active:scale-95 transition-transform cursor-pointer hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Delete Entry
              </button>
              <button
                onClick={() => setShowDeleteModal(false)}
                className="w-full py-3 bg-[#ECEEF0] text-[#191C1E] font-bold rounded-xl text-sm hover:bg-[#E6E8EA] transition-colors active:scale-95 cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AddSupplierAccountEntry;
