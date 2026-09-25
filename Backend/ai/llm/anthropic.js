// Anthropic adapter: returns the parsed command plus token usage.
const Anthropic = require('@anthropic-ai/sdk');
const { zodOutputFormat } = require('@anthropic-ai/sdk/helpers/zod');
const { ParsedCommandSchema } = require('../schema');
const { SYSTEM_PROMPT, buildUserMessage } = require('../prompt');

function createAnthropicProvider({ apiKey, model }) {
  const client = new Anthropic({ apiKey, timeout: 15_000, maxRetries: 1 });

  return {
    name: 'anthropic',
    model,
    async parseCommand({ text, context, draftItemNames }) {
      const response = await client.messages.parse({
        model,
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: buildUserMessage({ text, context, draftItemNames }) }],
        output_config: { format: zodOutputFormat(ParsedCommandSchema) },
      });

      if (response.stop_reason === 'refusal') {
        const err = new Error('The AI provider declined this command.');
        err.code = 'AI_REFUSED';
        throw err;
      }
      if (response.stop_reason === 'max_tokens' || !response.parsed_output) {
        const err = new Error('The AI provider returned an incomplete reply.');
        err.code = 'AI_BAD_OUTPUT';
        throw err;
      }

      return {
        parsed: response.parsed_output,
        usage: {
          inputTokens: response.usage?.input_tokens || 0,
          outputTokens: response.usage?.output_tokens || 0,
        },
      };
    },
  };
}

module.exports = { createAnthropicProvider };
