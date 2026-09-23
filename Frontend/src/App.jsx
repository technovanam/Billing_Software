import React, { useContext } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import AuthTransition from "./components/AuthTransition";
import Dashboard from "./pages/dashboard/Dashboard";
import Invoices from "./pages/invoices/InvoiceManagement";
import CreateInvoicePage from "./pages/invoices/CreateInvoicePage";
import DeliveryChallans from "./pages/challans/DeliveryChallanManagement";
import CreateDeliveryChallanPage from "./pages/challans/CreateDeliveryChallanPage";
import RecurringInvoices from "./pages/recurring-invoices/RecurringInvoices";
import Products from "./pages/products/ProductsList";
import Payments from "./pages/payments/Payment";
import Expenses from "./pages/expenses/Expenses";
import Header from "./components/Header";
import { AuthContext, AuthProvider } from "./context/AuthContext";
import { CompanyProfileProvider } from "./context/CompanyProfileContext";
import { ToastProvider } from "./context/ToastContext";
import { AIAssistantProvider } from "./context/AIAssistantContext";
import { OperatorProvider } from "./context/OperatorContext";
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

// ── Warehouse / Godown module ────────────────────────────────────────────────
import WarehouseLayout from "./layouts/WarehouseLayout";
import WarehouseDashboard from "./pages/warehouse/WarehouseDashboard";
import WarehouseProducts from "./pages/warehouse/WarehouseProducts";
import BarcodeScanner from "./pages/warehouse/BarcodeScanner";
import StockIn from "./pages/warehouse/StockIn";
import StockOut from "./pages/warehouse/StockOut";
import StockTransfer from "./pages/warehouse/StockTransfer";
import GodownManagement from "./pages/warehouse/GodownManagement";
import StockMovements from "./pages/warehouse/StockMovements";
import StockReport from "./pages/warehouse/StockReport";
import WarehouseSetup from "./pages/warehouse/WarehouseSetup";
// ────────────────────────────────────────────────────────────────────────────

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
            <OperatorProvider>
              <Router>
                <ScrollToTop />
                <Routes>
                  {/* Public */}
                  <Route path="/" element={<LandingPage />} />
                  <Route path="/signin" element={<AuthTransition key="signin" />} />
                  <Route path="/signup" element={<AuthTransition key="signup" />} />

                  {/* Dedicated Warehouse Portal Routes (Completely separate from Admin) */}
                  <Route
                    path="/warehouse/*"
                    element={
                      <ProtectedRoute>
                        <WarehouseLayout>
                          <Routes>
                            <Route path="/" element={<WarehouseDashboard />} />
                            <Route path="/products" element={<WarehouseProducts />} />
                            <Route path="/scan" element={<BarcodeScanner />} />
                            <Route path="/stock-in" element={<StockIn />} />
                            <Route path="/stock-out" element={<StockOut />} />
                            <Route path="/transfer" element={<StockTransfer />} />
                            <Route path="/godowns" element={<GodownManagement />} />
                            <Route path="/movements" element={<StockMovements />} />
                            <Route path="/reports" element={<StockReport />} />
                            <Route path="/setup" element={<WarehouseSetup />} />
                          </Routes>
                        </WarehouseLayout>
                      </ProtectedRoute>
                    }
                  />

                  {/* Admin / Billing Portal Routes */}
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
                              <Route path="/delivery-challans" element={<DeliveryChallans />} />
                              <Route path="/delivery-challans/create" element={<CreateDeliveryChallanPage />} />
                              <Route path="/recurring-invoices" element={<RecurringInvoices />} />
                              <Route path="/recurring-invoices/new" element={<RecurringInvoices />} />
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
            </OperatorProvider>
          </AIAssistantProvider>
        </ToastProvider>
      </CompanyProfileProvider>
    </AuthProvider>
  );
}