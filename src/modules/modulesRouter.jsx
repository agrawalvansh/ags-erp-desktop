// src/router/modulesRouter.jsx
import React, { Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import NotFound from '../pages/NotFound';

// Route-level code splitting via React.lazy() — each module loads on demand
// Invoice is imported eagerly because it is the default landing page
import Invoice from './invoice/Invoice';
const PriceList = React.lazy(() => import('./priceList/PriceList'));
const CustomerOrder = React.lazy(() => import('./orders/CustomerOrder'));
const AddCustomerOrder = React.lazy(() => import('./orders/AddCustomerOrder'));
const BuyerAccount = React.lazy(() => import('./accounts/BuyerAccount'));
const BuyerAccountDetail = React.lazy(() => import('./accounts/BuyerAccountDetail'));
const AddBuyerAccount = React.lazy(() => import('./accounts/AddBuyerAccount'));
const AddAccountEntry = React.lazy(() => import('./accounts/AddAccountEntry'));
const AddPriceListProduct = React.lazy(() => import('./priceList/AddPriceListProduct'));
const SupplierAccount = React.lazy(() => import('./accounts/SupplierAccount'));
const SupplierAccountDetail = React.lazy(() => import('./accounts/SupplierAccountDetail'));
const AddSupplierAccount = React.lazy(() => import('./accounts/AddSupplierAccount'));
const AddSupplierAccountEntry = React.lazy(() => import('./accounts/AddSupplierAccountEntry'));
const SupplierOrder = React.lazy(() => import('./orders/SupplierOrder'));
const AddSupplierOrder = React.lazy(() => import('./orders/AddSupplierOrder'));
const CreateQuickSale = React.lazy(() => import('./quick-sales/CreateQuickSales'));
const ListQuickSales = React.lazy(() => import('./quick-sales/ListQuickSales'));
const NotificationsPage = React.lazy(() => import('./notifications/NotificationsPage'));

import PageLoader from '../components/PageLoader';

const ModulesRouter = () => (
  <div className="ml-0 md:ml-[240px] w-[100vw] md:w-[calc(100vw-240px)]">
    <Suspense fallback={<PageLoader variant="inline" />}>
      <Routes>
        {/* Invoices */}
        <Route path="invoice" element={<Invoice />} />
        <Route path="invoice/:invoiceNo" element={<Invoice />} />
        {/* Price List */}
        <Route path="price-list" element={<PriceList />} />
        <Route path="price-list/add" element={<AddPriceListProduct />} />
        <Route path="price-list/edit/:code" element={<AddPriceListProduct />} />
        {/* Quick Sales */}
        <Route path="quick-sales/create" element={<CreateQuickSale />} />
        <Route path="quick-sales/:qsId" element={<CreateQuickSale />} />
        <Route path="quick-sales/list" element={<ListQuickSales />} />
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
        {/* Notifications */}
        <Route path="notifications" element={<NotificationsPage />} />
        {/* Fallback 404 for unmatched module routes */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  </div>
);

export default ModulesRouter;