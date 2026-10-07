// Run with: node --test src/utils/cheque.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { amountInWords, chequeHtml, chequeStage, isStale, chequeJournalLines } from "./cheque.js";
import { buildEntries, trialBalance } from "./accounting.js";

test("amount in words, Indian numbering", () => {
  assert.equal(amountInWords(1234567.5), "Twelve Lakh Thirty Four Thousand Five Hundred Sixty Seven Rupees and Fifty Paise Only");
  assert.equal(amountInWords(25000), "Twenty Five Thousand Rupees Only");
  assert.equal(amountInWords(100000000), "Ten Crore Rupees Only");
  assert.equal(amountInWords(0.75), "Seventy Five Paise Only");
  assert.equal(amountInWords(101), "One Hundred One Rupees Only");
});

test("cheque print has date digits, payee and figures; escapes text", () => {
  const html = chequeHtml({ payee: "A & B <Traders>", amount: 1500, date: "2026-10-07" });
  assert.match(html, /A &amp; B &lt;Traders&gt;/);
  assert.equal((html.match(/class="d"/g) || []).length, 8);
  assert.match(html, /\*\*1,500\.00\/-/);
  assert.match(html, /One Thousand Five Hundred Rupees Only/);
});

test("post-dated, due and stale cheques", () => {
  assert.equal(chequeStage({ chequeDate: "2026-12-01", status: "Pending" }, "2026-10-07"), "Post-dated");
  assert.equal(chequeStage({ chequeDate: "2026-10-01", status: "Pending" }, "2026-10-07"), "Due");
  assert.equal(chequeStage({ chequeDate: "2026-10-01", status: "Cleared" }, "2026-10-07"), "Cleared");
  assert.equal(isStale({ chequeDate: "2026-06-01", status: "Pending" }, "2026-10-07"), true);
  assert.equal(isStale({ chequeDate: "2026-08-01", status: "Pending" }, "2026-10-07"), false);
});

test("cleared cheque journal balances the books", () => {
  const lines = chequeJournalLines({ direction: "issued", partyName: "Steel Co", amount: 5000, account: "HDFC Current" });
  const tb = trialBalance(buildEntries({ journals: [{ id: "j", voucherDate: "2026-10-07", voucherType: "Payment", lines }] }));
  assert.equal(tb.balanced, true);
  assert.equal(tb.rows.find((r) => r.ledger === "Steel Co").debit, 5000);
});
