# Demo Portal Logins

Test-only accounts, created by `node seedPortalLogins.js` (run from `Backend/`). Re-running the script resets these passwords.

Passwords are **not** stored in this repository. Put them in `Backend/.env` (git-ignored; see `.env.example`) before running the script, and share them with your team privately.

All portals sign in at `/signin` (the POS portal can also use `/pos/login`).

| Portal | Email / ID | Password / PIN (in Backend/.env) | Opens |
|---|---|---|---|
| Super Admin | `admin@technovanam.com` | `DEMO_SUPER_ADMIN_PASSWORD` | `/super-admin/dashboard` |
| Business Owner | `owner.demo@technovanam.in` | `DEMO_OWNER_PASSWORD` | `/dashboard` |
| Warehouse | `wh.demo@technovanam.in` | `DEMO_WAREHOUSE_PASSWORD` | `/warehouse` |
| POS Cashier 1 | `CSH-001` | `DEMO_CASHIER1_PIN` | `/pos` |
| POS Cashier 2 | `CSH-002` | `DEMO_CASHIER2_PIN` | `/pos` |

**Cashier login note:** the sign-in page finds cashiers from the browser's cache, which fills when the Business Owner signs in. Sign in once as the owner in the same browser, sign out, then use a cashier ID and PIN.

**POS portal (`/pos/login`):** enter the Business Owner email and password as the store account, then a cashier ID.

**End-to-end tests:** `Frontend/tests/ai-command.spec.js` signs in as the Business Owner. Set `E2E_OWNER_PASSWORD` in your shell to run it.
