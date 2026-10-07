// Books of account, Tally style: Day Book, Ledger, Trial Balance, Profit &
// Loss, Balance Sheet and manual Journal / Contra vouchers. Every figure is
// derived from saved vouchers by utils/accounting.js.
import React, { useMemo, useState, useContext } from "react";
import { Download, Plus, Trash2, Save, CheckCircle2, AlertTriangle, BookOpen, Pencil, Lock, Unlock } from "lucide-react";
import { useBooksData, useVouchers, useCostCentres, useGodowns, useAccounts, useBooksLock } from "../../hooks/useFirestore";
import { carryForward, fyEnd, fyStart, fyLabel } from "../../utils/yearEnd.js";
import { AuthContext } from "../../context/AuthContext";
import { useCompanyProfile } from "../../context/CompanyProfileContext";
import { useToast } from "../../context/ToastContext";
import { buildEntries, dayBook, ledgerStatement, trialBalance, profitAndLoss, balanceSheet, ledgerNames, GROUPS, bankReconciliation, tdsReceivable, costCentreReport, budgetVsActual } from "../../utils/accounting.js";
import { nextVoucherNumber, financialYearLabel } from "../../utils/vouchers.js";
import { stockSummary, initialStockValue, godownStock, MAIN_GODOWN, batchStock } from "../../utils/inventory.js";
import { auditDiff, COLLECTION_LABELS } from "../../utils/audit.js";
import { receivablesAgeing, payablesAgeing, BUCKETS } from "../../utils/ageing.js";

const TABS = ["Day Book", "Outstanding", "Chart of Accounts", "Ledger", "Trial Balance", "Profit & Loss", "Balance Sheet", "Stock Summary", "Batches & Expiry", "Cost Centres", "Budgets", "Bank Reconciliation", "TDS", "Journal Entry", "Year End", "Audit Trail"];
const money = (v) => Number(v || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const blankIfZero = (v) => (Math.abs(Number(v) || 0) < 0.005 ? "" : money(v));
const field = "px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500";

function dayBefore(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d) - 86400000).toISOString().slice(0, 10);
}

function fyOf(dateKey) {
  const [y, m] = dateKey.split("-").map(Number);
  return m >= 4 ? y : y - 1;
}

function downloadCsv(name, rows) {
  const csv = rows.map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function Card({ title, actions, children }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-gray-200">
        <h2 className="text-base font-bold text-gray-900">{title}</h2>
        <div className="flex items-center gap-2">{actions}</div>
      </div>
      {children}
    </div>
  );
}

function CsvButton({ onClick }) {
  return (
    <button onClick={onClick} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
      <Download className="w-3.5 h-3.5" /> Export CSV
    </button>
  );
}

function BalanceBadge({ ok, label }) {
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
      {ok ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
      {label}
    </span>
  );
}

/* ─── Statement tables ─────────────────────────────────────────────────── */

function DayBookView({ entries, period }) {
  const rows = dayBook(entries, period);
  const [open, setOpen] = useState(null);
  return (
    <Card
      title={`Day Book · ${rows.length} vouchers`}
      actions={<CsvButton onClick={() => downloadCsv("day-book.csv", [["Date", "Type", "No.", "Party", "Narration", "Amount"], ...rows.map((r) => [r.date, r.type, r.number, r.party, r.narration, r.amount])])} />}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[760px]">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-2.5 text-left">Date</th>
              <th className="px-4 py-2.5 text-left">Voucher type</th>
              <th className="px-4 py-2.5 text-left">No.</th>
              <th className="px-4 py-2.5 text-left">Particulars</th>
              <th className="px-4 py-2.5 text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((r) => (
              <React.Fragment key={r.id}>
                <tr className="hover:bg-gray-50 cursor-pointer" onClick={() => setOpen(open === r.id ? null : r.id)}>
                  <td className="px-4 py-2.5 text-gray-600 whitespace-nowrap">{r.date}</td>
                  <td className="px-4 py-2.5">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">{r.type}</span>
                  </td>
                  <td className="px-4 py-2.5 text-gray-700">{r.number}</td>
                  <td className="px-4 py-2.5">
                    <p className="font-medium text-gray-900">{r.party}</p>
                    <p className="text-xs text-gray-500">{r.narration}</p>
                  </td>
                  <td className="px-4 py-2.5 text-right font-semibold tabular-nums">{money(r.amount)}</td>
                </tr>
                {open === r.id && (
                  <tr className="bg-slate-50">
                    <td colSpan={5} className="px-8 py-2">
                      <table className="w-full text-xs">
                        <tbody>
                          {r.lines.map((l, i) => (
                            <tr key={i}>
                              <td className="py-1 text-gray-700">{l.dr ? "Dr" : "Cr"} · {l.ledger}</td>
                              <td className="py-1 text-gray-400">{l.group}</td>
                              <td className="py-1 text-right tabular-nums w-32">{blankIfZero(l.dr)}</td>
                              <td className="py-1 text-right tabular-nums w-32">{blankIfZero(l.cr)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-gray-500">
                  No vouchers in this period.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function LedgerView({ entries, period }) {
  const names = useMemo(() => ledgerNames(entries), [entries]);
  const [ledger, setLedger] = useState("");
  const current = ledger || names[0]?.ledger || "";
  const st = current ? ledgerStatement(entries, current, period) : null;
  const drCr = (v) => `${money(Math.abs(v))} ${v >= 0 ? "Dr" : "Cr"}`;
  return (
    <Card
      title="Ledger"
      actions={
        <>
          <select className={field} value={current} onChange={(e) => setLedger(e.target.value)}>
            {Object.keys(GROUPS)
              .filter((g) => names.some((x) => x.group === g))
              .map((g) => (
                <optgroup key={g} label={g}>
                  {names
                    .filter((x) => x.group === g)
                    .map((x) => (
                      <option key={x.ledger} value={x.ledger}>
                        {x.ledger}
                      </option>
                    ))}
                </optgroup>
              ))}
          </select>
          {st && (
            <CsvButton
              onClick={() =>
                downloadCsv(`ledger-${current}.csv`, [
                  ["Date", "Particulars", "Type", "No.", "Debit", "Credit", "Balance"],
                  ["", "Opening balance", "", "", "", "", st.opening],
                  ...st.rows.map((r) => [r.date, r.particulars, r.type, r.number, r.dr, r.cr, r.balance]),
                ])
              }
            />
          )}
        </>
      }
    >
      {st ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[820px]">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-2.5 text-left">Date</th>
                <th className="px-4 py-2.5 text-left">Particulars</th>
                <th className="px-4 py-2.5 text-left">Vch type / No.</th>
                <th className="px-4 py-2.5 text-right">Debit</th>
                <th className="px-4 py-2.5 text-right">Credit</th>
                <th className="px-4 py-2.5 text-right">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 tabular-nums">
              <tr className="bg-slate-50 font-semibold">
                <td className="px-4 py-2.5" colSpan={5}>
                  Opening balance
                </td>
                <td className="px-4 py-2.5 text-right">{drCr(st.opening)}</td>
              </tr>
              {st.rows.map((r, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 text-gray-600 whitespace-nowrap">{r.date}</td>
                  <td className="px-4 py-2.5">
                    <p className="text-gray-900">{r.particulars}</p>
                    <p className="text-xs text-gray-500">{r.narration}</p>
                  </td>
                  <td className="px-4 py-2.5 text-gray-600">
                    {r.type} {r.number}
                  </td>
                  <td className="px-4 py-2.5 text-right">{blankIfZero(r.dr)}</td>
                  <td className="px-4 py-2.5 text-right">{blankIfZero(r.cr)}</td>
                  <td className="px-4 py-2.5 text-right">{drCr(r.balance)}</td>
                </tr>
              ))}
              <tr className="bg-slate-50 font-bold">
                <td className="px-4 py-2.5" colSpan={3}>
                  Totals / closing balance
                </td>
                <td className="px-4 py-2.5 text-right">{money(st.totalDr)}</td>
                <td className="px-4 py-2.5 text-right">{money(st.totalCr)}</td>
                <td className="px-4 py-2.5 text-right">{drCr(st.closing)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : (
        <p className="p-8 text-center text-sm text-gray-500">No ledgers yet — they appear as you record vouchers.</p>
      )}
    </Card>
  );
}

function TrialBalanceView({ entries, period }) {
  const tb = trialBalance(entries, { to: period.to });
  const groups = [...new Set(tb.rows.map((r) => r.group))];
  return (
    <Card
      title={`Trial Balance as on ${period.to || "today"}`}
      actions={
        <>
          <BalanceBadge ok={tb.balanced} label={tb.balanced ? "Balanced" : "Difference in TB"} />
          <CsvButton onClick={() => downloadCsv("trial-balance.csv", [["Ledger", "Group", "Debit", "Credit"], ...tb.rows.map((r) => [r.ledger, r.group, r.debit, r.credit]), ["Total", "", tb.totalDebit, tb.totalCredit]])} />
        </>
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[640px] tabular-nums">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-2.5 text-left">Particulars</th>
              <th className="px-4 py-2.5 text-right w-40">Debit</th>
              <th className="px-4 py-2.5 text-right w-40">Credit</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => {
              const rows = tb.rows.filter((r) => r.group === g);
              const dr = rows.reduce((s, r) => s + r.debit, 0);
              const cr = rows.reduce((s, r) => s + r.credit, 0);
              return (
                <React.Fragment key={g}>
                  <tr className="bg-slate-50 border-t border-gray-200">
                    <td className="px-4 py-2 font-bold text-gray-900">{g}</td>
                    <td className="px-4 py-2 text-right font-bold">{blankIfZero(dr)}</td>
                    <td className="px-4 py-2 text-right font-bold">{blankIfZero(cr)}</td>
                  </tr>
                  {rows.map((r) => (
                    <tr key={r.ledger}>
                      <td className="px-4 py-1.5 pl-8 text-gray-700">{r.ledger}</td>
                      <td className="px-4 py-1.5 text-right text-gray-600">{blankIfZero(r.debit)}</td>
                      <td className="px-4 py-1.5 text-right text-gray-600">{blankIfZero(r.credit)}</td>
                    </tr>
                  ))}
                </React.Fragment>
              );
            })}
            <tr className="border-t-2 border-gray-900 font-bold text-base">
              <td className="px-4 py-3">Grand Total</td>
              <td className="px-4 py-3 text-right">{money(tb.totalDebit)}</td>
              <td className="px-4 py-3 text-right">{money(tb.totalCredit)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function PlRow({ label, value, bold, indent }) {
  return (
    <div className={`flex justify-between py-1.5 ${bold ? "font-bold text-gray-900" : "text-gray-700"} ${indent ? "pl-4 text-sm" : ""}`}>
      <span>{label}</span>
      <span className="tabular-nums">{money(value)}</span>
    </div>
  );
}

function ProfitLossView({ entries, period, stock }) {
  const pl = profitAndLoss(entries, period, { openingStock: stock.totalOpening, closingStock: stock.totalClosing });
  return (
    <Card
      title={`Profit & Loss A/c · ${period.from || "start"} to ${period.to || "today"}`}
      actions={
        <CsvButton
          onClick={() =>
            downloadCsv("profit-and-loss.csv", [
              ["Particulars", "Amount"],
              ["Sales (net of returns)", pl.sales],
              ["Purchases (net of returns)", pl.purchases],
              ["Gross profit", pl.grossProfit],
              ...pl.indirectExpenses.map((e) => [`Expense: ${e.ledger}`, e.amount]),
              ...pl.indirectIncomes.map((e) => [`Income: ${e.ledger}`, e.amount]),
              ["Net profit", pl.netProfit],
            ])
          }
        />
      }
    >
      <div className="grid md:grid-cols-2 gap-0 md:divide-x divide-gray-200">
        <div className="p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Trading account</p>
          <PlRow label="Opening stock" value={pl.openingStock} />
          {pl.salesDetail.map((s) => (
            <PlRow key={s.ledger} label={s.ledger} value={s.amount} indent />
          ))}
          <PlRow label="Net sales" value={pl.sales} bold />
          {pl.purchaseDetail.map((s) => (
            <PlRow key={s.ledger} label={s.ledger} value={s.amount} indent />
          ))}
          <PlRow label="Net purchases" value={pl.purchases} bold />
          <PlRow label="Closing stock" value={pl.closingStock} />
          <div className={`mt-3 p-3 rounded-lg ${pl.grossProfit >= 0 ? "bg-green-50" : "bg-red-50"}`}>
            <PlRow label={pl.grossProfit >= 0 ? "Gross profit" : "Gross loss"} value={Math.abs(pl.grossProfit)} bold />
          </div>
          <p className="text-xs text-gray-500 mt-2">Gross profit = net sales + closing stock − opening stock − net purchases. Stock is valued at weighted-average purchase cost.</p>
        </div>
        <div className="p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Profit & loss account</p>
          <PlRow label="Gross profit b/f" value={pl.grossProfit} />
          {pl.indirectIncomes.map((s) => (
            <PlRow key={`i-${s.ledger}`} label={`+ ${s.ledger}`} value={s.amount} indent />
          ))}
          {pl.indirectExpenses.map((s) => (
            <PlRow key={`e-${s.ledger}`} label={`− ${s.ledger}`} value={s.amount} indent />
          ))}
          <PlRow label="Total indirect expenses" value={pl.totalIndirectExp} bold />
          <div className={`mt-3 p-3 rounded-lg ${pl.netProfit >= 0 ? "bg-green-50" : "bg-red-50"}`}>
            <PlRow label={pl.netProfit >= 0 ? "Net profit" : "Net loss"} value={Math.abs(pl.netProfit)} bold />
          </div>
        </div>
      </div>
    </Card>
  );
}

function BalanceSheetView({ entries, period, stockAll }) {
  const bs = balanceSheet(entries, { to: period.to, from: period.from }, stockAll);
  const side = (title, groups, total) => (
    <div className="p-5">
      <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">{title}</p>
      {groups.map((g) => (
        <div key={g.group} className="mb-2">
          <PlRow label={g.group} value={g.amount} bold />
          {g.ledgers.map((l) => (
            <PlRow key={l.ledger} label={l.ledger} value={l.amount} indent />
          ))}
        </div>
      ))}
      {!groups.length && <p className="text-sm text-gray-400">Nothing yet</p>}
      <div className="mt-3 pt-3 border-t-2 border-gray-900">
        <PlRow label="Total" value={total} bold />
      </div>
    </div>
  );
  return (
    <Card
      title={`Balance Sheet as on ${period.to || "today"}`}
      actions={
        <>
          <BalanceBadge ok={bs.balanced} label={bs.balanced ? "Assets = Liabilities" : "Does not balance"} />
          <CsvButton
            onClick={() =>
              downloadCsv("balance-sheet.csv", [
                ["Side", "Group", "Ledger", "Amount"],
                ...bs.liabilities.flatMap((g) => [["Liabilities", g.group, "", g.amount], ...g.ledgers.map((l) => ["Liabilities", g.group, l.ledger, l.amount])]),
                ...bs.assets.flatMap((g) => [["Assets", g.group, "", g.amount], ...g.ledgers.map((l) => ["Assets", g.group, l.ledger, l.amount])]),
              ])
            }
          />
        </>
      }
    >
      <div className="grid md:grid-cols-2 md:divide-x divide-gray-200">
        {side("Liabilities", bs.liabilities, bs.totalLiabilities)}
        {side("Assets", bs.assets, bs.totalAssets)}
      </div>
    </Card>
  );
}

/* ─── Year end: carry forward and lock ─────────────────────────────────── */

function YearEndView({ entries, years, stockData, products }) {
  const { lock, saveLock } = useBooksLock();
  const { user } = useContext(AuthContext);
  const { success, error: toastError } = useToast();
  const finished = years.filter((y) => fyEnd(y) < new Date().toISOString().slice(0, 10)).sort((a, b) => b - a);
  const [fy, setFy] = useState(String(finished[0] ?? years[0]));
  const stock = useMemo(
    () => ({
      initial: initialStockValue(products),
      opening: stockSummary(stockData, { to: dayBefore(fyStart(fy)) }).totalClosing || initialStockValue(products),
      closing: stockSummary(stockData, { to: fyEnd(fy) }).totalClosing,
    }),
    [stockData, products, fy]
  );
  const cf = useMemo(() => carryForward(entries, fy, stock), [entries, fy, stock]);
  const closed = lock.lockedUpTo && fyEnd(fy) <= lock.lockedUpTo;
  const totals = cf.rows.reduce((t, r) => ({ debit: t.debit + r.debit, credit: t.credit + r.credit }), { debit: 0, credit: 0 });

  const closeYear = async () => {
    if (!window.confirm(`Close FY ${fyLabel(fy)}? Vouchers dated up to ${fyEnd(fy)} will be locked. You can reopen it later.`)) return;
    const closedYears = [...(lock.closedYears || []).filter((c) => c.fy !== Number(fy)), { fy: Number(fy), closedAt: new Date().toISOString(), by: user?.email || "", netProfit: cf.netProfit, closingStock: cf.closingStock }];
    const lockedUpTo = lock.lockedUpTo && lock.lockedUpTo > fyEnd(fy) ? lock.lockedUpTo : fyEnd(fy);
    const res = await saveLock({ lockedUpTo, closedYears });
    if (res.success) success(`FY ${fyLabel(fy)} closed. Its closing balances are next year's opening balances.`);
    else toastError(res.error.includes("permission") ? "Only the business owner can close a year." : res.error);
  };
  const reopen = async () => {
    if (!window.confirm(`Reopen FY ${fyLabel(fy)}? Vouchers from ${fyStart(fy)} onwards can be edited again.`)) return;
    const closedYears = (lock.closedYears || []).filter((c) => c.fy < Number(fy));
    const lockedUpTo = closedYears.length ? fyEnd(Math.max(...closedYears.map((c) => c.fy))) : "";
    const res = await saveLock({ lockedUpTo, closedYears });
    if (res.success) success(`FY ${fyLabel(fy)} reopened.`);
    else toastError(res.error.includes("permission") ? "Only the business owner can reopen a year." : res.error);
  };

  return (
    <div className="space-y-6">
      <Card
        title={`Year end · FY ${fyLabel(fy)}`}
        actions={
          <>
            <select className={field} value={fy} onChange={(e) => setFy(e.target.value)} aria-label="Financial year">
              {years.map((y) => (
                <option key={y} value={y}>
                  FY {fyLabel(y)}
                </option>
              ))}
            </select>
            {closed ? (
              <button onClick={reopen} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-amber-800 bg-amber-100 rounded-lg hover:bg-amber-200">
                <Unlock className="w-3.5 h-3.5" /> Reopen year
              </button>
            ) : (
              <button onClick={closeYear} disabled={fyEnd(fy) >= new Date().toISOString().slice(0, 10)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50" title={fyEnd(fy) >= new Date().toISOString().slice(0, 10) ? "The year hasn't ended yet" : undefined}>
                <Lock className="w-3.5 h-3.5" /> Close year
              </button>
            )}
          </>
        }
      >
        <div className="grid sm:grid-cols-4 gap-4 p-4 border-b border-gray-200 text-sm">
          <div>
            <p className="text-xs text-gray-500">Status</p>
            <p className={`font-semibold ${closed ? "text-green-700" : "text-gray-800"}`}>{closed ? "Closed & locked" : "Open"}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">{cf.netProfit >= 0 ? "Net profit" : "Net loss"} for the year</p>
            <p className="font-semibold">₹{money(Math.abs(cf.netProfit))}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Closing stock → next year&apos;s opening stock</p>
            <p className="font-semibold">₹{money(cf.closingStock)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Books locked up to</p>
            <p className="font-semibold">{lock.lockedUpTo || "—"}</p>
          </div>
        </div>
        <p className="px-4 pt-3 text-xs text-gray-500">
          Closing balances on {cf.to}. These carry forward as the opening balances of FY {fyLabel(Number(fy) + 1)}; the year&apos;s profit moves into the P&amp;L A/c opening balance on the Balance Sheet.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[640px] tabular-nums mt-2">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-2.5 text-left">Ledger</th>
                <th className="px-4 py-2.5 text-left">Group</th>
                <th className="px-4 py-2.5 text-right">Opening Dr (next year)</th>
                <th className="px-4 py-2.5 text-right">Opening Cr (next year)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {cf.rows.map((r) => (
                <tr key={r.ledger}>
                  <td className="px-4 py-2">{r.ledger}</td>
                  <td className="px-4 py-2 text-gray-500">{r.group}</td>
                  <td className="px-4 py-2 text-right">{blankIfZero(r.debit)}</td>
                  <td className="px-4 py-2 text-right">{blankIfZero(r.credit)}</td>
                </tr>
              ))}
              <tr>
                <td className="px-4 py-2">Stock-in-Hand</td>
                <td className="px-4 py-2 text-gray-500">Current Assets</td>
                <td className="px-4 py-2 text-right">{blankIfZero(cf.closingStock)}</td>
                <td className="px-4 py-2" />
              </tr>
              <tr>
                <td className="px-4 py-2">Profit &amp; Loss A/c</td>
                <td className="px-4 py-2 text-gray-500">Reserves &amp; Surplus</td>
                <td className="px-4 py-2 text-right">{cf.retained < 0 ? money(-cf.retained) : ""}</td>
                <td className="px-4 py-2 text-right">{cf.retained > 0 ? money(cf.retained) : ""}</td>
              </tr>
              <tr className="bg-slate-50 font-bold">
                <td className="px-4 py-2" colSpan={2}>
                  Total
                </td>
                <td className="px-4 py-2 text-right">{money(totals.debit + cf.closingStock + Math.max(0, -cf.retained))}</td>
                <td className="px-4 py-2 text-right">{money(totals.credit + Math.max(0, cf.retained) + (initialStockValue(products) || 0))}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="p-4 flex justify-end">
          <CsvButton
            onClick={() =>
              downloadCsv(`opening-balances-fy${fyLabel(Number(fy) + 1)}.csv`, [
                ["Ledger", "Group", "Dr", "Cr"],
                ...cf.rows.map((r) => [r.ledger, r.group, r.debit, r.credit]),
                ["Stock-in-Hand", "Current Assets", cf.closingStock, 0],
                ["Profit & Loss A/c", "Reserves & Surplus", Math.max(0, -cf.retained), Math.max(0, cf.retained)],
              ])
            }
          />
        </div>
        {initialStockValue(products) > 0 && <p className="px-4 pb-3 text-xs text-gray-500">Cr total includes opening stock ₹{money(initialStockValue(products))} entered on products (shown under Capital Account).</p>}
      </Card>
      {(lock.closedYears || []).length > 0 && (
        <Card title="Closed years">
          <ul className="divide-y divide-gray-100 text-sm">
            {[...lock.closedYears]
              .sort((a, b) => b.fy - a.fy)
              .map((c) => (
                <li key={c.fy} className="px-4 py-2.5 flex justify-between">
                  <span>FY {fyLabel(c.fy)}</span>
                  <span className="text-gray-500">
                    {c.netProfit >= 0 ? "Profit" : "Loss"} ₹{money(Math.abs(c.netProfit))} · closed {String(c.closedAt).slice(0, 10)} {c.by ? `by ${c.by}` : ""}
                  </span>
                </li>
              ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

/* ─── Batches & expiry ─────────────────────────────────────────────────── */

function BatchView({ stockData }) {
  const [asOn, setAsOn] = useState(new Date().toISOString().slice(0, 10));
  const [only, setOnly] = useState("");
  const rows = useMemo(() => batchStock(stockData, { asOn }), [stockData, asOn]);
  const shown = only ? rows.filter((r) => r.status === only) : rows;
  const tone = { Expired: "bg-red-50 text-red-700", "Expiring soon": "bg-amber-50 text-amber-700", OK: "bg-green-50 text-green-700", "No expiry": "bg-gray-100 text-gray-600" };
  return (
    <Card
      title={`Batch-wise stock as on ${asOn}`}
      actions={
        <>
          <input type="date" max="9999-12-31" className={field} value={asOn} onChange={(e) => setAsOn(e.target.value)} aria-label="As on date" />
          <select className={field} value={only} onChange={(e) => setOnly(e.target.value)} aria-label="Filter by status">
            <option value="">All batches</option>
            <option>Expired</option>
            <option>Expiring soon</option>
            <option>OK</option>
          </select>
          <CsvButton onClick={() => downloadCsv("batches.csv", [["Item", "Batch", "Expiry", "Days left", "Quantity", "Status"], ...shown.map((r) => [r.name, r.batch, r.expiry, r.daysLeft ?? "", r.qty, r.status])])} />
        </>
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[720px] tabular-nums">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-2.5 text-left">Item</th>
              <th className="px-4 py-2.5 text-left">Batch</th>
              <th className="px-4 py-2.5 text-left">Expiry</th>
              <th className="px-4 py-2.5 text-right">Days left</th>
              <th className="px-4 py-2.5 text-right">Quantity</th>
              <th className="px-4 py-2.5 text-left">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {shown.map((r) => (
              <tr key={`${r.productId}|${r.batch}`}>
                <td className="px-4 py-2.5 font-medium">{r.name}</td>
                <td className="px-4 py-2.5">{r.batch || "—"}</td>
                <td className="px-4 py-2.5">{r.expiry || "—"}</td>
                <td className="px-4 py-2.5 text-right">{r.daysLeft ?? "—"}</td>
                <td className={`px-4 py-2.5 text-right ${r.qty < 0 ? "text-red-600" : ""}`}>
                  {r.qty} {r.unit}
                </td>
                <td className="px-4 py-2.5">
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${tone[r.status]}`}>{r.status}</span>
                </td>
              </tr>
            ))}
            {!shown.length && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-gray-500">
                  No batch stock. Turn on “Track batches &amp; expiry” on a product and enter batch numbers on purchase bills.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/* ─── Stock Summary + adjustments ──────────────────────────────────────── */

function StockView({ stockData, period, products }) {
  const { vouchers: journals, addVoucher, removeVoucher } = useVouchers("stockJournals");
  const { godowns: godownDocs, names: godowns, addGodown, removeGodown } = useGodowns();
  const { success, error: toastError } = useToast();
  const [adj, setAdj] = useState({ productId: "", quantity: "", reason: "Damaged", date: new Date().toISOString().slice(0, 10), godown: MAIN_GODOWN });
  const [godownFilter, setGodownFilter] = useState("");
  const [newGodown, setNewGodown] = useState("");
  const [transfer, setTransfer] = useState({ productId: "", quantity: "", from: MAIN_GODOWN, to: "", date: new Date().toISOString().slice(0, 10) });
  const stock = useMemo(() => stockSummary(stockData, { ...period, godown: godownFilter || undefined }), [stockData, period, godownFilter]);
  const byGodown = useMemo(() => godownStock(stockData, { to: period.to }), [stockData, period.to]);

  const addNewGodown = async () => {
    const name = newGodown.trim();
    if (!name) return;
    if (godowns.some((g) => g.toLowerCase() === name.toLowerCase())) {
      toastError("That godown already exists.");
      return;
    }
    const res = await addGodown({ name });
    if (res.success) setNewGodown("");
    else toastError(res.error);
  };

  const saveTransfer = async () => {
    const qty = Math.abs(Number(transfer.quantity));
    if (!transfer.productId || !qty || !transfer.to || transfer.from === transfer.to) {
      toastError("Pick a product, a quantity and two different godowns.");
      return;
    }
    const res = await addVoucher({
      kind: "transfer",
      voucherNumber: nextVoucherNumber(journals, "ST", new Date(transfer.date)),
      voucherDate: transfer.date,
      productId: transfer.productId,
      quantity: qty,
      fromGodown: transfer.from,
      toGodown: transfer.to,
      reason: `Transfer ${transfer.from} → ${transfer.to}`,
    });
    if (res.success) {
      success("Stock transferred.");
      setTransfer((t) => ({ ...t, quantity: "" }));
    } else toastError(res.error);
  };

  const saveAdj = async () => {
    const qty = Number(adj.quantity);
    if (!adj.productId || !qty) {
      toastError("Pick a product and a quantity (negative to reduce stock).");
      return;
    }
    const res = await addVoucher({
      voucherNumber: nextVoucherNumber(journals, "SJ", new Date(adj.date)),
      voucherDate: adj.date,
      productId: adj.productId,
      quantity: qty,
      reason: adj.reason,
      godown: adj.godown || MAIN_GODOWN,
    });
    if (res.success) {
      success("Stock adjustment saved.");
      setAdj((a) => ({ ...a, quantity: "" }));
    } else toastError(res.error);
  };

  const nameOf = (id) => products.find((p) => p.id === id)?.name || "Deleted product";

  return (
    <div className="space-y-6">
      <Card
        title={`Stock Summary${godownFilter ? ` · ${godownFilter}` : ""} · closing value ₹${money(stock.totalClosing)}`}
        actions={
          <>
          {godowns.length > 1 && (
            <select className={field} value={godownFilter} onChange={(e) => setGodownFilter(e.target.value)}>
              <option value="">All godowns</option>
              {godowns.map((g) => (
                <option key={g}>{g}</option>
              ))}
            </select>
          )}
          <CsvButton
            onClick={() =>
              downloadCsv("stock-summary.csv", [
                ["Item", "Unit", "Opening", "Inward", "Outward", "Closing", "Rate", "Closing value"],
                ...stock.rows.map((r) => [r.name, r.unit, r.opening, r.inward, r.outward, r.closing, r.rate, r.closingValue]),
              ])
            }
          />
          </>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[820px] tabular-nums">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-2.5 text-left">Item</th>
                <th className="px-4 py-2.5 text-right">Opening</th>
                <th className="px-4 py-2.5 text-right">Inward</th>
                <th className="px-4 py-2.5 text-right">Outward</th>
                <th className="px-4 py-2.5 text-right">Closing</th>
                <th className="px-4 py-2.5 text-right">Rate</th>
                <th className="px-4 py-2.5 text-right">Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {stock.rows.map((r) => (
                <tr key={r.productId} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5">
                    <p className="font-medium text-gray-900">{r.name}</p>
                    <p className="text-xs text-gray-500">{[r.hsn && `HSN ${r.hsn}`, r.unit].filter(Boolean).join(" · ")}</p>
                  </td>
                  <td className="px-4 py-2.5 text-right">{r.opening}</td>
                  <td className="px-4 py-2.5 text-right text-green-700">{r.inward || ""}</td>
                  <td className="px-4 py-2.5 text-right text-red-600">{r.outward || ""}</td>
                  <td className={`px-4 py-2.5 text-right font-semibold ${r.negative ? "text-red-600" : ""}`}>{r.closing}</td>
                  <td className="px-4 py-2.5 text-right text-gray-600">{money(r.rate)}</td>
                  <td className="px-4 py-2.5 text-right font-semibold">{money(r.closingValue)}</td>
                </tr>
              ))}
              {!stock.rows.length && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                    No stock movements yet. Add opening stock on Products, or record purchase bills.
                  </td>
                </tr>
              )}
              {stock.rows.length > 0 && (
                <tr className="bg-slate-50 font-bold">
                  <td className="px-4 py-2.5" colSpan={6}>
                    Total closing stock
                  </td>
                  <td className="px-4 py-2.5 text-right">{money(stock.totalClosing)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {stock.rows.some((r) => r.negative) && (
          <p className="px-4 py-3 text-xs text-red-600 border-t border-gray-200">Red closing quantities mean more was sold than recorded as bought — add opening stock or the missing purchase bills.</p>
        )}
      </Card>

      <Card title="Godowns">
        <div className="p-4 space-y-3">
          <div className="flex gap-2">
            <input className={`${field} flex-1 max-w-sm`} placeholder="e.g. Chennai warehouse" value={newGodown} onChange={(e) => setNewGodown(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addNewGodown()} />
            <button onClick={addNewGodown} className="flex items-center gap-1.5 px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700">
              <Plus className="w-4 h-4" /> Add godown
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm tabular-nums">
              <thead className="text-xs uppercase text-gray-500">
                <tr>
                  <th className="py-2 text-left">Godown</th>
                  <th className="py-2 text-right">Items in stock</th>
                  <th className="py-2 text-right">Total quantity</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {godowns.map((g) => {
                  const rows = byGodown.filter((r) => r.godown === g && r.qty !== 0);
                  const doc = godownDocs.find((d) => d.name === g);
                  return (
                    <tr key={g}>
                      <td className="py-2 font-medium">{g}</td>
                      <td className="py-2 text-right">{rows.length}</td>
                      <td className="py-2 text-right">{rows.reduce((s, r) => s + r.qty, 0)}</td>
                      <td className="py-2 text-right">
                        {doc && (
                          <button onClick={() => (rows.length ? toastError(`${g} still has stock — transfer it first.`) : window.confirm(`Remove ${g}?`) && removeGodown(doc.id))} className="p-1.5 text-red-500 hover:bg-red-50 rounded" aria-label={`Remove ${g}`}>
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        {godowns.length > 1 && (
          <div className="p-4 border-t border-gray-200 flex flex-wrap items-end gap-3">
            <p className="w-full text-sm font-semibold text-gray-900">Transfer stock</p>
            <label className="block">
              <span className="block text-xs text-gray-600 mb-1">Product</span>
              <select className={field} value={transfer.productId} onChange={(e) => setTransfer((t) => ({ ...t, productId: e.target.value }))}>
                <option value="">Select product</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="block text-xs text-gray-600 mb-1">Quantity</span>
              <input type="number" min="0" className={`${field} w-28`} value={transfer.quantity} onChange={(e) => setTransfer((t) => ({ ...t, quantity: e.target.value }))} />
            </label>
            <label className="block">
              <span className="block text-xs text-gray-600 mb-1">From</span>
              <select className={field} value={transfer.from} onChange={(e) => setTransfer((t) => ({ ...t, from: e.target.value }))}>
                {godowns.map((g) => (
                  <option key={g}>{g}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="block text-xs text-gray-600 mb-1">To</span>
              <select className={field} value={transfer.to} onChange={(e) => setTransfer((t) => ({ ...t, to: e.target.value }))}>
                <option value="">Select</option>
                {godowns
                  .filter((g) => g !== transfer.from)
                  .map((g) => (
                    <option key={g}>{g}</option>
                  ))}
              </select>
            </label>
            <label className="block">
              <span className="block text-xs text-gray-600 mb-1">Date</span>
              <input type="date" className={field} value={transfer.date} onChange={(e) => setTransfer((t) => ({ ...t, date: e.target.value }))} />
            </label>
            <button onClick={saveTransfer} className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700">
              <Save className="w-4 h-4" /> Transfer
            </button>
          </div>
        )}
      </Card>

      <Card title="Stock adjustment (stock journal)">
        <div className="p-4 flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="block text-xs text-gray-600 mb-1">Product</span>
            <select className={field} value={adj.productId} onChange={(e) => setAdj((a) => ({ ...a, productId: e.target.value }))}>
              <option value="">Select product</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="block text-xs text-gray-600 mb-1">Quantity (+ add / − remove)</span>
            <input type="number" className={`${field} w-40`} value={adj.quantity} onChange={(e) => setAdj((a) => ({ ...a, quantity: e.target.value }))} />
          </label>
          {godowns.length > 1 && (
            <label className="block">
              <span className="block text-xs text-gray-600 mb-1">Godown</span>
              <select className={field} value={adj.godown} onChange={(e) => setAdj((a) => ({ ...a, godown: e.target.value }))}>
                {godowns.map((g) => (
                  <option key={g}>{g}</option>
                ))}
              </select>
            </label>
          )}
          <label className="block">
            <span className="block text-xs text-gray-600 mb-1">Reason</span>
            <select className={field} value={adj.reason} onChange={(e) => setAdj((a) => ({ ...a, reason: e.target.value }))}>
              {["Damaged", "Expired", "Lost / theft", "Physical count", "Free sample", "Consumed internally", "Found extra"].map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="block text-xs text-gray-600 mb-1">Date</span>
            <input type="date" className={field} value={adj.date} onChange={(e) => setAdj((a) => ({ ...a, date: e.target.value }))} />
          </label>
          <button onClick={saveAdj} className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700">
            <Save className="w-4 h-4" /> Save adjustment
          </button>
        </div>
        <div className="divide-y divide-gray-100 border-t border-gray-200">
          {[...journals]
            .sort((a, b) => String(b.voucherDate).localeCompare(String(a.voucherDate)))
            .map((j) => (
              <div key={j.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <span>
                  <span className="font-semibold">{j.voucherNumber}</span> · {j.voucherDate} · {nameOf(j.productId)} ·{" "}
                  {j.kind === "transfer" ? (
                    <span className="text-blue-700">{j.quantity} moved</span>
                  ) : (
                    <span className={Number(j.quantity) < 0 ? "text-red-600" : "text-green-700"}>{Number(j.quantity) > 0 ? `+${j.quantity}` : j.quantity}</span>
                  )}{" "}
                  · {j.reason}
                  {j.godown && j.kind !== "transfer" ? ` · ${j.godown}` : ""}
                </span>
                <button onClick={() => window.confirm("Delete this adjustment?") && removeVoucher(j.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded" aria-label="Delete adjustment">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
        </div>
      </Card>
    </div>
  );
}

/* ─── Cost centres ─────────────────────────────────────────────────────── */

function CostCentreView({ entries, period }) {
  const { costCentres, addCostCentre, removeCostCentre } = useCostCentres();
  const { error: toastError } = useToast();
  const [name, setName] = useState("");
  const rows = costCentreReport(entries, period);

  const add = async () => {
    const clean = name.trim();
    if (!clean) return;
    if (costCentres.some((c) => c.name.toLowerCase() === clean.toLowerCase())) {
      toastError("That cost centre already exists.");
      return;
    }
    const res = await addCostCentre({ name: clean });
    if (res.success) setName("");
    else toastError(res.error);
  };

  return (
    <div className="space-y-6">
      <Card title="Cost centres (projects, branches, departments)">
        <div className="p-4 space-y-3">
          <div className="flex gap-2">
            <input className={`${field} flex-1 max-w-sm`} placeholder="e.g. Coimbatore branch, Project Alpha" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
            <button onClick={add} className="flex items-center gap-1.5 px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700">
              <Plus className="w-4 h-4" /> Add
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {costCentres.map((c) => (
              <span key={c.id} className="inline-flex items-center gap-1.5 text-sm bg-slate-100 text-slate-700 px-3 py-1 rounded-full">
                {c.name}
                <button onClick={() => window.confirm(`Remove ${c.name}? Vouchers keep their tag.`) && removeCostCentre(c.id)} className="text-slate-400 hover:text-red-600" aria-label={`Remove ${c.name}`}>
                  ×
                </button>
              </span>
            ))}
            {!costCentres.length && <span className="text-sm text-gray-500">None yet. Once added, pick one on invoices, purchases, expenses, journals and payroll.</span>}
          </div>
        </div>
      </Card>
      <Card
        title="Cost centre report"
        actions={<CsvButton onClick={() => downloadCsv("cost-centres.csv", [["Cost centre", "Income", "Purchases", "Expenses", "Net"], ...rows.map((r) => [r.costCentre, r.income, r.purchases, r.expenses, r.net])])} />}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[640px] tabular-nums">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-2.5 text-left">Cost centre</th>
                <th className="px-4 py-2.5 text-right">Income</th>
                <th className="px-4 py-2.5 text-right">Purchases</th>
                <th className="px-4 py-2.5 text-right">Expenses</th>
                <th className="px-4 py-2.5 text-right">Net</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((r) => (
                <tr key={r.costCentre} className={r.costCentre === "Unallocated" ? "text-gray-500" : ""}>
                  <td className="px-4 py-2.5 font-medium">{r.costCentre}</td>
                  <td className="px-4 py-2.5 text-right">{money(r.income)}</td>
                  <td className="px-4 py-2.5 text-right">{money(r.purchases)}</td>
                  <td className="px-4 py-2.5 text-right">{money(r.expenses)}</td>
                  <td className={`px-4 py-2.5 text-right font-semibold ${r.net < 0 ? "text-red-600" : "text-green-700"}`}>{money(r.net)}</td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-gray-500">
                    Nothing in this period.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

/* ─── Budgets ──────────────────────────────────────────────────────────── */

function BudgetView({ entries, period, fyKey }) {
  const { vouchers: budgetDocs, addVoucher, editVoucher } = useVouchers("budgets");
  const { success, error: toastError } = useToast();
  const doc = budgetDocs.find((b) => b.fy === fyKey);
  const [draft, setDraft] = useState(null);
  const [newLedger, setNewLedger] = useState("");
  const saved = doc?.lines || {};
  const lines = draft || saved;
  const rows = budgetVsActual(entries, period, Object.fromEntries(Object.entries(lines).map(([k, v]) => [k, Number(v) || 0])));

  const save = async () => {
    const clean = Object.fromEntries(Object.entries(lines).filter(([, v]) => Number(v) > 0).map(([k, v]) => [k, Number(v)]));
    const res = doc ? await editVoucher(doc.id, { lines: clean }) : await addVoucher({ fy: fyKey, lines: clean });
    if (res.success) {
      success("Budget saved.");
      setDraft(null);
    } else toastError(res.error);
  };

  const setAmount = (ledger, value) => setDraft((d) => ({ ...(d || saved), [ledger]: value }));
  const section = (nature, title) => {
    const list = rows.filter((r) => r.nature === nature);
    if (!list.length) return null;
    return (
      <React.Fragment key={nature}>
        <tr className="bg-slate-50">
          <td colSpan={5} className="px-4 py-2 font-bold text-gray-900">
            {title}
          </td>
        </tr>
        {list.map((r) => {
          const pct = r.usedPct ?? 0;
          const over = nature === "expense" ? r.actual > r.budget && r.budget > 0 : false;
          return (
            <tr key={r.ledger}>
              <td className="px-4 py-2 pl-8 text-gray-700">{r.ledger}</td>
              <td className="px-4 py-2 text-right">
                <input type="number" min="0" className="w-32 px-2 py-1 text-sm text-right bg-gray-100 rounded-lg" value={lines[r.ledger] ?? ""} placeholder="—" onChange={(e) => setAmount(r.ledger, e.target.value)} />
              </td>
              <td className="px-4 py-2 text-right">{money(r.actual)}</td>
              <td className={`px-4 py-2 text-right font-semibold ${r.budget ? (r.variance >= 0 ? "text-green-700" : "text-red-600") : "text-gray-400"}`}>{r.budget ? money(r.variance) : "—"}</td>
              <td className="px-4 py-2 w-48">
                {r.budget > 0 && (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                      <div className={`h-2 rounded-full ${over ? "bg-red-500" : nature === "income" ? "bg-green-500" : "bg-blue-500"}`} style={{ width: `${Math.min(100, pct)}%` }} />
                    </div>
                    <span className="text-xs text-gray-500 w-10 text-right">{pct}%</span>
                  </div>
                )}
              </td>
            </tr>
          );
        })}
      </React.Fragment>
    );
  };

  return (
    <Card
      title={`Budget vs actual · FY ${financialYearLabel(new Date(Number(fyKey), 3, 1))}`}
      actions={
        <>
          <input className={`${field} w-48`} placeholder="Add a ledger…" value={newLedger} onChange={(e) => setNewLedger(e.target.value)} onKeyDown={(e) => e.key === "Enter" && newLedger.trim() && (setAmount(newLedger.trim(), ""), setNewLedger(""))} />
          <button onClick={save} disabled={!draft} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50">
            <Save className="w-3.5 h-3.5" /> Save budget
          </button>
        </>
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[760px] tabular-nums">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-2.5 text-left">Ledger</th>
              <th className="px-4 py-2.5 text-right">Budget</th>
              <th className="px-4 py-2.5 text-right">Actual</th>
              <th className="px-4 py-2.5 text-right">Variance</th>
              <th className="px-4 py-2.5 text-left">Used</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {section("income", "Income")}
            {section("expense", "Expenses")}
            {!rows.length && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-gray-500">
                  No income or expense ledgers yet. Add one above to set a budget.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="px-4 py-3 text-xs text-gray-500 border-t border-gray-200">Green variance is favourable (income above budget, spending below it). Budgets are saved per financial year.</p>
    </Card>
  );
}

/* ─── Bank reconciliation & TDS ────────────────────────────────────────── */

function BankRecoView({ entries, period }) {
  const { vouchers: docs, addVoucher, editVoucher } = useVouchers("ledgers");
  const { error: toastError } = useToast();
  const bankLedgers = useMemo(() => ledgerNames(entries).filter((l) => l.group === "Bank Accounts").map((l) => l.ledger), [entries]);
  const [ledger, setLedger] = useState("");
  const current = ledger || bankLedgers[0] || "Bank";
  const brsDoc = docs.find((d) => d.kind === "brs");
  const cleared = brsDoc?.cleared || {};
  const r = bankReconciliation(entries, cleared, { to: period.to, ledger: current });

  const setBankDate = async (entryId, date) => {
    const next = { ...cleared, [entryId]: date };
    if (!date) delete next[entryId];
    const res = brsDoc ? await editVoucher(brsDoc.id, { cleared: next }) : await addVoucher({ kind: "brs", cleared: next });
    if (!res.success) toastError(res.error);
  };

  return (
    <div className="space-y-6">
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          ["Balance as per books", r.booksBalance],
          ["Deposits not yet in bank", -r.depositsNotCleared],
          ["Payments not yet cleared", r.paymentsNotCleared],
          ["Balance as per bank", r.bankBalance],
        ].map(([label, v], i) => (
          <div key={label} className={`p-4 rounded-lg border shadow-sm ${i === 3 ? "bg-blue-50 border-blue-200" : "bg-white border-gray-200"}`}>
            <p className="text-xs text-gray-500">{label}</p>
            <p className="text-lg font-bold text-gray-900 tabular-nums">
              ₹{money(Math.abs(v))} <span className="text-xs font-medium text-gray-500">{v >= 0 ? "Dr" : "Cr"}</span>
            </p>
          </div>
        ))}
      </div>
      <Card
        title="Enter the date each entry appears on your bank statement"
        actions={
          bankLedgers.length > 1 ? (
            <select className={field} value={current} onChange={(e) => setLedger(e.target.value)}>
              {bankLedgers.map((b) => (
                <option key={b}>{b}</option>
              ))}
            </select>
          ) : (
            <span className="text-xs text-gray-500">{current}</span>
          )
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[820px] tabular-nums">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-2.5 text-left">Date</th>
                <th className="px-4 py-2.5 text-left">Particulars</th>
                <th className="px-4 py-2.5 text-right">Deposit</th>
                <th className="px-4 py-2.5 text-right">Withdrawal</th>
                <th className="px-4 py-2.5 text-left">Bank date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {r.rows.map((row) => (
                <tr key={row.entryId} className={row.bankDate ? "" : "bg-amber-50/40"}>
                  <td className="px-4 py-2 text-gray-600">{row.date}</td>
                  <td className="px-4 py-2">
                    <p className="text-gray-900">{row.particulars}</p>
                    <p className="text-xs text-gray-500">
                      {row.type} {row.number} · {row.narration}
                    </p>
                  </td>
                  <td className="px-4 py-2 text-right">{blankIfZero(row.dr)}</td>
                  <td className="px-4 py-2 text-right">{blankIfZero(row.cr)}</td>
                  <td className="px-4 py-2">
                    <input type="date" className={`${field} py-1`} value={row.bankDate} onChange={(e) => setBankDate(row.entryId, e.target.value)} />
                  </td>
                </tr>
              ))}
              {!r.rows.length && (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-gray-500">
                    No bank entries yet. Receipts by UPI/NEFT/cheque and bank payments appear here.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function TdsView({ invoices, period }) {
  const r = tdsReceivable(invoices, period);
  return (
    <Card
      title={`TDS deducted by customers · ₹${money(r.total)}`}
      actions={<CsvButton onClick={() => downloadCsv("tds-receivable.csv", [["Customer", "GSTIN", "Invoices", "Invoice value", "TDS"], ...r.rows.map((x) => [x.customer, x.gstin, x.invoices, x.invoiceValue, x.tds])])} />}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[640px] tabular-nums">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-2.5 text-left">Customer</th>
              <th className="px-4 py-2.5 text-left">Invoices</th>
              <th className="px-4 py-2.5 text-right">Invoice value</th>
              <th className="px-4 py-2.5 text-right">TDS deducted</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {r.rows.map((x) => (
              <tr key={x.customer}>
                <td className="px-4 py-2.5">
                  <p className="font-medium text-gray-900">{x.customer}</p>
                  {x.gstin && <p className="text-xs text-gray-500 font-mono">{x.gstin}</p>}
                </td>
                <td className="px-4 py-2.5 text-gray-600">{x.rows.map((i) => i.number).join(", ")}</td>
                <td className="px-4 py-2.5 text-right">{money(x.invoiceValue)}</td>
                <td className="px-4 py-2.5 text-right font-semibold">{money(x.tds)}</td>
              </tr>
            ))}
            {!r.rows.length && (
              <tr>
                <td colSpan={4} className="px-4 py-12 text-center text-gray-500">
                  No TDS recorded in this period. TDS is entered when you record a payment on an invoice.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="px-4 py-3 text-xs text-gray-500 border-t border-gray-200">Match these against Form 26AS / AIS before claiming the credit in your income tax return.</p>
    </Card>
  );
}

/* ─── Chart of accounts ────────────────────────────────────────────────── */

const blankAccount = { name: "", group: "Bank Accounts", openingBalance: "", openingSide: "Dr", bankName: "", accountNumber: "", ifsc: "" };

function ChartOfAccountsView({ entries }) {
  const { accounts, addAccount, editAccount, removeAccount } = useAccounts();
  const { success, error: toastError } = useToast();
  const [form, setForm] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const balances = useMemo(() => new Map(ledgerBalancesFrom(entries)), [entries]);

  const save = async () => {
    const name = form.name.trim();
    if (!name) {
      toastError("Ledger name is required.");
      return;
    }
    if (accounts.some((a) => a.name.toLowerCase() === name.toLowerCase() && a.id !== editingId)) {
      toastError("A ledger with that name already exists.");
      return;
    }
    const doc = { ...form, name, openingBalance: Number(form.openingBalance) || 0 };
    delete doc.id;
    const res = editingId ? await editAccount(editingId, doc) : await addAccount(doc);
    if (res.success) {
      success(`${name} saved.`);
      setForm(null);
      setEditingId(null);
    } else toastError(res.error);
  };

  const setF = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <Card
      title="Chart of accounts"
      actions={
        <button
          onClick={() => {
            setForm({ ...blankAccount });
            setEditingId(null);
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-3.5 h-3.5" /> New ledger
        </button>
      }
    >
      {form && (
        <div className="p-4 border-b border-gray-200 bg-slate-50 grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <label className="block">
            <span className="block text-xs text-gray-600 mb-1">Ledger name *</span>
            <input className={`${field} w-full`} value={form.name} onChange={setF("name")} placeholder="e.g. HDFC Current A/c" />
          </label>
          <label className="block">
            <span className="block text-xs text-gray-600 mb-1">Under group</span>
            <select className={`${field} w-full`} value={form.group} onChange={setF("group")}>
              {Object.keys(GROUPS).map((g) => (
                <option key={g}>{g}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="block text-xs text-gray-600 mb-1">Opening balance (₹)</span>
            <input type="number" min="0" className={`${field} w-full`} value={form.openingBalance} onChange={setF("openingBalance")} />
          </label>
          <label className="block">
            <span className="block text-xs text-gray-600 mb-1">Dr / Cr</span>
            <select className={`${field} w-full`} value={form.openingSide} onChange={setF("openingSide")}>
              <option value="Dr">Dr (asset / receivable)</option>
              <option value="Cr">Cr (liability / capital)</option>
            </select>
          </label>
          {form.group === "Bank Accounts" && (
            <>
              <label className="block">
                <span className="block text-xs text-gray-600 mb-1">Bank name</span>
                <input className={`${field} w-full`} value={form.bankName} onChange={setF("bankName")} />
              </label>
              <label className="block">
                <span className="block text-xs text-gray-600 mb-1">Account number</span>
                <input className={`${field} w-full`} value={form.accountNumber} onChange={setF("accountNumber")} />
              </label>
              <label className="block">
                <span className="block text-xs text-gray-600 mb-1">IFSC</span>
                <input className={`${field} w-full uppercase`} value={form.ifsc} onChange={setF("ifsc")} />
              </label>
              <label className="block">
                <span className="block text-xs text-gray-600 mb-1">Cheque print nudge (mm → / ↓)</span>
                <div className="flex gap-2">
                  <input type="number" step="0.5" className={`${field} w-full`} value={form.chequeLayout?.dx ?? 0} onChange={(e) => setForm((f) => ({ ...f, chequeLayout: { ...(f.chequeLayout || {}), dx: Number(e.target.value) || 0 } }))} aria-label="Move right (mm)" />
                  <input type="number" step="0.5" className={`${field} w-full`} value={form.chequeLayout?.dy ?? 0} onChange={(e) => setForm((f) => ({ ...f, chequeLayout: { ...(f.chequeLayout || {}), dy: Number(e.target.value) || 0 } }))} aria-label="Move down (mm)" />
                </div>
              </label>
            </>
          )}
          <div className="flex items-end gap-2">
            <button onClick={save} className="flex items-center gap-1.5 px-4 py-2 text-sm text-white bg-green-600 rounded-lg hover:bg-green-700">
              <Save className="w-4 h-4" /> Save
            </button>
            <button onClick={() => setForm(null)} className="px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg">
              Cancel
            </button>
          </div>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[720px] tabular-nums">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-2.5 text-left">Ledger</th>
              <th className="px-4 py-2.5 text-left">Group</th>
              <th className="px-4 py-2.5 text-right">Opening</th>
              <th className="px-4 py-2.5 text-right">Current balance</th>
              <th className="px-4 py-2.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {accounts.map((a) => {
              const bal = balances.get(a.name) || 0;
              return (
                <tr key={a.id}>
                  <td className="px-4 py-2.5">
                    <p className="font-medium text-gray-900">{a.name}</p>
                    {a.accountNumber && <p className="text-xs text-gray-500">{[a.bankName, a.accountNumber, a.ifsc].filter(Boolean).join(" · ")}</p>}
                  </td>
                  <td className="px-4 py-2.5 text-gray-600">{a.group}</td>
                  <td className="px-4 py-2.5 text-right">{a.openingBalance ? `${money(a.openingBalance)} ${a.openingSide}` : "—"}</td>
                  <td className="px-4 py-2.5 text-right font-semibold">{`${money(Math.abs(bal))} ${bal >= 0 ? "Dr" : "Cr"}`}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => {
                          setForm({ ...blankAccount, ...a });
                          setEditingId(a.id);
                        }}
                        className="p-1.5 text-gray-500 hover:bg-gray-100 rounded"
                        aria-label="Edit ledger"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => (Math.abs(bal - (a.openingSide === "Cr" ? -1 : 1) * (Number(a.openingBalance) || 0)) > 0.005 ? toastError(`${a.name} has transactions — it can't be deleted.`) : window.confirm(`Delete ${a.name}?`) && removeAccount(a.id))}
                        className="p-1.5 text-red-500 hover:bg-red-50 rounded"
                        aria-label="Delete ledger"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {!accounts.length && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-gray-500">
                  Customers, suppliers, sales, purchases, GST and expense ledgers are created automatically. Add bank accounts, cash, capital, loans and fixed assets here.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

const ledgerBalancesFrom = (entries) => {
  const map = new Map();
  for (const e of entries) for (const l of e.lines) map.set(l.ledger, (map.get(l.ledger) || 0) + l.dr - l.cr);
  return [...map.entries()];
};

/* ─── Bill-wise outstanding & ageing ───────────────────────────────────── */

function OutstandingView({ data, asOn }) {
  const [side, setSide] = useState("Receivables");
  const [open, setOpen] = useState(null);
  const result = useMemo(
    () => (side === "Receivables" ? receivablesAgeing(data.invoices || [], asOn) : payablesAgeing(data.purchases || [], data.debitNotes || [], asOn)),
    [side, data.invoices, data.purchases, data.debitNotes, asOn]
  );
  const tone = (k) => (k === "90+" ? "text-red-700" : k === "61-90" ? "text-orange-600" : k === "Not due" ? "text-gray-500" : "text-gray-800");
  return (
    <Card
      title={`${side} as on ${asOn} · ₹${money(result.totals.total)}`}
      actions={
        <>
          <div className="flex p-1 bg-white border border-slate-300 rounded-xl">
            {["Receivables", "Payables"].map((t) => (
              <button key={t} onClick={() => { setSide(t); setOpen(null); }} className={`px-3 py-1 rounded-lg text-xs font-semibold ${side === t ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-50"}`}>
                {t}
              </button>
            ))}
          </div>
          <CsvButton
            onClick={() =>
              downloadCsv(`${side.toLowerCase()}-ageing.csv`, [
                ["Party", "Bill", "Bill date", "Due date", "Overdue days", "Amount", "Balance", "Bucket"],
                ...result.rows.flatMap((r) => r.bills.map((b) => [r.party, b.number, b.date, b.dueDate, b.overdueDays, b.amount, b.balance, b.bucket])),
              ])
            }
          />
        </>
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[860px] tabular-nums">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-2.5 text-left">{side === "Receivables" ? "Customer" : "Supplier"}</th>
              {BUCKETS.map((k) => (
                <th key={k} className="px-4 py-2.5 text-right">
                  {k === "Not due" ? k : `${k} days`}
                </th>
              ))}
              <th className="px-4 py-2.5 text-right">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {result.rows.map((r) => (
              <React.Fragment key={r.party}>
                <tr className="hover:bg-gray-50 cursor-pointer" onClick={() => setOpen(open === r.party ? null : r.party)}>
                  <td className="px-4 py-2.5 font-medium text-gray-900">
                    {r.party} <span className="text-xs text-gray-400">({r.bills.length})</span>
                  </td>
                  {BUCKETS.map((k) => (
                    <td key={k} className={`px-4 py-2.5 text-right ${tone(k)}`}>
                      {blankIfZero(r.buckets[k])}
                    </td>
                  ))}
                  <td className="px-4 py-2.5 text-right font-semibold">{money(r.total)}</td>
                </tr>
                {open === r.party &&
                  r.bills.map((b) => (
                    <tr key={b.id} className="bg-slate-50 text-xs">
                      <td className="px-8 py-1.5 text-gray-700">
                        {b.number} · {b.date} · due {b.dueDate}
                        {b.overdueDays > 0 && <span className="text-red-600"> · {b.overdueDays} days overdue</span>}
                      </td>
                      {BUCKETS.map((k) => (
                        <td key={k} className="px-4 py-1.5 text-right">
                          {b.bucket === k ? money(b.balance) : ""}
                        </td>
                      ))}
                      <td className="px-4 py-1.5 text-right text-gray-500">of {money(b.amount)}</td>
                    </tr>
                  ))}
              </React.Fragment>
            ))}
            {!result.rows.length && (
              <tr>
                <td colSpan={BUCKETS.length + 2} className="px-4 py-12 text-center text-gray-500">
                  Nothing outstanding.
                </td>
              </tr>
            )}
            {result.rows.length > 0 && (
              <tr className="bg-slate-50 font-bold">
                <td className="px-4 py-2.5">Total</td>
                {BUCKETS.map((k) => (
                  <td key={k} className={`px-4 py-2.5 text-right ${tone(k)}`}>
                    {blankIfZero(result.totals[k])}
                  </td>
                ))}
                <td className="px-4 py-2.5 text-right">{money(result.totals.total)}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {side === "Payables" && <p className="px-4 py-3 text-xs text-gray-500 border-t border-gray-200">Purchase bills without a due date are treated as due 30 days after the bill date.</p>}
    </Card>
  );
}

/* ─── Audit trail (edit log) ───────────────────────────────────────────── */

const ACTION_TONE = { create: "bg-green-50 text-green-700", update: "bg-amber-50 text-amber-700", delete: "bg-red-50 text-red-700" };

function AuditView({ period }) {
  const { vouchers: log, loading } = useVouchers("auditTrail");
  const [kind, setKind] = useState("");
  const [action, setAction] = useState("");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(null);

  const rows = useMemo(() => {
    const text = q.trim().toLowerCase();
    return [...(log || [])]
      .map((e) => ({ ...e, when: e.clientAt || (e.at?.toISOString ? e.at.toISOString() : "") }))
      .filter((e) => (!period.from || e.when.slice(0, 10) >= period.from) && (!period.to || e.when.slice(0, 10) <= period.to))
      .filter((e) => (!kind || e.collection === kind) && (!action || e.action === action))
      .filter((e) => !text || [e.summary, e.byEmail, e.docId].some((t) => String(t || "").toLowerCase().includes(text)))
      .sort((a, b) => b.when.localeCompare(a.when))
      .slice(0, 500);
  }, [log, period.from, period.to, kind, action, q]);

  const kinds = [...new Set((log || []).map((e) => e.collection))].sort();

  return (
    <Card
      title={`Audit trail · ${rows.length} change${rows.length === 1 ? "" : "s"}`}
      actions={
        <>
          <input className={`${field} w-44`} placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} />
          <select className={field} value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="">All records</option>
            {kinds.map((k) => (
              <option key={k} value={k}>
                {COLLECTION_LABELS[k] || k}
              </option>
            ))}
          </select>
          <select className={field} value={action} onChange={(e) => setAction(e.target.value)}>
            <option value="">All actions</option>
            <option value="create">Created</option>
            <option value="update">Edited</option>
            <option value="delete">Deleted</option>
          </select>
          <CsvButton
            onClick={() =>
              downloadCsv("audit-trail.csv", [
                ["When", "User", "Action", "Record", "Reference", "Changes"],
                ...rows.map((e) => [e.when, e.byEmail || e.by, e.action, COLLECTION_LABELS[e.collection] || e.collection, e.summary || e.docId, auditDiff(e.before, e.after).map((d) => `${d.field}: ${d.from} → ${d.to}`).join("; ")]),
              ])
            }
          />
        </>
      }
    >
      <div className="divide-y divide-gray-100">
        {rows.map((e) => {
          const diff = open === e.id ? auditDiff(e.before, e.after) : null;
          return (
            <div key={e.id}>
              <button onClick={() => setOpen(open === e.id ? null : e.id)} className="w-full flex flex-wrap items-center gap-3 px-4 py-2.5 text-left hover:bg-gray-50">
                <span className="text-xs text-gray-500 w-36 shrink-0 tabular-nums">{e.when ? new Date(e.when).toLocaleString("en-IN") : "—"}</span>
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${ACTION_TONE[e.action] || "bg-gray-100 text-gray-600"}`}>{e.action}</span>
                <span className="text-sm font-medium text-gray-900">{COLLECTION_LABELS[e.collection] || e.collection}</span>
                <span className="text-sm text-gray-600 truncate flex-1">{e.summary || e.docId}</span>
                <span className="text-xs text-gray-500">{e.byEmail || e.by}</span>
              </button>
              {diff && (
                <div className="px-4 pb-3">
                  {diff.length ? (
                    <table className="w-full text-xs">
                      <thead className="text-gray-500">
                        <tr>
                          <th className="text-left py-1 w-48">Field</th>
                          <th className="text-left py-1">Before</th>
                          <th className="text-left py-1">After</th>
                        </tr>
                      </thead>
                      <tbody>
                        {diff.map((d) => (
                          <tr key={d.field} className="border-t border-gray-100 align-top">
                            <td className="py-1 font-medium text-gray-700">{d.field}</td>
                            <td className="py-1 text-red-700 break-all">{d.from}</td>
                            <td className="py-1 text-green-700 break-all">{d.to}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <p className="text-xs text-gray-500">No field changes recorded.</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {!rows.length && <p className="px-4 py-12 text-center text-sm text-gray-500">{loading ? "Loading…" : "No changes recorded in this period."}</p>}
      </div>
      <p className="px-4 py-3 text-xs text-gray-500 border-t border-gray-200">
        Every create, edit and delete is logged with the user and time. Entries cannot be edited or deleted (edit log as required for company books from 1 April 2023).
      </p>
    </Card>
  );
}

/* ─── Journal / Contra entry ───────────────────────────────────────────── */

const JOURNAL_TYPES = ["Journal", "Contra", "Payment", "Receipt"];
const emptyLine = () => ({ id: Date.now() + Math.random(), ledger: "", group: "Indirect Expenses", dr: "", cr: "" });

function JournalView({ entries }) {
  const { vouchers: journals, addVoucher, removeVoucher } = useVouchers("journals");
  const { success, error: toastError } = useToast();
  const names = useMemo(() => ledgerNames(entries), [entries]);
  const [type, setType] = useState("Journal");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [narration, setNarration] = useState("");
  const [costCentre, setCostCentre] = useState("");
  const { names: costCentreNames } = useCostCentres();
  const [lines, setLines] = useState([emptyLine(), emptyLine()]);

  const dr = lines.reduce((s, l) => s + (Number(l.dr) || 0), 0);
  const cr = lines.reduce((s, l) => s + (Number(l.cr) || 0), 0);
  const balanced = dr > 0 && Math.abs(dr - cr) < 0.005;

  const setLine = (id, patch) =>
    setLines((ls) =>
      ls.map((l) => {
        if (l.id !== id) return l;
        const next = { ...l, ...patch };
        const known = names.find((x) => x.ledger === next.ledger);
        if (patch.ledger !== undefined && known) next.group = known.group;
        return next;
      })
    );

  const save = async () => {
    const clean = lines.filter((l) => l.ledger.trim() && (Number(l.dr) || Number(l.cr)));
    if (clean.length < 2 || !balanced) {
      toastError("Debit and credit totals must match, with at least two ledgers.");
      return;
    }
    const prefix = type === "Journal" ? "JV" : type === "Contra" ? "CV" : type === "Payment" ? "PV" : "RV";
    const res = await addVoucher({
      voucherType: type,
      voucherNumber: nextVoucherNumber(journals, prefix, new Date(date)),
      voucherDate: date,
      narration,
      costCentre,
      lines: clean.map((l) => ({ ledger: l.ledger.trim(), group: l.group, dr: Number(l.dr) || 0, cr: Number(l.cr) || 0 })),
    });
    if (res.success) {
      success(`${type} voucher saved.`);
      setNarration("");
      setLines([emptyLine(), emptyLine()]);
    } else toastError(`Could not save: ${res.error}`);
  };

  return (
    <div className="space-y-6">
      <Card
        title="New voucher"
        actions={
          <div className="flex p-1 bg-white border border-slate-300 rounded-xl">
            {JOURNAL_TYPES.map((t) => (
              <button key={t} onClick={() => setType(t)} className={`px-3 py-1 rounded-lg text-xs font-semibold ${type === t ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-50"}`}>
                {t}
              </button>
            ))}
          </div>
        }
      >
        <div className="p-4 space-y-4">
          <p className="text-xs text-gray-500">
            {type === "Journal" && "Adjustments between any ledgers — depreciation, provisions, write-offs, opening balances."}
            {type === "Contra" && "Cash ↔ bank movements: deposits, withdrawals, transfers between bank accounts."}
            {type === "Payment" && "Money paid out — e.g. to a supplier (Dr supplier, Cr Cash/Bank)."}
            {type === "Receipt" && "Money received other than against an invoice — e.g. advances, other income."}
          </p>
          <div className="flex flex-wrap gap-3">
            <input type="date" className={field} value={date} onChange={(e) => setDate(e.target.value)} />
            <input className={`${field} flex-1 min-w-[240px]`} placeholder="Narration" value={narration} onChange={(e) => setNarration(e.target.value)} />
            {costCentreNames.length > 0 && (
              <select className={field} value={costCentre} onChange={(e) => setCostCentre(e.target.value)}>
                <option value="">No cost centre</option>
                {costCentreNames.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            )}
          </div>
          <datalist id="ledger-names">
            {names.map((x) => (
              <option key={x.ledger} value={x.ledger} />
            ))}
            <option value="Cash" />
            <option value="Bank" />
            <option value="Capital" />
            <option value="Depreciation" />
          </datalist>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[720px]">
              <thead className="text-xs uppercase text-gray-500">
                <tr>
                  <th className="p-2 text-left">Ledger</th>
                  <th className="p-2 text-left w-56">Group (for a new ledger)</th>
                  <th className="p-2 text-right w-36">Debit</th>
                  <th className="p-2 text-right w-36">Credit</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => (
                  <tr key={l.id}>
                    <td className="p-1.5">
                      <input list="ledger-names" className={`${field} w-full`} value={l.ledger} onChange={(e) => setLine(l.id, { ledger: e.target.value })} placeholder="Ledger name" />
                    </td>
                    <td className="p-1.5">
                      <select className={`${field} w-full`} value={l.group} onChange={(e) => setLine(l.id, { group: e.target.value })}>
                        {Object.keys(GROUPS).map((g) => (
                          <option key={g}>{g}</option>
                        ))}
                      </select>
                    </td>
                    <td className="p-1.5">
                      <input type="number" min="0" className={`${field} w-full text-right`} value={l.dr} onChange={(e) => setLine(l.id, { dr: e.target.value, cr: e.target.value ? "" : l.cr })} />
                    </td>
                    <td className="p-1.5">
                      <input type="number" min="0" className={`${field} w-full text-right`} value={l.cr} onChange={(e) => setLine(l.id, { cr: e.target.value, dr: e.target.value ? "" : l.dr })} />
                    </td>
                    <td className="p-1.5">
                      <button onClick={() => setLines((ls) => (ls.length > 2 ? ls.filter((x) => x.id !== l.id) : ls))} className="p-2 text-red-500 hover:bg-red-50 rounded" aria-label="Remove line">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
                <tr className="font-bold tabular-nums">
                  <td className="p-2">
                    <button onClick={() => setLines((ls) => [...ls, emptyLine()])} className="flex items-center gap-1 text-xs font-semibold text-blue-600">
                      <Plus className="w-3.5 h-3.5" /> Add line
                    </button>
                  </td>
                  <td className="p-2 text-right text-gray-500">Total</td>
                  <td className="p-2 text-right">{money(dr)}</td>
                  <td className="p-2 text-right">{money(cr)}</td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between">
            <BalanceBadge ok={balanced} label={balanced ? "Debit = Credit" : `Difference ₹${money(Math.abs(dr - cr))}`} />
            <button onClick={save} disabled={!balanced} className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50">
              <Save className="w-4 h-4" /> Save {type}
            </button>
          </div>
        </div>
      </Card>

      <Card title={`Saved vouchers · ${journals.length}`}>
        <div className="divide-y divide-gray-100">
          {[...journals]
            .sort((a, b) => String(b.voucherDate).localeCompare(String(a.voucherDate)))
            .map((j) => (
              <div key={j.id} className="flex items-start justify-between gap-4 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-gray-900">
                    {j.voucherType} {j.voucherNumber} · <span className="font-normal text-gray-500">{j.voucherDate}</span>
                  </p>
                  <p className="text-xs text-gray-500">{j.narration}</p>
                  <p className="text-xs text-gray-600 mt-1">{(j.lines || []).map((l) => `${l.dr ? "Dr" : "Cr"} ${l.ledger} ${money(l.dr || l.cr)}`).join(" · ")}</p>
                </div>
                <button
                  onClick={async () => {
                    if (!window.confirm(`Delete ${j.voucherType} ${j.voucherNumber}?`)) return;
                    const res = await removeVoucher(j.id);
                    if (!res.success) toastError(res.error);
                  }}
                  className="p-2 text-red-500 hover:bg-red-50 rounded"
                  aria-label="Delete voucher"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          {!journals.length && <p className="px-4 py-8 text-center text-sm text-gray-500">No manual vouchers yet.</p>}
        </div>
      </Card>
    </div>
  );
}

/* ─── Page ─────────────────────────────────────────────────────────────── */

export default function AccountsPage() {
  const data = useBooksData();
  const { companyProfile } = useCompanyProfile();
  const [tab, setTab] = useState("Day Book");
  const currentFy = fyOf(new Date().toISOString().slice(0, 10));
  const [fy, setFy] = useState(String(currentFy));
  const [custom, setCustom] = useState({ from: "", to: "" });

  const entries = useMemo(
    () => buildEntries(data),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data.invoices, data.payments, data.expenses, data.creditNotes, data.purchases, data.debitNotes, data.journals, data.customers, data.suppliers, data.payrollRuns, data.accounts]
  );

  const years = useMemo(() => {
    const set = new Set([currentFy]);
    for (const e of entries) if (e.date) set.add(fyOf(e.date));
    return [...set].sort((a, b) => b - a);
  }, [entries, currentFy]);

  const period = fy === "custom" ? { from: custom.from || undefined, to: custom.to || undefined } : { from: `${fy}-04-01`, to: `${Number(fy) + 1}-03-31` };

  const stockData = { products: data.products, invoices: data.invoices, creditNotes: data.creditNotes, purchases: data.purchases, debitNotes: data.debitNotes, stockJournals: data.stockJournals };
  const stock = useMemo(
    () => stockSummary(stockData, period),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data.products, data.invoices, data.creditNotes, data.purchases, data.debitNotes, data.stockJournals, period.from, period.to]
  );
  const stockAll = useMemo(
    () => ({
      initial: initialStockValue(data.products),
      closing: stockSummary(stockData, { to: period.to }).totalClosing,
      ...(period.from ? { priorClosing: stockSummary(stockData, { to: dayBefore(period.from) }).totalClosing } : {}),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data.products, data.invoices, data.creditNotes, data.purchases, data.debitNotes, data.stockJournals, period.from, period.to]
  );

  return (
    <div className="min-h-screen text-slate-800 font-mazzard">
      <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 pb-8 pt-6">
        <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <BookOpen className="w-6 h-6 text-blue-600" /> Books & Statements
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              {companyProfile?.companyName || "Your business"} · double-entry books built from every invoice, note, purchase, receipt and expense.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select className={field} value={fy} onChange={(e) => setFy(e.target.value)}>
              {years.map((y) => (
                <option key={y} value={String(y)}>
                  FY {financialYearLabel(new Date(y, 3, 1))}
                </option>
              ))}
              <option value="custom">Custom period</option>
            </select>
            {fy === "custom" && (
              <>
                <input type="date" className={field} value={custom.from} onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))} />
                <input type="date" className={field} value={custom.to} onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))} />
              </>
            )}
          </div>
        </header>

        <div className="w-fit max-w-full overflow-x-auto pb-1 scrollbar-hide mb-6">
          <div className="flex p-1 bg-white border border-slate-300 rounded-xl whitespace-nowrap shadow-xs">
            {TABS.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${tab === t ? "bg-blue-600 text-white shadow-xs" : "text-slate-600 hover:text-slate-900 hover:bg-slate-50 font-medium"}`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {data.loading && !entries.length ? (
          <p className="text-sm text-gray-500">Loading books…</p>
        ) : (
          <>
            {tab === "Day Book" && <DayBookView entries={entries} period={period} />}
            {tab === "Chart of Accounts" && <ChartOfAccountsView entries={entries} />}
            {tab === "Outstanding" && <OutstandingView data={data} asOn={period.to && period.to < new Date().toISOString().slice(0, 10) ? period.to : new Date().toISOString().slice(0, 10)} />}
            {tab === "Ledger" && <LedgerView entries={entries} period={period} />}
            {tab === "Trial Balance" && <TrialBalanceView entries={entries} period={period} />}
            {tab === "Profit & Loss" && <ProfitLossView entries={entries} period={period} stock={stock} />}
            {tab === "Balance Sheet" && <BalanceSheetView entries={entries} period={period} stockAll={stockAll} />}
            {tab === "Stock Summary" && <StockView stockData={stockData} period={period} products={data.products || []} />}
            {tab === "Batches & Expiry" && <BatchView stockData={stockData} />}
            {tab === "Year End" && <YearEndView entries={entries} years={years} stockData={stockData} products={data.products || []} />}
            {tab === "Cost Centres" && <CostCentreView entries={entries} period={period} />}
            {tab === "Budgets" && <BudgetView key={fy} entries={entries} period={period} fyKey={fy === "custom" ? String(currentFy) : fy} />}
            {tab === "Bank Reconciliation" && <BankRecoView entries={entries} period={period} />}
            {tab === "TDS" && <TdsView invoices={data.invoices || []} period={period} />}
            {tab === "Journal Entry" && <JournalView entries={entries} />}
            {tab === "Audit Trail" && <AuditView period={period} />}
          </>
        )}
      </div>
    </div>
  );
}
