// Full rebuild of one business's stats from its invoices, POS bills and aiLogs,
// and the nightly job that rebuilds every business with new activity.
const admin = require('firebase-admin');
const cron = require('node-cron');
const { businessCollections, getBusinessRef } = require('../businessRef');
const { toProductRecord, toCustomerRecord } = require('../matcher');
const { buildStats } = require('./statsModel');

const NIGHTLY_CRON = '30 2 * * *';
const TIMEZONE = 'Asia/Kolkata';

const docsOf = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }));

async function rebuildBusiness(businessId, { statsStore, now = new Date() }) {
  const [products, customers, invoices, logs] = await Promise.all([
    businessCollections.products(businessId).get(),
    businessCollections.customers(businessId).get(),
    businessCollections.invoices(businessId).get(),
    businessCollections.aiLogs(businessId).where('type', 'in', ['command', 'alias_saved', 'pick_signal']).get(),
  ]);
  const stats = buildStats({
    invoices: docsOf(invoices),
    logs: docsOf(logs),
    products: docsOf(products).map(toProductRecord),
    customers: docsOf(customers).map(toCustomerRecord),
    now,
  });
  await statsStore.replace(businessId, stats);
  return { invoices: invoices.size, billsUsed: stats.meta.bills };
}

// True when the business has bills or AI activity newer than its last build.
async function needsRebuild(businessId) {
  const summary = await getBusinessRef(businessId).collection('aiStats').doc('summary').get();
  const builtAt = summary.exists ? summary.data().meta?.builtAt : null;
  const invoices = businessCollections.invoices(businessId);
  if (!builtAt) return !(await invoices.limit(1).get()).empty;
  const since = admin.firestore.Timestamp.fromDate(new Date(builtAt));
  const checks = await Promise.all([
    invoices.where('createdAt', '>=', builtAt).limit(1).get(),
    invoices.where('createdAt', '>=', since).limit(1).get(),
    businessCollections.aiLogs(businessId).where('createdAt', '>=', since).limit(1).get(),
  ]);
  return checks.some((snap) => !snap.empty);
}

async function runNightlyRebuild({ statsStore }) {
  const started = Date.now();
  const refs = await admin.firestore().collection('users').listDocuments();
  let rebuilt = 0;
  let failed = 0;
  for (const ref of refs) {
    try {
      if (await needsRebuild(ref.id)) {
        await rebuildBusiness(ref.id, { statsStore });
        rebuilt += 1;
      }
    } catch (err) {
      failed += 1;
      console.error(`aiStats nightly rebuild failed for ${ref.id}:`, err.message);
    }
  }
  console.log(`aiStats nightly rebuild: ${rebuilt} rebuilt, ${failed} failed, ${refs.length} checked in ${Date.now() - started} ms`);
  return { rebuilt, failed, checked: refs.length };
}

function startNightlyRebuild({ statsStore }) {
  return cron.schedule(
    NIGHTLY_CRON,
    () => runNightlyRebuild({ statsStore }).catch((err) => console.error('aiStats nightly job error:', err.message)),
    { timezone: TIMEZONE }
  );
}

module.exports = { rebuildBusiness, needsRebuild, runNightlyRebuild, startNightlyRebuild, NIGHTLY_CRON, TIMEZONE };
