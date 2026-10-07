const { test } = require('node:test');
const assert = require('node:assert/strict');
const { generateIrn, config, GspNotConfiguredError, GspError } = require('../../einvoice/gspClient');

const env = {
  EINVOICE_GSP: 'nic-passthrough',
  EINVOICE_BASE_URL: 'https://gsp.example',
  EINVOICE_CLIENT_ID: 'id',
  EINVOICE_CLIENT_SECRET: 'secret',
  EINVOICE_GSTIN: '33AMWPB2116Q1ZS',
  EINVOICE_USERNAME: 'api_user',
  EINVOICE_PASSWORD: 'pw',
};

const reply = (status, body) => Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) });

test('not configured lists the missing settings and sends nothing', async () => {
  assert.equal(config({}).configured, false);
  let called = false;
  await assert.rejects(
    generateIrn({}, { env: {}, fetchImpl: () => { called = true; } }),
    (err) => err instanceof GspNotConfiguredError && err.missing.includes('EINVOICE_GSP')
  );
  assert.equal(called, false);
});

test('logs in, posts the invoice and returns the IRN details', async () => {
  const calls = [];
  const fetchImpl = (url, opts) => {
    calls.push({ url, headers: opts.headers });
    if (url.endsWith('/auth')) return reply(200, { Status: 1, Data: { AuthToken: 'tok' } });
    return reply(200, { Status: 1, Data: { Irn: 'abc123', AckNo: 112010000000123, AckDt: '2026-10-07 12:00:00', SignedQRCode: 'qr', SignedInvoice: 'sig' } });
  };
  const r = await generateIrn({ Version: '1.1' }, { env, fetchImpl });
  assert.equal(r.irn, 'abc123');
  assert.equal(r.ackNo, '112010000000123');
  assert.equal(calls[1].headers.AuthToken, 'tok');
  assert.equal(calls[1].headers.gstin, env.EINVOICE_GSTIN);
});

test('IRP validation errors come back readable', async () => {
  const fetchImpl = (url) =>
    url.endsWith('/auth')
      ? reply(200, { Data: { AuthToken: 'tok' } })
      : reply(200, { Status: 0, ErrorDetails: [{ ErrorCode: '2150', ErrorMessage: 'Duplicate IRN' }] });
  await assert.rejects(generateIrn({}, { env, fetchImpl }), (err) => err instanceof GspError && /2150: Duplicate IRN/.test(err.message));
});
