import React, { Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import './styles.css';

const isBusinessRoute = window.location.pathname === '/business' || window.location.pathname.startsWith('/business/');
const ProductApp = React.lazy(() => isBusinessRoute ? import('./apps/business/BusinessApp') : import('./App'));

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <Suspense fallback={<div className="vf-route-loading" role="status">VerifyFirst</div>}>
      <ProductApp />
    </Suspense>
  </React.StrictMode>
);
