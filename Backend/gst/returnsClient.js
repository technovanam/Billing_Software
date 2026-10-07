// GST return upload through a GST Suvidha Provider (taxpayer API).
//
// GSTN needs a taxpayer session for every upload: the GSP sends an OTP to the
// registered mobile, the user enters it here, and the session token is then
// used to SAVE the GSTR-1 data. Submitting and filing (EVC/DSC) is finished on
// the GST portal. Configure GSTR_* in .env; until then nothing is sent.
//
// Adapter contract:
//   requestOtp({ gstin, username }) -> { ok }
//   authenticate({ gstin, username, otp }) -> { authToken, expiresInSec }
//   saveGstr1({ gstin, username, authToken, fp, payload }) -> { referenceId }

const REQUIRED = ['GSTR_GSP', 'GSTR_BASE_URL', 'GSTR_CLIENT_ID', 'GSTR_CLIENT_SECRET', 'GSTR_GSTIN', 'GSTR_USERNAME'];

class ReturnsNotConfiguredError extends Error {
  constructor(missing) {
    super('GST return upload is not configured');
    this.missing = missing;
  }
}
class ReturnsError extends Error {
  constructor(message, details) {
    super(message);
    this.details = details;
  }
}

function config(env = process.env) {
  const missing = REQUIRED.filter((k) => !env[k]);
  return { missing, configured: missing.length === 0, provider: env.GSTR_GSP || '' };
}

const headers = (env, extra = {}) => ({
  'Content-Type': 'application/json',
  clientid: env.GSTR_CLIENT_ID,
  'client-secret': env.GSTR_CLIENT_SECRET,
  gstin: env.GSTR_GSTIN,
  username: env.GSTR_USERNAME,
  'state-cd': String(env.GSTR_GSTIN).slice(0, 2),
  ...extra,
});

async function call(fetchImpl, url, opts, what) {
  const res = await fetchImpl(url, opts);
  const body = await res.json().catch(() => ({}));
  const failed = !res.ok || body.status_cd === '0' || body.status_cd === 0 || body.error;
  if (failed) {
    const msg = body?.error?.message || body?.error?.error_cd || body?.message || `${what} failed`;
    throw new ReturnsError(msg, body);
  }
  return body;
}

// GSPs that pass GSTN's taxpayer API through unchanged (they handle the
// GSTN encryption): authenticate with OTPREQUEST / AUTHTOKEN, then RETSAVE.
const passThroughGstn = {
  async requestOtp(env, fetchImpl) {
    await call(fetchImpl, `${env.GSTR_BASE_URL}/taxpayerapi/v1.0/authenticate`, { method: 'POST', headers: headers(env), body: JSON.stringify({ action: 'OTPREQUEST', username: env.GSTR_USERNAME }) }, 'OTP request');
    return { ok: true };
  },
  async authenticate(otp, env, fetchImpl) {
    const body = await call(
      fetchImpl,
      `${env.GSTR_BASE_URL}/taxpayerapi/v1.0/authenticate`,
      { method: 'POST', headers: headers(env), body: JSON.stringify({ action: 'AUTHTOKEN', username: env.GSTR_USERNAME, otp: String(otp) }) },
      'OTP verification'
    );
    if (!body.auth_token) throw new ReturnsError('No session token returned', body);
    return { authToken: body.auth_token, expiresInSec: Number(body.expiry || 360) * 60 };
  },
  async saveGstr1(authToken, fp, payload, env, fetchImpl) {
    const body = await call(
      fetchImpl,
      `${env.GSTR_BASE_URL}/taxpayerapi/v1.1/returns/gstr1`,
      { method: 'PUT', headers: headers(env, { 'auth-token': authToken, ret_period: fp }), body: JSON.stringify({ action: 'RETSAVE', data: payload }) },
      'GSTR-1 upload'
    );
    return { referenceId: body.reference_id || body.data?.reference_id || '' };
  },
};

const ADAPTERS = { 'gstn-passthrough': passThroughGstn };

function adapterFor(env) {
  const cfg = config(env);
  if (!cfg.configured) throw new ReturnsNotConfiguredError(cfg.missing);
  const adapter = ADAPTERS[cfg.provider];
  if (!adapter) throw new ReturnsNotConfiguredError([`GSTR_GSP must be one of: ${Object.keys(ADAPTERS).join(', ')}`]);
  return adapter;
}

// Session tokens live in memory per business for their validity window.
const sessions = new Map();

async function requestOtp(uid, { env = process.env, fetchImpl = globalThis.fetch } = {}) {
  return adapterFor(env).requestOtp(env, fetchImpl);
}

async function verifyOtp(uid, otp, { env = process.env, fetchImpl = globalThis.fetch, now = Date.now } = {}) {
  if (!/^\d{4,8}$/.test(String(otp || ''))) throw new ReturnsError('Enter the OTP sent to your registered mobile');
  const { authToken, expiresInSec } = await adapterFor(env).authenticate(otp, env, fetchImpl);
  sessions.set(uid, { authToken, expiresAt: now() + expiresInSec * 1000 });
  return { expiresInSec };
}

async function uploadGstr1(uid, fp, payload, { env = process.env, fetchImpl = globalThis.fetch, now = Date.now } = {}) {
  const adapter = adapterFor(env);
  const session = sessions.get(uid);
  if (!session || session.expiresAt <= now()) throw new ReturnsError('GST portal session expired — request a new OTP');
  if (!/^\d{6}$/.test(String(fp))) throw new ReturnsError('Return period must look like 102026');
  if (payload?.gstin && payload.gstin !== env.GSTR_GSTIN) throw new ReturnsError('The return is for a different GSTIN than the one configured on the server');
  return adapter.saveGstr1(session.authToken, fp, payload, env, fetchImpl);
}

module.exports = { config, requestOtp, verifyOtp, uploadGstr1, ReturnsNotConfiguredError, ReturnsError, _sessions: sessions };
