# TechnoVanam Billing Software

A full-stack, multi-tenant SaaS billing and inventory platform for Indian retail businesses, featuring three independent portals, real-time Firebase data, a PDF-generation backend, and a complete Super Admin Command Center.

---

## Table of Contents

1. Project Overview
2. Architecture
3. Repository Structure
4. Technology Stack
5. The Three Portals
6. Warehouse Module
7. All Application Routes
8. Backend API Endpoints
9. Firebase Collections Schema
10. Firestore Security Rules
11. Context Providers
12. Custom Hooks
13. Environment Variables
14. Getting Started
15. Seeding Data
16. Deployment

---

## Project Overview

TechnoVanam Billing Software is a multi-tenant SaaS platform built for Indian retail businesses. It provides:

- GST-compliant invoice generation with PDF export and Razorpay online payment links
- Full inventory management with godown/warehouse tracking, barcode scanning, and stock movements
- A touch-optimized POS terminal for cashiers with offline-ready local caching
- A Super Admin Command Center to manage all tenants, subscriptions, billing, support tickets, and platform-wide configurations
- AI-powered business assistant for instant financial insights and automated analytics

The platform is designed as a multi-tenant architecture where each business (userId) owns its own Firestore subcollection tree, isolated from other tenants at the security rules level.

---

## Architecture

```
+---------------------------------------------------------------------+
|                        CLIENT (React + Vite)                        |
|  +-------------+  +------------------+  +------------------------+ |
|  |  Business   |  |   POS Terminal   |  |  Super Admin Portal    | |
|  |  Portal     |  |   Portal         |  |  Command Center        | |
|  |  /dashboard |  |   /pos/*         |  |  /super-admin/*        | |
|  +------+------+  +--------+---------+  +----------+-------------+ |
|         |                  |                        |               |
|         +------------------+------------------------+               |
|                      Real-time onSnapshot                           |
+----------------------------+----------------------------------------+
                             |
              +--------------v--------------+
              |     Firebase (Google Cloud)  |
              |   Firestore + Auth + Storage |
              +--------------+--------------+
                             |
              +--------------v--------------+
              |  Node.js Backend (Express)   |
              |  Port 5000                   |
              |  - PDF Generation (Puppeteer)|
              |  - Razorpay Payments         |
              |  - CRON: Subscriptions       |
              |  - CRON: Analytics Agg.      |
              |  - CRON: Recurring Invoices  |
              +------------------------------+
```

---

## Repository Structure

```
Billing_Software/
+-- firestore.rules
+-- firestore.indexes.json
+-- storage.rules
+-- firebase.json
+-- cors.json
+-- .firebaserc
|
+-- Backend/
|   +-- server.js                (PDF, payments, CRON jobs)
|   +-- package.json
|   +-- seedSuperAdmin.js
|   +-- seedData.js
|   +-- seedDemoUser.js
|   +-- seedFirestore.js
|   +-- seedCoupons.js
|   +-- seedWarehouseUser.js
|   +-- linkWarehouseToAdmin.js
|   +-- .env
|
+-- Frontend/
    +-- vite.config.js
    +-- index.html
    +-- src/
        +-- App.jsx              (all routes defined here)
        +-- main.jsx
        +-- index.css
        |
        +-- components/
        |   +-- AIAssistantWidget.jsx
        |   +-- AuthCollage.jsx
        |   +-- AuthTransition.jsx
        |   +-- Header.jsx
        |   +-- InactivityDetector.jsx
        |   +-- InvoiceAutocomplete.jsx
        |   +-- Pagination.jsx
        |   +-- ScrollToTop.jsx
        |   +-- Toast.jsx
        |   +-- super-admin/
        |   |   +-- ImpersonationBanner.jsx
        |   |   +-- SuperAdminRoute.jsx
        |   +-- warehouse/
        |
        +-- context/
        |   +-- AuthContext.jsx
        |   +-- SuperAdminAuthContext.jsx
        |   +-- CompanyProfileContext.jsx
        |   +-- OperatorContext.jsx
        |   +-- AIAssistantContext.jsx
        |   +-- ToastContext.jsx
        |
        +-- hooks/
        |   +-- useFirestore.js
        |   +-- useSuperAdminFirestore.js
        |   +-- useWarehouse.js
        |   +-- usePOSFullscreen.js
        |   +-- useFormKeyboardNavigation.js
        |
        +-- lib/firebase/config.js
        +-- layouts/WarehouseLayout.jsx
        +-- services/
        +-- types/
        +-- utils/
        |
        +-- pages/
            +-- landing/
            +-- auth/
            +-- dashboard/
            +-- invoices/
            +-- challans/
            +-- recurring-invoices/
            +-- clients/
            +-- products/
            +-- payments/
            +-- expenses/
            +-- reports/
            +-- cashiers/
            +-- settings/
            +-- ai/
            +-- pay/
            +-- pos/
            +-- warehouse/
            +-- admin/
            +-- super-admin/
                +-- auth/
                +-- dashboard/
                +-- businesses/
                +-- platform/
                +-- subscriptions/
                +-- analytics/
                +-- support/
                +-- security/
                +-- system/
                +-- layout/
```

---

## Technology Stack

### Frontend

| Technology | Version | Purpose |
|---|---|---|
| React | 18 | UI framework |
| Vite | 7 | Build tool with code-splitting |
| TailwindCSS | 4 (Vite plugin) | Utility-first styling |
| React Router DOM | v6 | Client-side routing |
| Firebase SDK | v10 | Firestore, Auth, Storage |
| Lucide React | Latest | Icon system |
| @nivo/line, bar | Latest | Analytics charts |
| jsPDF + html2canvas | Latest | Client-side PDF generation |
| XLSX | Latest | Excel export |
| date-fns | Latest | Date formatting |
| Lodash | Latest | Utility functions |
| Gemini AI API | Latest | AI assistant integration |

### Backend

| Technology | Version | Purpose |
|---|---|---|
| Node.js + Express | Latest | REST API server |
| Firebase Admin SDK | 13.6 | Server-side Firestore |
| Puppeteer | 21 | Headless Chrome PDF rendering |
| Razorpay | 2.9 | Payment gateway |
| node-cron | 4.2 | CRON job scheduler |
| Nodemailer | 7 | Email delivery |
| dotenv | 17 | Environment configuration |

### Firebase Platform

| Service | Usage |
|---|---|
| Firestore | Real-time multi-tenant database |
| Authentication | Firebase Auth email/password |
| Storage | Logo and document uploads |
| Security Rules | RBAC with tenant isolation |

---

## The Three Portals

### Portal 1 - Business / Billing Portal

**URL Base:** /dashboard, /invoices, /products, etc.

**Who uses it:** Business owners and managers of registered tenants.

**Authentication:** Firebase Auth (AuthContext) with automatic 15-minute inactivity timeout (InactivityDetector).

#### Features

| Module | Description |
|---|---|
| Dashboard | Real-time KPI cards: revenue, invoice count, payment status, top products |
| Invoice Management | Create, view, edit, delete GST-compliant invoices. Bulk export to PDF/Excel |
| Create Invoice | Full invoice builder with product autocomplete, GST, discount, freight, round-off |
| Delivery Challans | Create and track delivery challans linked to invoices |
| Recurring Invoices | Automated monthly/quarterly billing with template-based generation |
| Clients / CRM | Customer and vendor directory with transaction history and ledger |
| Products | Product catalogue with price, tax rate, HSN code, barcode, and stock tracking |
| Payments | Record payment receipts with multiple modes Cash, UPI, Bank Transfer |
| Expenses | Log and categorize business expenses with vendor tagging |
| Reports | Revenue line charts, GST summary, expense breakdown, profit/loss |
| Cashier Management | Create and manage cashier PIN-based accounts for POS login |
| AI Assistant | Gemini-powered chatbot for instant financial queries |
| Settings | Company profile, logo, GST details, branding, payment configuration |
| FY Archives | Financial year data archiving and rollover |

#### Page Files

```
src/pages/dashboard/          -> Dashboard.jsx
src/pages/invoices/           -> InvoiceManagement.jsx, CreateInvoicePage.jsx
src/pages/challans/           -> DeliveryChallanManagement.jsx, CreateDeliveryChallanPage.jsx
src/pages/recurring-invoices/ -> RecurringInvoices.jsx
src/pages/clients/            -> ClientManagement.jsx
src/pages/products/           -> ProductsList.jsx
src/pages/payments/           -> Payment.jsx
src/pages/expenses/           -> Expenses.jsx
src/pages/reports/            -> RevenueLineChart.jsx
src/pages/cashiers/           -> CashierManagement.jsx
src/pages/settings/           -> SettingsPage.jsx
src/pages/ai/                 -> AIAssistant.jsx
src/pages/admin/              -> DataSeeder.jsx, ClearAndReseed.jsx, FYArchives.jsx
```

---

### Portal 2 - POS (Point of Sale) Portal

**URL Base:** /pos/*

**Who uses it:** Cashiers and billing operators at retail counters.

**Authentication:** Dual-mode. Cashiers log in using a business UID + 4-digit PIN stored in the Firestore cashiers subcollection. Business owners can also access the POS via regular Firebase auth.

**Design:** Touch-optimized, fullscreen-capable. Supports barcode scanning, customer lookup, multi-item cart, thermal receipt printing, QR payments, and real-time stock deduction.

#### Features

| Page | Description |
|---|---|
| POS Login | Cashier selects business UID and enters PIN to open a shift |
| POS Dashboard | Shift summary, quick stats, shortcuts to POS functions |
| POS Billing | Full billing terminal: product search, cart, discount, payment, receipt printing |
| POS Customers | Customer search, registration, ledger view, balance payments |
| POS Products Catalog | Browse product catalog with stock levels and pricing |

#### Page Files

```
src/pages/pos/POSLogin.jsx           -> Cashier PIN login screen
src/pages/pos/POSPortalLayout.jsx    -> POS shell layout with nav
src/pages/pos/POSDashboard.jsx       -> Shift overview dashboard
src/pages/pos/POSPage.jsx            -> Main billing terminal (77KB largest component)
src/pages/pos/POSCustomers.jsx       -> Customer lookup and registration
src/pages/pos/POSProductsCatalog.jsx -> Product browsing
src/pages/pos/QRScannerModal.jsx     -> Camera-based QR/barcode scanner
src/pages/pos/ThermalReceipt.jsx     -> 80mm thermal receipt layout
```

#### POS Session Management (OperatorContext)

- Stores cashier name, PIN, shift start time in localStorage under pos_cashier_session
- Route guard POSProtectedRoute checks for active session or owner Firebase auth
- Session persists across page refreshes until explicitly ended via shift close

---

### Portal 3 - Super Admin Command Center

**URL Base:** /super-admin/*

**Who uses it:** Platform administrators (TechnoVanam staff) to manage all tenant businesses.

**Authentication:** Separate Firebase Auth scope (SuperAdminAuthContext). Only users in the adminUsers Firestore collection with role Super Admin can access. Supports 2FA/MFA via TOTP. Separate 15-minute idle timeout.

**Master Credentials:** admin@technovanam.com / SuperAdmin@2026!

**Ghost Mode (Impersonation):** Super Admins can impersonate any business to view their data as if they were the owner. An always-visible ImpersonationBanner warns when a ghost session is active.

#### Authentication Pages

| Route | Page | Description |
|---|---|---|
| /super-admin/login | SuperAdminLogin.jsx | Email/password login with 2FA check |
| /super-admin/forgot-password | SuperAdminForgotPassword.jsx | Firebase password reset email |
| /super-admin/reset-password | SuperAdminResetPassword.jsx | Password reset confirmation |
| /super-admin/2fa | SuperAdmin2FA.jsx | TOTP 2FA verification screen |

#### Dashboard

| Route | Page | Description |
|---|---|---|
| /super-admin/dashboard | SuperAdminDashboard.jsx | Platform-wide KPIs: businesses, revenue, subscriptions, payments, sessions |

#### Business Management

| Route | Page | Description |
|---|---|---|
| /super-admin/businesses | BusinessesList.jsx | Searchable list of all tenant businesses with status badges |
| /super-admin/businesses/:id | BusinessDetail.jsx | Subscription, usage, feature overrides, impersonation, plan management |

#### Platform Data

| Route | Page | Description |
|---|---|---|
| /super-admin/platform/users | BusinessUsersList.jsx | All cashiers and staff across all tenants |
| /super-admin/platform/branches | BranchesList.jsx | All branches registered by all tenants |
| /super-admin/platform/godowns | GodownsList.jsx | All warehouses/godowns across tenants |
| /super-admin/platform/terminals | POSTerminalsList.jsx | All POS terminals with block/unblock/remote reset |

#### Subscriptions and Billing

| Route | Page | Description |
|---|---|---|
| /super-admin/subscriptions/plans | SubscriptionPlans.jsx | Plan Builder: create/edit tiers with pricing, quotas, feature toggles |
| /super-admin/subscriptions/list | SubscriptionsList.jsx | All tenant subscriptions Trial / Active / Expired / Suspended |
| /super-admin/subscriptions/payments | PlatformPayments.jsx | Platform-wide payment records and refund management |
| /super-admin/subscriptions/revenue | RevenueAnalytics.jsx | MRR, ARR, ARPU revenue analytics |
| /super-admin/subscriptions/coupons | CouponsManagement.jsx | Discount coupon creation and management |

#### Analytics

| Route | Page | Description |
|---|---|---|
| /super-admin/analytics | PlatformAnalytics.jsx | Business count, user count, transaction volume, revenue aggregated every 5 min |

#### Support

| Route | Page | Description |
|---|---|---|
| /super-admin/support/tickets | SupportTickets.jsx | Tenant support tickets with inline reply, status, assignment |
| /super-admin/support/announcements | Announcements.jsx | Broadcast system for maintenance alerts and feature updates |

#### Security and Audit

| Route | Page | Description |
|---|---|---|
| /super-admin/security/admin-users | AdminUsers.jsx | Super Admin and staff account management |
| /super-admin/security/roles | RolesAndPermissions.jsx | RBAC role builder with granular permissions |
| /super-admin/security/audit-logs | AuditLogs.jsx | Immutable audit trail for all sensitive admin actions |
| /super-admin/security/login-activity | LoginActivity.jsx | Admin login history with IP, device, browser |
| /super-admin/security/sessions | ActiveSessions.jsx | Live admin sessions with remote termination capability |

#### System Management

| Route | Page | Description |
|---|---|---|
| /super-admin/system/health | SystemHealth.jsx | Platform service health indicators |
| /super-admin/system/settings | SystemSettings.jsx | Global settings: SMTP, Razorpay, SMS, WhatsApp, timezone |
| /super-admin/system/backups | BackupsManagement.jsx | Database snapshot metadata and on-demand backup requests |
| /super-admin/system/maintenance | MaintenanceMode.jsx | Toggle maintenance mode and configure tenant banner message |

#### Super Admin Layout

File: src/pages/super-admin/layout/SuperAdminLayout.jsx

- Independently scrolling sidebar with collapsible section groups
- Impersonation banner at top when ghost mode is active
- 15-minute idle session timeout with automatic logout

---

## Warehouse Module

**URL Base:** /warehouse/*

**Who uses it:** Warehouse operators and inventory managers linked to a business tenant.

**Authentication:** Same business Firebase Auth (AuthContext). A dedicated seedWarehouseUser.js script creates a warehouse operator account linked to a tenant userId.

**Architecture:** All warehouse data stored under users/{userId}/ subcollections: godowns, stock, stockMovements, barcodeIndex, damaged_stock, and staff.

### Pages and Routes

| Route | Page | Description |
|---|---|---|
| /warehouse/ | WarehouseDashboard.jsx | Stock summary, low-stock alerts, recent movements, godown breakdown |
| /warehouse/products | WarehouseProducts.jsx | Product registry with stock levels per godown, pricing, barcode |
| /warehouse/scan | BarcodeScanner.jsx | Camera and manual barcode scanning with product lookup |
| /warehouse/stock-in | StockIn.jsx | Receive goods: select godown, product, quantity, lot, expiry |
| /warehouse/stock-out | StockOut.jsx | Issue goods: dispatch recording with reason codes |
| /warehouse/movements | StockMovements.jsx | Immutable ledger of all stock IN/OUT/TRANSFER events |
| /warehouse/damaged | DamagedStock.jsx | Log and track damaged/expired inventory |
| /warehouse/reports | StockReport.jsx | Godown-wise stock valuation, movement history, low-stock report |
| /warehouse/setup | WarehouseSetup.jsx | Configure godowns, set alerts, link staff operators |

### Key Warehouse Data Rules

- stockMovements are immutable (append-only via security rules, update and delete blocked)
- Barcode uniqueness enforced via Firestore atomic transactions on barcodeIndex/{barcode}
- Stock transfers between godowns use runTransaction for concurrency-safe atomic updates

---

## All Application Routes

### Public Routes

| Route | Component | Description |
|---|---|---|
| / | LandingPage | Marketing landing page |
| /signin | AuthTransition | Business owner sign in |
| /signup | AuthTransition | New business registration |
| /pay/:userId/* | PublicInvoicePayPage | Public invoice payment Razorpay |
| /pay/invoice/* | PublicInvoicePayPage | Alternative payment URL format |

### Business Portal (Firebase Auth required)

| Route | Component | Description |
|---|---|---|
| /dashboard | Dashboard | Main business dashboard |
| /invoices | InvoiceManagement | Invoice list, search, export |
| /invoices/create | CreateInvoicePage | New invoice builder |
| /challans | DeliveryChallans | Delivery challan list |
| /challans/create | CreateDeliveryChallanPage | New delivery challan |
| /delivery-challans | DeliveryChallans | Alternate route alias |
| /delivery-challans/create | CreateDeliveryChallanPage | Alternate route alias |
| /recurring-invoices | RecurringInvoices | Recurring billing list |
| /recurring-invoices/new | RecurringInvoices | New recurring invoice |
| /clients | ClientManagement | Customer / vendor directory |
| /customers/new | ClientManagement | Add new customer shortcut |
| /products | ProductsList | Product catalogue |
| /payments | Payment | Payment records |
| /expenses | Expenses | Expense tracker |
| /reports | RevenueLineChart | Revenue analytics |
| /ai-assistant | AIAssistant | Gemini AI chatbot |
| /settings | SettingsPage | Company settings |
| /seed-data | DataSeeder | Dev: seed Firestore data |
| /clear-and-reseed | ClearAndReseed | Dev: reset and reseed |
| /fy-archives | FYArchives | Financial year archives |

### Warehouse Portal (Firebase Auth required)

| Route | Component | Description |
|---|---|---|
| /warehouse/ | WarehouseDashboard | Inventory overview |
| /warehouse/products | WarehouseProducts | Product registry |
| /warehouse/scan | BarcodeScanner | Barcode scanner |
| /warehouse/stock-in | StockIn | Receive stock |
| /warehouse/stock-out | StockOut | Issue stock |
| /warehouse/movements | StockMovements | Movement ledger |
| /warehouse/damaged | DamagedStock | Damaged goods log |
| /warehouse/reports | StockReport | Inventory reports |
| /warehouse/setup | WarehouseSetup | Godown configuration |

### POS Portal (POS PIN or Firebase Auth)

| Route | Component | Description |
|---|---|---|
| /pos/login | POSLogin | Cashier PIN login |
| /pos/ | POSDashboard | Shift dashboard |
| /pos/billing | POSPage | Main POS billing terminal |
| /pos/customers | POSCustomers | Customer management |
| /pos/products | POSProductsCatalog | Product catalog |

### Super Admin Portal (Super Admin Auth required)

| Route | Component | Description |
|---|---|---|
| /super-admin/login | SuperAdminLogin | Admin login |
| /super-admin/forgot-password | SuperAdminForgotPassword | Reset email |
| /super-admin/reset-password | SuperAdminResetPassword | New password |
| /super-admin/2fa | SuperAdmin2FA | TOTP 2FA verification |
| /super-admin/dashboard | SuperAdminDashboard | Platform overview |
| /super-admin/businesses | BusinessesList | All tenants |
| /super-admin/businesses/:id | BusinessDetail | Tenant detail and controls |
| /super-admin/platform/users | BusinessUsersList | All tenant staff |
| /super-admin/platform/branches | BranchesList | All branches |
| /super-admin/platform/godowns | GodownsList | All godowns |
| /super-admin/platform/terminals | POSTerminalsList | All POS terminals |
| /super-admin/subscriptions/plans | SubscriptionPlans | Plan builder |
| /super-admin/subscriptions/list | SubscriptionsList | Active subscriptions |
| /super-admin/subscriptions/payments | PlatformPayments | Payments and refunds |
| /super-admin/subscriptions/revenue | RevenueAnalytics | Revenue dashboard |
| /super-admin/subscriptions/coupons | CouponsManagement | Coupon management |
| /super-admin/analytics | PlatformAnalytics | Platform analytics |
| /super-admin/support/tickets | SupportTickets | Support tickets |
| /super-admin/support/announcements | Announcements | Platform announcements |
| /super-admin/security/admin-users | AdminUsers | Admin account management |
| /super-admin/security/roles | RolesAndPermissions | RBAC role management |
| /super-admin/security/audit-logs | AuditLogs | Audit trail |
| /super-admin/security/login-activity | LoginActivity | Login history |
| /super-admin/security/sessions | ActiveSessions | Active session monitor |
| /super-admin/system/health | SystemHealth | Service health |
| /super-admin/system/settings | SystemSettings | Global platform settings |
| /super-admin/system/backups | BackupsManagement | Backup management |
| /super-admin/system/maintenance | MaintenanceMode | Maintenance toggle |

---

## Backend API Endpoints

The Express server runs on port 5000, proxied through Vite in development.

### PDF Generation

| Method | Endpoint | Description |
|---|---|---|
| POST | /generate-pdf | Renders invoice/challan HTML via Puppeteer and returns PDF binary |

### Payment Gateway (Razorpay)

| Method | Endpoint | Description |
|---|---|---|
| POST | /create-razorpay-order | Creates a Razorpay order and returns orderId for frontend checkout |
| POST | /verify-razorpay-payment | Verifies HMAC signature of a completed Razorpay payment |
| POST | /admin/refund | Issues full/partial Razorpay refund (Super Admin only) |

### Email

| Method | Endpoint | Description |
|---|---|---|
| POST | /send-invoice-email | Sends invoice PDF as email attachment via Nodemailer |

### CRON Jobs (every 5 minutes via node-cron)

| Job | Function | Description |
|---|---|---|
| Subscription Lifecycle | processSubscriptions() | Transitions Trial to Active to Expired to Suspended; applies grace periods |
| Recurring Invoices | processRecurringInvoices() | Generates invoices from active recurring templates when due |
| Analytics Aggregation | aggregatePlatformAnalytics() | Aggregates revenue, users, businesses, writes to analytics/platform |

---

## Firebase Collections Schema

### Root-Level Collections

```
/users/{userId}                      Tenant profile document
  +-- /customers/{docId}             CRM contacts
  +-- /products/{docId}              Product catalogue
  +-- /invoices/{docId}              Invoice records
  +-- /payments/{docId}              Payment entries
  +-- /expenses/{docId}              Expense records
  +-- /recurringInvoices/{docId}     Recurring billing templates
  +-- /deliveryChallans/{docId}      Delivery challans
  +-- /settings/{docId}              Company settings
  +-- /cashiers/{docId}              POS cashier accounts PIN-based
  +-- /staff/{docId}                 Warehouse staff
  +-- /branches/{docId}              Branch offices
  +-- /godowns/{docId}               Warehouse/godown definitions
  +-- /terminals/{docId}             POS terminal registrations
  +-- /stock/{docId}                 Current stock per product+godown
  +-- /stockMovements/{docId}        Immutable stock movement ledger
  +-- /damaged_stock/{docId}         Damaged goods records
  +-- /barcodeIndex/{barcode}        Unique barcode to product mapping
  +-- /appSettings/{docId}           App-level configuration cache

/adminUsers/{adminId}                Super Admin and staff accounts
/adminRoles/{roleId}                 RBAC role definitions with permissions map
/auditLogs/{logId}                   Immutable platform audit trail
/loginActivity/{docId}               Admin login history
/activeSessions/{docId}              Live admin session tokens
/subscriptionPlans/{planId}          Platform subscription plan definitions
/subscriptionsList/{docId}           All tenant subscription instances
/platformPayments/{docId}            Platform-level payment records
/announcements/{docId}               Platform broadcast announcements
/supportTickets/{ticketId}           Tenant support requests
/coupons/{couponId}                  Discount coupon codes
/analytics/platform                  Aggregated platform analytics single doc
/system/settings                     Global platform configuration
/system/maintenance                  Maintenance mode state
/system/health                       Service health indicators
/systemBackups/{docId}               Backup metadata records
```

### Key Tenant Document Fields

```js
{
  companyName: string,
  ownerName: string,
  phone: string,
  gstin: string,
  address: string,
  city: string,
  state: string,
  pincode: string,
  logoURL: string,
  status: "Active" | "Suspended" | "Expired" | "Trial",
  planName: string,
  subscriptionExpiry: Timestamp,
  totalSales: number,
  usersCount: number,
  branchesCount: number,
  createdAt: Timestamp
}
```

---

## Firestore Security Rules

File: firestore.rules

The security rules enforce strict multi-tenant isolation and RBAC for Super Admins.

### Key Helper Functions

```
isAuthenticated()           -> request.auth != null
isOwner(userId)             -> auth.uid == userId (tenant isolation)
isAdmin()                   -> uid exists in /adminUsers collection
isSuperAdmin()              -> isAdmin() AND role == "Super Admin"
hasPermission(name)         -> isSuperAdmin() OR role permissions map has name=true
isLinkedWarehouseReader()   -> Currently aliased to isOwner (extensible)
```

### Rule Strategy Summary

| Collection | Read | Write |
|---|---|---|
| users/{userId} | Owner only | Owner (protected fields blocked); Admin with permission |
| users/{uid}/invoices | Owner | Owner |
| users/{uid}/payments | Owner | Owner |
| users/{uid}/cashiers | Owner | Owner |
| users/{uid}/stockMovements | Owner | Owner (create only, update/delete blocked) |
| adminUsers | Any Admin | Super Admin only |
| adminRoles | Any Admin | Super Admin only |
| auditLogs | Admin with View Analytics | Any Admin (append only) |
| subscriptionPlans | Public | Admin with Change Plan permission |
| supportTickets | Admin | Admin |
| /* (all others) | false | false |

CRITICAL: Tenant users cannot modify status, planName, subscriptionExpiry, totalSales, usersCount, or branchesCount on their own document. These fields are write-protected at the security rules level.

---

## Context Providers

All providers are nested in App.jsx in this order (outermost to innermost):

```
AuthProvider
  CompanyProfileProvider
    ToastProvider
      AIAssistantProvider
        OperatorProvider
          SuperAdminAuthProvider
            Router
```

| Context | File | Provides |
|---|---|---|
| AuthContext | AuthContext.jsx | user, authInitialized, Firebase sign-in/sign-out |
| CompanyProfileContext | CompanyProfileContext.jsx | companyProfile (tenant Firestore doc), loading |
| ToastContext | ToastContext.jsx | showToast(message, type) global toast function |
| AIAssistantContext | AIAssistantContext.jsx | Gemini AI chat state, message history, loading |
| OperatorContext | OperatorContext.jsx | POS cashier session, shift state, login/logout |
| SuperAdminAuthContext | SuperAdminAuthContext.jsx | adminUser, 2FA state, login, logout, verify2FA, startImpersonation, stopImpersonation |

---

## Custom Hooks

### useFirestore.js - Business Portal Hooks

All hooks use onSnapshot for real-time Firestore updates.

| Hook | Collection | Returns |
|---|---|---|
| useInvoices() | invoices | { invoices, loading } |
| useProducts() | products | { products, loading } |
| useCustomers() | customers | { customers, loading } |
| usePayments() | payments | { payments, loading } |
| useExpenses() | expenses | { expenses, loading } |
| useRecurringInvoices() | recurringInvoices | { recurringInvoices, loading } |
| useCashiers() | cashiers | { cashiers, loading } |
| useDashboardStats() | Multiple aggregated | { stats, loading } |

### useSuperAdminFirestore.js - Super Admin Hooks

| Hook | Collection | Returns |
|---|---|---|
| useBusinesses() | users | { businesses, loading } |
| useAdminUsers() | adminUsers | { adminUsers, loading } |
| useAdminRoles() | adminRoles | { roles, loading } |
| useAuditLogs() | auditLogs | { auditLogs, loading } |
| useLoginActivity() | loginActivity | { loginActivity, loading } |
| useActiveSessions() | activeSessions | { sessions, loading } |
| useSubscriptions() | subscriptionsList | { subscriptions, loading } |
| useSubscriptionPlans() | subscriptionPlans | { plans, loading } |
| usePlatformPayments() | platformPayments | { payments, loading } |
| useSupportTickets() | supportTickets | { tickets, loading } |
| useAnnouncements() | announcements | { announcements, loading } |
| usePlatformAnalytics() | analytics/platform | { analytics, loading } |
| useMaintenanceMode() | system/maintenance | { maintenance, loading } |
| useSystemSettings() | system/settings | { settings, loading } |
| useBackups() | systemBackups | { backups, loading } |
| useSystemHealth() | system/health | { health, loading } |
| usePlatformTerminals() | users collectionGroup | { terminals, loading } |
| usePlatformBranches() | users collectionGroup | { branches, loading } |
| usePlatformGodowns() | users collectionGroup | { godowns, loading } |
| usePlatformUsers() | users collectionGroup | { users, loading } |

### useWarehouse.js - Warehouse Hooks

Large hook file (55KB) covering all warehouse operations:

- useGodowns(), useWarehouseProducts(), useStockMovements(), useStockReport()
- stockIn(), stockOut(), stockTransfer(), addDamagedStock()
- useBarcodeScanner(), lookupBarcode()

---

## Environment Variables

### Backend (Backend/.env)

```
PORT=5000
FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY=your_private_key
RAZORPAY_KEY_ID=rzp_live_xxxxxxxxxxxx
RAZORPAY_KEY_SECRET=your_razorpay_secret
SMTP_HOST=smtp.your-provider.com
SMTP_PORT=587
SMTP_USER=your@email.com
SMTP_PASS=your_smtp_password
```

### Frontend (Frontend/.env)

```
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:...
VITE_GEMINI_API_KEY=your_gemini_api_key
VITE_RAZORPAY_KEY_ID=rzp_live_xxxxxxxxxxxx
```

---

## Getting Started

### Prerequisites

- Node.js v18+
- Firebase project with Firestore, Auth, and Storage enabled
- Razorpay account (test or live keys)

### 1. Clone the Repository

```bash
git clone https://github.com/technovanam/Billing_Software.git
cd Billing_Software
```

### 2. Configure Firebase

1. Go to the Firebase Console at https://console.firebase.google.com/
2. Enable Firestore, Authentication (Email/Password), and Storage
3. Download the Service Account Key and save as Backend/serviceAccountKey.json
4. Copy Firebase SDK config into Frontend/src/lib/firebase/config.js

### 3. Deploy Security Rules and Indexes

```bash
firebase deploy --only firestore:rules,firestore:indexes
```

### 4. Start the Backend

```bash
cd Backend
npm install
npm start
```

Server starts on http://localhost:5000

### 5. Start the Frontend

```bash
cd Frontend
npm install
npm run dev
```

App starts on http://localhost:5173

### 6. Seed the Super Admin

```bash
cd Backend
node seedSuperAdmin.js
```

This creates the Super Admin account:
- Email: admin@technovanam.com
- Password: SuperAdmin@2026!
- Portal URL: http://localhost:5173/super-admin/login

---

## Seeding Data

All seed scripts are in Backend/ and require a valid serviceAccountKey.json:

| Script | Command | Description |
|---|---|---|
| seedSuperAdmin.js | node seedSuperAdmin.js | Creates Super Admin Firebase Auth account and Firestore document |
| seedData.js | node seedData.js | Seeds a full demo business with invoices, products, customers |
| seedDemoUser.js | node seedDemoUser.js | Creates a demo tenant account |
| seedFirestore.js | node seedFirestore.js | Seeds basic Firestore structure and config |
| seedCoupons.js | node seedCoupons.js | Seeds discount coupon codes |
| seedWarehouseUser.js | node seedWarehouseUser.js | Creates a warehouse operator account |
| linkWarehouseToAdmin.js | node linkWarehouseToAdmin.js | Links warehouse operator to a specific tenant |

---

## Deployment

### Frontend - Firebase Hosting

```bash
cd Frontend
npm run build
firebase deploy --only hosting
```

### Backend - Node.js Server

Deploy to Render, Railway, Google Cloud Run, or any Node.js host:

```bash
cd Backend
npm start
```

### CORS for Firebase Storage

```bash
gsutil cors set cors.json gs://your-project.appspot.com
```

---

## License

Proprietary - 2026 TechnoVanam. All rights reserved.

---

## Security

Please review SECURITY.md for responsible disclosure guidelines and security contact information.

---

Built with love by the TechnoVanam Engineering Team
