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
import ToastContainer from "./components/Toast";
import Clients from "./pages/clients/ClientManagement";
import Report from "./pages/reports/RevenueLineChart";
import Settings from "./pages/settings/SettingsPage";
import InactivityDetector from "./components/InactivityDetector";
import DataSeeder from "./pages/admin/DataSeeder";
import ClearAndReseed from "./pages/admin/ClearAndReseed";
import FYArchives from "./pages/admin/FYArchives";
import CashierManagement from "./pages/cashiers/CashierManagement";
import AIAssistant from "./pages/ai/AIAssistant";
import LandingPage from "./pages/landing/LandingPage";
import POSPage from "./pages/pos/POSPage";
import POSLogin from "./pages/pos/POSLogin";
import POSPortalLayout from "./pages/pos/POSPortalLayout";
import POSCustomers from "./pages/pos/POSCustomers";
import POSDashboard from "./pages/pos/POSDashboard";
import POSProductsCatalog from "./pages/pos/POSProductsCatalog";
import ScrollToTop from "./components/ScrollToTop";
import { useFormKeyboardNavigation } from "./hooks/useFormKeyboardNavigation";

import PublicInvoicePayPage from "./pages/pay/PublicInvoicePayPage";
import TokenPublicPayPage from "./pages/pay/TokenPublicPayPage";
import PaymentSuccessPage from "./pages/pay/PaymentSuccessPage";

// Super Admin Imports
import { SuperAdminAuthProvider } from "./context/SuperAdminAuthContext";
import SuperAdminRoute from "./components/super-admin/SuperAdminRoute";
import ImpersonationBanner from "./components/super-admin/ImpersonationBanner";
import SuperAdminLayout from "./pages/super-admin/layout/SuperAdminLayout";

import SuperAdminLogin from "./pages/super-admin/auth/SuperAdminLogin";
import SuperAdminForgotPassword from "./pages/super-admin/auth/SuperAdminForgotPassword";
import SuperAdminResetPassword from "./pages/super-admin/auth/SuperAdminResetPassword";
import SuperAdmin2FA from "./pages/super-admin/auth/SuperAdmin2FA";

import SuperAdminDashboard from "./pages/super-admin/dashboard/SuperAdminDashboard";
import BusinessesList from "./pages/super-admin/businesses/BusinessesList";
import BusinessDetail from "./pages/super-admin/businesses/BusinessDetail";

import BusinessUsersList from "./pages/super-admin/platform/BusinessUsersList";
import BranchesList from "./pages/super-admin/platform/BranchesList";
import GodownsList from "./pages/super-admin/platform/GodownsList";
import POSTerminalsList from "./pages/super-admin/platform/POSTerminalsList";

import SubscriptionPlans from "./pages/super-admin/subscriptions/SubscriptionPlans";
import SubscriptionsList from "./pages/super-admin/subscriptions/SubscriptionsList";
import PlatformPayments from "./pages/super-admin/subscriptions/PlatformPayments";
import RevenueAnalytics from "./pages/super-admin/subscriptions/RevenueAnalytics";
import CouponsManagement from "./pages/super-admin/subscriptions/CouponsManagement";

import PlatformAnalytics from "./pages/super-admin/analytics/PlatformAnalytics";
import SupportTickets from "./pages/super-admin/support/SupportTickets";
import Announcements from "./pages/super-admin/support/Announcements";

import AdminUsers from "./pages/super-admin/security/AdminUsers";
import RolesAndPermissions from "./pages/super-admin/security/RolesAndPermissions";
import AuditLogs from "./pages/super-admin/security/AuditLogs";
import LoginActivity from "./pages/super-admin/security/LoginActivity";
import ActiveSessions from "./pages/super-admin/security/ActiveSessions";

import SystemHealth from "./pages/super-admin/system/SystemHealth";
import SystemSettings from "./pages/super-admin/system/SystemSettings";
import BackupsManagement from "./pages/super-admin/system/BackupsManagement";
import MaintenanceMode from "./pages/super-admin/system/MaintenanceMode";


import PropTypes from 'prop-types';

function POSProtectedRoute({ children }) {
  const { user, authInitialized } = useContext(AuthContext);
  const cashierSession = localStorage.getItem("pos_cashier_session");

  if (cashierSession) {
    return <>{children}</>;
  }

  if (!authInitialized) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-100">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
      </div>
    );
  }

  if (user) {
    return <>{children}</>;
  }

  return <Navigate to="/signin?role=cashier" replace />;
}

POSProtectedRoute.propTypes = {
  children: PropTypes.node.isRequired,
};

function ProtectedRoute({ children }) {
  const { user, authInitialized } = useContext(AuthContext);

  if (!authInitialized) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-100">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/signin" replace />;
  }

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
            <Route path="/pay/:userId/*" element={<PublicInvoicePayPage />} />
            <Route path="/pay/invoice/*" element={<PublicInvoicePayPage />} />

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
                        <Route path="/challans" element={<DeliveryChallans />} />
                        <Route path="/challans/create" element={<CreateDeliveryChallanPage />} />
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