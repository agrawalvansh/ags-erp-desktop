import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, Trash } from 'lucide-react';
import { toast } from 'react-hot-toast';
import Popup from 'reactjs-popup';
import 'reactjs-popup/dist/index.css';

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
      navigate('/accounts/suppliers');
    } catch (err) {
      toast.error(err.message);
      setError(err.message);
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
              onClick={() => navigate(`/accounts/suppliers`)}
              className="flex items-center text-[#05014A] hover:text-[#03012e] cursor-pointer"
            >
              <ArrowLeft className="mr-2" size={20} />
              Back to Supplier Account
            </button>
          </div>
        </header>
      </div>
      <div className="flex flex-col min-h-screen bg-gray-50 p-4 md:p-6">
        <div className="max-w-xl w-full mx-auto bg-white rounded-lg shadow p-6 space-y-6">
          <h1 className="text-2xl font-bold text-center text-[#05014A]">{isEdit ? 'Edit Supplier' : 'Add New Supplier'}</h1>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block mb-1 font-medium">Supplier&nbsp;ID</label>
              <input
                type="text"
                value={supplierId}
                readOnly
                className="w-full px-3 py-2 border rounded bg-gray-100 cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block mb-1 font-medium">Name<span className="text-red-500">*</span></label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-[#05014A]"
                required
              />
            </div>

            <div>
              <label className="block mb-1 font-medium">Address</label>
              <textarea
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-[#05014A] resize-none"
                rows={3}
              ></textarea>
            </div>

            <div>
              <label className="block mb-1 font-medium">Mobile&nbsp;No.</label>
              <input
                type="text"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-[#05014A]"
                maxLength={15}
              />
            </div>

            {error && <p className="text-red-600 text-sm">{error}</p>}

            <div className="mt-8 flex justify-end">
              {isEdit && (
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
                            Are you sure you want to delete this Supplier? This action cannot be undone.
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
                {loading ? (isEdit ? 'Updating...' : 'Saving...') : (isEdit ? 'Update Supplier' : 'Add Supplier')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AddSupplierAccount;