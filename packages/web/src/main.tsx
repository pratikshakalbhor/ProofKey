import './polyfills';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AppRoutes } from './app/App';
import { ToastProvider } from './components/ui/Toast';
import { WalletProvider } from './components/wallet/WalletProvider';
import './styles/globals.css';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Root element not found');

createRoot(rootElement).render(
  <React.StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <WalletProvider>
          <AppRoutes />
        </WalletProvider>
      </ToastProvider>
    </BrowserRouter>
  </React.StrictMode>,
);