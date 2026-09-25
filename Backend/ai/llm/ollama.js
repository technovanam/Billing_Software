// Self-hosted model through Ollama's OpenAI-compatible API
// (POST {AI_OLLAMA_URL}/v1/chat/completions). The reply is validated with the
// same zod schema as every other provider.
const { z } = require('zod');
const { ParsedCommandSchema } = require('../schema');
const { SYSTEM_PROMPT, buildUserMessage } = require('../prompt');

const JSON_SCHEMA = (() => {
  const schema = z.toJSONSchema(ParsedCommandSchema);
  delete schema.$schema;
  return schema;
})();

function extractJson(content) {
  const text = String(content || '').trim();
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start < 0 || end <= start) throw Object.assign(new Error('Ollama reply had no JSON object.'), { code: 'AI_BAD_OUTPUT' });
  return JSON.parse(body.slice(start, end + 1));
}

function createOllamaProvider({ baseUrl, model, apiKey = null, timeoutMs = 20000, fetchImpl = fetch }) {
  const url = `${String(baseUrl).replace(/\/+$/, '')}/v1/chat/completions`;

  return {
    name: 'ollama',
    model,
    async parseCommand({ text, context, draftItemNames }) {
      const headers = { 'content-type': 'application/json' };
      if (apiKey) headers.authorization = `Bearer ${apiKey}`;
      let res;
      try {
        res = await fetchImpl(url, {
          method: 'POST',
          headers,
          signal: AbortSignal.timeout(timeoutMs),
          body: JSON.stringify({
            model,
            temperature: 0,
            stream: false,
            messages: [
              { role: 'system', content: `${SYSTEM_PROMPT}\n\nReply with one JSON object only, matching the given schema.` },
              { role: 'user', content: buildUserMessage({ text, context, draftItemNames }) },
            ],
            response_format: { type: 'json_schema', json_schema: { name: 'billing_command', strict: true, schema: JSON_SCHEMA } },
          }),
        });
      } catch (err) {
        throw Object.assign(new Error(`Ollama request failed: ${err.message}`), { code: 'AI_UNAVAILABLE' });
      }
      if (!res.ok) {
        throw Object.assign(new Error(`Ollama returned HTTP ${res.status}`), { code: res.status >= 500 ? 'AI_UNAVAILABLE' : 'AI_BAD_REQUEST' });
      }
      const data = await res.json();
      let raw;
      try {
        raw = extractJson(data?.choices?.[0]?.message?.content);
      } catch (err) {
        throw Object.assign(new Error(err.message), { code: 'AI_BAD_OUTPUT' });
      }
      const checked = ParsedCommandSchema.safeParse(raw);
      if (!checked.success) throw Object.assign(new Error('Ollama reply failed validation.'), { code: 'AI_BAD_OUTPUT' });
      return {
        parsed: checked.data,
        usage: {
          inputTokens: data?.usage?.prompt_tokens || 0,
          outputTokens: data?.usage?.completion_tokens || 0,
        },
      };
    },
  };
}

module.exports = { createOllamaProvider, extractJson };
