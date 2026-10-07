// Run with: node --test src/utils/audit.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { auditDiff } from "./audit.js";

test("only changed fields are listed, timestamps ignored", () => {
  const d = auditDiff({ amount: 1180, status: "Unpaid", updatedAt: "x", items: [1] }, { amount: 1000, status: "Unpaid", updatedAt: "y", items: [1], note: "fix" });
  assert.deepEqual(d.map((x) => x.field), ["amount", "note"]);
  assert.equal(d[0].from, "1180");
  assert.equal(d[1].from, "—");
});

test("create and delete show every field once", () => {
  assert.equal(auditDiff(null, { a: 1, b: 2 }).length, 2);
  assert.equal(auditDiff({ a: 1 }, null)[0].to, "—");
});
