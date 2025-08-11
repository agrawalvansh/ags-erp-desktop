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
// …add the rest as needed

// Generic if you need it
export const ipc = invoke;