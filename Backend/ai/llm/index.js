// Picks the fallback model used when the local parser is not confident.
// AI_FALLBACK = none (default) | ollama. No third-party AI service is used:
// "none" keeps everything in the local parser, and "ollama" is a model you
// run yourself. Every provider exposes
// parseCommand({ text, context, draftItemNames }) -> { parsed, usage }.
const { createOllamaProvider } = require('./ollama');

function configError(message) {
  return Object.assign(new Error(message), { code: 'AI_NOT_CONFIGURED' });
}

let cached;

function buildProvider(name, env) {
  switch (name) {
    case 'none':
      return null;
    case 'ollama':
      if (!env.AI_OLLAMA_URL || !env.AI_OLLAMA_MODEL) throw configError('AI_FALLBACK=ollama needs AI_OLLAMA_URL and AI_OLLAMA_MODEL in Backend/.env.');
      return createOllamaProvider({ baseUrl: env.AI_OLLAMA_URL, model: env.AI_OLLAMA_MODEL, apiKey: env.AI_OLLAMA_API_KEY || null });
    default:
      throw configError(`Unsupported AI_FALLBACK "${name}". Use none or ollama.`);
  }
}

// Returns the configured provider, or null for "none". Throws on bad config.
function getFallbackProvider(env = process.env) {
  if (env !== process.env) return buildProvider((env.AI_FALLBACK || 'none').toLowerCase(), env);
  if (cached === undefined) cached = buildProvider((env.AI_FALLBACK || 'none').toLowerCase(), env);
  return cached;
}

module.exports = { getFallbackProvider, buildProvider };
