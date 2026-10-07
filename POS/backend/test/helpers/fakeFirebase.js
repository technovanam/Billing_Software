// Minimal in-memory stand-ins for Firestore and Firebase Auth, enough for the
// POS and auth code paths (doc/collection refs, where('==') queries, add,
// merge sets, and transactions that apply writes on commit).
const crypto = require('crypto');

function clone(v) {
  return v === undefined ? undefined : JSON.parse(JSON.stringify(v));
}

function createFakeFirestore() {
  const store = new Map(); // path -> data

  function snap(path) {
    const data = store.get(path);
    const id = path.split('/').pop();
    return { id, exists: data !== undefined, data: () => clone(data), ref: docRef(path) };
  }

  function write(path, data, opts = {}) {
    const next = opts.merge ? { ...(store.get(path) || {}), ...clone(data) } : clone(data);
    store.set(path, next);
  }

  function docRef(path) {
    return {
      id: path.split('/').pop(),
      path,
      get: async () => snap(path),
      set: async (data, opts) => write(path, data, opts),
      update: async (data) => {
        if (!store.has(path)) throw Object.assign(new Error(`No document to update: ${path}`), { code: 5 });
        write(path, data, { merge: true });
      },
      delete: async () => {
        store.delete(path);
      },
      collection: (name) => collectionRef(`${path}/${name}`),
    };
  }

  function listDocs(colPath) {
    const depth = colPath.split('/').length + 1;
    return [...store.keys()].filter((k) => k.startsWith(`${colPath}/`) && k.split('/').length === depth).sort();
  }

  function query(colPath, filters) {
    return {
      where: (field, op, value) => query(colPath, [...filters, [field, op, value]]),
      get: async () => {
        const docs = listDocs(colPath)
          .map(snap)
          .filter((s) => filters.every(([f, op, v]) => op === '==' && s.data()[f] === v));
        return { docs, empty: docs.length === 0, size: docs.length };
      },
    };
  }

  function collectionRef(path) {
    return {
      path,
      doc: (id) => docRef(`${path}/${id || crypto.randomBytes(10).toString('hex')}`),
      add: async (data) => {
        const ref = docRef(`${path}/${crypto.randomBytes(10).toString('hex')}`);
        await ref.set(data);
        return ref;
      },
      where: (f, op, v) => query(path, [[f, op, v]]),
      get: () => query(path, []).get(),
    };
  }

  return {
    store,
    collection: (name) => collectionRef(name),
    doc: (path) => docRef(path),
    async runTransaction(fn) {
      const writes = [];
      const tx = {
        get: async (ref) => snap(ref.path),
        set: (ref, data, opts) => writes.push(() => write(ref.path, data, opts)),
        update: (ref, data) => writes.push(() => write(ref.path, data, { merge: true })),
        delete: (ref) => writes.push(() => store.delete(ref.path)),
      };
      const result = await fn(tx);
      writes.forEach((w) => w());
      return result;
    },
    dump: (prefix = '') => Object.fromEntries([...store.entries()].filter(([k]) => k.startsWith(prefix))),
  };
}

// Tokens are opaque strings mapped to decoded claims. Revocation mirrors
// Firebase: revokeRefreshTokens marks the user; verifyIdToken(token, true)
// then rejects tokens issued before it.
function createFakeAuth({ now = () => Date.now() } = {}) {
  const tokens = new Map();
  const revokedAt = new Map();
  const revokeCalls = [];
  const customTokens = [];
  let n = 0;
  return {
    revokeCalls,
    customTokens,
    issue(claims) {
      const token = `tok_${(n += 1)}`;
      tokens.set(token, { ...claims, iat: Math.floor(now() / 1000) });
      return token;
    },
    async verifyIdToken(token, checkRevoked = false) {
      const decoded = tokens.get(token);
      if (!decoded) throw Object.assign(new Error('bad token'), { code: 'auth/argument-error' });
      if (checkRevoked && revokedAt.has(decoded.uid) && decoded.iat <= revokedAt.get(decoded.uid)) {
        throw Object.assign(new Error('revoked'), { code: 'auth/id-token-revoked' });
      }
      return { ...decoded };
    },
    async revokeRefreshTokens(uid) {
      revokeCalls.push(uid);
      revokedAt.set(uid, Math.floor(now() / 1000));
    },
    async createCustomToken(uid, claims) {
      customTokens.push({ uid, claims });
      return `custom_${uid}`;
    },
  };
}

module.exports = { createFakeFirestore, createFakeAuth };
