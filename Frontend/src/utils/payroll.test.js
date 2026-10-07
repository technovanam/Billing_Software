// Run with: node --test src/utils/payroll.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { computePayslip, computePayrollRun, payrollJournalLines, daysInMonth } from "./payroll.js";

const asha = { id: "e1", name: "Asha", basic: 12000, hra: 4800, otherAllowances: 2000, pfEnabled: true, esiEnabled: true, professionalTax: 200, tdsMonthly: 0 };
const ravi = { id: "e2", name: "Ravi", basic: 40000, hra: 16000, otherAllowances: 4000, pfEnabled: true, esiEnabled: true, professionalTax: 200, tdsMonthly: 3000 };

test("days in month", () => {
  assert.equal(daysInMonth("2026-02"), 28);
  assert.equal(daysInMonth("2026-10"), 31);
});

test("full month payslip with PF and ESI", () => {
  const s = computePayslip(asha, "2026-10");
  assert.equal(s.earnings.gross, 18800);
  assert.equal(s.deductions.pfEmployee, 1440); // 12% of 12,000
  assert.equal(s.deductions.esiEmployee, 141); // 0.75% of 18,800 rounded up
  assert.equal(s.employer.esiEmployer, 611); // 3.25% of 18,800 rounded up
  assert.equal(s.netPay, 18800 - 1440 - 141 - 200);
});

test("PF capped at the wage ceiling; no ESI above ₹21,000 gross", () => {
  const s = computePayslip(ravi, "2026-10");
  assert.equal(s.deductions.pfEmployee, 1800); // 12% of 15,000
  assert.equal(s.deductions.esiEmployee, 0);
  assert.equal(s.netPay, 60000 - 1800 - 200 - 3000);
});

test("loss of pay pro-rates earnings by paid days", () => {
  const s = computePayslip(asha, "2026-10", { paidDays: 15.5 });
  assert.equal(s.earnings.basic, 6000);
  assert.equal(s.earnings.gross, 9400);
});

test("payroll journal balances", () => {
  const run = computePayrollRun([asha, ravi], "2026-10");
  const lines = payrollJournalLines(run.totals);
  const dr = lines.reduce((s, l) => s + l.dr, 0);
  const cr = lines.reduce((s, l) => s + l.cr, 0);
  assert.ok(Math.abs(dr - cr) < 0.01, `${dr} vs ${cr}`);
  assert.equal(run.totals.gross, 78800);
});
