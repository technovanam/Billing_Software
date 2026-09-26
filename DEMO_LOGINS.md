# Demo Login Credentials

> **Notice**: These demo accounts exist in the development Firebase environment for testing and evaluating each portal.

| Portal | Role | Email / Identifier | Password / PIN | Destination Route | Notes |
|---|---|---|---|---|---|
| **Super Admin Portal** | Platform Super Admin | `admin@technovanam.com` | `SuperAdmin@2026!` | `/super-admin/dashboard` | Cross-tenant analytics, billing plans, audit logs, 2FA bypassed in dev. |
| **Business / Billing Portal** | Store Owner / Admin | `owner.demo@technovanam.in` | `Owner@123` | `/dashboard` | Full billing, GST invoices, inventory, clients, cashiers, settings. |
| **Warehouse Portal** | Warehouse Operator | `wh.demo@technovanam.in` | `Warehouse@123` | `/warehouse` | Multi-godown stock in/out/transfer, barcode scanning, damage logs. |
| **POS Terminal** | Cashier 1 (Counter 01) | `CSH-001` | `1234` | `/pos/billing` | Touch billing terminal. Sign in as owner once or register device. |
| **POS Terminal** | Cashier 2 (Counter 02) | `CSH-002` | `5678` | `/pos/billing` | Touch billing terminal. Sign in as owner once or register device. |

---

## How to Sign In

### 1. Unified Sign-in Page
Navigate to `http://localhost:5173/signin`.
- **Super Admin**: Enter `admin@technovanam.com` and `SuperAdmin@2026!`.
- **Store Owner**: Enter `owner.demo@technovanam.in` and `Owner@123`.
- **Warehouse Operator**: Enter `wh.demo@technovanam.in` and `Warehouse@123`.
- **POS Cashier**: Enter Cashier ID (e.g., `CSH-001`) and PIN (`1234`).

### 2. POS Dedicated Terminal Login
Navigate to `http://localhost:5173/pos/login`.
- If using POS login directly, ensure the device was registered by the Owner from **Cashier Management** (`/cashiers` → *Register this device for POS*), or sign in once as the Owner in the same browser session to synchronize the cashier cache.
