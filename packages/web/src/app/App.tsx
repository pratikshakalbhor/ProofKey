import { useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { ScrollToTop } from '@/components/layout/ScrollToTop';
import { LandingPage } from '@/features/landing/LandingPage';
import { IssuerPortal } from '@/features/issuer/IssuerPortal';
import { HolderPortal } from '@/features/holder/HolderPortal';
import { VerifierPortal } from '@/features/verifier/VerifierPortal';

export function AppRoutes() {
  const location = useLocation();

  // Scroll to top on route change
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  return (
    <>
      <ScrollToTop />
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route path="/" element={<LandingPage />} />
          <Route path="/issuer/*" element={<IssuerPortal />} />
          <Route path="/holder/*" element={<HolderPortal />} />
          <Route path="/verifier/*" element={<VerifierPortal />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AnimatePresence>
    </>
  );
}