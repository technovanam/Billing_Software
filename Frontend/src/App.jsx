qimport React, { useContext } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import AuthTransition from "./components/AuthTransition";
import Dashboard from "./pages/dashboard/Dashboard";
import Invoices from "./pages/invoices/InvoiceManagement";
import CreateInvoicePage from "./pages/invoices/CreateInvoicePage";
import DeliveryChallans from "./pages/challans/DeliveryChallanManagement";
import CreateDeliveryChallanPage from "./pages/challans/CreateDeliveryChallanPage";
import Products from "./pages/products/ProductsList";
import Payments from "./pages/payments/Payment";
import Expenses from "./pages/expenses/Expenses";
import Header from "./components/Header";
import { AuthContext, AuthProvider } from "./context/AuthContext";
import { CompanyProfileProvider } from "./context/CompanyProfileContext";
import { ToastProvider } from "./context/ToastContext";
import { AIAssistantProvider } from "./context/AIAssistantContext";
import ToastContainer from "./components/Toast";
import Clients from "./pages/clients/ClientManagement";
import Report from "./pages/reports/RevenueLineChart";
import Settings from "./pages/settings/SettingsPage";
import InactivityDetector from "./components/InactivityDetector";
import DataSeeder from "./pages/admin/DataSeeder";
import ClearAndReseed from "./pages/admin/ClearAndReseed";
import FYArchives from "./pages/admin/FYArchives";
import AIAssistant from "./pages/ai/AIAssistant";
import LandingPage from "./pages/landing/LandingPage";
import ScrollToTop from "./components/ScrollToTop";

import PropTypes from 'prop-types';

function ProtectedRoute({ children }) {
  const { user, authInitialized } = useContext(AuthContext);

  // Wait for Firebase to initialize authentication before making decisions
  if (!authInitialized) {
    return null; // Don't show anything while Firebase initializes
  }

  if (!user) {
    return <Navigate to="/signin" replace />;
  }

  // ✅ 2. RENDER THE DETECTOR ALONGSIDE YOUR PROTECTED CONTENT
  return (
    <>
      <InactivityDetector />
      {children}
    </>
  );
}

ProtectedRoute.propTypes = {
  children: PropTypes.node.isRequired,
};

export default function App() {
  return (
    <AuthProvider>
      <CompanyProfileProvider>
        <ToastProvider>
          <AIAssistantProvider>
            <Router>
              <ScrollToTop />
              <Routes>
            {/* Public */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/signin" element={<AuthTransition key="signin" />} />
            <Route path="/signup" element={<AuthTransition key="signup" />} />

            {/* Protected with header */}
            <Route
              path="/*"
              element={
                <ProtectedRoute>
                  <div className="min-h-screen bg-slate-100">
                    <Header />
                    <main className="ml-64 flex-1 p-6">
                      <Routes>
                        <Route path="/" element={<Navigate to="/dashboard" replace />} />
                        <Route path="/dashboard" element={<Dashboard />} />
                        <Route path="/invoices" element={<Invoices />} />
                        <Route path="/invoices/create" element={<CreateInvoicePage />} />
                        <Route path="/clients" element={<Clients />} />
                        <Route path="/customers/new" element={<Clients />} />
                        <Route path="/products" element={<Products />} />
                        <Route path="/reports" element={<Report />} />
                        <Route path="/payments" element={<Payments />} />
                        <Route path="/expenses" element={<Expenses />} />
                        <Route path="/ai-assistant" element={<AIAssistant />} />
                        <Route path="/settings" element={<Settings />} />
                        <Route path="/seed-data" element={<DataSeeder />} />
                        <Route path="/clear-and-reseed" element={<ClearAndReseed />} />
                        <Route path="/fy-archives" element={<FYArchives />} />
                      </Routes>
                    </main>
                  </div>
                </ProtectedRoute>
              }
            />
            </Routes>
            <ToastContainer />
          </Router>
        </AIAssistantProvider>
        </ToastProvider>
      </CompanyProfileProvider>
    </AuthProvider>
  );
}