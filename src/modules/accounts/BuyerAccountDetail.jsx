import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronDown, Search, Calendar, Edit, Trash2, ChevronLeft, ChevronRight, Filter, Plus, Phone, MapPin, Building, Save, X } from 'lucide-react';
import { toast } from 'react-hot-toast';
import Popup from 'reactjs-popup';
import 'reactjs-popup/dist/index.css';

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

const BuyerAccountDetail = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [isFiltering, setIsFiltering] = useState(false);
  const [editingRow, setEditingRow] = useState(null);
  const [editDraft, setEditDraft] = useState({});
  const [searchQuery, setSearchQuery] = useState('');

  // State management
  const [buyer, setBuyer] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [transactions, setTransactions] = useState([]);

  // Reset to first page when rows per page changes
  useEffect(() => {
    setCurrentPage(1);
  }, [rowsPerPage]);

  // Fetch functions remain the same
  const fetchInvoices = useCallback(async () => {
    try {
      const invData = await window.api.invoke('invoices:getByCustomer', slug);
      setInvoices(invData || []);
    } catch (err) {
      console.error('Error loading invoices', err);
    }
  }, [slug]);

  const fetchTransactions = useCallback(async () => {
    try {
      const txData = await window.api.invoke('transactions:getByCustomer', slug);
      setTransactions(txData || []);
    } catch (err) {
      console.error('Error loading transactions', err);
    }
  }, [slug]);

  useEffect(() => {
    const fetchBuyer = async () => {
      try {
        setIsLoading(true);
        const found = await window.api.invoke('customers:get', slug);

        if (!found) {
          setError('Customer not found');
        } else {
          setBuyer(found);
        }
      } catch (err) {
        setError('Error loading customer data');
        console.error('Error fetching customer:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchBuyer();
    fetchInvoices();
    fetchTransactions();
  }, [slug, fetchInvoices, fetchTransactions]);

  // Data processing functions
  const accountData = useMemo(() => {
    const maalEntries = invoices.map((inv) => ({
      type: 'maal',
      id: `M-${inv.invoice_id}`,           // React key only
      invoiceId: inv.invoice_id,            // Clean DB identifier for API calls
      source: inv.source || 'invoice',      // 'invoice' or 'maal_only' from backend
      isLinkedToInvoice: (inv.source || 'invoice') === 'invoice',
      maalDate: inv.invoice_date,
      maalInvoiceNumber: inv.invoice_id,
      maalAmount: inv.grand_total,
      maalRemark: inv.remark || '',
    }));

    const jamaEntries = transactions.map((t) => {
      const txnId = t.transaction_id ?? t.id ?? t.txnId;
      const remark = t.remark || '';
      return {
        type: 'jama',
        id: `J-${txnId}`,                   // React key only
        transactionId: txnId,                // Clean DB identifier for API calls
        isLinkedToInvoiceOrOrder: remark.startsWith('Invoice ') || remark.startsWith('Order '),
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
      filtered = filtered.filter(item =>
        item.sortDate >= fromDateObj
      );
    }

    if (toDate) {
      const toDateObj = new Date(toDate);
      toDateObj.setHours(23, 59, 59);
      filtered = filtered.filter(item =>
        item.sortDate <= toDateObj
      );
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

  // Utility functions
  const formatCurrency = (val) =>
    new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2
    }).format(val || 0);

  // For balance display - show rounded amount without decimals
  const formatBalanceCurrency = (val) =>
    new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(Math.round(val) || 0);

  // Delete handler for entries
  const handleDeleteEntry = async (row) => {
    try {
      const entryType = row.type;
      let result;
      if (entryType === 'maal') {
        // Use clean invoiceId (no M- prefix)
        result = await window.api.invoke('customers:maalDelete', row.invoiceId);
      } else {
        // Use clean transactionId (no J- prefix)
        result = await window.api.invoke('customers:txnDelete', row.transactionId);
      }
      // Respect backend guards
      if (!result || result.success === false || result.error) {
        toast.error(result?.error || 'Failed to delete entry.');
        return;
      }
      toast.success('Entry deleted successfully');
      fetchInvoices();
      fetchTransactions();
    } catch (err) {
      toast.error('Error deleting entry: ' + err.message);
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

  // Navigation helper for invoice links
  const handleInvoiceNavigate = (invoiceId) => {
    // Support both new format (E-*) and old format (AGS-I-*)
    if (invoiceId && (invoiceId.startsWith('E-') || invoiceId.startsWith('AGS-I-'))) {
      navigate(`/invoice/${invoiceId}`);
    }
  };

  // Row editing functions
  // Navigate to dedicated edit entry page instead of inline editing
  const handleEditClick = (row) => {
    if (row.type === 'maal') {
      if (row.isLinkedToInvoice) {
        // Linked to invoice → navigate to the invoice page
        navigate(`/invoice/${row.invoiceId}`);
        return;
      }
      // Standalone maal entry → edit form
      navigate(`/accounts/customers/${slug}/edit/maal/${row.invoiceId}`);
    } else {
      if (row.isLinkedToInvoiceOrOrder) {
        toast.error('This payment is linked to an invoice or order and cannot be edited directly.');
        return;
      }
      // Standalone jama entry → edit form
      navigate(`/accounts/customers/${slug}/edit/jama/${row.transactionId}`);
    }
  };

  const handleSaveEdit = async (rowId) => {
    try {
      if (!editDraft.type) return setEditingRow(null);

      let result;
      if (editDraft.type === 'maal') {
        // Use clean invoiceId stored in editDraft
        const invoiceId = editDraft.invoiceId;
        result = await window.api.invoke('maal:update', {
          invoice_number: invoiceId,
          date: editDraft.maalDate,
          amount: editDraft.maalAmount,
          remark: editDraft.maalRemark,
        });

        // Explicit success check
        if (!result || result.error || result.success === false) {
          toast.error(result?.error || 'An error occurred while saving. Please try again.');
          return; // Keep data, do NOT clear
        }

        setInvoices((prev) => prev.map(inv =>
          inv.invoice_id === invoiceId
            ? { ...inv, grand_total: editDraft.maalAmount, invoice_date: editDraft.maalDate }
            : inv
        ));
      } else if (editDraft.type === 'jama') {
        const txnId = editDraft.transactionId;
        if (txnId) {
          result = await window.api.invoke('transactions:update', {
            id: txnId,
            date: editDraft.jamaDate,
            txn_type: editDraft.jamaTxnType,
            amount: editDraft.jamaAmount,
            remark: editDraft.jamaRemark,
          });

          // Explicit success check
          if (!result || result.error || result.success === false) {
            toast.error(result?.error || 'An error occurred while saving. Please try again.');
            return; // Keep data, do NOT clear
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
      // Keep editing state, do NOT clear
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Enhanced Header */}
      <header className="bg-gradient-to-r from-[#05014A] to-[#0077b6] text-white">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center space-y-4 md:space-y-0">
            <div>
              <h1 className="text-3xl font-bold">{buyer.name}</h1>
              <div className="mt-2 space-y-1">
                {buyer.address && (
                  <div className="flex items-center text-gray-200">
                    <MapPin size={16} className="mr-2" />
                    <span>{buyer.address}</span>
                  </div>
                )}
                {buyer.mobile && (
                  <div className="flex items-center text-gray-200">
                    <Phone size={16} className="mr-2" />
                    <span>{buyer.mobile}</span>
                  </div>
                )}
                {buyer.gstNumber && (
                  <div className="flex items-center text-gray-200">
                    <Building size={16} className="mr-2" />
                    <span>GST: {buyer.gstNumber}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 cursor-pointer">
              <button
                onClick={() => navigate(`/accounts/customers/${slug}/add/maal`)}
                className="flex items-center justify-center bg-white text-[#05014A] px-4 py-2 rounded-lg hover:bg-opacity-90 transition shadow-sm cursor-pointer"
              >
                <Plus size={18} className="mr-2" />
                Add Maal Entry
              </button>
              <button
                onClick={() => navigate(`/accounts/customers/${slug}/add/jama`)}
                className="flex items-center justify-center bg-[#0077b6] text-white px-4 py-2 rounded-lg hover:bg-opacity-90 transition shadow-sm cursor-pointer"
              >
                <Plus size={18} className="mr-2" />
                Add Jama Entry
              </button>
            </div>
          </div>

          {/* Grand Total Card in Header */}
          <div className="mt-6 bg-white/10 rounded-lg p-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-100">Current Balance</span>
              <span className="text-2xl font-bold">{formatBalanceCurrency(grandTotal)}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Enhanced Filters Section */}
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center space-y-4 md:space-y-0">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setIsFiltering(!isFiltering)}
                className={`cursor-pointer flex items-center px-4 py-2 rounded-lg transition ${isFiltering
                  ? 'bg-[#05014A] text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
              >
                <Filter size={18} className="mr-2" />
                {isFiltering ? 'Hide Filters' : 'Show Filters'}
              </button>

              <div className="relative">
                <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search entries..."
                  className="pl-10 pr-4 py-2 border rounded-lg w-64 focus:ring-2 focus:ring-[#05014A] focus:border-transparent"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Enhanced Filter Panel */}
          {isFiltering && (
            <div className="mt-4 border-t pt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">From Date</label>
                  <div className="relative">
                    <Calendar size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    <input
                      type="date"
                      className="pl-10 pr-4 py-2 border rounded-lg w-full focus:ring-2 focus:ring-[#05014A] focus:border-transparent"
                      value={fromDate}
                      onChange={(e) => setFromDate(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">To Date</label>
                  <div className="relative">
                    <Calendar size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    <input
                      type="date"
                      className="pl-10 pr-4 py-2 border rounded-lg w-full focus:ring-2 focus:ring-[#05014A] focus:border-transparent"
                      value={toDate}
                      onChange={(e) => setToDate(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="mt-4 flex justify-end">
                <button
                  className="cursor-pointer px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition"
                  onClick={() => {
                    setFromDate('');
                    setToDate('');
                    setSearchQuery('');
                  }}
                >
                  Clear Filters
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      {/* Enhanced Tables Section */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid md:grid-cols-2 gap-6">
          {/* Maal Table */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="p-4 bg-[#05014A] text-white">
              <h2 className="text-xl font-semibold">Maal Entries</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Date</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Invoice</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-gray-600">Amount</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Remark</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-gray-600">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {maalData.map((row) => (
                    <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        {editingRow === row.id ? (
                          <input
                            type="date"
                            className="w-full px-2 py-1 border rounded focus:ring-2 focus:ring-[#05014A]"
                            value={editDraft.maalDate || ''}
                            onChange={(e) => setEditDraft({ ...editDraft, maalDate: e.target.value })}
                          />
                        ) : (
                          formatDate(row.maalDate)
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {editingRow === row.id ? (
                          <input
                            type="text"
                            className="w-full px-2 py-1 border rounded focus:ring-2 focus:ring-[#05014A]"
                            value={editDraft.maalInvoiceNumber || ''}
                            onChange={(e) => setEditDraft({ ...editDraft, maalInvoiceNumber: e.target.value })}
                          />
                        ) : (
                          <span
                            className={row.isLinkedToInvoice ? 'cursor-pointer text-blue-600 hover:underline' : ''}
                            onClick={() => row.isLinkedToInvoice && handleInvoiceNavigate(row.maalInvoiceNumber)}
                          >
                            {row.maalInvoiceNumber}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {editingRow === row.id ? (
                          <input
                            type="number"
                            className="w-full px-2 py-1 border rounded text-right focus:ring-2 focus:ring-[#05014A]"
                            value={editDraft.maalAmount || ''}
                            onChange={(e) => setEditDraft({ ...editDraft, maalAmount: e.target.value })}
                          />
                        ) : (
                          formatCurrency(row.maalAmount)
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {editingRow === row.id ? (
                          <input
                            type="text"
                            className="w-full px-2 py-1 border rounded focus:ring-2 focus:ring-[#05014A]"
                            value={editDraft.maalRemark || ''}
                            onChange={(e) => setEditDraft({ ...editDraft, maalRemark: e.target.value })}
                          />
                        ) : (
                          row.maalRemark
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {editingRow === row.id ? (
                          <div className="flex justify-center space-x-2">
                            <button
                              className="p-1 text-green-600 hover:bg-green-50 rounded-full transition cursor-pointer"
                              onClick={() => handleSaveEdit(row.id)}
                            >
                              <Save size={18} />
                            </button>
                            <button
                              className="p-1 text-red-600 hover:bg-red-50 rounded-full transition cursor-pointer"
                              onClick={() => setEditingRow(null)}
                            >
                              <X size={18} />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center space-x-1">
                            <button
                              className="p-1 text-blue-600 hover:bg-blue-50 rounded-full transition cursor-pointer"
                              onClick={() => handleEditClick(row)}
                              title={row.isLinkedToInvoice ? 'View Invoice' : 'Edit Entry'}
                            >
                              <Edit size={18} />
                            </button>
                            {!row.isLinkedToInvoice && (
                              <Popup
                                trigger={
                                  <button className="p-1 text-red-600 hover:bg-red-50 rounded-full transition cursor-pointer">
                                    <Trash2 size={18} />
                                  </button>
                                }
                                modal
                                nested
                                overlayStyle={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
                              >
                                {close => (
                                  <div className="bg-white p-6 rounded-xl shadow-2xl border border-gray-100">
                                    <div className="mb-4 text-center">
                                      <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                        <Trash2 className="text-red-600" size={24} />
                                      </div>
                                      <h2 className="text-xl font-bold text-gray-800 mb-2">Confirm Delete</h2>
                                      <p className="text-gray-600">Are you sure you want to delete this entry? This action cannot be undone.</p>
                                    </div>
                                    <div className="flex gap-3 justify-end">
                                      <button onClick={close} className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 cursor-pointer">Cancel</button>
                                      <button onClick={() => { handleDeleteEntry(row); close(); }} className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 cursor-pointer">Delete</button>
                                    </div>
                                  </div>
                                )}
                              </Popup>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50 font-semibold">
                    <td colSpan="2" className="px-4 py-3 text-right">Total Maal</td>
                    <td className="px-4 py-3 text-right">{formatCurrency(maalTotal)}</td>
                    <td colSpan="2"></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Jama Table */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="p-4 bg-[#0077b6] text-white">
              <h2 className="text-xl font-semibold">Jama Entries</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Date</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Type</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-gray-600">Amount</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Remark</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-gray-600">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {jamaData.map((row) => (
                    <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        {editingRow === row.id ? (
                          <input
                            type="date"
                            className="w-full px-2 py-1 border rounded focus:ring-2 focus:ring-[#0077b6]"
                            value={editDraft.jamaDate || ''}
                            onChange={(e) => setEditDraft({ ...editDraft, jamaDate: e.target.value })}
                          />
                        ) : (
                          formatDate(row.jamaDate)
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {editingRow === row.id ? (
                          <input
                            type="text"
                            className="w-full px-2 py-1 border rounded focus:ring-2 focus:ring-[#0077b6]"
                            value={editDraft.jamaTxnType || ''}
                            onChange={(e) => setEditDraft({ ...editDraft, jamaTxnType: e.target.value })}
                          />
                        ) : (
                          row.jamaTxnType
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {editingRow === row.id ? (
                          <input
                            type="number"
                            className="w-full px-2 py-1 border rounded text-right focus:ring-2 focus:ring-[#0077b6]"
                            value={editDraft.jamaAmount || ''}
                            onChange={(e) => setEditDraft({ ...editDraft, jamaAmount: e.target.value })}
                          />
                        ) : (
                          formatCurrency(row.jamaAmount)
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {editingRow === row.id ? (
                          <input
                            type="text"
                            className="w-full px-2 py-1 border rounded focus:ring-2 focus:ring-[#0077b6]"
                            value={editDraft.jamaRemark || ''}
                            onChange={(e) => setEditDraft({ ...editDraft, jamaRemark: e.target.value })}
                          />
                        ) : (
                          row.jamaRemark
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {editingRow === row.id ? (
                          <div className="flex justify-center space-x-2">
                            <button
                              className="p-1 text-green-600 hover:bg-green-50 rounded-full transition cursor-pointer"
                              onClick={() => handleSaveEdit(row.id)}
                            >
                              <Save size={18} />
                            </button>
                            <button
                              className="p-1 text-red-600 hover:bg-red-50 rounded-full transition cursor-pointer"
                              onClick={() => setEditingRow(null)}
                            >
                              <X size={18} />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center space-x-1">
                            <button
                              className="p-1 text-blue-600 hover:bg-blue-50 rounded-full transition cursor-pointer"
                              onClick={() => handleEditClick(row)}
                            >
                              <Edit size={18} />
                            </button>
                            <Popup
                              trigger={
                                <button className="p-1 text-red-600 hover:bg-red-50 rounded-full transition cursor-pointer">
                                  <Trash2 size={18} />
                                </button>
                              }
                              modal
                              nested
                              overlayStyle={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
                            >
                              {close => (
                                <div className="bg-white p-6 rounded-xl shadow-2xl border border-gray-100">
                                  <div className="mb-4 text-center">
                                    <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                      <Trash2 className="text-red-600" size={24} />
                                    </div>
                                    <h2 className="text-xl font-bold text-gray-800 mb-2">Confirm Delete</h2>
                                    <p className="text-gray-600">Are you sure you want to delete this entry? This action cannot be undone.</p>
                                  </div>
                                  <div className="flex gap-3 justify-end">
                                    <button onClick={close} className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 cursor-pointer">Cancel</button>
                                    <button onClick={() => { handleDeleteEntry(row); close(); }} className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 cursor-pointer">Delete</button>
                                  </div>
                                </div>
                              )}
                            </Popup>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50 font-semibold">
                    <td colSpan="2" className="px-4 py-3 text-right">Total Jama</td>
                    <td className="px-4 py-3 text-right">{formatCurrency(jamaTotal)}</td>
                    <td colSpan="2"></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BuyerAccountDetail;