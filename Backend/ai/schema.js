// Shape the LLM must return for a billing command. Used both to constrain the
// model (structured outputs) and to validate its reply before we trust it.
const { z } = require('zod');

const INTENTS = [
  'create_invoice',
  'create_pos_bill',
  'add_item',
  'remove_item',
  'update_qty',
  'set_customer',
  'apply_discount',
  'record_payment',
  'query',
  'unknown',
];

const ParsedCommandSchema = z.object({
  intent: z.enum(INTENTS),
  customer: z
    .object({
      name: z.string(),
      phone: z.string().nullable(),
    })
    .nullable(),
  items: z.array(
    z.object({
      spoken_name: z.string(),
      qty: z.number().nullable(),
      unit: z.string().nullable(),
    })
  ),
  discount: z
    .object({
      type: z.enum(['percent', 'amount']),
      value: z.number(),
    })
    .nullable(),
  payment: z
    .object({
      mode: z.enum(['cash', 'upi', 'card', 'bank']).nullable(),
      amount: z.number().nullable(),
    })
    .nullable(),
  due_in_days: z.number().int().nullable(),
  notes: z.string().nullable(),
  clarification_needed: z.string().nullable(),
});

const ParseRequestSchema = z.object({
  text: z.string().trim().min(1).max(500),
  context: z.enum(['invoice', 'pos']),
  currentDraft: z.any().optional().nullable(),
  sessionId: z.string().max(64).optional().nullable(),
});

module.exports = { INTENTS, ParsedCommandSchema, ParseRequestSchema };
