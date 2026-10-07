const { test } = require('node:test');
const assert = require('node:assert/strict');
const rc = require('../../gst/returnsClient');

const env = {
  GSTR_GSP: 'gstn-passthrough',
  GSTR_BASE_URL: 'https://gsp.example',
  GSTR_CLIENT_ID: 'id',
  GSTR_CLIENT_SECRET: 'secret',
  GSTR_GSTIN: '33AMWPB2116Q1ZS',
  GSTR_USERNAME: 'taxpayer',
};
const reply = (status, body) => Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) });

test('not configured: nothing is sent', async () => {
  let called = false;
  await assert.rejects(rc.requestOtp('u1', { env: {}, fetchImpl: () => { called = true; } }), (e) => e instanceof rc.ReturnsNotConfiguredError && e.missing.includes('GSTR_GSP'));
  assert.equal(called, false);
});

test('OTP -> session -> GSTR-1 save', async () => {
  const calls = [];
  const fetchImpl = (url, opts) => {
    const body = JSON.parse(opts.body);
    calls.push({ url, body, headers: opts.headers });
    if (body.action === 'OTPREQUEST') return reply(200, { status_cd: '1' });
    if (body.action === 'AUTHTOKEN') return reply(200, { status_cd: '1', auth_token: 'tok', expiry: 360 });
    return reply(200, { status_cd: '1', reference_id: 'REF123' });
  };
  await rc.requestOtp('u2', { env, fetchImpl });
  await rc.verifyOtp('u2', '575757', { env, fetchImpl });
  const r = await rc.uploadGstr1('u2', '102026', { gstin: env.GSTR_GSTIN, fp: '102026', b2b: [] }, { env, fetchImpl });
  assert.equal(r.referenceId, 'REF123');
  assert.equal(calls[2].headers['auth-token'], 'tok');
  assert.equal(calls[2].headers.ret_period, '102026');
  assert.equal(calls[2].body.action, 'RETSAVE');
});

test('expired session and wrong GSTIN are refused', async () => {
  const fetchImpl = () => reply(200, { status_cd: '1', auth_token: 'tok', expiry: 1 });
  let t = 0;
  await rc.verifyOtp('u3', '123456', { env, fetchImpl, now: () => t });
  t = 61 * 1000;
  await assert.rejects(rc.uploadGstr1('u3', '102026', {}, { env, fetchImpl, now: () => t }), /expired/);
  t = 0;
  await assert.rejects(rc.uploadGstr1('u3', '102026', { gstin: '29ABCDE1234F1Z5' }, { env, fetchImpl, now: () => t }), /different GSTIN/);
});

test('GSTN errors come back readable', async () => {
  const fetchImpl = () => reply(200, { status_cd: '0', error: { message: 'Invalid OTP', error_cd: 'AUTH4033' } });
  await assert.rejects(rc.verifyOtp('u4', '111111', { env, fetchImpl }), /Invalid OTP/);
});
