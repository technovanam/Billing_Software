# Techno Vanam Billing Software

A web-based billing and business operations application for managing customers, products, invoices, payments, expenses, reports, company settings, and invoice PDF generation.

The project is organized as a React/Vite frontend backed by Firebase Authentication, Cloud Firestore, and Firebase Storage. A small Express service is included for server-side invoice PDF generation with Puppeteer.

## Contents

- [Project Overview](#project-overview)
- [Main Features](#main-features)
- [Technology Stack](#technology-stack)
- [Repository Structure](#repository-structure)
- [Application Architecture](#application-architecture)
- [Prerequisites](#prerequisites)
- [Environment Configuration](#environment-configuration)
- [Installation](#installation)
- [Running the Application](#running-the-application)
- [Frontend Routes](#frontend-routes)
- [Backend API](#backend-api)
- [Firebase Data Model](#firebase-data-model)
- [Authentication and Security](#authentication-and-security)
- [Core Workflows](#core-workflows)
- [Testing](#testing)
- [Database Seeding](#database-seeding)
- [Production Build and Preview](#production-build-and-preview)
- [Troubleshooting](#troubleshooting)
- [Deployment](#deployment)
- [Development Guidelines](#development-guidelines)
- [Known Considerations](#known-considerations)

## Project Overview

Techno Vanam Billing Software helps a business maintain its billing lifecycle in one application:

1. A user signs up or signs in with Firebase Authentication.
2. The authenticated user accesses a protected business workspace.
3. Customers, products, invoices, payments, and expenses are stored in Firestore under the authenticated user's UID.
4. Dashboard cards and reports calculate totals from the current user's data.
5. Invoices can be previewed, printed, or sent to the backend PDF service for PDF generation.
6. Company profile information and a company logo can be managed from Settings.

The application uses per-user Firestore paths such as:

```text
users/{firebaseUid}/customers/{documentId}
users/{firebaseUid}/products/{documentId}
users/{firebaseUid}/invoices/{documentId}
users/{firebaseUid}/payments/{documentId}
users/{firebaseUid}/expenses/{documentId}
users/{firebaseUid}/settings/{documentId}
```

## Main Features

### Authentication

- Email/password sign-up and sign-in through Firebase Authentication.
- Browser session persistence.
- Protected application routes.
- Inactivity detection and sign-out handling.
- Company profile setup during onboarding.

### Dashboard

The dashboard summarizes business activity, including:

- Total bill amount.
- Amount to receive.
- Received revenue.
- Total expenses.
- GST collected.
- Payment status.
- Invoice count.
- Customer count.
- Product count.
- Recent activity and invoice status views.

### Customer Management

- Customer list with search and pagination.
- Add customer page at `/customers/new`.
- Customer type selection: Business or Individual.
- Salutation, first name, last name, company name, and display name.
- Email address, phone, mobile, language, GSTIN, address, and remarks.
- View, edit, and delete customer records.
- Customer statistics derived from related invoices.

The Customers item in the left sidebar opens the customer list at `/clients`. The Add Customer button navigates to the dedicated customer creation page instead of opening a popup.

### Product Management

- Product creation and editing.
- Product name and HSN code.
- Price and price history.
- Unit selection, including Piece, Box, Kilogram, Gram, Meter, Mile, Litre, and Hour.
- Product description.
- Product search and pagination.
- Product detail and price history view.
- Delete confirmation.

### Invoice Management

- Invoice list with search, filters, pagination, and status handling.
- Invoice creation and editing.
- Invoice number and invoice date.
- Due date.
- P.O. Number and P.O. Date.
- D.O. Number and D.O. Date.
- Customer selection and autocomplete.
- Product line items, quantities, rates, HSN codes, and amounts.
- CGST, SGST, and IGST calculations.
- Optional round-off handling.
- Invoice notes and declaration text.
- Invoice preview with independent scrolling.
- Save as PDF through the backend service.
- Browser print workflow.

### Recurring Invoices

- Recurring invoice profile list and search.
- Full-page recurring invoice creation and editing.
- Customer and product selection from existing Firestore data.
- Weekly, biweekly, monthly, multi-month, and yearly schedules.
- Automatic item, discount, TDS, adjustment, round-off, and total calculations.
- Pause, resume, edit, and delete actions.
- Backend processing with duplicate-prevention run locks.
- Email notification to the configured recurring invoice recipient.

### Payments

- Record payments against invoices.
- Track payment methods and transaction details.
- View payment history.
- Support for paid, partial, unpaid, and outstanding invoice states.

### Expenses

- Expense page with KPI cards for total expenses, expense records, and average expense.
- Inline Record Expense form rather than a popup.
- Date and category selection.
- Itemize option.
- Currency and amount fields.
- Notes.
- Customer selection.
- Receipt upload field.
- Expense create, edit, delete, and list workflows.
- Expense totals used by the dashboard.

### Reports

- Revenue visualization and business reporting views.
- Charts powered by the chart libraries included in the frontend dependencies.

### Settings

- Company name and owner information.
- Phone, GSTIN, address, city, state, and pincode.
- Company logo upload through Firebase Storage.
- Profile and application settings.

### Administration Utilities

The frontend includes protected utility pages for:

- Seed data.
- Clear and reseed data.
- Financial year archives.

Use these tools carefully, especially against a production Firebase project.

## Technology Stack

### Frontend

- React 19.
- Vite 7.
- React Router.
- Tailwind CSS with the Vite integration.
- Firebase Web SDK.
- Firebase Authentication.
- Cloud Firestore.
- Firebase Storage.
- Lucide React and Heroicons.
- Recharts/Nivo/ApexCharts/Syncfusion chart dependencies already present in the project.
- jsPDF and jsPDF AutoTable for client-side PDF-related functionality.
- Playwright for browser tests.

### Backend

- Node.js.
- Express 4.
- CORS.
- Body Parser.
- Puppeteer for PDF rendering.
- Firebase Admin SDK for the seeding utility.

### Firebase

- Firebase Authentication for users.
- Cloud Firestore for application data.
- Firebase Storage for company logos.
- Firestore rules in `firestore.rules`.
- Storage rules in `storage.rules`.
- Firebase deployment configuration in `firebase.json`.

## Repository Structure

```text
Billing_Software/
|-- Backend/
|   |-- package.json
|   |-- server.js                  # Express PDF generation service
|   |-- seedData.js                # Firebase Admin data seeder
|   |-- SEEDING_INSTRUCTIONS.md
|   `-- serviceAccountKey.json     # Local secret; do not commit
|-- Frontend/
|   |-- package.json
|   |-- vite.config.js
|   |-- tailwind.config.js
|   |-- playwright.config.js
|   |-- .env                       # Local Firebase client configuration
|   |-- index.html
|   |-- public/
|   |-- src/
|   |   |-- App.jsx                # Application routes and providers
|   |   |-- main.jsx               # React entry point
|   |   |-- index.css              # Global styles
|   |   |-- components/            # Shared UI components
|   |   |-- context/               # Auth, company, and toast contexts
|   |   |-- hooks/                 # Firestore and application hooks
|   |   |-- lib/                   # Firebase and service helpers
|   |   |-- pages/                 # Feature pages
|   |   |-- types/                 # Shared type definitions
|   |   `-- utils/                 # Financial and invoice utilities
|   |-- tests/                     # Playwright browser tests
|   `-- dist/                      # Generated production output
|-- firestore.rules
|-- storage.rules
|-- firebase.json
|-- cors.json
|-- SECURITY.md
|-- .gitignore
`-- README.md
```

## Application Architecture

### Providers and routing

`Frontend/src/App.jsx` creates the application provider hierarchy:

```text
AuthProvider
  CompanyProfileProvider
    ToastProvider
      BrowserRouter
        ProtectedRoute
          Header + page content
```

Unauthenticated users can access the landing page, sign-in page, and sign-up page. All business pages are rendered inside `ProtectedRoute`.

### Shared navigation

`Frontend/src/components/Header.jsx` implements the fixed left sidebar. It contains links to:

- Dashboard
- Invoices
- Customers
- Products
- Reports
- Payments
- Expenses
- Settings

The profile card at the bottom displays the current user and has a dedicated sign-out icon.

### Data access

`Frontend/src/hooks/useFirestore.js` centralizes Firestore access. The user ID is read from `AuthContext`; it is not taken from a URL, local storage, or user-controlled input.

The main hooks include:

- `useCustomers`
- `useProducts`
- `useInvoices`
- `usePayments`
- `useAllPayments`
- `useExpenses`
- `useSettings`

These hooks expose loading state, error state, list data, pagination where applicable, and CRUD functions.

### Invoice PDF flow

1. The user opens Invoice Preview.
2. The preview content is placed in `#invoice-print-root`.
3. Save as PDF sends the rendered HTML and styles to `POST http://localhost:5000/generate-pdf`.
4. Express launches Puppeteer.
5. Puppeteer renders the HTML and generates an A4 PDF.
6. The backend returns `application/pdf` to the browser.

## Prerequisites

Install the following before running the project:

- Node.js 18 or newer recommended.
- npm.
- A Firebase project.
- Firebase Authentication enabled with Email/Password provider.
- Cloud Firestore enabled.
- Firebase Storage enabled if company logo uploads are required.
- A Firebase service-account key for database seeding only.
- Google Chrome or Chromium-compatible browser for Playwright tests.
- Puppeteer-compatible system dependencies for the backend PDF service.

On Windows, verify Node and npm:

```powershell
node --version
npm --version
```

## Environment Configuration

Create `Frontend/.env` with the Firebase Web SDK values for your Firebase project:

```env
VITE_FIREBASE_API_KEY=your_firebase_web_api_key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
VITE_FIREBASE_APP_ID=your_web_app_id
```

Only variables prefixed with `VITE_` are exposed to frontend code by Vite.

Important:

- Do not place a Firebase Admin service-account JSON in `Frontend`.
- Do not commit `Backend/serviceAccountKey.json`.
- Do not commit private keys, refresh tokens, passwords, or deployment credentials.
- Firebase web configuration values are not treated as secrets; Firestore and Storage rules provide authorization.
- In production builds, the Firebase client module throws if required variables are missing.

For the backend seeder, place the downloaded Firebase Admin service-account file at:

```text
Backend/serviceAccountKey.json
```

That file must remain local and ignored by Git.

For recurring invoice email delivery, configure these variables in the backend environment before starting the server:

```env
EMAIL_HOST=smtp.example.com
EMAIL_PORT=587
EMAIL_USER=your-smtp-user
EMAIL_PASSWORD=your-smtp-password
EMAIL_FROM=billing@example.com
RECURRING_INVOICE_EMAIL=mohammedsuhail100506@gmail.com
```

`EMAIL_PASSWORD` is server-only and must never be placed in the React frontend or committed to source control. If SMTP variables are missing, invoice processing still creates invoices but logs that email delivery was skipped.

## Installation

Install frontend dependencies:

```powershell
Set-Location Frontend
npm install
```

Install backend dependencies:

```powershell
Set-Location Backend
npm install
```

If the seed utility has not yet installed Firebase Admin in the backend package, install it with:

```powershell
npm install firebase-admin
```

## Running the Application

The application has two local processes: the Vite frontend and the Express PDF service.

### Start the backend PDF service

From the repository root:

```powershell
Set-Location Backend
npm start
```

The service listens on:

```text
http://localhost:5000
```

### Start the frontend development server

In a second terminal:

```powershell
Set-Location Frontend
npm run dev
```

The Vite server is configured for:

```text
http://localhost:5175
```

Open the displayed Vite URL in a browser. The Playwright configuration also expects `http://localhost:5175`.

### Run both processes in VS Code

Use two integrated terminals:

```powershell
# Terminal 1
Set-Location C:\Users\moham\Billing_Software\Backend
npm start
```

```powershell
# Terminal 2
Set-Location C:\Users\moham\Billing_Software\Frontend
npm run dev
```

## Frontend Routes

Public routes:

| Route | Purpose |
|---|---|
| `/` | Landing page |
| `/signin` | Sign-in page |
| `/signup` | Sign-up page |

Protected routes:

| Route | Purpose |
|---|---|
| `/dashboard` | Business dashboard |
| `/invoices` | Invoice management |
| `/invoices/create` | Create invoice page |
| `/recurring-invoices` | Recurring invoice profiles |
| `/recurring-invoices/new` | Create or edit a recurring invoice profile |
| `/clients` | Customer list and management |
| `/customers/new` | Dedicated inline Add Customer page |
| `/products` | Product management |
| `/reports` | Revenue and reporting views |
| `/payments` | Payment management |
| `/expenses` | Expense management and inline Record Expense form |
| `/settings` | Company and application settings |
| `/seed-data` | Data seeding utility |
| `/clear-and-reseed` | Data cleanup and reseeding utility |
| `/fy-archives` | Financial year archives |

## Backend API

### `POST /generate-pdf`

Generates an invoice PDF from supplied HTML and CSS.

Request body:

```json
{
  "html": "<div>Invoice markup</div>",
  "css": "body { ... }",
  "baseUrl": "http://localhost:5175/"
}
```

Behavior:

- `html` is required.
- JSON payloads up to 50 MB are accepted.
- Puppeteer renders the submitted document.
- The response has `Content-Type: application/pdf`.
- The server returns HTTP 400 when HTML is missing.
- The server returns HTTP 500 when PDF generation fails.

The backend currently enables CORS for local frontend requests.

### Recurring invoice endpoints

These endpoints require a Firebase ID token in the `Authorization` header:

```http
Authorization: Bearer <firebase-id-token>
```

- `POST /recurring-invoices/process` processes due profiles for the authenticated user, creates normal invoices, updates schedule dates, and sends the notification email.
- `POST /recurring-invoices/test-email` sends a configuration test email.

When Firebase Admin is configured, the backend also runs the processor every five minutes. A Firestore run document under each profile prevents duplicate invoice generation during retries.

## Firebase Data Model

The client stores application data beneath the authenticated user document:

```text
users/{uid}
  customers/{customerId}
  products/{productId}
  invoices/{invoiceId}
  payments/{paymentId}
  expenses/{expenseId}
  recurringInvoices/{recurringInvoiceId}
  settings/{settingId}
```

### Recurring invoice fields

Recurring profiles store customer, schedule, items, calculations, notes, status, `nextRunDate`, and `lastRunDate`. Generated invoices are written to the existing invoice collection with a `recurringInvoiceId` reference.

```text
users/{uid}/recurringInvoices/{profileId}
users/{uid}/recurringInvoices/{profileId}/runs/{nextRunDate}
```

The `runs` document is an idempotency lock and is created transactionally before an invoice is generated.

### Customer fields

Customer records can contain fields such as:

- `name`
- `displayName`
- `customerType`
- `salutation`
- `firstName`
- `lastName`
- `companyName` or `company`
- `email`
- `phone`
- `mobile`
- `address`
- `customerLanguage`
- `gstin` or `taxId`
- `notes`
- `serialNumber`

### Product fields

Product records can contain:

- `name`
- `hsn`
- `price`
- `unit`
- `description`
- `oldPrice`
- `priceHistory`

### Invoice fields

Invoice records can contain:

- `invoiceNumber`
- `invoiceDate`
- `dueDate`
- `poNumber`
- `poDate`
- `dcNumber`
- `dcDate`
- `clientId` / customer reference fields
- `items` or `products`
- `cgst`
- `sgst`
- `igst`
- `invoiceNotes`
- `declaration`
- `bankDetails`
- `status`
- `isRoundOff`
- computed totals and payment values

The UI labels `dcNumber` and `dcDate` as D.O. Number and D.O. Date.

### Expense fields

Expense records can contain:

- `title`
- `category`
- `amount`
- `currency`
- `expenseDate`
- `notes`
- `customerId`
- `customerName`
- `itemized`
- `receiptName`

Receipt selection currently stores the selected file name in the expense form. Actual binary receipt storage is not implemented by the current expense form.

## Authentication and Security

Security rules are deny-by-default and bind user data to the authenticated Firebase UID.

### Firestore rules

The rules in `firestore.rules` allow an authenticated user to access only:

```text
users/{request.auth.uid}/...
```

Allowed user-owned subcollections include customers, products, invoices, payments, expenses, and settings. Other paths are denied.

### Storage rules

The rules in `storage.rules` allow authenticated users to upload image files under their own logo path:

```text
logos/{request.auth.uid}/{fileName}
```

Uploads are limited to images smaller than 2 MB. Other Storage paths are denied.

### Deploy rules

Install and authenticate the Firebase CLI, then from the repository root run:

```powershell
firebase deploy --only firestore:rules
firebase deploy --only storage
```

Review `SECURITY.md` before changing rules or introducing new data paths.

## Core Workflows

### Sign up

1. Open `/signup`.
2. Create a Firebase email/password account.
3. Create the owner profile under `users/{uid}`.
4. Optionally upload the company logo to Firebase Storage.
5. Continue to the protected application.

### Create a customer

1. Open the Customers list from the sidebar.
2. Click Add Customer.
3. Navigate to `/customers/new`.
4. Complete the inline form.
5. Save the record.
6. Return to `/clients`.

### Create an invoice

1. Open `/invoices`.
2. Start a new invoice.
3. Select a customer.
4. Add products and quantities.
5. Enter invoice, due date, P.O., and D.O. information.
6. Review taxes and totals.
7. Save, preview, print, or generate a PDF.

### Record an expense

1. Open `/expenses`.
2. Click Add Expense.
3. Complete the inline Record Expense section.
4. Select a category and enter amount.
5. Optionally itemize, select a customer, add notes, and choose a receipt file.
6. Click Save Expense.
7. Review the KPI totals and expense list.

## Testing

Run the production build:

```powershell
Set-Location Frontend
npm run build
```

Run all Playwright tests:

```powershell
npm test
```

Run tests with a visible browser:

```powershell
npm run test:headed
```

Run the Playwright UI mode:

```powershell
npm run test:ui
```

Run browser-specific tests:

```powershell
npm run test:chromium
npm run test:firefox
npm run test:webkit
```

Run mobile projects:

```powershell
npm run test:mobile
```

Open the last Playwright report:

```powershell
npm run test:report
```

The Playwright web server starts the frontend with `npm run dev` and expects port `5175`.

## Database Seeding

The seeder is documented in `Backend/SEEDING_INSTRUCTIONS.md`.

Basic process:

```powershell
Set-Location Backend
npm install
# Place serviceAccountKey.json in this directory
node seedData.js
```

The documented seed set creates large sample collections, including customers, products, invoices, and payments. Seeding writes to Firebase and should only be run against a project where test data is acceptable.

Before seeding:

- Confirm the Firebase project in the service-account key.
- Confirm the target database is not production unless intentionally seeding it.
- Keep the service-account JSON out of source control.
- Review the seeder paths before using it with a new project.

## Production Build and Preview

Build the frontend:

```powershell
Set-Location Frontend
npm run build
```

Preview the generated frontend build:

```powershell
npm run preview
```

The preview script uses port `8080` and binds to `0.0.0.0`.

The `dist/` directory is generated output and should not be manually edited.

## Troubleshooting

### `ERR_NAME_NOT_RESOLVED` for `identitytoolkit.googleapis.com`

This error occurs before Firebase can authenticate. It means the browser or operating system cannot resolve Firebase's Google API hostname. It is usually a DNS, network, VPN, proxy, firewall, or hosts-file issue rather than an invalid email/password.

Check the following:

1. Open another website to confirm internet access.
2. Try resolving the host in PowerShell:

   ```powershell
   Resolve-DnsName identitytoolkit.googleapis.com
   ```

3. Flush the Windows DNS cache:

   ```powershell
   ipconfig /flushdns
   ```

4. Temporarily test with a trusted DNS resolver such as `1.1.1.1` or `8.8.8.8` according to your organization's policy.
5. Check VPN, proxy, antivirus, firewall, and corporate network restrictions.
6. Check the Windows hosts file for an incorrect Google API entry:

   ```text
   C:\Windows\System32\drivers\etc\hosts
   ```

7. Confirm the Firebase Authentication Email/Password provider is enabled.
8. Confirm the frontend's Firebase project variables point to the intended project.

Do not fix this by exposing an Admin SDK key in the frontend. Firebase web API keys are intended for client configuration; authorization is enforced by Firebase rules.

### `Missing or insufficient permissions`

Check:

- The user is authenticated.
- The request path is under `users/{authenticatedUid}/...`.
- The deployed Firestore rules match the local `firestore.rules` file.
- The Firebase project selected in `.env` is the same project where rules were deployed.
- The authenticated account has not expired or been signed out.

Deploy the rules again if needed:

```powershell
firebase deploy --only firestore:rules
```

### PDF generation fails

Check:

- The backend service is running on port `5000`.
- The frontend can reach `http://localhost:5000/generate-pdf`.
- Puppeteer can start on the current machine.
- The submitted invoice HTML is not empty.
- The request payload is below the 50 MB JSON limit.

Start the service directly to inspect logs:

```powershell
Set-Location Backend
npm start
```

### Firebase config missing during build

Set every required `VITE_FIREBASE_*` variable in `Frontend/.env`, then restart Vite. Vite reads environment variables when the dev server starts; changing `.env` while it is running requires a restart.

### Port already in use

The default ports are:

- Frontend: `5175` for development and Playwright.
- Backend: `5000` for PDF generation.
- Frontend preview: `8080`.

Stop the process using the port or update the relevant configuration and frontend request URL together.

### Seed service-account error

If `seedData.js` reports that `serviceAccountKey.json` is missing:

1. Download a new private key from Firebase Console.
2. Save it as `Backend/serviceAccountKey.json`.
3. Confirm the file is ignored by Git.
4. Run the seeder from the `Backend` directory.

## Deployment

A typical deployment requires:

1. Build the frontend with `npm run build`.
2. Host the generated `Frontend/dist` directory on a static hosting service.
3. Configure the production domain in Firebase Authentication authorized domains.
4. Deploy Firestore and Storage rules.
5. Host the Express PDF service separately if PDF generation is required.
6. Update the frontend PDF endpoint from the local `localhost:5000` URL to the deployed backend URL.
7. Configure CORS on the backend for the deployed frontend origin.
8. Set production Firebase environment variables in the hosting provider.
9. Never deploy `Backend/serviceAccountKey.json` with the frontend or public server assets.

The repository currently contains Firebase rule files and project configuration, but it does not contain a complete production hosting workflow. Hosting, DNS, TLS, environment secrets, and backend deployment must be configured for the target platform.

## Development Guidelines

- Keep Firestore paths scoped to the authenticated user.
- Use existing hooks and contexts instead of creating ad-hoc Firestore clients.
- Keep business logic in hooks or feature components and shared UI in `components/`.
- Preserve the existing React/Tailwind visual system.
- Run `npm run build` after frontend changes.
- Run focused Playwright tests for user-facing workflow changes.
- Do not commit `.env`, service-account files, generated credentials, or local debug output.
- Keep modal and inline form scrolling isolated from the page where a popup is intentionally used.
- Validate new fields in both create and edit flows.
- Update Firestore rules when adding a new collection or path.

## Known Considerations

- The frontend currently contains some legacy naming such as `clientId` and `dcNumber` for compatibility, while the UI uses Customer and D.O. terminology.
- The backend PDF service uses a fixed local port and a local URL in the frontend; production deployment requires making that endpoint configurable.
- Receipt upload in the expense form currently records the selected filename in the expense document. It does not yet upload receipt bytes to Firebase Storage.
- Firebase client configuration fallback values exist in the client module for development convenience. Production should provide all required `VITE_FIREBASE_*` variables explicitly.
- The seeding utility requires a Firebase Admin service-account key and should be reviewed before use because seed scripts can write large amounts of data.
- The Vite build may report a circular manual chunk warning. This is a bundling warning and does not currently prevent a successful build.

## Useful Commands Summary

```powershell
# Install frontend dependencies
Set-Location Frontend
npm install

# Start frontend
npm run dev

# Build frontend
npm run build

# Run browser tests
npm test

# Start backend PDF service
Set-Location ..\Backend
npm install
npm start

# Seed Firebase test data
node seedData.js

# Deploy Firebase rules from repository root
Set-Location ..
firebase deploy --only firestore:rules
firebase deploy --only storage
```

## License and Ownership

No license file is currently defined in the repository. Add an explicit license before distributing the project outside its intended organization.
