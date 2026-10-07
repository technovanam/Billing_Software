# POS (Point of Sale) + Warehouse

A standalone app for the shop floor: the billing counter for cashiers and the warehouse / godown module for stock staff. It is **separate from the billing website**: its own frontend, its own backend, its own `package.json` files. The website has no POS or warehouse pages, routes or APIs, and the website backend refuses POS cashier and `wh.` warehouse tokens.

The only thing the two share is the **Firebase project** (the same business account, products, customers and invoices). POS bills are saved to `users/{uid}/invoices` with `source: "POS Counter Terminal"`, so they appear in the website's invoice list and reports.

```
POS/
+-- frontend/   React + Vite app (port 5174)
+-- backend/    Express server (port 5100): /api/pos, /warehouse/* and Razorpay for counter payments
```

## Run it

```bash
# backend
cd POS/backend
cp .env.example .env            # fill in values
npm install
npm start                       # http://localhost:5100
npm test                        # unit tests (in-memory fakes, no Firebase needed)

# frontend
cd POS/frontend
cp .env.example .env            # same Firebase web config as the website + VITE_POS_BACKEND_URL
npm install
npm run dev                     # http://localhost:5174
```

The backend needs Firebase Admin credentials for the shared project: `POS/backend/serviceAccountKey.json` (git-ignored) or `GOOGLE_APPLICATION_CREDENTIALS` in `POS/backend/.env`. It will not start without them.

Online counter payments need `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` in `POS/backend/.env`; without them cash billing still works and online payment returns an error.

## Sign in

| Who | Where | How |
|---|---|---|
| Business owner | `/owner/signin` | Same email and password as the billing website. Opens Cashier Management; can also bill at `/pos/billing` and open the warehouse at `/warehouse`. |
| Warehouse account | `/owner/signin` | An email starting with `wh.`. Opens `/warehouse` only. |
| Cashier | `/pos/login` | Cashier ID + 4-digit PIN, only on a device the owner registered. 5 wrong PINs lock the ID for 15 minutes. |

### Roles

| Role | Counter (`/pos/*`) | Cashier Management | Warehouse (`/warehouse/*`) |
|---|---|---|---|
| Owner | ✅ | ✅ | ✅ |
| Cashier | ✅ | ❌ | ❌ |
| Warehouse account (`wh.`) | ❌ | ❌ | ✅ |

Inside the warehouse, the operator picks a sub-role (stored per browser session; these are screen limits, not server checks):

| Warehouse sub-role | Scan / Stock In / Stock Out | Transfer | Manage godowns, staff, products | View dashboard, reports, movements |
|---|---|---|---|---|
| Admin (default) | ✅ | ✅ | ✅ | ✅ |
| Warehouse Staff | ✅ | ✅ | ❌ | ✅ |
| Manager | ❌ | ✅ | ❌ | ✅ |

## One-time setup per environment

1. Deploy the Firestore rules from the repo root (`firebase deploy --only firestore:rules`). The cashier rules in `firestore.rules` are what let POS cashiers read and write their business's data.
2. Migrate old plain-text PINs, if any (dry run first):
   ```bash
   cd POS/backend
   node scripts/migrate-cashier-pins.js            # report
   node scripts/migrate-cashier-pins.js --apply    # hash PINs and remove plain text
   ```
3. On each counter device: sign in as the owner at `/owner/signin` → Cashier Management → **Register this device for POS**. Cashiers then sign in there with cashier ID + PIN.

4. Warehouse accounts: a `wh.` account sees the owner's product catalogue once linked. The owner copies their UID from `/warehouse/setup` (signed in as the owner); the warehouse account pastes it into its own `/warehouse/setup`.

## Features

### Cashier Management — `/cashiers` (owner only)
- Add, edit and remove cashiers (cashier ID, name, email, phone, 4-digit PIN, counter)
- Set cashiers Active or Inactive (deactivating or changing a PIN signs the cashier out)
- Register or remove POS devices
- Stats: total, active and inactive cashiers, and active counters

### POS Billing — `/pos/billing`
- Add items to the bill from the product catalogue or with a **barcode / QR scanner** (device camera)
- Attach a customer, or add a new one on the spot ("Counter Customer" by default)
- **Pause and resume bills** so several customers can be served at once
- Pay by **cash** or **online (Razorpay)**, with payment verification
- Keyboard shortcut **F9**: generate and print the bill
- **Thermal receipt** printing (tax invoice with CGST / SGST / CESS split)
- Bills that fail to save while offline are queued and synced automatically

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

### Warehouse — `/warehouse/*` (owner or `wh.` account)

Warehouse data lives under `users/{uid}/`: `godowns`, `stock`, `stockMovements`, `barcodeIndex`, `damaged_stock`, `staff`.



#### Warehouse Dashboard — `/warehouse`
- Live stock overview: low stock (at or below reorder level), out of stock (zero units), damaged / wastage
- Recent stock activity
- Shortcuts to barcode intake, products and reports

#### Products — `/warehouse/products`
- Product list with stock status: In Stock, Low Stock, Out of Stock
- **Add a product manually** (brand, category, HSN, unit, image, minimum stock level, opening stock)
- Review a new product before saving it
- Edit and delete products

#### Barcode Scanner — `/warehouse/scan`
- Scan a barcode to find the product and add stock straight away
- Auto-add mode and a running total for the current session

#### Stock In — `/warehouse/stock-in`
- Receive stock with a quantity and remarks; shows the updated stock level

#### Stock Out — `/warehouse/stock-out`
- Dispatch stock with a reason; blocks the dispatch if there isn't enough stock

#### Stock Transfer — `/warehouse/transfer`
- Move stock between godowns (needs at least 2 godowns)

#### Godown Management — `/warehouse/godowns`
- Add, edit and delete godowns (name, address or location, notes)

#### Stock Movements — `/warehouse/movements`
- Full movement history: IN, OUT, TRANSFER IN / OUT, ADJUSTMENT, DAMAGED
- Filter by movement type; shows operator, reference / transfer ID and time

#### Damaged Stock — `/warehouse/damaged`
- Record damaged items with a reason: Broken, Expired, Manufacturing Defect, Packaging Torn, Water / Moisture, Wastage / Spoilage, Other
- Kept separate from live stock; each record is either **Restored to Live** or **Written Off / Scrapped**
- Preview the stock change before saving

#### Stock Report — `/warehouse/reports`
- Inventory report with status (Healthy, Low, Out of Stock), minimum level, category and unit
- Search and filters

#### Warehouse Setup — `/warehouse/setup`
- Link the warehouse account to a business admin UID, or remove the link
- Copy this warehouse's UID

#### Operator / Staff Tracking
- Every stock action records the operator's name
- Staff list is stored on the backend so operators can be picked quickly

## Tests

- `POS/backend`: `npm test` (cashier login, lockout, token revocation, devices, shifts, routes)
- `POS/frontend`: `npm run test:unit` (offline bill queue); `npm test` runs the Playwright e2e tests against both dev servers (`E2E_OWNER_PASSWORD` and `E2E_CASHIER_PIN` required for the login tests)
