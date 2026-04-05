import React from 'react';
import { createHashRouter, Route, createRoutesFromElements, Navigate } from "react-router-dom";
import Login from './pages/login';   
import NotFound from './pages/NotFound';
import ErrorBoundary from './pages/ErrorBoundary';
import Layout from './Layout';
import ModulesRouter from './modules/modulesRouter';

const App = createHashRouter(
  createRoutesFromElements(
    <>
      <Route path="login" element={<Login />} errorElement={<ErrorBoundary />} />
      <Route element={<Layout />} errorElement={<ErrorBoundary />}>
        <Route path="/" element={<Navigate to="/invoice" replace />} />
        <Route path="/*" element={<ModulesRouter />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </>
  )
);

export default App;