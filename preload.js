// preload.js
// Exposes a safe, whitelisted API to the renderer process.
// NOTE: update this file whenever new ipcMain channels are added.
// -------------------------------------------------------------------
const { contextBridge, ipcRenderer } = require('electron');

// Helper to build wrappers for an array of [alias, channel]
function buildApiMap(pairs) {
  const api = {};
  for (const [alias, channel] of pairs) {
    api[alias] = (payload) => ipcRenderer.invoke(channel, payload);
  }
  return api;
}

// Explicitly list the most-used channels (add more as needed)
const exposed = buildApiMap([
  // Products ----------------------------------------------------------------
  ['getProducts', 'products:getAll'],
  ['createProduct', 'products:create'],
  ['updateProduct', 'products:update'],
  ['deleteProduct', 'products:delete'],

  // Customers ---------------------------------------------------------------
  ['getCustomers', 'customers:getAll'],
  ['createCustomer', 'customers:create'],
  ['updateCustomer', 'customers:update'],
  ['deleteCustomer', 'customers:delete'],

  // Suppliers ---------------------------------------------------------------
  ['getSuppliers', 'suppliers:getAll'],
  ['createSupplier', 'suppliers:create'],
  ['updateSupplier', 'suppliers:update'],
  ['deleteSupplier', 'suppliers:delete'],

  // Invoices ----------------------------------------------------------------
  ['getInvoice', 'invoices:get'],
  ['createInvoice', 'invoices:create'],
  ['updateInvoice', 'invoices:update'],
  ['getNextInvoiceId', 'invoices:getNextId'],

  // Customer transactions ---------------------------------------------------
  ['createTransaction', 'transactions:create'],
  ['updateTransaction', 'transactions:update'],
  ['deleteTransaction', 'transactions:delete'],
]);

// Add a true generic invoke helper
exposed.invoke = (...args) => ipcRenderer.invoke(...args);

// Listen for batch Marathi translation events from main process
exposed.onMarathiBatchStart = (callback) => {
  ipcRenderer.on('marathi:batchStart', (_event, data) => callback(data));
};
exposed.onMarathiBatchComplete = (callback) => {
  ipcRenderer.on('marathi:batchComplete', (_event, data) => callback(data));
};

if (!('api' in globalThis)) {
  contextBridge.exposeInMainWorld('api', exposed);
}

// -------------------------------------------------------------------
// Legacy FETCH shim: reroute old HTTP calls (http://localhost:4000/api/*)
// to their equivalent IPC channels, so existing React components that
// still use fetch() keep working. Remove this once every component
// switches to window.api wrappers directly.
// -------------------------------------------------------------------
const originalFetch = globalThis.fetch.bind(globalThis);

const crudMap = {
  'products': 'products',
  'customers': 'customers',
  'suppliers': 'suppliers',
  'invoices': 'invoices',
  'customer-orders': 'cusOrders',
  'supplier-orders': 'supOrders'
};

function translateEndpoint(entity, method, id, subPath) {
  const base = crudMap[entity];
  if (!base) return null; // unknown entity
  switch (method) {
    case 'GET':
      if (id) return [base + ':get', id];
      return [base + ':getAll'];
    case 'POST':
      return [base + ':create'];
    case 'PUT':
      return [base + ':update'];
    case 'DELETE':
      return [base + ':delete', id];
    default:
      return null;
  }
}

async function ipcFetch(input, init = {}) {
  try {
    const url = typeof input === 'string' ? input : input.url;
    const method = (init.method || 'GET').toUpperCase();
    const apiPrefix = 'http://localhost:4000/api/';
    if (!url.startsWith(apiPrefix)) {
      // non-API request → fall back to real fetch
      return originalFetch(input, init);
    }
    const rel = url.slice(apiPrefix.length); // products or products/123
    const [entity, id, subPath] = rel.split('/');
    const t = translateEndpoint(entity, method, id, subPath);
    if (!t) {
      console.warn('ipcFetch: unmapped endpoint', method, url);
      return originalFetch(input, init); // fallback
    }
    const [channel, paramOverride] = t;
    let payload = undefined;
    if (['POST', 'PUT'].includes(method)) {
      if (init.body) {
        payload = typeof init.body === 'string' ? JSON.parse(init.body) : init.body;
      }
      if (paramOverride) payload = { ...(payload || {}), id: paramOverride };
    } else if (paramOverride) {
      payload = paramOverride;
    }
    const data = await exposed.invoke(channel, payload);
    const json = JSON.stringify(data);
    return new Response(json, { headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error('ipcFetch error:', err);
    throw err;
  }
}

// Override global fetch in the renderer BEFORE other scripts run
delete globalThis.fetch;
globalThis.fetch = ipcFetch;
