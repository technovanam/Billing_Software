// Per-user sliding-window limiter for AI endpoints (keyed by Firebase uid, not IP,
// so a whole shop behind one router is not throttled together).
function createUserRateLimiter({ limit, windowMs = 60 * 1000, now = () => Date.now() }) {
  const hits = new Map();

  function check(key) {
    const t = now();
    const recent = (hits.get(key) || []).filter((ts) => t - ts < windowMs);
    if (recent.length >= limit) {
      hits.set(key, recent);
      return { allowed: false, retryAfterSec: Math.ceil((windowMs - (t - recent[0])) / 1000) };
    }
    recent.push(t);
    hits.set(key, recent);
    return { allowed: true, retryAfterSec: 0 };
  }

  const timer = setInterval(() => {
    const t = now();
    for (const [key, list] of hits) {
      if (!list.some((ts) => t - ts < windowMs)) hits.delete(key);
    }
  }, windowMs);
  timer.unref?.();

  return { check };
}

module.exports = { createUserRateLimiter };
