// preload.js
// Exposes a safe, whitelisted API to the renderer process.
// All IPC communication goes through window.api.invoke(channel, payload).
// Shorthand aliases are provided for the most frequently used channels.
// -------------------------------------------------------------------
const { contextBridge, ipcRenderer } = require('electron');

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

// Generic invoke — used by all other IPC calls ----------------------
exposed.invoke = (...args) => ipcRenderer.invoke(...args);

// Event listeners from main process ---------------------------------
exposed.onNotificationCountUpdate = (callback) => {
  const handler = (_event, data) => callback(data);
  ipcRenderer.on('notifications:countUpdate', handler);
  return () => ipcRenderer.removeListener('notifications:countUpdate', handler);
};

// Expose to renderer ------------------------------------------------
if (!('api' in globalThis)) {
  contextBridge.exposeInMainWorld('api', exposed);
}