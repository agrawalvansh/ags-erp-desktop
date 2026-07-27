import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useParams, useBlocker } from 'react-router-dom';
import { ArrowLeft, Save, Trash2, Lock } from 'lucide-react';
import { toast } from 'react-hot-toast';
import DeleteConfirmModal from '../../components/DeleteConfirmModal';
import NavigationWarningModal from '../../components/NavigationWarningModal';

// Form to create / edit a supplier (mirrors AddBuyerAccount but hits /api/suppliers)
const AddSupplierAccount = () => {
  const navigate = useNavigate();
  const { id: paramId } = useParams();
  const isEdit = Boolean(paramId);

  // form state
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [mobile, setMobile] = useState('');
  const deleteModalRef = useRef(null);
  const [supplierId, setSupplierId] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [deleting, setDeleting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [originalValues, setOriginalValues] = useState(null);
  const savedRef = useRef(false); // ref so isDirty reads it synchronously on navigate

  // Focus the delete modal when it opens
  useEffect(() => {
    if (showDeleteModal) deleteModalRef.current?.focus();
  }, [showDeleteModal]);

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
            setOriginalValues({ name: found.name || '', address: found.address || '', mobile: found.mobile || '' });
          } else {
            setErrors({ general: 'Supplier not found' });
          }
        } else {
          let maxNum = 0;
          for (const s of data) {
            const m = s.supplier_id.match(/^AGS-S-(\d+)$/);
            if (m) maxNum = Math.max(maxNum, parseInt(m[1]));
          }
          setSupplierId(`AGS-S-${maxNum + 1}`);
        }
      } catch (err) {
        console.error(err);
        setErrors({ general: err.message });
        if (!isEdit) setSupplierId('AGS-S-1');
      }
    };
    fetchData();
  }, [isEdit, paramId]);

  // Unsaved changes detection.
  // isDirty is a useMemo — it cannot react to ref changes, so savedRef is NOT
  // read here. Instead, savedRef is read directly in the blocker callback
  // (which is evaluated fresh on every navigation) so it always sees the
  // synchronous write that happened just before navigate() was called.
  const isDirty = useMemo(() => {
    if (!isEdit) return name.trim() !== '';
    if (!originalValues) return false;
    return name !== originalValues.name || address !== originalValues.address || mobile !== originalValues.mobile;
  }, [name, address, mobile, originalValues, isEdit]);

  // blocker reads savedRef.current directly — synchronously true after save
  const blocker = useBlocker(({ currentLocation, nextLocation }) =>
    !savedRef.current && isDirty && currentLocation.pathname !== nextLocation.pathname
  );

  useEffect(() => {
    const handler = (e) => { if (!savedRef.current && isDirty) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const newErrors = {};
    if (!name.trim()) newErrors.name = 'Name is required';
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    setLoading(true);
    setErrors({});

    try {
      const channel = isEdit ? 'suppliers:update' : 'suppliers:create';
      await window.api.invoke(channel, { supplier_id: supplierId, name, address, mobile });

      toast.success(isEdit ? 'Supplier updated successfully' : 'Supplier added successfully');
      // Set ref synchronously so isDirty is false before navigate() runs the blocker check
      savedRef.current = true;
      navigate('/accounts/suppliers');
    } catch (err) {
      toast.error(err.message);
      setErrors({ general: err.message });
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
      setErrors({ general: err.message });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F9FB]">
      {/* ─── Top Bar ─── */}
      <header className="bg-[#F7F9FB] flex items-center gap-4 px-8 py-5">
        <button
          onClick={() => navigate('/accounts/suppliers')}
          className="flex items-center gap-2 text-[#434655] hover:text-[#004AC6] transition-colors group cursor-pointer"
        >
          <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
          <span className="text-sm font-medium">Back to Supplier Accounts</span>
        </button>
        <div className="bg-[#ECEEF0] h-6 w-[1px]"></div>
        <h1 className="text-lg font-bold text-[#191C1E]">
          {isEdit ? 'Edit Supplier' : 'Add New Supplier'}
        </h1>
      </header>

      {/* ─── Content Canvas ─── */}
      <main className="flex flex-col items-center px-4 py-8 md:py-12">
        {/* Form Card */}
        <div className="w-full max-w-[576px] bg-white rounded-xl shadow-sm border border-[#C3C6D7]/10 p-8">
            <form onSubmit={handleSubmit} className="space-y-6" autoComplete="off">
              {/* Supplier ID (Read-only) */}
              <div className="space-y-2">
                <label className="block text-[10px] font-bold uppercase text-[#434655] tracking-wider mb-1.5 ml-1">
                  Supplier ID
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={supplierId}
                    readOnly
                    className="w-full bg-[#ECEEF0] border-none rounded-lg px-3 py-2.5 text-sm text-[#434655] cursor-not-allowed focus:ring-0 outline-none"
                    autoComplete="off"
                  />
                  <Lock size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#434655]/40" />
                </div>
              </div>

              {/* Name (Required) */}
              <div className="space-y-2">
                <label className="block text-[10px] font-bold uppercase text-[#434655] tracking-wider mb-1.5 ml-1">
                  Name <span className="text-[#BA1A1A]">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => { setName(e.target.value); if (errors.name) setErrors(prev => ({ ...prev, name: '' })); }}
                  className={`w-full bg-[#F2F4F6] border-none rounded-lg px-3 py-2.5 text-sm focus:bg-white focus:ring-2 focus:ring-[#004AC6]/15 transition-all outline-none ${errors.name ? 'ring-2 ring-[#BA1A1A]/30' : ''}`}
                  placeholder="Enter supplier name"
                  autoComplete="off"
                />
                {errors.name && <p className="text-xs text-[#BA1A1A] mt-1.5 ml-1">{errors.name}</p>}
              </div>

              {/* Address (Textarea) */}
              <div className="space-y-2">
                <label className="block text-[10px] font-bold uppercase text-[#434655] tracking-wider mb-1.5 ml-1">
                  Address
                </label>
                <textarea
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full bg-[#F2F4F6] border-none rounded-lg px-3 py-2.5 text-sm focus:bg-white focus:ring-2 focus:ring-[#004AC6]/15 transition-all outline-none resize-none"
                  placeholder="Enter complete business address"
                  rows={3}
                  autoComplete="off"
                ></textarea>
              </div>

              {/* Mobile No. */}
              <div className="space-y-2">
                <label className="block text-[10px] font-bold uppercase text-[#434655] tracking-wider mb-1.5 ml-1">
                  Mobile No.
                </label>
                <input
                  type="text"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  className="w-full bg-[#F2F4F6] border-none rounded-lg px-3 py-2.5 text-sm focus:bg-white focus:ring-2 focus:ring-[#004AC6]/15 transition-all outline-none"
                  placeholder="Enter mobile number"
                  maxLength={15}
                  autoComplete="off"
                />
              </div>

              {errors.general && <p className="text-[#BA1A1A] text-sm">{errors.general}</p>}

              {/* Form Actions */}
              <div className="flex items-center justify-between pt-6 border-t border-[#ECEEF0]">
                {isEdit ? (
                  <button
                    type="button"
                    disabled={deleting}
                    onClick={() => setShowDeleteModal(true)}
                    className="px-6 py-2.5 bg-[#DC2626] text-white font-bold rounded-xl text-sm hover:bg-red-700 transition-colors active:scale-95 duration-150 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center gap-2"
                  >
                    <Trash2 size={16} />
                    {deleting ? 'Deleting...' : 'Delete'}
                  </button>
                ) : (
                  <div></div>
                )}
                <button
                  type="submit"
                  disabled={loading}
                  className="px-8 py-2.5 text-white font-bold rounded-xl text-sm shadow-lg shadow-[#004AC6]/20 hover:opacity-90 transition-all active:scale-95 duration-150 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center gap-2"
                  style={{ background: 'linear-gradient(135deg, #004AC6 0%, #2563EB 100%)' }}
                >
                  <Save size={16} />
                  {loading
                    ? (isEdit ? 'Updating...' : 'Saving...')
                    : (isEdit ? 'Update Supplier' : 'Add Supplier')
                  }
                </button>
              </div>
            </form>
          </div>
      </main>

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={showDeleteModal}
        onConfirm={() => handleDelete()}
        onCancel={() => setShowDeleteModal(false)}
        title="Delete Supplier?"
        message="This action cannot be undone. All pending drafts for this supplier will be permanently removed."
        confirmLabel="Delete Supplier"
        isLoading={deleting}
      />
      <NavigationWarningModal blocker={blocker} />
    </div>
  );
};

export default AddSupplierAccount;