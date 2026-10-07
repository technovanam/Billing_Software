// E-invoice (IRN) generation through a GST Suvidha Provider.
//
// Every GSP wraps the NIC IRP API in its own login + endpoint shape, so this
// file keeps a small adapter per provider. Pick one with EINVOICE_GSP and fill
// the credentials in .env (see .env.example). Until then the endpoint answers
// "not configured" and nothing is sent anywhere.
//
// Adapter contract: generateIrn(payload) -> { irn, ackNo, ackDate, signedInvoice, signedQrCode, ewbNo? }

const REQUIRED = ['EINVOICE_GSP', 'EINVOICE_BASE_URL', 'EINVOICE_CLIENT_ID', 'EINVOICE_CLIENT_SECRET', 'EINVOICE_GSTIN', 'EINVOICE_USERNAME', 'EINVOICE_PASSWORD'];

class GspNotConfiguredError extends Error {
  constructor(missing) {
    super('E-invoice GSP is not configured');
    this.missing = missing;
  }
}

class GspError extends Error {
  constructor(message, details) {
    super(message);
    this.details = details;
  }
}

function config(env = process.env) {
  const missing = REQUIRED.filter((k) => !env[k]);
  return { missing, configured: missing.length === 0, provider: env.EINVOICE_GSP || '' };
}

// Generic adapter for GSPs that expose the NIC IRP API as-is behind their own
// base URL (the common "pass-through" style): an auth call that returns an
// AuthToken, then POST /eicore/v1.03/Invoice with NIC headers. Providers that
// differ get their own adapter below.
const passThroughNic = {
  async authenticate(env, fetchImpl) {
    const res = await fetchImpl(`${env.EINVOICE_BASE_URL}/eivital/v1.04/auth`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        client_id: env.EINVOICE_CLIENT_ID,
        client_secret: env.EINVOICE_CLIENT_SECRET,
        gstin: env.EINVOICE_GSTIN,
      },
      body: JSON.stringify({ UserName: env.EINVOICE_USERNAME, Password: env.EINVOICE_PASSWORD, ForceRefreshAccessToken: false }),
    });
    const body = await res.json().catch(() => ({}));
    const token = body?.Data?.AuthToken || body?.data?.AuthToken;
    if (!res.ok || !token) throw new GspError('GSP login failed', body);
    return token;
  },
  async generateIrn(payload, env, fetchImpl) {
    const token = await this.authenticate(env, fetchImpl);
    const res = await fetchImpl(`${env.EINVOICE_BASE_URL}/eicore/v1.03/Invoice`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        client_id: env.EINVOICE_CLIENT_ID,
        client_secret: env.EINVOICE_CLIENT_SECRET,
        gstin: env.EINVOICE_GSTIN,
        user_name: env.EINVOICE_USERNAME,
        AuthToken: token,
      },
      body: JSON.stringify(payload),
    });
    const body = await res.json().catch(() => ({}));
    const data = body?.Data || body?.data;
    if (!res.ok || !data?.Irn) {
      const msg = body?.ErrorDetails?.map?.((e) => `${e.ErrorCode}: ${e.ErrorMessage}`).join('; ') || body?.message || 'IRN generation failed';
      throw new GspError(msg, body);
    }
    return {
      irn: data.Irn,
      ackNo: String(data.AckNo || ''),
      ackDate: data.AckDt || '',
      signedInvoice: data.SignedInvoice || '',
      signedQrCode: data.SignedQRCode || '',
      ewbNo: data.EwbNo || null,
    };
  },
};

const ADAPTERS = {
  'nic-passthrough': passThroughNic,
};

async function generateIrn(payload, { env = process.env, fetchImpl = globalThis.fetch } = {}) {
  const cfg = config(env);
  if (!cfg.configured) throw new GspNotConfiguredError(cfg.missing);
  const adapter = ADAPTERS[cfg.provider];
  if (!adapter) throw new GspNotConfiguredError([`EINVOICE_GSP must be one of: ${Object.keys(ADAPTERS).join(', ')}`]);
  return adapter.generateIrn(payload, env, fetchImpl);
}

module.exports = { generateIrn, config, GspNotConfiguredError, GspError, ADAPTERS };
