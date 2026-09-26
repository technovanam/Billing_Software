# Backend Microservices & API Reference Manual

Express.js server powering PDF generation, Razorpay payment processing, recurring invoice automation, warehouse logistics, hybrid local/LLM AI command parser (`/api/ai`), and hardened POS cashier authentication (`/api/pos`).

---

## 1. Quick Start

```bash
cd Backend
npm install
npm start        # Starts server on http://localhost:5000
npm test         # Runs all 217 unit and integration tests across 31 test suites
```

---

## 2. Core Server Modules & Endpoints (`server.js`)

### 2.1 Middleware & Security
- `initFirebaseAdmin()`: Validates that `serviceAccountKey.json` or `GOOGLE_APPLICATION_CREDENTIALS` exists. Halts startup if credentials are absent.
- `authenticateRequest(req, res, next)`: Verifies Bearer ID token via Firebase Admin SDK. Decodes user claims (`uid`, `email`, `role`, `businessUid`). Blocks cashier tokens (`role: 'cashier'`) from accessing owner-only administration endpoints.
- `rateLimiter(req, res, next)`: In-memory sliding-window token bucket limiter protecting public invoice payment endpoints.

### 2.2 Scheduled Background Jobs (CRON)
- `processRecurringInvoices(uid)` (Every 5 min `*/5 * * * *`):
  - Queries `users/{uid}/recurringInvoices` where `status == 'active'` and `nextDueDate <= now`.
  - Calculates next execution timestamp via `addSchedule(date, interval)` (`Week`, `2 Weeks`, `Month`, `2 Months`, `3 Months`, `6 Months`, `Year`).
  - Creates materialized invoice in `users/{uid}/invoices` and triggers email delivery via Nodemailer.
- `processSubscriptions()` (Every 5 min):
  - Evaluates SaaS tenant subscriptions in `subscriptions/{subscriptionId}`.
  - Manages transitions (`trial` -> `active` / `past_due` / `expired`) and logs audit records.
- `aggregatePlatformAnalytics()` (Every 5 min):
  - Aggregates platform KPIs (MRR, ARR, active tenant count, invoice volume, godown inventory movements) into `platform/analytics/daily/{date}`.

### 2.3 Route Index

#### Public Payment Gateway Endpoints
- `GET /api/public/payment/invoice/:token` — Resolves sanitized invoice details for customer online checkout.
- `POST /api/public/payment/create-order` — Creates a Razorpay order in INR paise.
- `POST /api/public/payment/record` — Records transaction confirmation and marks invoice as `Paid`.
- `POST /api/payment/webhook` — Verifies `x-razorpay-signature` and handles asynchronous payment captures/refunds.

#### Invoice & PDF Services
- `POST /generate-pdf` — Headless Puppeteer Chromium renderer generating high-resolution A4 tax invoices and 80mm thermal receipts.
- `POST /create-razorpay-order` — Authenticated order creation for direct billing.
- `POST /verify-razorpay-payment` — HMAC-SHA256 signature verification.
- `POST /process-razorpay-refund` — Dispatches automated refund requests to Razorpay.

#### Warehouse & Logistics Endpoints
- `POST /warehouse/barcode/resolve` — Universal barcode lookup (local catalog, Open Food Facts, UPC registries).
- `POST /warehouse/stock/in` — Inward stock intake, batch registration, and inventory increments.
- `POST /warehouse/stock/out` — Outward stock dispatch and quantity decrements.
- `POST /warehouse/stock/transfer` — Two-phase atomic inter-godown inventory transfer.
- `POST /warehouse/products` — Registers new warehouse catalog SKUs.
- `POST /warehouse/products/assign-barcode` — Maps physical EAN/UPC barcodes to existing products.
- `GET /warehouse/dashboard` — Aggregated inventory metrics and low-stock warnings.
- `GET /warehouse/movements` — Paginated stock movement audit ledger.
- `GET /warehouse/stock/report` — Stock valuation, turnover rates, and SKU quantities across godowns.
- `GET / POST /warehouse/godowns` — Godown facility creation and listing.
- `PUT / DELETE /warehouse/godowns/:id` — Godown update and decommissioning.
- `GET / POST /warehouse/staff` — Warehouse operator roster management.
- `POST /warehouse/link-admin` — Links warehouse operator accounts to primary business tenant.

---

## 3. Natural Language AI Engine (`Backend/ai/`)

Edge-first natural language processing engine converting spoken and typed commands into validated billing drafts.

### Architecture Flow
1. **Tokenize & Lexicon** (`localParser/`): Trilingual vocabulary in English, Tamil, and Hindi (`lexicon.js`). Handles numbers (`numbers.js`), fractions (`dedh`=1.5, `dhai`=2.5, `arai`=0.5), trade units (`moota`, `petti`, `dabba`, `carton`), and payment types (`gpay`, `phonepe`, `cash`, `credit`).
2. **Intent Recognition**: Extracts intents: `create_invoice`, `create_pos_bill`, `add_item`, `remove_item`, `update_qty`, `set_customer`, `apply_discount`, `record_payment`, `query`.
3. **Matcher** (`matcher.js`): Normalized token comparison, brand resolution, alias lookup (`users/{uid}/aiAliases`), and Fuse.js fuzzy fallback.
4. **Draft Builder** (`draftBuilder.js`): Applies intent mutations to draft state with accurate subtotal, tax, and discount computations.
5. **Confidence Scoring & Routing** (`pipeline.js`): If confidence >= 0.85, returns immediate local result (~5ms). If low confidence, invokes configured LLM fallback (Ollama / Claude). If no LLM configured, marks uncertain fields with *"Please check"*.
6. **Continuous Learning** (`learning/`): Listens to finalized invoices (`billListener.js`), extracts item affinity graphs (`statsModel.js`), boosts co-occurring product matching (`ranker.js`), and runs nightly maintenance rebuilds (`rebuild.js`).

### AI Routes (`/api/ai`)
- `POST /api/ai/parse-command` — Main parser endpoint receiving speech/text and mutating current bill draft.
- `POST /api/ai/aliases` — Saves cashier custom shorthand aliases for products.
- `DELETE /api/ai/aliases` — Removes a registered product alias.
- `POST /api/ai/logs/update` — Records user corrections to improve future matching accuracy.

---

## 4. POS Terminal & Cashier Security (`Backend/pos/`)

### 4.1 Device Registration & Fingerprinting (`devices.js`)
- Store owner registers counter terminals.
- Physical device generates a 256-bit cryptographic secret stored in browser `localStorage`.
- Only the SHA-256 hash is persisted on the server. Unregistered devices cannot sign in.

### 4.2 Cashier PIN Security & Brute-Force Lockout (`cashiers.js`, `pins.js`)
- 4-digit PINs are hashed using `bcryptjs` with salt work factor 10.
- 5 consecutive invalid PIN attempts triggers an automatic **15-minute account lockout**.
- Successful login issues a signed Firebase Custom Token containing `{ role: 'cashier', businessUid }`.
- Revocation triggers immediately when owner changes PIN, disables account, or deregisters terminal.

### 4.3 Shift Management & Drawer Reconciliation (`shifts.js`)
- Enforces strict one-active-shift-per-cashier constraint.
- Tracks opening cash float, multi-mode sales collections, in-shift refunds, and closing physical cash count.
- Computes cash discrepancy (overage / shortage) upon shift closure.

### POS Routes (`/api/pos`)
- `POST /cashiers/login` — Device-bound PIN authentication returning custom Firebase auth token.
- `GET / POST /devices` — Owner management of registered POS hardware terminals.
- `DELETE /devices/:deviceId` — Deregisters a counter terminal and revokes active sessions.
- `GET /cashiers` — Real-time status of all cashiers (active shifts, lockout status).
- `POST /cashiers/:id/pin` — Provisions or updates cashier bcrypt PIN.
- `POST /cashiers/:id/status` — Toggles cashier active/inactive state.
- `DELETE /cashiers/:id` — Removes cashier record.
- `POST /shifts/open` — Opens a new cashier shift with recorded starting cash float.
- `POST /shifts/:id/close` — Closes shift, records physical cash count, and tallies totals.
- `POST /shifts/refund` — Records an in-shift sales return or refund.
- `POST /shifts/import` — Ingests offline shift logs generated during network outages.

---

## 5. Maintenance & Diagnostic Scripts (`scripts/`)

| Script | Command | Purpose |
|---|---|---|
| `migrate-cashier-pins.js` | `node scripts/migrate-cashier-pins.js --apply` | Migrates legacy plain text PINs to bcrypt hashes. |
| `backfill-product-ids.js` | `node scripts/backfill-product-ids.js --apply` | Links historical invoice lines to catalog product IDs. |
| `ai-live-eval.js` | `node scripts/ai-live-eval.js` | Benchmarks NLP accuracy, token latency, and match precision. |
| `export-training-data.js`| `node scripts/export-training-data.js` | Exports sanitized, PII-redacted voice billing sessions as JSONL for LLM fine-tuning. |
| `seedPortalLogins.js` | `node seedPortalLogins.js` | Generates verified demo accounts for all portals. |
