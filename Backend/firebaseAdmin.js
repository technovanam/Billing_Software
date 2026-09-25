// Firebase Admin setup. The backend needs real service account credentials:
// without them it cannot verify ID tokens or mint cashier tokens, so it refuses
// to start instead of running with weaker checks.
const path = require('path');

const DEFAULT_KEY_PATH = path.join(__dirname, 'serviceAccountKey.json');

const CREDENTIALS_HELP = `Firebase Admin credentials not found.
The backend will not start without them (see Backend/README.md, "Getting credentials").
Provide ONE of:
  - Backend/serviceAccountKey.json (a service account key for the development project), or
  - GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json in Backend/.env or the environment.`;

function initFirebaseAdmin({ admin = require('firebase-admin'), fs = require('fs'), env = process.env, keyPath = DEFAULT_KEY_PATH } = {}) {
  if (admin.apps.length) return admin.app();
  if (fs.existsSync(keyPath)) {
    return admin.initializeApp({ credential: admin.credential.cert(JSON.parse(fs.readFileSync(keyPath, 'utf8'))) });
  }
  const adc = env.GOOGLE_APPLICATION_CREDENTIALS;
  if (adc && fs.existsSync(adc)) {
    return admin.initializeApp({ credential: admin.credential.applicationDefault() });
  }
  const err = new Error(CREDENTIALS_HELP);
  err.code = 'NO_CREDENTIALS';
  throw err;
}

module.exports = { initFirebaseAdmin, CREDENTIALS_HELP, DEFAULT_KEY_PATH };
