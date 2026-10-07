import React, { useContext } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from "react-router-dom";
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
import WorkspaceBar from "./components/WorkspaceBar";
import AdvanceReceipts from "./pages/advances/AdvanceReceipts";
import PriceLists from "./pages/inventory/PriceLists";
import Manufacturing from "./pages/inventory/Manufacturing";
import Cheques from "./pages/cheques/Cheques";
import { AuthContext, AuthProvider } from "./context/AuthContext";
import { CompanyProfileProvider } from "./context/CompanyProfileContext";
import { ToastProvider } from "./context/ToastContext";
import { AIAssistantProvider } from "./context/AIAssistantContext";
import ToastContainer from "./components/Toast";
import Clients from "./pages/clients/ClientManagement";
import Report from "./pages/reports/RevenueLineChart";
import Settings from "./pages/settings/SettingsPage";
import InactivityDetector from "./components/InactivityDetector";
import FYArchives from "./pages/admin/FYArchives";
import VoucherRegister from "./pages/vouchers/VoucherRegister";
import SuppliersList from "./pages/suppliers/SuppliersList";
import AccountsPage from "./pages/accounts/AccountsPage";
import GstReturnsPage from "./pages/accounts/GstReturnsPage";
import PayrollPage from "./pages/payroll/PayrollPage";
import LandingPage from "./pages/landing/LandingPage";
import FeaturesPage from "./pages/landing/FeaturesPage";
import SolutionsPage from "./pages/landing/SolutionsPage";
import IntegrationsPage from "./pages/landing/IntegrationsPage";
import PricingPage from "./pages/landing/PricingPage";
import ScrollToTop from "./components/ScrollToTop";

import PublicInvoicePayPage from "./pages/pay/PublicInvoicePayPage";
import TokenPublicPayPage from "./pages/pay/TokenPublicPayPage";
import PaymentSuccessPage from "./pages/pay/PaymentSuccessPage";

// Super Admin Imports
import { SuperAdminAuthProvider } from "./context/SuperAdminAuthContext";
import SuperAdminRoute from "./components/super-admin/SuperAdminRoute";
import ImpersonationBanner from "./components/super-admin/ImpersonationBanner";
import SuperAdminLayout from "./pages/super-admin/layout/SuperAdminLayout";

import SuperAdminForgotPassword from "./pages/super-admin/auth/SuperAdminForgotPassword";
import SuperAdminResetPassword from "./pages/super-admin/auth/SuperAdminResetPassword";
import SuperAdmin2FA from "./pages/super-admin/auth/SuperAdmin2FA";

import SuperAdminDashboard from "./pages/super-admin/dashboard/SuperAdminDashboard";
import BusinessesList from "./pages/super-admin/businesses/BusinessesList";
import BusinessDetail from "./pages/super-admin/businesses/BusinessDetail";

import BusinessUsersList from "./pages/super-admin/platform/BusinessUsersList";
import BranchesList from "./pages/super-admin/platform/BranchesList";

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
import MaintenanceGate from "./components/MaintenanceGate";
import ErrorBoundary from "./components/ErrorBoundary";
import AIAssistantWidget from "./components/AIAssistantWidget";

import PropTypes from 'prop-types';

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
                  <Route path="/features" element={<FeaturesPage />} />
                  <Route path="/solutions" element={<SolutionsPage />} />
                  <Route path="/integrations" element={<IntegrationsPage />} />
                  <Route path="/pricing" element={<PricingPage />} />
                  <Route path="/signin" element={<AuthTransition key="signin" />} />
                  <Route path="/login" element={<Navigate to="/signin" replace />} />
                  <Route path="/signup" element={<AuthTransition key="signup" />} />

                  {/* Admin / Billing Portal Routes */}
                  <Route
                    path="/*"
                    element={
                      <ProtectedRoute>
                        <MaintenanceGate>
                        <div className="min-h-screen bg-slate-100">
                          <Header />
                          <main className="ml-64 flex-1 p-6">
                            <WorkspaceBar />
                            <RouteErrorBoundary>
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
                              <Route path="/reports" element={<Report />} />
                              <Route path="/payments" element={<Payments />} />
                              <Route path="/expenses" element={<Expenses />} />
                              <Route path="/credit-notes" element={<VoucherRegister key="creditNote" typeKey="creditNote" />} />
                              <Route path="/purchases" element={<VoucherRegister key="purchase" typeKey="purchase" />} />
                              <Route path="/debit-notes" element={<VoucherRegister key="debitNote" typeKey="debitNote" />} />
                              <Route path="/advance-receipts" element={<AdvanceReceipts />} />
                              <Route path="/price-lists" element={<PriceLists />} />
                              <Route path="/manufacturing" element={<Manufacturing />} />
                              <Route path="/cheques" element={<Cheques />} />
                              <Route path="/quotations" element={<VoucherRegister key="quotation" typeKey="quotation" />} />
                              <Route path="/sales-orders" element={<VoucherRegister key="salesOrder" typeKey="salesOrder" />} />
                              <Route path="/purchase-orders" element={<VoucherRegister key="purchaseOrder" typeKey="purchaseOrder" />} />
                              <Route path="/suppliers" element={<SuppliersList />} />
                              <Route path="/accounts" element={<AccountsPage />} />
                              <Route path="/gst-returns" element={<GstReturnsPage />} />
                              <Route path="/payroll" element={<PayrollPage />} />
                              <Route path="/settings" element={<Settings />} />
                              <Route path="/fy-archives" element={<FYArchives />} />
                              <Route path="/ai-assistant" element={<AIAssistantWidget embedded />} />
                              <Route path="*" element={<Navigate to="/dashboard" replace />} />
                            </Routes>
                            </RouteErrorBoundary>
                          </main>
                        </div>
                        </MaintenanceGate>
                      </ProtectedRoute>
                    }
                  />
                </Routes>
                <ToastContainer />
              </Router>
            
          </SuperAdminAuthProvider>
        </AIAssistantProvider>
      </ToastProvider>
    </CompanyProfileProvider>
  </AuthProvider>
);
}

// Resets the error boundary when the user moves to another page.
function RouteErrorBoundary({ children }) {
  const location = useLocation();
  return <ErrorBoundary resetKey={location.pathname}>{children}</ErrorBoundary>;
}
