// src/router/modulesRouter.jsx
import React from 'react';
import { Routes, Route } from 'react-router-dom';
import NotFound from '../pages/NotFound';

// page imports
import Invoice from './invoice/Invoice';
import PriceList from './priceList/PriceList';
import CustomerOrder from './orders/CustomerOrder';
import AddCustomerOrder from './orders/AddCustomerOrder';
import BuyerAccount from './accounts/BuyerAccount';
import BuyerAccountDetail from './accounts/BuyerAccountDetail';
import AddBuyerAccount from './accounts/AddBuyerAccount';
import AddAccountEntry from './accounts/AddAccountEntry';
import AddPriceListProduct from './priceList/AddPriceListProduct';
import SupplierAccount from './accounts/SupplierAccount';
import SupplierAccountDetail from './accounts/SupplierAccountDetail';
import AddSupplierAccount from './accounts/AddSupplierAccount';
import AddSupplierAccountEntry from './accounts/AddSupplierAccountEntry';
import SupplierOrder from './orders/SupplierOrder';
import AddSupplierOrder from './orders/AddSupplierOrder';

const ModulesRouter = () => (
  <div className="ml-0 md:ml-[280px] w-[100vw] md:w-[calc(100vw-280px)]">
    <Routes>
      {/* Invoices */}
      <Route path="invoice" element={<Invoice />} />
      <Route path="invoice/:invoiceNo" element={<Invoice />} />
      {/* Price List */}
      <Route path="price-list" element={<PriceList />} />
      <Route path="price-list/add" element={<AddPriceListProduct />} />
      <Route path="price-list/edit/:code" element={<AddPriceListProduct />} />
      {/* Accounts / Buyers */}
      <Route path="accounts/customers" element={<BuyerAccount />} />
      <Route path="accounts/customers/:slug" element={<BuyerAccountDetail />} />
      <Route path="accounts/customers/:slug/add/:type" element={<AddAccountEntry />} />
      {/* Edit account entry */}
      <Route path="accounts/customers/:slug/edit/:type/:id" element={<AddAccountEntry />} />
      <Route path="accounts/customers/add" element={<AddBuyerAccount />} />
      <Route path="accounts/customers/edit/:id" element={<AddBuyerAccount />} />
      {/* Accounts / Suppliers */}
      <Route path="accounts/suppliers" element={<SupplierAccount />} />
      <Route path="accounts/suppliers/:slug" element={<SupplierAccountDetail />} />
      <Route path="accounts/suppliers/:slug/add/:type" element={<AddSupplierAccountEntry />} />
      {/* Edit supplier account entry */}
      <Route path="accounts/suppliers/:slug/edit/:type/:id" element={<AddSupplierAccountEntry />} />
      <Route path="accounts/suppliers/add" element={<AddSupplierAccount />} />
      <Route path="accounts/suppliers/edit/:id" element={<AddSupplierAccount />} />
      {/* Orders */}
      <Route path="orders/customers" element={<CustomerOrder />} />
      <Route path="orders/customers/add" element={<AddCustomerOrder />} />
      <Route path="orders/customers/:orderId" element={<AddCustomerOrder />} />
      <Route path="orders/suppliers" element={<SupplierOrder />} />
      <Route path="orders/suppliers/add" element={<AddSupplierOrder />} />
      <Route path="orders/suppliers/:orderId" element={<AddSupplierOrder />} />
      {/* Fallback 404 for unmatched module routes */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  </div>
);

export default ModulesRouter;