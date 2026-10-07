// Payroll: employees, monthly salary run (paid days, PF, ESI, PT, TDS),
// payslips, and the salary journal posted to the books.
import { useMemo, useState } from "react";
import { Plus, Pencil, Trash2, X, Users, Calculator, History, Printer, Save, IndianRupee } from "lucide-react";
import { useVouchers, useCostCentres } from "../../hooks/useFirestore";
import { useCompanyProfile } from "../../context/CompanyProfileContext";
import { useToast } from "../../context/ToastContext";
import { computePayrollRun, payrollJournalLines, daysInMonth } from "../../utils/payroll.js";
import { sellerAddressLines } from "../../utils/gst.js";

const TABS = [
  ["Employees", Users],
  ["Run Payroll", Calculator],
  ["History", History],
];
const money = (v) => Number(v || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const field = "w-full px-3 py-2 text-sm bg-gray-100 border-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500";
const blankEmployee = {
  name: "",
  designation: "",
  joiningDate: "",
  pan: "",
  uan: "",
  esiNumber: "",
  bankAccount: "",
  ifsc: "",
  basic: 0,
  hra: 0,
  otherAllowances: 0,
  pfEnabled: true,
  esiEnabled: true,
  professionalTax: 200,
  tdsMonthly: 0,
  active: true,
};
const esc = (v) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function monthLabel(ym) {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleString("en-IN", { month: "long", year: "numeric" });
}

function payslipHtml(slip, company) {
  const row = (a, b) => `<tr><td>${esc(a)}</td><td class="r">${money(b)}</td></tr>`;
  return `<!DOCTYPE html><html><head><title>Payslip ${esc(slip.name)} ${esc(slip.ym)}</title>
<style>body{font-family:Arial,sans-serif;font-size:13px;margin:24px;color:#000}h1{margin:0;font-size:20px}table{width:100%;border-collapse:collapse}
td,th{border:1px solid #000;padding:6px}th{background:#f1f5f9;text-align:left}.r{text-align:right}.grid{display:flex;gap:12px}.grid>div{flex:1}.head{text-align:center;margin-bottom:12px}</style>
</head><body>
<div class="head"><h1>${esc(company?.companyName || "")}</h1>${sellerAddressLines(company || {}).map((l) => `<div>${esc(l)}</div>`).join("")}
<h2 style="margin:10px 0 0;font-size:16px">Payslip for ${esc(monthLabel(slip.ym))}</h2></div>
<table style="margin-bottom:12px"><tr><th>Employee</th><td>${esc(slip.name)}</td><th>Designation</th><td>${esc(slip.designation)}</td></tr>
<tr><th>Paid days</th><td>${slip.paidDays} / ${slip.totalDays}</td><th>Net pay</th><td><b>₹${money(slip.netPay)}</b></td></tr></table>
<div class="grid"><div><table><tr><th>Earnings</th><th class="r">Amount</th></tr>
${row("Basic", slip.earnings.basic)}${row("HRA", slip.earnings.hra)}${row("Other allowances", slip.earnings.other)}
<tr><th>Gross earnings</th><th class="r">${money(slip.earnings.gross)}</th></tr></table></div>
<div><table><tr><th>Deductions</th><th class="r">Amount</th></tr>
${row("Provident Fund", slip.deductions.pfEmployee)}${row("ESI", slip.deductions.esiEmployee)}${row("Professional Tax", slip.deductions.professionalTax)}${row("TDS", slip.deductions.tds)}
<tr><th>Total deductions</th><th class="r">${money(slip.deductions.total)}</th></tr></table></div></div>
<p style="margin-top:16px"><b>Net pay: ₹${money(slip.netPay)}</b></p>
<p style="font-size:11px;color:#555">Employer contributions (not deducted): PF ₹${money(slip.employer.pfEmployer)}, ESI ₹${money(slip.employer.esiEmployer)}. This is a computer-generated payslip.</p>
</body></html>`;
}

function printHtml(html) {
  const w = window.open("", "_blank", "width=820,height=900");
  if (!w) return false;
  w.document.open();
  w.document.write(html);
  w.document.close();
  setTimeout(() => w.print(), 400);
  return true;
}

export default function PayrollPage() {
  const { vouchers: employees, addVoucher: addEmployee, editVoucher: editEmployee, removeVoucher: removeEmployee } = useVouchers("employees");
  const { vouchers: runs, addVoucher: addRun, removeVoucher: removeRun } = useVouchers("payrollRuns");
  const { names: costCentres } = useCostCentres();
  const { companyProfile } = useCompanyProfile();
  const { success, error: toastError } = useToast();

  const [tab, setTab] = useState("Employees");
  const [form, setForm] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const now = new Date();
  const [ym, setYm] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
  const [attendance, setAttendance] = useState({});
  const [costCentre, setCostCentre] = useState("");

  const active = useMemo(() => (employees || []).filter((e) => e.active !== false).sort((a, b) => String(a.name).localeCompare(String(b.name))), [employees]);
  const run = useMemo(() => computePayrollRun(active, ym, attendance), [active, ym, attendance]);
  const alreadyRun = (runs || []).some((r) => r.ym === ym);

  const saveEmployee = async () => {
    if (!form.name.trim()) {
      toastError("Employee name is required.");
      return;
    }
    const doc = {
      ...form,
      name: form.name.trim(),
      pan: form.pan.trim().toUpperCase(),
      ifsc: form.ifsc.trim().toUpperCase(),
      basic: Number(form.basic) || 0,
      hra: Number(form.hra) || 0,
      otherAllowances: Number(form.otherAllowances) || 0,
      professionalTax: Number(form.professionalTax) || 0,
      tdsMonthly: Number(form.tdsMonthly) || 0,
    };
    delete doc.id;
    const res = editingId ? await editEmployee(editingId, doc) : await addEmployee(doc);
    if (res.success) {
      success(`${doc.name} ${editingId ? "updated" : "added"}.`);
      setForm(null);
      setEditingId(null);
    } else toastError(res.error);
  };

  const saveRun = async () => {
    if (!run.slips.length) {
      toastError("Add employees first.");
      return;
    }
    if (alreadyRun) {
      toastError(`Payroll for ${monthLabel(ym)} is already saved. Delete it in History to redo it.`);
      return;
    }
    const res = await addRun({ ym, voucherNumber: `PAY-${ym}`, slips: run.slips, totals: run.totals, costCentre: costCentre || "" });
    if (res.success) {
      success(`Payroll for ${monthLabel(ym)} saved and posted to the books.`);
      setTab("History");
    } else toastError(res.error);
  };

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  return (
    <div className="min-h-screen text-slate-800 font-mazzard">
      <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 pb-8 pt-6">
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Payroll</h1>
            <p className="text-sm text-gray-600 mt-1">Monthly salaries with PF, ESI, professional tax and TDS — posted to your books automatically.</p>
          </div>
          {tab === "Employees" && (
            <button
              onClick={() => {
                setForm({ ...blankEmployee });
                setEditingId(null);
              }}
              className="bg-blue-600 text-white flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" /> Add Employee
            </button>
          )}
        </header>

        <div className="w-fit overflow-x-auto pb-1 scrollbar-hide mb-6">
          <div className="flex p-1 bg-white border border-slate-300 rounded-xl whitespace-nowrap shadow-xs">
            {TABS.map(([t, Icon]) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${tab === t ? "bg-blue-600 text-white shadow-xs" : "text-slate-600 hover:text-slate-900 hover:bg-slate-50 font-medium"}`}
              >
                <Icon className="w-4 h-4" /> {t}
              </button>
            ))}
          </div>
        </div>

        {tab === "Employees" && (
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-x-auto">
            <table className="w-full text-sm min-w-[860px]">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3 text-left">Employee</th>
                  <th className="px-4 py-3 text-right">Basic</th>
                  <th className="px-4 py-3 text-right">HRA</th>
                  <th className="px-4 py-3 text-right">Other</th>
                  <th className="px-4 py-3 text-right">Monthly gross</th>
                  <th className="px-4 py-3 text-left">Statutory</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(employees || []).map((e) => (
                  <tr key={e.id} className={e.active === false ? "opacity-50" : "hover:bg-gray-50"}>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-gray-900">{e.name}</p>
                      <p className="text-xs text-gray-500">{[e.designation, e.active === false && "Inactive"].filter(Boolean).join(" · ")}</p>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{money(e.basic)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{money(e.hra)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{money(e.otherAllowances)}</td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums">{money(Number(e.basic) + Number(e.hra) + Number(e.otherAllowances))}</td>
                    <td className="px-4 py-3 text-xs text-gray-600">{[e.pfEnabled && "PF", e.esiEnabled && "ESI", Number(e.professionalTax) > 0 && "PT", Number(e.tdsMonthly) > 0 && "TDS"].filter(Boolean).join(" · ") || "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => {
                            setForm({ ...blankEmployee, ...e });
                            setEditingId(e.id);
                          }}
                          className="p-2 rounded-lg text-gray-500 hover:bg-gray-100"
                          aria-label="Edit"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => window.confirm(`Delete ${e.name}?`) && removeEmployee(e.id)} className="p-2 rounded-lg text-red-500 hover:bg-red-50" aria-label="Delete">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!(employees || []).length && (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                      No employees yet. Click Add Employee.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {tab === "Run Payroll" && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 flex flex-wrap items-end gap-4">
              <label className="block">
                <span className="block text-xs text-gray-600 mb-1">Month</span>
                <input type="month" className={`${field} bg-white border border-gray-300`} value={ym} onChange={(e) => e.target.value && setYm(e.target.value)} />
              </label>
              {costCentres.length > 0 && (
                <label className="block">
                  <span className="block text-xs text-gray-600 mb-1">Cost centre</span>
                  <select className={`${field} bg-white border border-gray-300`} value={costCentre} onChange={(e) => setCostCentre(e.target.value)}>
                    <option value="">None</option>
                    {costCentres.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </label>
              )}
              <div className="flex-1" />
              {alreadyRun && <span className="text-sm text-amber-700">Already saved for {monthLabel(ym)}.</span>}
              <button onClick={saveRun} disabled={alreadyRun || !run.slips.length} className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50">
                <Save className="w-4 h-4" /> Save & post payroll
              </button>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-x-auto">
              <table className="w-full text-sm min-w-[980px] tabular-nums">
                <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                  <tr>
                    <th className="px-4 py-3 text-left">Employee</th>
                    <th className="px-4 py-3 text-left">Paid days (of {daysInMonth(ym)})</th>
                    <th className="px-4 py-3 text-right">Gross</th>
                    <th className="px-4 py-3 text-right">PF</th>
                    <th className="px-4 py-3 text-right">ESI</th>
                    <th className="px-4 py-3 text-right">PT</th>
                    <th className="px-4 py-3 text-right">TDS</th>
                    <th className="px-4 py-3 text-right">Net pay</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {run.slips.map((s) => (
                    <tr key={s.employeeId}>
                      <td className="px-4 py-2.5 font-medium text-gray-900">{s.name}</td>
                      <td className="px-4 py-2.5">
                        <input
                          type="number"
                          min="0"
                          max={s.totalDays}
                          step="0.5"
                          className="w-24 px-2 py-1 text-sm bg-gray-100 rounded-lg"
                          value={attendance[s.employeeId]?.paidDays ?? s.totalDays}
                          onChange={(e) => setAttendance((a) => ({ ...a, [s.employeeId]: { paidDays: e.target.value } }))}
                        />
                      </td>
                      <td className="px-4 py-2.5 text-right">{money(s.earnings.gross)}</td>
                      <td className="px-4 py-2.5 text-right">{money(s.deductions.pfEmployee)}</td>
                      <td className="px-4 py-2.5 text-right">{money(s.deductions.esiEmployee)}</td>
                      <td className="px-4 py-2.5 text-right">{money(s.deductions.professionalTax)}</td>
                      <td className="px-4 py-2.5 text-right">{money(s.deductions.tds)}</td>
                      <td className="px-4 py-2.5 text-right font-semibold">{money(s.netPay)}</td>
                    </tr>
                  ))}
                  {!run.slips.length && (
                    <tr>
                      <td colSpan={8} className="px-4 py-12 text-center text-gray-500">
                        No active employees.
                      </td>
                    </tr>
                  )}
                  {run.slips.length > 0 && (
                    <tr className="bg-slate-50 font-bold">
                      <td className="px-4 py-2.5" colSpan={2}>
                        Total ({run.slips.length})
                      </td>
                      <td className="px-4 py-2.5 text-right">{money(run.totals.gross)}</td>
                      <td className="px-4 py-2.5 text-right">{money(run.totals.pfEmployee)}</td>
                      <td className="px-4 py-2.5 text-right">{money(run.totals.esiEmployee)}</td>
                      <td className="px-4 py-2.5 text-right">{money(run.totals.professionalTax)}</td>
                      <td className="px-4 py-2.5 text-right">{money(run.totals.tds)}</td>
                      <td className="px-4 py-2.5 text-right">{money(run.totals.netPay)}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {run.slips.length > 0 && (
              <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
                <p className="text-sm font-bold text-gray-900 mb-2">Journal that will be posted</p>
                <table className="w-full text-sm tabular-nums">
                  <tbody>
                    {payrollJournalLines(run.totals).map((l) => (
                      <tr key={l.ledger}>
                        <td className="py-1 text-gray-700">
                          {l.dr ? "Dr" : "Cr"} · {l.ledger} <span className="text-xs text-gray-400">({l.group})</span>
                        </td>
                        <td className="py-1 text-right w-36">{l.dr ? money(l.dr) : ""}</td>
                        <td className="py-1 text-right w-36">{l.cr ? money(l.cr) : ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="text-xs text-gray-500 mt-2">
                  Employer cost this month: ₹{money(run.totals.ctc)}. Pay salaries with a Payment voucher (Dr Salary Payable, Cr Bank) in Books → Journal Entry.
                </p>
              </div>
            )}
          </div>
        )}

        {tab === "History" && (
          <div className="space-y-4">
            {[...(runs || [])]
              .sort((a, b) => String(b.ym).localeCompare(String(a.ym)))
              .map((r) => (
                <div key={r.id} className="bg-white rounded-lg border border-gray-200 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-gray-200">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
                        <IndianRupee className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-bold text-gray-900">{monthLabel(r.ym)}</p>
                        <p className="text-xs text-gray-500">
                          {r.slips?.length || 0} employees · gross ₹{money(r.totals?.gross)} · net ₹{money(r.totals?.netPay)}
                          {r.costCentre ? ` · ${r.costCentre}` : ""}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => window.confirm(`Delete payroll for ${monthLabel(r.ym)}? Its journal will be removed from the books.`) && removeRun(r.id)}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                      aria-label="Delete payroll run"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {(r.slips || []).map((s) => (
                      <div key={s.employeeId} className="flex items-center justify-between px-4 py-2 text-sm">
                        <span>
                          {s.name} <span className="text-xs text-gray-500">· {s.paidDays}/{s.totalDays} days</span>
                        </span>
                        <span className="flex items-center gap-3 tabular-nums">
                          ₹{money(s.netPay)}
                          <button onClick={() => printHtml(payslipHtml(s, companyProfile)) || toastError("Allow pop-ups to print.")} className="p-1.5 text-gray-500 hover:bg-gray-100 rounded" aria-label="Print payslip">
                            <Printer className="w-4 h-4" />
                          </button>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            {!(runs || []).length && <p className="text-sm text-gray-500 text-center py-12">No payroll saved yet.</p>}
          </div>
        )}
      </div>

      {form && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setForm(null)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()} data-lenis-prevent>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-bold text-gray-900">{editingId ? "Edit employee" : "Add employee"}</h2>
              <button onClick={() => setForm(null)} className="p-1 text-gray-400 hover:text-gray-600" aria-label="Close">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                ["name", "Name *", "text", "sm:col-span-2"],
                ["designation", "Designation"],
                ["joiningDate", "Joining date", "date"],
                ["pan", "PAN"],
                ["uan", "UAN (PF)"],
                ["esiNumber", "ESI number"],
                ["bankAccount", "Bank account no."],
                ["ifsc", "IFSC"],
                ["basic", "Basic / month (₹)", "number"],
                ["hra", "HRA / month (₹)", "number"],
                ["otherAllowances", "Other allowances (₹)", "number"],
                ["professionalTax", "Professional tax / month (₹)", "number"],
                ["tdsMonthly", "TDS / month (₹)", "number"],
              ].map(([k, label, type = "text", span = ""]) => (
                <label key={k} className={`block ${span}`}>
                  <span className="block text-sm text-gray-700 mb-1">{label}</span>
                  <input type={type} className={field} value={form[k] ?? ""} onChange={set(k)} />
                </label>
              ))}
              <div className="sm:col-span-3 flex flex-wrap gap-6 pt-2">
                {[
                  ["pfEnabled", "PF applicable (12% of basic, capped at ₹15,000)"],
                  ["esiEnabled", "ESI applicable (gross ≤ ₹21,000)"],
                  ["active", "Active"],
                ].map(([k, label]) => (
                  <label key={k} className="flex items-center gap-2 text-sm text-gray-700">
                    <input type="checkbox" checked={Boolean(form[k])} onChange={set(k)} className="w-4 h-4 accent-blue-600" />
                    {label}
                  </label>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-xl">
              <button onClick={() => setForm(null)} className="px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={saveEmployee} className="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700">
                {editingId ? "Save changes" : "Add employee"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
