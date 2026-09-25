# ESA Billing Software — Feature List

A multi-tenant, GST-ready billing and inventory platform. It has **four portals** plus public pages:

| # | Portal | Who uses it | Entry URL |
|---|---|---|---|
| 1 | [Business Admin Portal](#1-business-admin-portal) | Store / business owner | `/dashboard` |
| 2 | [POS Cashier Portal](#2-pos-cashier-portal) | Counter cashiers | `/pos` |
| 3 | [Warehouse Portal](#3-warehouse-portal) | Warehouse operators | `/warehouse` |
| 4 | [Super Admin Portal](#4-super-admin-portal) | Platform owner (SaaS admin) | `/super-admin/dashboard` |
| — | [Public Pages](#5-public-pages) | Visitors and paying customers | `/`, `/pay/...` |

Every portal signs in from **`/signin`**. The page reads the email or ID you enter and sends you to the right portal. Demo logins are listed in [`Backend/DEMO_LOGINS.md`](Backend/DEMO_LOGINS.md).

---

## 1. Business Admin Portal

The main back office for a business. It keeps each business's data separate: `users/{uid}/...`.

### Dashboard — `/dashboard`
- Summary cards: Total Invoices, Total Revenue, Total Revenue Received, Total Amount to Receive, Total Bill Amount, Total Expenses, Total GST Collected, Total Customers, Total Products
- Payment status breakdown (Paid / Unpaid / Overdue / Draft)
- Recent activity feed
- Current financial year filter

### Invoices — `/invoices`, `/invoices/create`
- Create GST invoices with a client picker and product autocomplete
- CGST / SGST / IGST tax calculation with HSN codes
- TDS deduction support
- Optional round-off of the invoice total
- Save as **draft** or as a final invoice
- New products typed on an invoice can be saved to the product catalogue
- Invoice preview laid out for printing, with the amount written out in words ("Rupees ...")
- **PDF download** (jsPDF / html2canvas in the browser, Puppeteer on the server)
- **Online payment links**: generate, copy, regenerate, or disable a secure pay link for each invoice
- Shows paid amount and balance due for partly paid invoices
- Filters by client, status, month, year, financial year or custom date range
- Monthly, yearly and custom invoice reports

### Delivery Challans — `/challans`, `/challans/create`
- Create delivery challans with a reference number, items, amount summary and declaration
- Challan preview and print
- Filters by customer and date range
- Delete a challan (asks for confirmation)

### Recurring Invoices — `/recurring-invoices`
- Create, edit, pause or resume, and delete recurring invoices
- Frequency options and a due-date schedule
- **Automatic creation:** the backend checks every 5 minutes and generates any invoices that are due
- Emails invoices to clients (Nodemailer / SMTP)
- Filters by customer and frequency

### Clients / Customers — `/clients`
- Add and edit clients: salutation, first and last name, company, customer type, GSTIN, phone, mobile, address, remarks
- Preferred customer language (English, Hindi, Gujarati, Marathi)
- Per-client totals: total invoices, total revenue, outstanding amount

### Products — `/products`
- Product catalogue: name, brand, category, HSN code, price, unit (piece, kg, gram, litre, metre, hour, …), image URL
- Minimum stock alert level
- **Price history** for each product
- **Assign a barcode and set opening stock** (links the product to the Warehouse portal)

### Payments — `/payments`
- Payment tracker for every invoice
- Record full or **partial payments**, including TDS
- Payment methods: Cash, Bank Transfer and others, with transaction ID and date
- Edit recorded payments
- **Transaction history** for each invoice
- Monthly, yearly and custom payment reports
- Online payments through **Razorpay**, including refunds

### Expenses — `/expenses`
- Record expenses with category, customer, amount and date
- Upload receipts by drag and drop (up to 10 MB)
- Total and average expense summary
- Edit and delete expenses

### Reports — `/reports`
- Revenue line chart
- GST breakdown (CGST / SGST / IGST)
- Download the whole financial year's bills
- Download a month's bills
- Client-specific reports and yearly reports per client

### Cashier Management — `/cashiers`
- Add, edit and remove POS cashiers (cashier ID, name, email, phone, 4-digit PIN, counter)
- Set cashiers Active or Inactive
- Stats: total, active and inactive cashiers, and active counters

### FY Archives — `/fy-archives`
- View invoices from past financial years
- Per-year totals: total invoices, paid, unpaid and revenue

### Settings — `/settings`
- User and company profile
- Security settings, including the auto-logout timeout
- Shows your Admin UID so a warehouse account can be linked to you

### AI Assistant (floating widget)
- Ask questions about your live billing data
- Quick prompts: Today's Sales, Monthly Profit, Top Product, Who Owes Money?, Customer Insights, Stock Prediction, GST Tax, Validate GSTIN

### Other
- **Auto logout** after a period of inactivity
- Toast notifications and paginated tables throughout

---

## 2. POS Cashier Portal

A fast billing screen for retail counters. Cashiers sign in with a **cashier ID + 4-digit PIN**, or at `/pos/login` with the store account and then a cashier ID.

### POS Billing — `/pos/billing`
- Add items to the bill from the product catalogue or with a **barcode / QR scanner** (device camera)
- Attach a customer, or add a new one on the spot ("Counter Customer" by default)
- **Pause and resume bills** so several customers can be served at once
- Pay by **cash** or **online (Razorpay)**, with payment verification
- Keyboard shortcut **F9**: generate and print the bill
- **Thermal receipt** printing (tax invoice with CGST / SGST / CESS split)

### POS Dashboard — `/pos/dashboard`
- Dashboard for the current shift: invoices issued this shift, cash drawer settlement, electronic (card / UPI) transactions
- Shift invoices with links to view each receipt

### Customers — `/pos/customers`
- Customer list with bill count and total spent
- View a customer's past bills and receipts

### Products & QR Catalog — `/pos/products`
- Browsable product catalogue with QR codes
- "Bill this item" adds it straight to the billing screen

### Sales Return & Refund — `/pos/returns`
- Look up the original invoice and choose which items are being returned
- Refund options: **Cash Refund, UPI Refund, Store Credit, Credit Note, Product Exchange**
- Refund amount worked out automatically; print a return receipt

### Shift Management — `/pos/shifts`
- Open a shift with an opening float
- Tracks sales by payment type: Cash, Card (POS swipe machine), UPI (bank QR)
- Refunds and returns are deducted from the cash drawer
- Close the shift with a closing cash count
- **Print a shift summary report**

---

## 3. Warehouse Portal

Inventory and stock control. Sign in with an email that starts with `wh.` and link the account to a business admin.

### Warehouse Dashboard — `/warehouse`
- Live stock overview: low stock (at or below reorder level), out of stock (zero units), damaged / wastage
- Recent stock activity
- Shortcuts to barcode intake, products and reports

### Products — `/warehouse/products`
- Product list with stock status: In Stock, Low Stock, Out of Stock
- **Add a product manually** (brand, category, HSN, unit, image, minimum stock level, opening stock)
- Review a new product before saving it
- Edit and delete products

### Barcode Scanner — `/warehouse/scan`
- Scan a barcode to find the product and add stock straight away
- Auto-add mode and a running total for the current session

### Stock In — `/warehouse/stock-in`
- Receive stock with a quantity and remarks; shows the updated stock level

### Stock Out — `/warehouse/stock-out`
- Dispatch stock with a reason; blocks the dispatch if there isn't enough stock

### Stock Transfer — `/warehouse/transfer`
- Move stock between godowns (needs at least 2 godowns)

### Godown Management — `/warehouse/godowns`
- Add, edit and delete godowns (name, address or location, notes)

### Stock Movements — `/warehouse/movements`
- Full movement history: IN, OUT, TRANSFER IN / OUT, ADJUSTMENT, DAMAGED
- Filter by movement type; shows operator, reference / transfer ID and time

### Damaged Stock — `/warehouse/damaged`
- Record damaged items with a reason: Broken, Expired, Manufacturing Defect, Packaging Torn, Water / Moisture, Wastage / Spoilage, Other
- Kept separate from live stock; each record is either **Restored to Live** or **Written Off / Scrapped**
- Preview the stock change before saving

### Stock Report — `/warehouse/reports`
- Inventory report with status (Healthy, Low, Out of Stock), minimum level, category and unit
- Search and filters

### Warehouse Setup — `/warehouse/setup`
- Link the warehouse account to a business admin UID, or remove the link
- Copy this warehouse's UID

### Operator / Staff Tracking
- Every stock action records the operator's name
- Staff list is stored on the backend so operators can be picked quickly

---

## 4. Super Admin Portal

The platform owner's control panel for the whole SaaS: all businesses, subscriptions and system settings.

### Authentication
- Super admin login (from `/signin`)
- **Two-factor authentication (2FA)**
- Forgot password and reset password, with password strength rules

### Dashboard — `/super-admin/dashboard`
- Platform totals: total, active, trial and suspended businesses; total platform users; total invoices; total invoiced amount; failed payments
- Business growth chart (active / new / suspended over the last 6 months)
- Subscription distribution by plan
- Expiring subscriptions, failed payments, gateway status and recent activity

### Business Management
- **Businesses** — `/super-admin/businesses`: every business with plan, status, users, branches and expiry date
- **Business Detail** — `/super-admin/businesses/:id`, with tabs: Overview, Users, Branches, Godowns, POS Terminals, Subscription, Payments, Support, Activity
  - Registered office and compliance details, feature overrides for a single business, and that business's audit history

### Platform Resources
- **Business Users** — every business's users, with role, branch and last login
- **Branches** — branches with manager, location, users, godowns and POS terminals
- **Godowns / Warehouses** — SKU count, stock quantity and stock value
- **POS Terminals** — terminal ID, assigned cashier, device, app version, last seen

### Subscriptions & Billing
- **Subscription Plans** — set plan limits: max users, branches, godowns, POS terminals, products and invoices per month
- **Subscriptions** — active subscriptions with billing cycle, renewal date and estimated yearly revenue (ARR)
- **Platform Payments** — subscription payments with gateway, method and transaction ID
- **Revenue Analytics** — monthly recurring revenue (MRR), total revenue, payment success rate, refunds, revenue by plan
- **Coupons & Promo Codes** — create discount codes with usage limits and expiry dates
- **Automatic subscription checks** (backend, every 5 minutes) handle expiry and status changes

### Analytics — `/super-admin/analytics`
- Business, revenue, transaction and user analytics
- Figures are recalculated automatically by the backend

### Support
- **Support Tickets** — priority, status and assigned staff
- **Announcements** — broadcast messages to businesses

### Security
- **Admin Users** — invite platform admins, assign roles, restrict by IP
- **Roles & Permissions** — a grid of which role can do what (Firestore rules enforce these permissions)
- **Audit Logs** — every admin action, with who did it, which business it affected, and IP address
- **Login Activity** — login and logout times, device, browser, IP address and whether the login succeeded
- **Active Sessions** — admin sessions that are currently signed in

### System
- **System Health** — status and response times of each service
- **System Settings** — General & Branding, Email (SMTP), Payment Gateway (Razorpay), SMS Gateway, WhatsApp Cloud API, Tax & Integrations
- **Backups** — database backups with size, storage location and an integrity check
- **Maintenance Mode** — turn platform-wide maintenance on or off

---

## 5. Public Pages

| Page | URL | Features |
|---|---|---|
| Landing page | `/` | Product overview, features, how it works, stats, about, contact |
| Sign in / Sign up | `/signin`, `/signup` | One sign-in page for all portals; register a new business |
| Pay by token | `/pay/:token` | Customer opens an invoice from a secure link and pays online |
| Pay by invoice | `/pay/:userId/...`, `/pay/invoice/...` | Public invoice payment page |
| Payment success | `/payment/success` | Payment confirmation |

---

## 6. Backend Services (`Backend/server.js`)

| Area | Endpoints / Jobs |
|---|---|
| PDF | `POST /generate-pdf` — renders invoice PDFs with Puppeteer |
| Razorpay | Create an order, verify a payment, process a refund, payment **webhook** |
| Public payments | Look up an invoice by token, create an order, record a payment (**rate-limited**) |
| Recurring invoices | Process due invoices, send a test email |
| Warehouse API | Barcode lookup, stock in / out / transfer, products, assign barcode, dashboard, movements, stock report, godowns (add / edit / delete), staff, link to admin |
| Scheduled jobs (every 5 min) | Recurring invoices, subscription lifecycle checks, platform analytics |
| Security | Firebase ID token checked on protected routes |

---

## 7. Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React, Vite, React Router, Tailwind CSS, lucide-react icons, axios |
| Backend | Node.js, Express, node-cron, Nodemailer, Puppeteer, Razorpay SDK |
| Database & Auth | Firebase Firestore, Firebase Authentication, Firebase Storage |
| Security | Firestore security rules with role-based access control (RBAC) |
| Testing | Playwright end-to-end tests |
