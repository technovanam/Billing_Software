# Demo Portal Logins

Verified test accounts for local development and QA testing across all 4 portals.

All portals sign in at `http://localhost:5173/signin` (POS terminal can also use `http://localhost:5173/pos/login`).

| Portal | Role | Email / Identifier | Password / PIN | Opens Route |
|---|---|---|---|---|
| **Super Admin** | Platform Super Admin | `admin@technovanam.com` | `SuperAdmin@2026!` | `/super-admin/dashboard` |
| **Business Owner** | Store Owner / Admin | `owner.demo@technovanam.in` | `Owner@123` | `/dashboard` |
| **Warehouse** | Warehouse Operator | `wh.demo@technovanam.in` | `Warehouse@123` | `/warehouse` |
| **POS Cashier 1** | Counter 01 Cashier | `CSH-001` | `1234` | `/pos/billing` |
| **POS Cashier 2** | Counter 02 Cashier | `CSH-002` | `5678` | `/pos/billing` |

---

## Authentication Instructions

1. **Owner, Super Admin, and Warehouse Logins**:
   - Go to `http://localhost:5173/signin`.
   - Enter the Email and Password shown above.
   - The router automatically redirects based on role claims.

2. **Cashier POS Terminal Logins**:
   - Counter devices use hardware binding. On first use, log into the Owner account once (`owner.demo@technovanam.in`) and navigate to **Cashier Management** (`/cashiers`) -> click **Register this device for POS**.
   - Cashiers can then log into `http://localhost:5173/signin` or `http://localhost:5173/pos/login` using Cashier ID (`CSH-001`) and PIN (`1234`).
