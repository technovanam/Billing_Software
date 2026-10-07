// Run with: node --test src/utils/advances.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { advanceForSave, advanceTables, newAdvance } from "./advances.js";
import { buildEntries, trialBalance } from "./accounting.js";
import { buildGstr1, buildGstr3b, monthPeriod } from "./gstReturns.js";

const company = { companyName: "Us", state: "Tamil Nadu", gstin: "33ABCDE1234F1Z5" };
const party = { id: "c1", name: "Kaveri", gstin: "33AAAAA1111A1Z1" };

const adv = (over = {}) => ({ id: "a1", ...advanceForSave({ ...newAdvance({ today: new Date("2026-05-10") }), partyId: "c1", party, received: 11800, gstRate: 18 }, company), ...over });

test("advance is split into value and GST, intra-state", () => {
  const a = adv();
  assert.equal(a.taxableAmount, 10000);
  assert.equal(a.cgstAmount, 900);
  assert.equal(a.amount, 11800);
  assert.equal(a.isInterState, false);
});

test("GSTR-1 11A in the month received, 11B in the month adjusted", () => {
  const a = adv({ adjustedDate: "2026-06-05", adjustedInvoiceId: "i1" });
  const may = advanceTables([a], monthPeriod("2026-05"), company);
  assert.equal(may.atTotals.txval, 10000);
  assert.equal(may.atTotals.camt, 900);
  const june = advanceTables([a], monthPeriod("2026-06"), company);
  assert.equal(june.at.length, 0);
  assert.equal(june.txpdTotals.txval, 10000);
  // Received and adjusted in the same month: nothing to report.
  const same = advanceTables([adv({ adjustedDate: "2026-05-20" })], monthPeriod("2026-05"), company);
  assert.equal(same.at.length + same.txpd.length, 0);
  const g1 = buildGstr1({ advances: [a], company, ym: "2026-05" });
  assert.equal(g1.json.at[0].itms[0].ad_amt, 10000);
  assert.equal(g1.summary.at.camt, 900);
  const g3 = buildGstr3b({ advances: [a], company, ym: "2026-06" });
  assert.equal(g3.outward.camt, -900);
});

test("advance books balance and GST on advance clears on adjustment", () => {
  const a = adv({ adjustedDate: "2026-06-05", adjustedInvoiceId: "i1", adjustedInvoiceNumber: "001" });
  const tb = trialBalance(buildEntries({ advances: [a] }));
  assert.equal(tb.balanced, true);
  const row = (l) => tb.rows.find((r) => r.ledger === l);
  assert.equal(row("Bank").debit, 11800);
  assert.equal(row("Kaveri").credit, 11800);
  assert.ok(!row("GST on Advances") || (row("GST on Advances").debit || 0) === 0);
  const open = trialBalance(buildEntries({ advances: [adv()] }));
  assert.equal(open.rows.find((r) => r.ledger === "GST on Advances").debit, 1800);
});
