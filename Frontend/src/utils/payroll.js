// Payroll, Tally style: employee pay structures, a monthly run with paid-day
// pro-rating, statutory deductions (PF, ESI, professional tax, TDS) and the
// journal it posts to the books.
import { round2 } from "./gst.js";

export const PF_RATE = 0.12; // employee and employer, on basic
export const PF_WAGE_CEILING = 15000; // statutory wage ceiling for PF
export const ESI_EMPLOYEE_RATE = 0.0075;
export const ESI_EMPLOYER_RATE = 0.0325;
export const ESI_GROSS_LIMIT = 21000; // ESI applies when monthly gross ≤ this

const n = (v) => {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
};

export const daysInMonth = (ym) => {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m, 0).getDate();
};

// One employee's payslip for a month.
// `employee`: { basic, hra, otherAllowances, pfEnabled, esiEnabled, professionalTax, tdsMonthly }
// `attendance`: { paidDays }
export function computePayslip(employee, ym, attendance = {}) {
  const totalDays = daysInMonth(ym);
  const paidDays = Math.min(totalDays, Math.max(0, attendance.paidDays === undefined || attendance.paidDays === "" ? totalDays : n(attendance.paidDays)));
  const factor = totalDays ? paidDays / totalDays : 0;

  const basic = round2(n(employee.basic) * factor);
  const hra = round2(n(employee.hra) * factor);
  const other = round2(n(employee.otherAllowances) * factor);
  const gross = round2(basic + hra + other);

  const pfWage = Math.min(basic, PF_WAGE_CEILING);
  const pfEmployee = employee.pfEnabled ? Math.round(pfWage * PF_RATE) : 0;
  const pfEmployer = employee.pfEnabled ? Math.round(pfWage * PF_RATE) : 0;

  // ESI eligibility is judged on the full monthly gross in the pay structure.
  const structureGross = n(employee.basic) + n(employee.hra) + n(employee.otherAllowances);
  const esiApplies = employee.esiEnabled && structureGross <= ESI_GROSS_LIMIT;
  const esiEmployee = esiApplies ? Math.ceil(gross * ESI_EMPLOYEE_RATE) : 0;
  const esiEmployer = esiApplies ? Math.ceil(gross * ESI_EMPLOYER_RATE) : 0;

  const professionalTax = paidDays > 0 ? n(employee.professionalTax) : 0;
  const tds = paidDays > 0 ? n(employee.tdsMonthly) : 0;
  const totalDeductions = round2(pfEmployee + esiEmployee + professionalTax + tds);
  const netPay = round2(gross - totalDeductions);

  return {
    employeeId: employee.id,
    name: employee.name,
    designation: employee.designation || "",
    ym,
    totalDays,
    paidDays,
    earnings: { basic, hra, other, gross },
    deductions: { pfEmployee, esiEmployee, professionalTax, tds, total: totalDeductions },
    employer: { pfEmployer, esiEmployer, total: pfEmployer + esiEmployer },
    netPay,
    costToCompany: round2(gross + pfEmployer + esiEmployer),
  };
}

export function computePayrollRun(employees, ym, attendanceById = {}) {
  const slips = employees.filter((e) => e.active !== false).map((e) => computePayslip(e, ym, attendanceById[e.id]));
  const sum = (fn) => round2(slips.reduce((s, x) => s + fn(x), 0));
  return {
    ym,
    slips,
    totals: {
      gross: sum((x) => x.earnings.gross),
      pfEmployee: sum((x) => x.deductions.pfEmployee),
      pfEmployer: sum((x) => x.employer.pfEmployer),
      esiEmployee: sum((x) => x.deductions.esiEmployee),
      esiEmployer: sum((x) => x.employer.esiEmployer),
      professionalTax: sum((x) => x.deductions.professionalTax),
      tds: sum((x) => x.deductions.tds),
      netPay: sum((x) => x.netPay),
      ctc: sum((x) => x.costToCompany),
    },
  };
}

// Journal lines (for utils/accounting.js) for a saved run.
export function payrollJournalLines(totals) {
  return [
    { ledger: "Salaries & Wages", group: "Indirect Expenses", dr: totals.gross, cr: 0 },
    { ledger: "Employer PF Contribution", group: "Indirect Expenses", dr: totals.pfEmployer, cr: 0 },
    { ledger: "Employer ESI Contribution", group: "Indirect Expenses", dr: totals.esiEmployer, cr: 0 },
    { ledger: "Salary Payable", group: "Current Liabilities", dr: 0, cr: totals.netPay },
    { ledger: "PF Payable", group: "Duties & Taxes", dr: 0, cr: round2(totals.pfEmployee + totals.pfEmployer) },
    { ledger: "ESI Payable", group: "Duties & Taxes", dr: 0, cr: round2(totals.esiEmployee + totals.esiEmployer) },
    { ledger: "Professional Tax Payable", group: "Duties & Taxes", dr: 0, cr: totals.professionalTax },
    { ledger: "TDS on Salary Payable", group: "Duties & Taxes", dr: 0, cr: totals.tds },
  ].filter((l) => l.dr > 0.005 || l.cr > 0.005);
}
