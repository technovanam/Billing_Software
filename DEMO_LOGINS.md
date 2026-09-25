# Demo Login Credentials

> **Security Notice**: Never commit production passwords or sensitive credentials to version control. Demo accounts exist solely in the demo Firebase project environment.

| Role | Email / Identifier | Password / PIN | Description & Notes |
|------|--------------------|----------------|---------------------|
| Platform Super Admin | `admin@technovanam.com` | *Configured via Firebase Auth console* | Super Admin access with cross-tenant analytics and administration. |
| Store Admin / Owner (Demo) | `demo@technovanam.in` | *Configured via Firebase Auth console* | Store Owner with full billing, inventory, settings, and cashier management. |
| Warehouse Operator (Demo) | `wh.demo@technovanam.in` | *Configured via Firebase Auth console* | Dedicated warehouse portal for stock, dispatch, and purchase orders. |
| POS Cashier (Demo) | `CSH-001` | *Set by Store Admin in Cashier Management* | Counter cashier terminal login with registered 4-digit PIN. |

## Notes
- To provision new test credentials, create the respective account in the Firebase Authentication console or use the seed scripts with proper environment variables.
- Cashier PINs are hashed and verified via the backend POS authentication service (`POST /api/pos/login`).
