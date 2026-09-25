// /api/ai routes: command parsing, alias management and AI log updates.
const express = require('express');
const admin = require('firebase-admin');
const { z } = require('zod');
const { requireVerifiedUser } = require('./auth');
const { ParseRequestSchema } = require('./schema');
const { resolveRole, canUseContext, canRunIntent, canManageAliases } = require('./permissions');
const { normalizeText, DEFAULT_THRESHOLD } = require('./matcher');
const { createCatalogCache } = require('./catalogCache');
const { createUserRateLimiter } = require('./rateLimit');
const { getFallbackProvider } = require('./llm');
const { runCommand, localThreshold } = require('./pipeline');
const { createLearning } = require('./learning');
const aiLog = require('./aiLog');
const { businessCollections } = require('./businessRef');

const MAX_ALIASES_PER_PRODUCT = 25;

const AliasSaveSchema = z.object({
  productId: z.string().min(1).max(128),
  alias: z.string().trim().min(2).max(60),
  source: z.enum(['invoice', 'pos']),
  commandLogId: z.string().max(128).optional().nullable(),
  customerId: z.string().max(128).optional().nullable(),
});

const AliasRemoveSchema = z.object({
  productId: z.string().min(1).max(128),
  alias: z.string().trim().min(1).max(60),
});

const CorrectionSchema = z
  .object({
    type: z.string().max(40),
    itemKey: z.string().max(64).optional().nullable(),
    spokenName: z.string().max(120).optional().nullable(),
    from: z.any().optional(),
    to: z.any().optional(),
  })
  .refine((c) => JSON.stringify(c).length <= 1024, 'correction too large');

const LogUpdateSchema = z.object({
  context: z.enum(['invoice', 'pos']),
  logIds: z.array(z.string().min(1).max(128)).min(1).max(50),
  corrections: z.array(CorrectionSchema).max(100).optional(),
  finalInvoiceId: z.string().max(128).optional().nullable(),
  status: z.enum(['confirmed', 'saved', 'discarded']).optional(),
  // What the user confirmed: ids and quantities only, never prices.
  finalDraft: z
    .object({
      customerId: z.string().max(128).nullable().optional(),
      customerName: z.string().max(120).nullable().optional(),
      items: z
        .array(
          z.object({
            key: z.string().max(64),
            productId: z.string().max(128).nullable(),
            productName: z.string().max(200).nullable().optional(),
            qty: z.number().nullable(),
            spokenName: z.string().max(120).nullable().optional(),
          })
        )
        .max(100),
    })
    .optional()
    .nullable(),
});

function createAiRouter({
  getFallback = getFallbackProvider,
  catalogCache = createCatalogCache(),
  learning = null,
  rateLimiter = createUserRateLimiter({ limit: Number(process.env.AI_RATE_LIMIT_PER_MIN) || 20 }),
  logger = aiLog,
} = {}) {
  const router = express.Router();
  const threshold = Number(process.env.AI_MATCH_THRESHOLD) || DEFAULT_THRESHOLD;
  const localConfidence = localThreshold();
  const learn = learning || createLearning({ catalogCache });
  router.learning = learn;

  router.use(requireVerifiedUser);

  function limit(req, res, next) {
    const { allowed, retryAfterSec } = rateLimiter.check(req.aiUser.uid);
    if (allowed) return next();
    res.set('Retry-After', String(retryAfterSec));
    return res.status(429).json({ error: `Too many AI requests. Try again in ${retryAfterSec}s.` });
  }

  router.post('/parse-command', limit, async (req, res) => {
    const started = Date.now();
    const body = ParseRequestSchema.safeParse(req.body);
    if (!body.success) return res.status(400).json({ error: 'Invalid command request.' });
    const { text, context, currentDraft, sessionId } = body.data;
    const user = req.aiUser;
    const role = resolveRole({ email: user.email, context });
    const businessId = user.uid;

    if (!canUseContext(role, context)) {
      return res.status(403).json({ error: 'Your role cannot create bills here.' });
    }

    let catalog;
    try {
      catalog = await catalogCache.get(businessId);
    } catch (err) {
      console.error('AI catalogue load failed:', err);
      return res.status(503).json({ error: 'Could not load your products. Please try again.' });
    }

    // A misconfigured fallback must not stop local parsing.
    let fallback = null;
    let fallbackError = null;
    try {
      fallback = getFallback();
    } catch (err) {
      fallbackError = err.code || 'AI_NOT_CONFIGURED';
      console.error('AI fallback not available:', err.message);
    }

    const ranking = await learn.rankingFor(businessId);
    const run = await runCommand({ text, context, currentDraft, catalog, ranking, fallback, fallbackError, threshold: localConfidence, matchThreshold: threshold });
    const { result, parsed } = run;
    const latencyMs = Date.now() - started;
    const logBase = {
      businessId, user, role, context, sessionId, text, parsed,
      path: run.path, localConfidence: run.localConfidence, lowConfidence: run.lowConfidence, fallbackError: run.fallbackError,
      draftItemNames: run.draftItemNames, usage: run.usage, provider: run.provider, model: run.model, latencyMs,
    };

    if (!canRunIntent(role, result.intent)) {
      const logId = await logger.logCommand({ ...logBase, intent: result.intent, error: 'FORBIDDEN_INTENT' }).catch(() => null);
      return res.status(403).json({ error: 'Your role is not allowed to do that from here.', logId });
    }

    let logId = null;
    try {
      logId = await logger.logCommand({
        ...logBase,
        intent: result.intent, draft: result.draft, clarification: result.clarification, messages: result.messages,
        itemKeys: result.createdItemKeys,
      });
    } catch (err) {
      console.error('AI log write failed:', err.message);
    }

    return res.json({
      logId,
      intent: result.intent,
      draft: result.draft,
      clarification: result.clarification,
      messages: result.messages,
      path: run.path,
      latencyMs,
    });
  });

  router.post('/aliases', limit, async (req, res) => {
    const body = AliasSaveSchema.safeParse(req.body);
    if (!body.success) return res.status(400).json({ error: 'Invalid alias.' });
    const { productId, source, commandLogId, customerId } = body.data;
    const alias = normalizeText(body.data.alias);
    const user = req.aiUser;
    const role = resolveRole({ email: user.email, context: source });
    const businessId = user.uid;
    if (!canUseContext(role, source)) return res.status(403).json({ error: 'Your role cannot save aliases.' });
    if (alias.length < 2) return res.status(400).json({ error: 'Alias is too short.' });

    const products = businessCollections.products(businessId);
    const productRef = products.doc(productId);
    try {
      let aliasSaved = true;
      const productName = await admin.firestore().runTransaction(async (tx) => {
        const snap = await tx.get(productRef);
        if (!snap.exists) throw Object.assign(new Error('Product not found.'), { status: 404 });
        const data = snap.data();
        if (normalizeText(data.name) === alias) {
          aliasSaved = false; // the name already matches exactly; only the pick is learned
          return data.name;
        }
        const aliases = Array.isArray(data.aliases) ? data.aliases : [];
        if (!aliases.includes(alias) && aliases.length >= MAX_ALIASES_PER_PRODUCT) {
          throw Object.assign(new Error('This product already has the maximum number of aliases.'), { status: 409 });
        }
        // An alias points to one product only; move it if another product had it.
        const others = await tx.get(products.where('aliases', 'array-contains', alias));
        others.docs.filter((d) => d.id !== productId).forEach((d) => tx.update(d.ref, { aliases: admin.firestore.FieldValue.arrayRemove(alias) }));
        tx.update(productRef, { aliases: admin.firestore.FieldValue.arrayUnion(alias) });
        return data.name;
      });
      learn.recordPick(businessId, alias, productId);
      if (aliasSaved) catalogCache.invalidate(businessId);
      await logger
        .logAliasEvent({ businessId, user, role, action: aliasSaved ? 'saved' : 'pick', source, productId, productName, alias, commandLogId, customerId })
        .catch((e) => console.error('Alias log failed:', e.message));
      return res.json({ ok: true, alias, aliasSaved });
    } catch (err) {
      if (err.status) return res.status(err.status).json({ error: err.message });
      console.error('Alias save failed:', err);
      return res.status(500).json({ error: 'Could not save the alias.' });
    }
  });

  router.delete('/aliases', limit, async (req, res) => {
    const body = AliasRemoveSchema.safeParse(req.body);
    if (!body.success) return res.status(400).json({ error: 'Invalid alias.' });
    const user = req.aiUser;
    const role = resolveRole({ email: user.email, context: 'products' });
    if (!canManageAliases(role)) return res.status(403).json({ error: 'Only the business owner can remove aliases.' });
    const businessId = user.uid;
    const alias = normalizeText(body.data.alias);
    const productRef = businessCollections.products(businessId).doc(body.data.productId);
    try {
      const snap = await productRef.get();
      if (!snap.exists) return res.status(404).json({ error: 'Product not found.' });
      await productRef.update({ aliases: admin.firestore.FieldValue.arrayRemove(alias) });
      catalogCache.invalidate(businessId);
      await logger.logAliasEvent({ businessId, user, role, action: 'removed', source: 'products', productId: snap.id, productName: snap.data().name, alias }).catch((e) => console.error('Alias log failed:', e.message));
      return res.json({ ok: true });
    } catch (err) {
      console.error('Alias remove failed:', err);
      return res.status(500).json({ error: 'Could not remove the alias.' });
    }
  });

  router.post('/logs/update', limit, async (req, res) => {
    const body = LogUpdateSchema.safeParse(req.body);
    if (!body.success) return res.status(400).json({ error: 'Invalid log update.' });
    const user = req.aiUser;
    const role = resolveRole({ email: user.email, context: body.data.context });
    if (!canUseContext(role, body.data.context)) return res.status(403).json({ error: 'Not allowed.' });
    try {
      const updated = await logger.updateCommandLogs({ businessId: user.uid, userId: user.uid, ...body.data });
      return res.json({ ok: true, updated });
    } catch (err) {
      console.error('AI log update failed:', err);
      return res.status(500).json({ error: 'Could not update the AI log.' });
    }
  });

  return router;
}

module.exports = { createAiRouter };
