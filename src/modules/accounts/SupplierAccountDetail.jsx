import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Search, Edit, Trash2, Filter, Plus, Phone, MapPin, Building, Save, X, ArrowLeft, Bell, Clock } from 'lucide-react';
import { toast } from 'react-hot-toast';

// Utility to parse various date formats to a Date object
export const parseDate = (dateStr) => {
  if (!dateStr) return new Date(0);
  if (dateStr.includes('-')) {
    const [yyyy, mm, dd] = dateStr.split('-').map(Number);
    return new Date(yyyy, mm - 1, dd);
  }
  const [dd, mm, yyyy] = dateStr.split('/').map(Number);
  return new Date(yyyy, mm - 1, dd);
};

const SupplierAccountDetail = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [isFiltering, setIsFiltering] = useState(false);
  const [editingRow, setEditingRow] = useState(null);
  const [editDraft, setEditDraft] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);

  // State management
  const [supplier, setSupplier] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [transactions, setTransactions] = useState([]);

  // Reminder state
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderDays, setReminderDays] = useState(1);
  const lastSavedReminderDaysRef = useRef(1);
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch functions
  const fetchInvoices = useCallback(async () => {
    try {
      const invData = await window.api.invoke('suppliersMaal:getBySupplier', slug);
      setInvoices(invData || []);
    } catch (err) {
      console.error('Error loading invoices', err);
    }
  }, [slug]);

  const fetchTransactions = useCallback(async () => {
    try {
      const txData = await window.api.invoke('supplierTransactions:getBySupplier', slug);
      setTransactions(txData || []);
    } catch (err) {
      console.error('Error loading transactions', err);
    }
  }, [slug]);

  useEffect(() => {
    const fetchSupplier = async () => {
      try {
        setIsLoading(true);
        const found = await window.api.invoke('suppliers:get', slug);
        if (!found) {
          setError('Supplier not found');
        } else {
          setSupplier(found);
          setReminderEnabled(!!found.reminder_enabled);
          const days = Math.max(1, found.reminder_days || 1);
          setReminderDays(days);
          lastSavedReminderDaysRef.current = days;
        }
      } catch (err) {
        setError('Error loading supplier data');
        console.error('Error fetching supplier:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchSupplier();
    fetchInvoices();
    fetchTransactions();
  }, [slug, fetchInvoices, fetchTransactions]);

  // Save reminder settings
  const handleReminderToggle = async (enabled) => {
    const prev = reminderEnabled;
    setReminderEnabled(enabled);
    try {
      await window.api.invoke('suppliers:update', {
        supplier_id: slug,
        name: supplier.name,
        address: supplier.address || '',
        mobile: supplier.mobile || '',
        reminder_enabled: enabled ? 1 : 0,
        reminder_days: reminderDays,
      });
      toast.success(enabled ? 'Reminder enabled' : 'Reminder disabled');
    } catch (err) {
      setReminderEnabled(prev);
      toast.error('Failed to update reminder');
    }
  };

  const handleReminderDaysChange = (days) => {
    const numDays = Math.max(1, parseInt(days) || 1);
    setReminderDays(numDays);
  };

  const saveReminderDays = async () => {
    try {
      await window.api.invoke('suppliers:update', {
        supplier_id: slug,
        name: supplier.name,
        address: supplier.address || '',
        mobile: supplier.mobile || '',
        reminder_enabled: reminderEnabled ? 1 : 0,
        reminder_days: reminderDays,
      });
      lastSavedReminderDaysRef.current = reminderDays;
    } catch (err) {
      setReminderDays(lastSavedReminderDaysRef.current);
      toast.error('Failed to update reminder days');
    }
  };

  // Data processing functions
  const accountData = useMemo(() => {
    const maalEntries = invoices.map((inv) => ({
      type: 'maal',
      id: `M-${inv.id ?? inv.invoice_id}`,
      maalDbId: inv.id,
      maalDate: inv.invoice_date ?? inv.maal_date,
      maalInvoiceNumber: inv.invoice_id ?? inv.maal_invoice_no,
      maalAmount: inv.grand_total ?? inv.maal_amount,
      maalRemark: inv.remark ?? inv.maal_remark ?? '',
    }));

    const jamaEntries = transactions.map((t) => {
      const txnId = t.transaction_id ?? t.id ?? t.txnId;
      const remark = t.remark || '';
      return {
        type: 'jama',
        id: `J-${txnId}`,
        transactionId: txnId,
        isLinkedToOrder: remark.startsWith('Order '),
        jamaDate: t.date || t.transaction_date,
        jamaTxnType: t.txn_type || t.txnType || '',
        jamaAmount: t.amount || 0,
        jamaRemark: remark,
      };
    });

    const combined = [...maalEntries, ...jamaEntries].map(entry => ({
      ...entry,
      sortDate: entry.type === 'maal' ? parseDate(entry.maalDate) : parseDate(entry.jamaDate)
    }));

    combined.sort((a, b) => b.sortDate - a.sortDate);
    return combined;
  }, [invoices, transactions]);

  // Filter data based on date range and search query
  const filteredData = useMemo(() => {
    let filtered = [...accountData];

    if (fromDate) {
      const fromDateObj = new Date(fromDate);
      filtered = filtered.filter(item => item.sortDate >= fromDateObj);
    }

    if (toDate) {
      const toDateObj = new Date(toDate);
      toDateObj.setHours(23, 59, 59);
      filtered = filtered.filter(item => item.sortDate <= toDateObj);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(item =>
        (item.maalInvoiceNumber && item.maalInvoiceNumber.toLowerCase().includes(query)) ||
        (item.maalRemark && item.maalRemark.toLowerCase().includes(query)) ||
        (item.jamaTxnType && item.jamaTxnType.toLowerCase().includes(query)) ||
        (item.jamaRemark && item.jamaRemark.toLowerCase().includes(query))
      );
    }

    return filtered;
  }, [accountData, fromDate, toDate, searchQuery]);

  // Data calculations
  const maalData = useMemo(() => filteredData.filter(item => item.type === 'maal'), [filteredData]);
  const jamaData = useMemo(() => filteredData.filter(item => item.type === 'jama'), [filteredData]);

  const maalTotal = useMemo(() => maalData.reduce((sum, m) => sum + (Number(m.maalAmount) || 0), 0), [maalData]);
  const jamaTotal = useMemo(() => jamaData.reduce((sum, j) => sum + (Number(j.jamaAmount) || 0), 0), [jamaData]);
  const grandTotal = maalTotal - jamaTotal;

  // Reminder logic: check if balance is zero AND reminder is set
  const isReminderTriggered = useMemo(() => {
    if (!reminderEnabled || reminderDays <= 0) return false;
    // Balance is zero or negative (fully paid) — reminder triggers
    return grandTotal <= 0;
  }, [reminderEnabled, reminderDays, grandTotal]);

  // Utility functions
  const formatCurrency = (val) =>
    new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2
    }).format(val || 0);

  const formatBalanceCurrency = (val) =>
    new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(Math.round(val) || 0);

  // Delete handler for entries — returns true on success, false on failure
  const handleDeleteEntry = async (row) => {
    try {
      const entryType = row.type;
      let result;
      if (entryType === 'maal') {
        result = await window.api.invoke('suppliersMaal:delete', row.maalDbId || row.maalInvoiceNumber);
      } else {
        result = await window.api.invoke('suppliers:txnDelete', row.transactionId);
      }
      if (!result || result.success === false || result.error) {
        toast.error(result?.error || 'Failed to delete entry.');
        return false;
      }
      toast.success('Entry deleted successfully');
      fetchInvoices();
      fetchTransactions();
      return true;
    } catch (err) {
      toast.error('Error deleting entry: ' + err.message);
      return false;
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    if (dateStr.includes('-')) {
      const [yyyy, mm, dd] = dateStr.split('-');
      return `${dd}-${mm}-${yyyy}`;
    }
    if (dateStr.includes('/')) {
      const [dd, mm, yyyy] = dateStr.split('/');
      return `${dd}-${mm}-${yyyy}`;
    }
    return dateStr;
  };

  const handleEditClick = (row) => {
    if (row.type === 'maal') {
      const entryId = row.maalDbId || row.maalInvoiceNumber;
      navigate(`/accounts/suppliers/${slug}/edit/maal/${entryId}`);
    } else {
      if (row.isLinkedToOrder) {
        toast.error('This payment is linked to an order and cannot be edited directly.');
        return;
      }
      navigate(`/accounts/suppliers/${slug}/edit/jama/${row.transactionId}`);
    }
  };

  const handleSaveEdit = async (rowId) => {
    try {
      if (!editDraft.type) return setEditingRow(null);

      let result;
      if (editDraft.type === 'maal') {
        const numericId = editDraft.maalDbId;
        result = await window.api.invoke('suppliersMaal:update', {
          id: numericId,
          invoice_number: editDraft.maalInvoiceNumber,
          date: editDraft.maalDate,
          amount: editDraft.maalAmount,
          remark: editDraft.maalRemark,
        });
        if (!result || result.error || result.success === false) {
          toast.error(result?.error || 'An error occurred while saving. Please try again.');
          return;
        }
      } else if (editDraft.type === 'jama') {
        const txnId = editDraft.transactionId;
        if (txnId) {
          result = await window.api.invoke('supplierTransactions:update', {
            id: txnId,
            date: editDraft.jamaDate,
            txn_type: editDraft.jamaTxnType,
            amount: editDraft.jamaAmount,
            remark: editDraft.jamaRemark,
          });
          if (!result || result.error || result.success === false) {
            toast.error(result?.error || 'An error occurred while saving. Please try again.');
            return;
          }
          setTransactions((prev) => prev.map(tx =>
            tx.transaction_id === txnId
              ? { ...tx, amount: editDraft.jamaAmount, date: editDraft.jamaDate, remark: editDraft.jamaRemark, txn_type: editDraft.jamaTxnType }
              : tx
          ));
        }
      }

      toast.success('Entry updated successfully');
      await fetchInvoices();
      await fetchTransactions();
      setEditingRow(null);
    } catch (err) {
      console.error('Save edit error', err);
      toast.error('An error occurred while saving. Please try again.');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F7F9FB] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-[#004AC6] border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-semibold text-[#434655]">Loading supplier...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#F7F9FB] flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-extrabold text-[#191C1E] mb-2">Error</h2>
          <p className="text-[#434655]">{error}</p>
          <button onClick={() => navigate('/accounts/suppliers')} className="mt-4 px-6 py-2 bg-[#004AC6] text-white rounded-xl font-semibold hover:bg-[#003EA8] transition cursor-pointer">Back to Suppliers</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F9FB]">
      {/* ─── Stitch TopAppBar ─── */}
      <header className="w-full h-16 sticky top-0 z-40 bg-[#F7F9FB] flex items-center justify-between px-8 border-b border-[#C3C6D7]/10">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/accounts/suppliers')}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-[#F2F4F6] transition-colors cursor-pointer"
          >
            <ArrowLeft size={20} className="text-[#434655]" />
          </button>
          <h2 className="text-lg font-bold tracking-tight text-[#191C1E]">{supplier.name}</h2>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(`/accounts/suppliers/edit/${slug}`)}
            className="px-5 py-2 text-sm font-semibold text-[#191C1E] bg-[#E6E8EA] rounded-xl hover:bg-[#E0E3E5] transition-all cursor-pointer"
          >Edit Supplier</button>
          <button
            onClick={() => navigate(`/accounts/suppliers/${slug}/add/maal`)}
            className="px-5 py-2 text-sm font-semibold text-white rounded-xl shadow-sm hover:opacity-90 transition-all flex items-center gap-2 cursor-pointer"
            style={{ background: 'linear-gradient(135deg, #004AC6 0%, #2563EB 100%)' }}
          >
            <Plus size={16} />
            Add Maal
          </button>
          <button
            onClick={() => navigate(`/accounts/suppliers/${slug}/add/jama`)}
            className="px-5 py-2 text-sm font-semibold text-white rounded-xl shadow-sm hover:opacity-90 transition-all flex items-center gap-2 cursor-pointer"
            style={{ background: 'linear-gradient(135deg, #004AC6 0%, #2563EB 100%)' }}
          >
            <Plus size={16} />
            Add Jama
          </button>
        </div>
      </header>

      {/* ─── Content Area ─── */}
      <div className="p-8 space-y-8">
        {/* ─── Summary Ribbon ─── */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-xl border border-[#C3C6D7]/10 shadow-sm flex flex-col justify-between">
            <span className="text-[11px] font-bold text-[#434655] uppercase tracking-wider mb-2">Balance Owed</span>
            <div className="flex items-end justify-between">
              <h3 className="text-3xl font-black text-[#004AC6] tracking-tight">{formatBalanceCurrency(grandTotal)}</h3>
              {grandTotal > 0 && (
                <span className="bg-red-100/50 text-red-600 text-[10px] font-bold px-2 py-1 rounded uppercase">Due</span>
              )}
              {grandTotal <= 0 && (
                <span className="bg-green-100/50 text-green-600 text-[10px] font-bold px-2 py-1 rounded uppercase">Clear</span>
              )}
            </div>
          </div>
          <div className="bg-white p-6 rounded-xl border border-[#C3C6D7]/10 shadow-sm">
            <span className="text-[11px] font-bold text-[#434655] uppercase tracking-wider mb-2">Total Purchases</span>
            <h3 className="text-3xl font-black text-[#191C1E] tracking-tight">{formatBalanceCurrency(maalTotal)}</h3>
          </div>
          <div className="bg-white p-6 rounded-xl border border-[#C3C6D7]/10 shadow-sm">
            <span className="text-[11px] font-bold text-[#434655] uppercase tracking-wider mb-2">Total Payments</span>
            <h3 className="text-3xl font-black text-[#191C1E] tracking-tight">{formatBalanceCurrency(jamaTotal)}</h3>
          </div>
        </section>

        {/* ─── Supplier Info + Quick Report ─── */}
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Supplier Information Card */}
          <div className="flex-grow bg-white rounded-xl shadow-sm border border-[#C3C6D7]/10 overflow-hidden">
            <div className="bg-[#F2F4F6] px-8 py-4 border-b border-[#C3C6D7]/10 flex justify-between items-center">
              <h4 className="font-bold text-[#191C1E]">Supplier Information</h4>
            </div>
            <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-12">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-[#434655] uppercase tracking-wider">Supplier ID</label>
                <p className="text-sm font-semibold text-[#191C1E]">{slug}</p>
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-[#434655] uppercase tracking-wider">Contact Name</label>
                <p className="text-sm font-semibold text-[#191C1E]">{supplier.name || '—'}</p>
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-[#434655] uppercase tracking-wider">Mobile Number</label>
                <div className="flex items-center gap-2">
                  <Phone size={14} className="text-[#004AC6]" />
                  <p className="text-sm font-semibold text-[#191C1E]">{supplier.mobile || '—'}</p>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-[#434655] uppercase tracking-wider">GST Number</label>
                <div className="flex items-center gap-2">
                  <Building size={14} className="text-[#004AC6]" />
                  <p className="text-sm font-semibold text-[#191C1E]">{supplier.gstNumber || '—'}</p>
                </div>
              </div>
              <div className="md:col-span-2 space-y-1">
                <label className="text-[11px] font-bold text-[#434655] uppercase tracking-wider">Registered Address</label>
                <div className="flex items-start gap-2">
                  <MapPin size={14} className="text-[#004AC6] mt-0.5" />
                  <p className="text-sm font-medium text-[#191C1E] leading-relaxed">{supplier.address || '—'}</p>
                </div>
              </div>

              {/* ─── Reminder Toggle ─── */}
              <div className="md:col-span-2 mt-2 pt-6 border-t border-[#F2F4F6]">
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-3">
                    <Bell size={18} className="text-[#004AC6]" />
                    <label className="text-[11px] font-bold text-[#434655] uppercase tracking-wider">Payment Reminder</label>
                  </div>
                  <button
                    onClick={() => handleReminderToggle(!reminderEnabled)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${reminderEnabled ? 'bg-[#004AC6]' : 'bg-[#C3C6D7]'}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition-transform ${reminderEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                  <span className="text-xs font-semibold text-[#434655]">{reminderEnabled ? 'On' : 'Off'}</span>
                </div>

                {reminderEnabled && (
                  <div className="mt-4 flex items-center gap-3 pl-[27px]">
                    <Clock size={16} className="text-[#434655]" />
                    <label className="text-xs font-semibold text-[#434655]">Remind after</label>
                    <input
                      type="number"
                      min="1"
                      max="365"
                      value={reminderDays}
                      onChange={(e) => handleReminderDaysChange(e.target.value)}
                      onBlur={saveReminderDays}
                      className="w-20 px-3 py-1.5 text-sm font-semibold text-[#191C1E] border border-[#C3C6D7]/30 rounded-lg focus:ring-2 focus:ring-[#004AC6]/20 focus:border-[#004AC6] outline-none text-center"
                    />
                    <span className="text-xs font-semibold text-[#434655]">days if balance is zero</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Quick Report Card */}
          <div className="w-full lg:w-80 space-y-4">
            <div className="p-6 rounded-xl text-white shadow-lg flex flex-col justify-between min-h-[280px]" style={{ background: 'linear-gradient(135deg, #004AC6 0%, #2563EB 100%)' }}>
              <div>
                <span className="text-[10px] font-bold opacity-80 uppercase tracking-widest">Quick Report</span>
                {isReminderTriggered ? (
                  <>
                    <h4 className="text-xl font-bold mt-1">⚠️ Balance Clear</h4>
                    <p className="text-xs opacity-80 mt-2">Balance is ₹0. No pending dues. Reminder was set for {reminderDays} day{reminderDays > 1 ? 's' : ''}.</p>
                  </>
                ) : reminderEnabled ? (
                  <>
                    <h4 className="text-xl font-bold mt-1">Reminder Active</h4>
                    <p className="text-xs opacity-80 mt-2">Alert active: triggers when balance is zero or negative.</p>
                  </>
                ) : (
                  <>
                    <h4 className="text-xl font-bold mt-1">Account Overview</h4>
                    <p className="text-xs opacity-80 mt-2">Enable payment reminders to track this supplier's balance status.</p>
                  </>
                )}
              </div>
              <div className="mt-4">
                <p className="text-3xl font-black">{maalData.length + jamaData.length}</p>
                <p className="text-xs opacity-80">Total ledger entries</p>
              </div>
              <button
                onClick={() => toast('Download Ledger coming soon!', { icon: '📄' })}
                title="Coming soon"
                aria-label="Download Ledger – coming soon"
                className="mt-6 w-full py-2.5 bg-white/20 hover:bg-white/30 backdrop-blur-md rounded-lg text-xs font-bold transition-all uppercase tracking-widest cursor-pointer"
              >Download Ledger</button>
            </div>
          </div>
        </div>

        {/* ─── Filter Bar ─── */}
        <div className="bg-white rounded-xl shadow-sm border border-[#C3C6D7]/10 overflow-hidden">
          <div className="px-8 py-5 flex items-center justify-between">
            <div>
              <h4 className="text-lg font-bold text-[#191C1E]">Account Ledger</h4>
              <p className="text-xs text-[#434655]">Detailed history of all purchases and payments</p>
            </div>
            <div className="flex gap-2">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#434655]" />
                <input
                  type="text"
                  placeholder="Filter transactions..."
                  className="pl-9 pr-4 py-2 bg-[#F2F4F6] border-none rounded-lg text-xs w-64 focus:ring-2 focus:ring-[#004AC6]/20 transition-all outline-none"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#434655] hover:text-[#191C1E] cursor-pointer">
                    <X size={14} />
                  </button>
                )}
              </div>
              <button
                onClick={() => setIsFiltering(!isFiltering)}
                className={`p-2 rounded-lg transition-colors cursor-pointer ${isFiltering ? 'bg-[#004AC6] text-white' : 'bg-[#F2F4F6] text-[#434655] hover:bg-[#E6E8EA]'}`}
              >
                <Filter size={16} />
              </button>
            </div>
          </div>

          {/* Date Filter Panel */}
          {isFiltering && (
            <div className="px-8 pb-5 border-t border-[#F2F4F6] pt-4">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <label className="text-[11px] font-bold text-[#434655] uppercase tracking-wider">From</label>
                  <input
                    type="date"
                    className="px-3 py-1.5 bg-[#F2F4F6] border-none rounded-lg text-xs focus:ring-2 focus:ring-[#004AC6]/20 outline-none"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-[11px] font-bold text-[#434655] uppercase tracking-wider">To</label>
                  <input
                    type="date"
                    className="px-3 py-1.5 bg-[#F2F4F6] border-none rounded-lg text-xs focus:ring-2 focus:ring-[#004AC6]/20 outline-none"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                  />
                </div>
                <button
                  onClick={() => { setFromDate(''); setToDate(''); setSearchQuery(''); }}
                  className="px-3 py-1.5 text-xs font-semibold text-[#434655] bg-[#F2F4F6] rounded-lg hover:bg-[#E6E8EA] transition cursor-pointer"
                >Clear</button>
              </div>
            </div>
          )}
        </div>

        {/* ─── Maal & Jama Tables — Stitch Split ─── */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* ─── Maal Entries ─── */}
          <div className="bg-white rounded-xl overflow-hidden shadow-sm border border-[#C3C6D7]/5">
            <div className="px-6 py-4 flex items-center justify-between border-b border-[#F2F4F6]">
              <h2 className="text-lg font-extrabold text-[#191C1E] tracking-tight">Maal Entries</h2>
              <span className="text-xs font-bold text-[#004AC6] bg-[#DBE1FF]/50 px-3 py-1 rounded-full">{maalData.length} records</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-[#F2F4F6]/50">
                  <tr>
                    <th className="py-3 px-4 text-[11px] font-bold text-[#434655] uppercase tracking-wider">Date</th>
                    <th className="py-3 px-4 text-[11px] font-bold text-[#434655] uppercase tracking-wider">Invoice</th>
                    <th className="py-3 px-4 text-[11px] font-bold text-[#434655] uppercase tracking-wider text-right">Amount</th>
                    <th className="py-3 px-4 text-[11px] font-bold text-[#434655] uppercase tracking-wider">Remark</th>
                    <th className="py-3 px-4 text-[11px] font-bold text-[#434655] uppercase tracking-wider text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F2F4F6]">
                  {maalData.length > 0 ? maalData.map((row) => (
                    <tr key={row.id} className="hover:bg-[#F2F4F6]/30 transition-colors">
                      <td className="px-4 py-3 text-sm text-[#434655]">
                        {editingRow === row.id ? (
                          <input type="date" className="w-full px-2 py-1 border border-[#C3C6D7]/30 rounded-lg text-sm focus:ring-2 focus:ring-[#004AC6]/20 focus:border-[#004AC6] outline-none" value={editDraft.maalDate || ''} onChange={(e) => setEditDraft({ ...editDraft, maalDate: e.target.value })} />
                        ) : formatDate(row.maalDate)}
                      </td>
                      <td className="px-4 py-3 text-sm font-bold text-[#004AC6]">
                        {editingRow === row.id ? (
                          <input type="text" className="w-full px-2 py-1 border border-[#C3C6D7]/30 rounded-lg text-sm focus:ring-2 focus:ring-[#004AC6]/20 focus:border-[#004AC6] outline-none" value={editDraft.maalInvoiceNumber || ''} onChange={(e) => setEditDraft({ ...editDraft, maalInvoiceNumber: e.target.value })} />
                        ) : row.maalInvoiceNumber}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-semibold text-[#191C1E]">
                        {editingRow === row.id ? (
                          <input type="number" className="w-full px-2 py-1 border border-[#C3C6D7]/30 rounded-lg text-sm text-right focus:ring-2 focus:ring-[#004AC6]/20 focus:border-[#004AC6] outline-none" value={editDraft.maalAmount || ''} onChange={(e) => setEditDraft({ ...editDraft, maalAmount: e.target.value })} />
                        ) : formatCurrency(row.maalAmount)}
                      </td>
                      <td className="px-4 py-3 text-sm text-[#434655]">
                        {editingRow === row.id ? (
                          <input type="text" className="w-full px-2 py-1 border border-[#C3C6D7]/30 rounded-lg text-sm focus:ring-2 focus:ring-[#004AC6]/20 focus:border-[#004AC6] outline-none" value={editDraft.maalRemark || ''} onChange={(e) => setEditDraft({ ...editDraft, maalRemark: e.target.value })} />
                        ) : row.maalRemark}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {editingRow === row.id ? (
                          <div className="flex justify-center gap-1">
                            <button className="p-1.5 text-green-600 hover:bg-green-50 rounded-full transition cursor-pointer" onClick={() => handleSaveEdit(row.id)}><Save size={16} /></button>
                            <button className="p-1.5 text-[#434655] hover:bg-gray-100 rounded-full transition cursor-pointer" onClick={() => setEditingRow(null)}><X size={16} /></button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center gap-1">
                            <button className="p-1.5 rounded-full hover:bg-white text-[#434655] hover:text-[#004AC6] transition-all hover:shadow-sm cursor-pointer" onClick={() => handleEditClick(row)}><Edit size={16} /></button>
                            <button className="p-1.5 rounded-full hover:bg-white text-[#434655] hover:text-[#DC2626] transition-all hover:shadow-sm cursor-pointer" onClick={() => setDeleteTarget(row)}><Trash2 size={16} /></button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )) : (
                    <tr><td colSpan="5" className="px-4 py-8 text-center text-[#434655] text-sm">No maal entries found.</td></tr>
                  )}
                </tbody>
                <tfoot>
                  <tr className="bg-[#F2F4F6]/50">
                    <td colSpan="2" className="px-4 py-3 text-right text-sm font-extrabold text-[#191C1E]">Total Maal</td>
                    <td className="px-4 py-3 text-right text-sm font-extrabold text-[#191C1E]">{formatCurrency(maalTotal)}</td>
                    <td colSpan="2"></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* ─── Jama Entries ─── */}
          <div className="bg-white rounded-xl overflow-hidden shadow-sm border border-[#C3C6D7]/5">
            <div className="px-6 py-4 flex items-center justify-between border-b border-[#F2F4F6]">
              <h2 className="text-lg font-extrabold text-[#191C1E] tracking-tight">Jama Entries</h2>
              <span className="text-xs font-bold text-emerald-700 bg-emerald-100/50 px-3 py-1 rounded-full">{jamaData.length} records</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-[#F2F4F6]/50">
                  <tr>
                    <th className="py-3 px-4 text-[11px] font-bold text-[#434655] uppercase tracking-wider">Date</th>
                    <th className="py-3 px-4 text-[11px] font-bold text-[#434655] uppercase tracking-wider">Type</th>
                    <th className="py-3 px-4 text-[11px] font-bold text-[#434655] uppercase tracking-wider text-right">Amount</th>
                    <th className="py-3 px-4 text-[11px] font-bold text-[#434655] uppercase tracking-wider">Remark</th>
                    <th className="py-3 px-4 text-[11px] font-bold text-[#434655] uppercase tracking-wider text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F2F4F6]">
                  {jamaData.length > 0 ? jamaData.map((row) => (
                    <tr key={row.id} className="hover:bg-[#F2F4F6]/30 transition-colors">
                      <td className="px-4 py-3 text-sm text-[#434655]">
                        {editingRow === row.id ? (
                          <input type="date" className="w-full px-2 py-1 border border-[#C3C6D7]/30 rounded-lg text-sm focus:ring-2 focus:ring-[#004AC6]/20 focus:border-[#004AC6] outline-none" value={editDraft.jamaDate || ''} onChange={(e) => setEditDraft({ ...editDraft, jamaDate: e.target.value })} />
                        ) : formatDate(row.jamaDate)}
                      </td>
                      <td className="px-4 py-3">
                        {editingRow === row.id ? (
                          <input type="text" className="w-full px-2 py-1 border border-[#C3C6D7]/30 rounded-lg text-sm focus:ring-2 focus:ring-[#004AC6]/20 focus:border-[#004AC6] outline-none" value={editDraft.jamaTxnType || ''} onChange={(e) => setEditDraft({ ...editDraft, jamaTxnType: e.target.value })} />
                        ) : (
                          <span className="inline-block text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-100/50 text-emerald-700">{row.jamaTxnType}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-semibold text-[#191C1E]">
                        {editingRow === row.id ? (
                          <input type="number" className="w-full px-2 py-1 border border-[#C3C6D7]/30 rounded-lg text-sm text-right focus:ring-2 focus:ring-[#004AC6]/20 focus:border-[#004AC6] outline-none" value={editDraft.jamaAmount || ''} onChange={(e) => setEditDraft({ ...editDraft, jamaAmount: e.target.value })} />
                        ) : formatCurrency(row.jamaAmount)}
                      </td>
                      <td className="px-4 py-3 text-sm text-[#434655]">
                        {editingRow === row.id ? (
                          <input type="text" className="w-full px-2 py-1 border border-[#C3C6D7]/30 rounded-lg text-sm focus:ring-2 focus:ring-[#004AC6]/20 focus:border-[#004AC6] outline-none" value={editDraft.jamaRemark || ''} onChange={(e) => setEditDraft({ ...editDraft, jamaRemark: e.target.value })} />
                        ) : row.jamaRemark}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {editingRow === row.id ? (
                          <div className="flex justify-center gap-1">
                            <button className="p-1.5 text-green-600 hover:bg-green-50 rounded-full transition cursor-pointer" onClick={() => handleSaveEdit(row.id)}><Save size={16} /></button>
                            <button className="p-1.5 text-[#434655] hover:bg-gray-100 rounded-full transition cursor-pointer" onClick={() => setEditingRow(null)}><X size={16} /></button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center gap-1">
                            <button className="p-1.5 rounded-full hover:bg-white text-[#434655] hover:text-[#004AC6] transition-all hover:shadow-sm cursor-pointer" onClick={() => handleEditClick(row)}><Edit size={16} /></button>
                            <button className="p-1.5 rounded-full hover:bg-white text-[#434655] hover:text-[#DC2626] transition-all hover:shadow-sm cursor-pointer" onClick={() => setDeleteTarget(row)}><Trash2 size={16} /></button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )) : (
                    <tr><td colSpan="5" className="px-4 py-8 text-center text-[#434655] text-sm">No jama entries found.</td></tr>
                  )}
                </tbody>
                <tfoot>
                  <tr className="bg-[#F2F4F6]/50">
                    <td colSpan="2" className="px-4 py-3 text-right text-sm font-extrabold text-[#191C1E]">Total Jama</td>
                    <td className="px-4 py-3 text-right text-sm font-extrabold text-[#191C1E]">{formatCurrency(jamaTotal)}</td>
                    <td colSpan="2"></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal — Stitch Glass Overlay */}
      {deleteTarget !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backdropFilter: 'blur(8px)', backgroundColor: 'rgba(255,255,255,0.7)' }}>
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-[#C3C6D7]/20 p-8">
            <div className="w-12 h-12 rounded-full bg-red-100/50 flex items-center justify-center text-red-600 mb-6">
              <Trash2 size={28} />
            </div>
            <h2 className="text-2xl font-extrabold text-[#0F172A] tracking-tight mb-3">Delete Entry?</h2>
            <p className="text-[#434655] leading-relaxed mb-8">
              Are you sure you want to delete this <span className="font-bold text-[#191C1E]">{deleteTarget?.type === 'maal' ? 'maal' : 'jama'}</span> entry? This action cannot be undone.
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 px-6 py-3 bg-[#E6E8EA] text-[#191C1E] font-bold rounded-xl hover:bg-[#E0E3E5] transition-all text-sm cursor-pointer"
              >Cancel</button>
              <button
                onClick={async () => {
                  const target = deleteTarget;
                  setIsDeleting(true);
                  try {
                    const success = await handleDeleteEntry(target);
                    if (success) setDeleteTarget(null);
                  } finally {
                    setIsDeleting(false);
                  }
                }}
                disabled={isDeleting}
                className="flex-1 px-6 py-3 bg-red-600 text-white font-bold rounded-xl shadow-lg shadow-red-600/20 hover:bg-red-700 hover:scale-[1.02] active:scale-95 transition-all text-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >{isDeleting ? 'Deleting...' : 'Delete'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SupplierAccountDetail;