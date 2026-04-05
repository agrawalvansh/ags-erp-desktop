// src/erpApi.js
/* Thin wrapper around window.api for React components */

const invoke = (c, p) => window.api.invoke(c, p);

// Products -------------------------------------------------
export const getProducts      = () => invoke('products:getAll');
export const createProduct    = (p) => invoke('products:create', p);
export const updateProduct    = (p) => invoke('products:update', p);
export const deleteProduct    = (code) => invoke('products:delete', code);

// Customers ------------------------------------------------
export const getCustomers     = () => invoke('customers:getAll');
export const createCustomer   = (p) => invoke('customers:create', p);
export const updateCustomer   = (p) => invoke('customers:update', p);
export const deleteCustomer   = (id) => invoke('customers:delete', id);

// Suppliers ------------------------------------------------
export const getSuppliers     = () => invoke('suppliers:getAll');
export const createSupplier   = (p) => invoke('suppliers:create', p);
export const updateSupplier   = (p) => invoke('suppliers:update', p);
export const deleteSupplier   = (id) => invoke('suppliers:delete', id);

// Generic if you need it
export const ipc = invoke;