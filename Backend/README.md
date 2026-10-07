# Backend

Express server for PDFs, payments, recurring invoices and the AI command bar (`/api/ai`).

The POS app (counter + warehouse) has its own backend in [`POS/backend`](../POS/README.md); this server has no POS or warehouse routes and accepts business-owner accounts only (POS cashier and `wh.` warehouse tokens get 403).

```bash
cd Backend
npm install
npm start        # http://localhost:5000
npm test         # unit tests (no Firebase needed; they use in-memory fakes)
```

## Getting credentials

The backend **refuses to start without Firebase Admin credentials**. It needs them to verify every sign-in token; there is no fallback that decodes tokens without checking them.

Use the **development** Firebase project for local work, never production.

1. Ask the project owner to add you to the development Firebase project (Firebase console → Project settings → Users and permissions). The **Editor** role is enough to create a key; a narrower custom role needs `iam.serviceAccountKeys.create`.
2. In the Firebase console open **Project settings → Service accounts → Generate new private key**. A JSON file downloads.
3. Save it as `Backend/serviceAccountKey.json` (git-ignored), **or** keep it elsewhere and set in `Backend/.env`:
   ```
   GOOGLE_APPLICATION_CREDENTIALS=C:/path/to/dev-service-account.json
   ```
4. Copy `Backend/.env.example` to `Backend/.env` and fill in what you need.
5. `npm start`. If credentials are missing you'll see `Firebase Admin credentials not found` and the process exits.

Keep the key private: it has full admin access to the project. Don't commit it, paste it into chat, or share it by email. If a key leaks, delete it in Google Cloud console → IAM → Service accounts → Keys and generate a new one.

## Useful scripts

| Script | What it does |
|---|---|
| `scripts/backfill-product-ids.js` | Add `productId` to old bill lines (dry run unless `--apply`) |
| `scripts/ai-live-eval.js` | Measure the AI command parser |
| `scripts/export-training-data.js` | Export confirmed AI commands as redacted JSONL |
