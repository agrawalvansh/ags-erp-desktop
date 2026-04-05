import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, Trash2, Lock } from 'lucide-react';
import { toast } from 'react-hot-toast';

// Form to create / edit a supplier (mirrors AddBuyerAccount but hits /api/suppliers)
const AddSupplierAccount = () => {
  const navigate = useNavigate();
  const { id: paramId } = useParams();
  const isEdit = Boolean(paramId);

  // form state
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [mobile, setMobile] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Fetch data – either next ID (add) or existing supplier (edit)
  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await window.api.invoke('suppliers:getAll');

        if (isEdit) {
          const found = data.find((s) => s.supplier_id === paramId);
          if (found) {
            setSupplierId(found.supplier_id);
            setName(found.name || '');
            setAddress(found.address || '');
            setMobile(found.mobile || '');
          } else {
            setError('Supplier not found');
          }
        } else {
          const nextNum = data.length + 1;
          setSupplierId(`AGS-S-${nextNum}`);
        }
      } catch (err) {
        console.error(err);
        setError(err.message);
        if (!isEdit) setSupplierId('AGS-S-1');
      }
    };
    fetchData();
  }, [isEdit, paramId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    setLoading(true);
    setError('');

    try {
      const channel = isEdit ? 'suppliers:update' : 'suppliers:create';
      await window.api.invoke(channel, { supplier_id: supplierId, name, address, mobile });

      toast.success(isEdit ? 'Supplier updated successfully' : 'Supplier added successfully');
      // success – back to list page
      navigate('/accounts/suppliers');
    } catch (err) {
      toast.error(err.message);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await window.api.invoke('suppliers:delete', supplierId);
      toast.success('Supplier deleted successfully');
      setShowDeleteModal(false);
      navigate('/accounts/suppliers');
    } catch (err) {
      toast.error(err.message);
      setError(err.message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F9FB]">
      {/* ─── Page Content ─── */}
      <div className="flex-1 p-8">
        <div className="max-w-4xl mx-auto">
          {/* ─── Header Section ─── */}
          <div className="mb-8">
            <button
              onClick={() => navigate('/accounts/suppliers')}
              className="flex items-center gap-2 text-[#434655] hover:text-[#004AC6] transition-colors mb-3 group cursor-pointer"
            >
              <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" />
              <span className="text-sm font-medium">Back to Supplier Accounts</span>
            </button>
            <h2 className="text-[20px] font-bold text-[#191C1E]">
              {isEdit ? 'Edit Supplier' : 'Add New Supplier'}
            </h2>
          </div>

          {/* ─── Form Card ─── */}
          <div className="max-w-[576px] mx-auto bg-white rounded-xl shadow-sm border border-[#C3C6D7]/10 p-8">
            <form onSubmit={handleSubmit} className="space-y-6" autoComplete="off">
              {/* Supplier ID (Read-only) */}
              <div className="space-y-2">
                <label className="block text-[10px] font-bold uppercase text-[#434655] tracking-wider">
                  Supplier ID
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={supplierId}
                    readOnly
                    className="w-full bg-[#ECEEF0] border-none rounded-lg px-4 py-3 text-sm text-[#434655] cursor-not-allowed focus:ring-0 outline-none"
                    autoComplete="off"
                  />
                  <Lock size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#434655]/40" />
                </div>
              </div>

              {/* Name (Required) */}
              <div className="space-y-2">
                <label className="block text-[10px] font-bold uppercase text-[#434655] tracking-wider">
                  Name <span className="text-[#BA1A1A]">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-[#F2F4F6] border-none rounded-lg px-4 py-3 text-sm focus:bg-white focus:ring-2 focus:ring-[#004AC6]/15 transition-all outline-none"
                  placeholder="Enter supplier name"
                  required
                  autoComplete="off"
                />
              </div>

              {/* Address (Textarea) */}
              <div className="space-y-2">
                <label className="block text-[10px] font-bold uppercase text-[#434655] tracking-wider">
                  Address
                </label>
                <textarea
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full bg-[#F2F4F6] border-none rounded-lg px-4 py-3 text-sm focus:bg-white focus:ring-2 focus:ring-[#004AC6]/15 transition-all outline-none resize-none"
                  placeholder="Enter complete business address"
                  rows={3}
                  autoComplete="off"
                ></textarea>
              </div>

              {/* Mobile No. */}
              <div className="space-y-2">
                <label className="block text-[10px] font-bold uppercase text-[#434655] tracking-wider">
                  Mobile No.
                </label>
                <input
                  type="text"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  className="w-full bg-[#F2F4F6] border-none rounded-lg px-4 py-3 text-sm focus:bg-white focus:ring-2 focus:ring-[#004AC6]/15 transition-all outline-none"
                  placeholder="Enter mobile number"
                  maxLength={15}
                  autoComplete="off"
                />
              </div>

              {error && <p className="text-[#BA1A1A] text-sm">{error}</p>}

              {/* Form Actions */}
              <div className="flex items-center justify-between pt-6 border-t border-[#ECEEF0]">
                {isEdit ? (
                  <button
                    type="button"
                    disabled={deleting}
                    onClick={() => setShowDeleteModal(true)}
                    className="px-6 py-2.5 bg-[#DC2626] text-white font-bold rounded-xl text-sm hover:bg-red-700 transition-colors active:scale-95 duration-150 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {deleting ? 'Deleting...' : 'Delete'}
                  </button>
                ) : (
                  <div></div>
                )}
                <button
                  type="submit"
                  disabled={loading}
                  className="px-8 py-2.5 text-white font-bold rounded-xl text-sm shadow-lg shadow-[#004AC6]/20 hover:opacity-90 transition-all active:scale-95 duration-150 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  style={{ background: 'linear-gradient(135deg, #004AC6 0%, #2563EB 100%)' }}
                >
                  {loading
                    ? (isEdit ? 'Updating...' : 'Saving...')
                    : (isEdit ? 'Update Supplier' : 'Add Supplier')
                  }
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* ─── Delete Confirmation — Stitch Glass Overlay ─── */}
      {showDeleteModal && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 outline-none"
          style={{ backdropFilter: 'blur(8px)', backgroundColor: 'rgba(255,255,255,0.7)' }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-supplier-heading"
          tabIndex={-1}
          ref={(el) => el?.focus()}
          onKeyDown={(e) => { if (e.key === 'Escape' && !deleting) setShowDeleteModal(false); }}
          onClick={(e) => { if (e.target === e.currentTarget && !deleting) setShowDeleteModal(false); }}
        >
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl border border-[#C3C6D7]/20 p-8 text-center">
            <div className="w-16 h-16 bg-red-100/50 rounded-full flex items-center justify-center mx-auto mb-6">
              <Trash2 size={28} className="text-[#DC2626]" />
            </div>
            <h3 id="delete-supplier-heading" className="text-lg font-bold text-[#0F172A] mb-2">Delete Supplier?</h3>
            <p className="text-sm text-[#434655] mb-8 px-4">
              This action cannot be undone. All pending drafts for this supplier will be permanently removed.
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => handleDelete()}
                disabled={deleting}
                className="w-full py-3 bg-[#DC2626] text-white font-bold rounded-xl text-sm active:scale-95 transition-transform cursor-pointer hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Delete Supplier
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

export default AddSupplierAccount;