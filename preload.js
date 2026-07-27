// preload.js
// Exposes a safe, whitelisted API to the renderer process.
// All IPC communication goes through window.api.invoke(channel, payload).
// Shorthand aliases are provided for the most frequently used channels.
// -------------------------------------------------------------------
// SECURITY: The generic invoke() is restricted to an explicit allowlist.
// Any channel NOT in this set is rejected with an error before it ever
// reaches the main process. This prevents a compromised renderer from
// calling destructive or sensitive handlers arbitrarily.
// -------------------------------------------------------------------
const { contextBridge, ipcRenderer } = require('electron');

// ─── Channel Allowlist ──────────────────────────────────────────────────────
// Every channel that the renderer is permitted to invoke.
// To add a new handler: register it in ipcHandlers.js first, then add its
// channel string here. Never add wildcard or partial matches.
const ALLOWED_CHANNELS = new Set([
  // Products
  'products:getAll',
  'products:get',
  'products:create',
  'products:update',
  'products:delete',

  // Customers
  'customers:getAll',
  'customers:get',
  'customers:create',
  'customers:update',
  'customers:delete',
  'customers:checkDependencies',
  'customers:bulkDeleteEntries',
  'customers:maalGet',
  'customers:maalCreate',
  'customers:maalUpdate',
  'customers:maalDelete',
  'customers:txnGet',
  'customers:txnCreate',
  'customers:txnUpdate',
  'customers:txnDelete',

  // Invoices
  'invoices:get',
  'invoices:getNextId',
  'invoices:getByCustomer',
  'invoices:create',
  'invoices:update',
  'invoices:delete',
  'invoices:addPayment',
  'invoices:updatePayment',
  'invoices:deletePayment',
  'invoices:getUnpaidByCustomer',
  'invoices:refreshOverdueStatuses',

  // Transactions (customer ledger)
  'transactions:getByCustomer',

  // Customer Orders
  'cusOrders:getAll',
  'cusOrders:get',
  'cusOrders:getNextId',
  'cusOrders:create',
  'cusOrders:update',
  'cusOrders:delete',

  // Supplier Orders
  'supOrders:getAll',
  'supOrders:get',
  'supOrders:getNextId',
  'supOrders:create',
  'supOrders:update',
  'supOrders:delete',

  // Quick Sales
  'quickSales:getAll',
  'quickSales:get',
  'quickSales:getNextId',
  'quickSales:create',
  'quickSales:update',
  'quickSales:delete',

  // Suppliers
  'suppliers:getAll',
  'suppliers:get',
  'suppliers:create',
  'suppliers:update',
  'suppliers:delete',
  'suppliers:checkDependencies',
  'suppliers:bulkDeleteEntries',
  'suppliersMaal:getBySupplier',
  'suppliersMaal:create',
  'suppliersMaal:update',
  'suppliersMaal:delete',
  'supplierTransactions:getBySupplier',
  'supplierTransactions:create',
  'supplierTransactions:update',
  'supplierTransactions:delete',

  // Notifications
  'notifications:getAll',
  'notifications:getUnreadCount',
  'notifications:markRead',
  'notifications:markAllRead',
  'notifications:delete',
  'notifications:deleteAll',

  // Marathi transliteration
  'translate:toMarathi',
  'translate:nameToMarathi',
  'translate:checkMissing',
  'translate:getMarathiNames',

  // Auth
  'auth:login',

  // Printing
  'print:listPrinters',
  'print:pdf',
]);

const exposed = {};

// Shorthand aliases for frequently-used channels --------------------
// Products
exposed.getProducts    = (p) => ipcRenderer.invoke('products:getAll', p);
exposed.createProduct  = (p) => ipcRenderer.invoke('products:create', p);
exposed.updateProduct  = (p) => ipcRenderer.invoke('products:update', p);
exposed.deleteProduct  = (p) => ipcRenderer.invoke('products:delete', p);

// Customers
exposed.getCustomers   = (p) => ipcRenderer.invoke('customers:getAll', p);

// Invoices
exposed.getInvoice       = (p) => ipcRenderer.invoke('invoices:get', p);
exposed.getNextInvoiceId = (p) => ipcRenderer.invoke('invoices:getNextId', p);

// Invoice payment methods
exposed.invoiceAddPayment      = (data)        => ipcRenderer.invoke('invoices:addPayment', data);
exposed.invoiceUpdatePayment   = (data)        => ipcRenderer.invoke('invoices:updatePayment', data);
exposed.invoiceDeletePayment   = (data)        => ipcRenderer.invoke('invoices:deletePayment', data);
exposed.invoiceGetUnpaid       = (customer_id) => ipcRenderer.invoke('invoices:getUnpaidByCustomer', customer_id);
exposed.invoiceRefreshOverdue  = ()            => ipcRenderer.invoke('invoices:refreshOverdueStatuses');

// Auth
exposed.login = (credentials) => ipcRenderer.invoke('auth:login', credentials);

// Allowlist-gated invoke — replaces the old unrestricted generic invoke ------
// Only channels present in ALLOWED_CHANNELS above are forwarded to the main
// process. Any unknown channel is rejected immediately in the renderer,
// before the IPC call is even made. This closes C1 from the audit report.
exposed.invoke = (channel, ...args) => {
  if (!ALLOWED_CHANNELS.has(channel)) {
    console.error(`[preload] Blocked invoke on unknown channel: "${channel}"`);
    return Promise.reject(new Error(`IPC channel not permitted: "${channel}"`));
  }
  return ipcRenderer.invoke(channel, ...args);
};

// Event listeners from main process ---------------------------------
exposed.onNotificationCountUpdate = (callback) => {
  const handler = (_event, data) => callback(data);
  ipcRenderer.on('notifications:countUpdate', handler);
  return () => ipcRenderer.removeListener('notifications:countUpdate', handler);
};

exposed.onQuickSalesCleanup = (callback) => {
  const handler = (_event, data) => callback(data);
  ipcRenderer.on('cleanup:quickSalesDeleted', handler);
  return () => ipcRenderer.removeListener('cleanup:quickSalesDeleted', handler);
};

exposed.onAppUpgraded = (callback) => {
  const handler = (_event, data) => callback(data);
  ipcRenderer.on('app:upgraded', handler);
  return () => ipcRenderer.removeListener('app:upgraded', handler);
};

exposed.onMarathiBatchStart = (callback) => {
  const handler = (_event, data) => callback(data);
  ipcRenderer.on('marathi:batchStart', handler);
  return () => ipcRenderer.removeListener('marathi:batchStart', handler);
};

exposed.onMarathiBatchComplete = (callback) => {
  const handler = (_event, data) => callback(data);
  ipcRenderer.on('marathi:batchComplete', handler);
  return () => ipcRenderer.removeListener('marathi:batchComplete', handler);
};

// Expose to renderer ------------------------------------------------
if (!('api' in globalThis)) {
  contextBridge.exposeInMainWorld('api', exposed);
}