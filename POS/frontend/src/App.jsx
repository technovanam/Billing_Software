import React, { useContext } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, Link } from "react-router-dom";
import PropTypes from "prop-types";
import { ArrowLeft } from "lucide-react";
import { AuthContext, AuthProvider } from "./context/AuthContext";
import { CompanyProfileProvider } from "./context/CompanyProfileContext";
import { ToastProvider } from "./context/ToastContext";
import ToastContainer from "./components/Toast";
import POSLogin from "./pages/pos/POSLogin";
import OwnerSignIn from "./pages/pos/OwnerSignIn";
import POSPortalLayout from "./pages/pos/POSPortalLayout";
import POSPage from "./pages/pos/POSPage";
import POSCustomers from "./pages/pos/POSCustomers";
import POSDashboard from "./pages/pos/POSDashboard";
import POSProductsCatalog from "./pages/pos/POSProductsCatalog";
import POSSalesReturn from "./pages/pos/POSSalesReturn";
import POSShiftManagement from "./pages/pos/POSShiftManagement";
import CashierManagement from "./pages/pos/CashierManagement";
import { OperatorProvider } from "./context/OperatorContext";
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

function Spinner() {
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-slate-100">
      <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
    </div>
  );
}

// The counter needs a real Firebase session (a cashier token or the owner).
function POSProtectedRoute({ children }) {
  const { user, authInitialized } = useContext(AuthContext);
  if (!authInitialized) return <Spinner />;
  if (!user) return <Navigate to="/pos/login" replace />;
  if (user.role === "warehouse") return <Navigate to="/warehouse" replace />;
  return children;
}

// Warehouse: the owner or a "wh." warehouse account (Admin / Warehouse Staff /
// Manager are chosen inside the warehouse). Cashiers stay on the counter.
function WarehouseRoute({ children }) {
  const { user, authInitialized } = useContext(AuthContext);
  if (!authInitialized) return <Spinner />;
  if (!user) return <Navigate to="/owner/signin" replace />;
  if (user.role === "cashier") return <Navigate to="/pos/billing" replace />;
  return <OperatorProvider>{children}</OperatorProvider>;
}

// Cashier management and device registration are owner-only.
function OwnerRoute({ children }) {
  const { user, authInitialized } = useContext(AuthContext);
  if (!authInitialized) return <Spinner />;
  if (!user) return <Navigate to="/owner/signin" replace />;
  if (user.role !== "owner") return <Navigate to={user.role === "warehouse" ? "/warehouse" : "/pos/billing"} replace />;
  return children;
}

POSProtectedRoute.propTypes = { children: PropTypes.node.isRequired };
OwnerRoute.propTypes = { children: PropTypes.node.isRequired };
WarehouseRoute.propTypes = { children: PropTypes.node.isRequired };

export default function App() {
  return (
    <AuthProvider>
      <CompanyProfileProvider>
        <ToastProvider>
          <Router>
            <Routes>
              <Route path="/" element={<Navigate to="/pos/billing" replace />} />
              <Route path="/pos/login" element={<POSLogin />} />
              <Route path="/owner/signin" element={<OwnerSignIn />} />
              <Route
                path="/cashiers"
                element={
                  <OwnerRoute>
                    <div className="min-h-screen bg-slate-100">
                      <Link to="/pos/billing" className="ml-8 mt-4 inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800">
                        <ArrowLeft className="h-3.5 w-3.5" /> Open POS counter
                      </Link>
                      <CashierManagement />
                    </div>
                  </OwnerRoute>
                }
              />
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
                path="/warehouse/*"
                element={
                  <WarehouseRoute>
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
                  </WarehouseRoute>
                }
              />
              <Route path="*" element={<Navigate to="/pos/billing" replace />} />
            </Routes>
            <ToastContainer />
          </Router>
        </ToastProvider>
      </CompanyProfileProvider>
    </AuthProvider>
  );
}
