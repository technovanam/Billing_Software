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
import POSSalesReturn from "./pages/pos/POSSalesReturn";
import POSShiftManagement from "./pages/pos/POSShiftManagement";
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
import DamagedStock from "./pages/warehouse/DamagedStock";
import WarehouseSetup from "./pages/warehouse/WarehouseSetup";
// ────────────────────────────────────────────────────────────────────────────

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
            <SuperAdminAuthProvider>
              <OperatorProvider>
                <Router>
                <ScrollToTop />
                <ImpersonationBanner />
                <Routes>
                  {/* Super Admin Public Auth Routes */}
                  <Route path="/super-admin/login" element={<Navigate to="/signin" replace />} />
                  <Route path="/super-admin/forgot-password" element={<SuperAdminForgotPassword />} />
                  <Route path="/super-admin/reset-password" element={<SuperAdminResetPassword />} />
                  <Route path="/super-admin/2fa" element={<SuperAdmin2FA />} />

                  {/* Super Admin Protected Portal Routes */}
                  <Route
                    path="/super-admin/*"
                    element={
                      <SuperAdminRoute>
                        <SuperAdminLayout />
                      </SuperAdminRoute>
                    }
                  >
                    <Route index element={<Navigate to="dashboard" replace />} />
                    <Route path="dashboard" element={<SuperAdminDashboard />} />

                    {/* Businesses */}
                    <Route path="businesses" element={<BusinessesList />} />
                    <Route path="businesses/:id" element={<BusinessDetail />} />

                    {/* Platform Data */}
                    <Route path="users" element={<BusinessUsersList />} />
                    <Route path="platform/users" element={<BusinessUsersList />} />
                    <Route path="branches" element={<BranchesList />} />
                    <Route path="platform/branches" element={<BranchesList />} />
                    <Route path="godowns" element={<GodownsList />} />
                    <Route path="platform/godowns" element={<GodownsList />} />
                    <Route path="pos-terminals" element={<POSTerminalsList />} />
                    <Route path="platform/terminals" element={<POSTerminalsList />} />
                    <Route path="platform/pos-terminals" element={<POSTerminalsList />} />

                    {/* Subscriptions & Billing */}
                    <Route path="plans" element={<SubscriptionPlans />} />
                    <Route path="subscriptions/plans" element={<SubscriptionPlans />} />
                    <Route path="subscriptions" element={<SubscriptionsList />} />
                    <Route path="subscriptions/list" element={<SubscriptionsList />} />
                    <Route path="payments" element={<PlatformPayments />} />
                    <Route path="subscriptions/payments" element={<PlatformPayments />} />
                    <Route path="revenue" element={<RevenueAnalytics />} />
                    <Route path="subscriptions/revenue" element={<RevenueAnalytics />} />
                    <Route path="coupons" element={<CouponsManagement />} />
                    <Route path="subscriptions/coupons" element={<CouponsManagement />} />

                    {/* Analytics */}
                    <Route path="analytics" element={<PlatformAnalytics />} />

                    {/* Support */}
                    <Route path="support" element={<SupportTickets />} />
                    <Route path="support/tickets" element={<SupportTickets />} />
                    <Route path="announcements" element={<Announcements />} />
                    <Route path="support/announcements" element={<Announcements />} />

                    {/* Security & Access */}
                    <Route path="admin-users" element={<AdminUsers />} />
                    <Route path="security/admin-users" element={<AdminUsers />} />
                    <Route path="roles" element={<RolesAndPermissions />} />
                    <Route path="security/roles" element={<RolesAndPermissions />} />
                    <Route path="audit-logs" element={<AuditLogs />} />
                    <Route path="security/audit-logs" element={<AuditLogs />} />
                    <Route path="login-activity" element={<LoginActivity />} />
                    <Route path="security/login-activity" element={<LoginActivity />} />
                    <Route path="sessions" element={<ActiveSessions />} />
                    <Route path="security/sessions" element={<ActiveSessions />} />

                    {/* System & Maintenance */}
                    <Route path="system-health" element={<SystemHealth />} />
                    <Route path="system/health" element={<SystemHealth />} />
                    <Route path="settings" element={<SystemSettings />} />
                    <Route path="system/settings" element={<SystemSettings />} />
                    <Route path="backups" element={<BackupsManagement />} />
                    <Route path="system/backups" element={<BackupsManagement />} />
                    <Route path="maintenance" element={<MaintenanceMode />} />
                    <Route path="system/maintenance" element={<MaintenanceMode />} />
                  </Route>

                  {/* Public Invoice Payment Routes */}
                  <Route path="/pay/:token" element={<TokenPublicPayPage />} />
                  <Route path="/payment/success" element={<PaymentSuccessPage />} />
                  <Route path="/pay/:userId/*" element={<PublicInvoicePayPage />} />
                  <Route path="/pay/invoice/*" element={<PublicInvoicePayPage />} />

                  {/* Public Authentication & Marketing */}
                  <Route path="/" element={<LandingPage />} />
                  <Route path="/signin" element={<AuthTransition key="signin" />} />
                  <Route path="/login" element={<Navigate to="/signin" replace />} />
                  <Route path="/signup" element={<AuthTransition key="signup" />} />

                  {/* POS Terminal & Cashier Routes */}
                  <Route path="/pos/login" element={<POSLogin />} />
                  <Route
                    path="/pos"
                    element={
                      <POSProtectedRoute>
                        <POSPortalLayout />
                      </POSProtectedRoute>
                    }
                  >
                    <Route index element={<Navigate to="/pos/billing" replace />} />
                    <Route path="billing" element={<POSPage />} />
                    <Route path="customers" element={<POSCustomers />} />
                    <Route path="returns" element={<POSSalesReturn />} />
                    <Route path="shifts" element={<POSShiftManagement />} />
                    <Route path="dashboard" element={<POSDashboard />} />
                    <Route path="products" element={<POSProductsCatalog />} />
                    <Route path="catalog" element={<POSProductsCatalog />} />
                    <Route path="*" element={<Navigate to="/pos/billing" replace />} />
                  </Route>
                  <Route
                    path="/pos/portal"
                    element={
                      <POSProtectedRoute>
                        <POSPortalLayout />
                      </POSProtectedRoute>
                    }
                  >
                    <Route index element={<Navigate to="/pos/billing" replace />} />
                    <Route path="billing" element={<POSPage />} />
                    <Route path="customers" element={<POSCustomers />} />
                    <Route path="returns" element={<POSSalesReturn />} />
                    <Route path="shifts" element={<POSShiftManagement />} />
                    <Route path="dashboard" element={<POSDashboard />} />
                    <Route path="products" element={<POSProductsCatalog />} />
                    <Route path="catalog" element={<POSProductsCatalog />} />
                    <Route path="*" element={<Navigate to="/pos/billing" replace />} />
                  </Route>
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
                            <Route path="/damaged" element={<DamagedStock />} />
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
                              <Route path="/challans" element={<DeliveryChallans />} />
                              <Route path="/challans/create" element={<CreateDeliveryChallanPage />} />
                              <Route path="/delivery-challans" element={<DeliveryChallans />} />
                              <Route path="/delivery-challans/create" element={<CreateDeliveryChallanPage />} />
                              <Route path="/recurring-invoices" element={<RecurringInvoices />} />
                              <Route path="/recurring-invoices/new" element={<RecurringInvoices />} />
                              <Route path="/clients" element={<Clients />} />
                              <Route path="/customers/new" element={<Clients />} />
                              <Route path="/products" element={<Products />} />
                              <Route path="/cashiers" element={<CashierManagement />} />
                              <Route path="/reports" element={<Report />} />
                              <Route path="/payments" element={<Payments />} />
                              <Route path="/expenses" element={<Expenses />} />
                              <Route path="/cashiers" element={<CashierManagement />} />
                              <Route path="/settings" element={<Settings />} />
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
          </SuperAdminAuthProvider>
        </AIAssistantProvider>
      </ToastProvider>
    </CompanyProfileProvider>
  </AuthProvider>
);
}