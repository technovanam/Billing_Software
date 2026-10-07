// GSTR-1 and GSTR-3B for a month, built from saved invoices, credit notes,
// purchases and debit notes (utils/gstReturns.js).
import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Download, FileJson, AlertTriangle, Landmark, UploadCloud, X, Loader2, CheckCircle2 } from "lucide-react";
import { authJsonHeaders } from "../../lib/authHeaders";
import { useBooksData } from "../../hooks/useFirestore";
import { useCompanyProfile } from "../../context/CompanyProfileContext";
import { buildGstr1, buildGstr3b, monthPeriod } from "../../utils/gstReturns.js";
import { parseGstr2b, reconcile2b } from "../../utils/gstr2b.js";
import { stateName } from "../../utils/gst.js";

import { BACKEND_URL } from "../../lib/backend";

const money = (v) => Number(v || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const field = "px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500";

function download(name, text, type = "application/json") {
  const url = URL.createObjectURL(new Blob([text], { type }));
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

function Table({ head, rows, empty = "Nothing in this section for the month." }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm min-w-[720px] tabular-nums">
        <thead className="bg-gray-50 text-xs uppercase text-gray-500">
          <tr>
            {head.map((h, i) => (
              <th key={h} className={`px-4 py-2.5 ${i < 2 ? "text-left" : "text-right"}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((r, i) => (
            <tr key={i} className="hover:bg-gray-50">
              {r.map((c, j) => (
                <td key={j} className={`px-4 py-2 ${j < 2 ? "text-left" : "text-right"}`}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
          {!rows.length && (
            <tr>
              <td colSpan={head.length} className="px-4 py-10 text-center text-gray-500">
                {empty}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

const itemSum = (itms, k) => itms.reduce((s, it) => s + (it.itm_det[k] || 0), 0);
const BACKEND = BACKEND_URL;

async function api(path, body) {
  const res = await fetch(`${BACKEND}${path}`, { method: "POST", headers: await authJsonHeaders(), body: JSON.stringify(body || {}) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const extra = data.missing?.length ? ` Missing on the server: ${data.missing.join(", ")}.` : "";
    throw new Error((data.error || "Request failed.") + extra);
  }
  return data;
}

// OTP -> session -> save GSTR-1 on the GST portal through the GSP.
function UploadDialog({ r, onClose }) {
  const [step, setStep] = useState("start"); // start | otp | uploading | done
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ref, setRef] = useState("");

  const run = async (fn) => {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(e.message === "Failed to fetch" ? "Could not reach the server." : e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h2 className="font-bold text-gray-900">Upload GSTR-1 for {r.period.fp.slice(0, 2)}/{r.period.fp.slice(2)}</h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 space-y-4 text-sm">
          {step === "start" && (
            <>
              <p className="text-gray-600">
                We will ask your GSP to send an OTP to your GST-registered mobile. After you enter it, the GSTR-1 data ({r.summary.b2b.count} B2B, {r.summary.b2cs.count} B2CS rows,
                {" "}{r.summary.cdnr.count} credit notes) is saved on the GST portal. You then submit and file it there with EVC/DSC.
              </p>
              <button
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    await api("/api/gst/returns/otp");
                    setStep("otp");
                  })
                }
                className="w-full flex items-center justify-center gap-2 py-2.5 text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60"
              >
                {busy && <Loader2 className="w-4 h-4 animate-spin" />} Send OTP
              </button>
            </>
          )}
          {step === "otp" && (
            <>
              <label className="block">
                <span className="block text-gray-700 mb-1">OTP sent to your registered mobile</span>
                <input value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 8))} inputMode="numeric" className="w-full px-3 py-2 text-lg tracking-widest bg-gray-100 rounded-lg" autoFocus />
              </label>
              <button
                disabled={busy || otp.length < 4}
                onClick={() =>
                  run(async () => {
                    await api("/api/gst/returns/session", { otp });
                    setStep("uploading");
                    const res = await api("/api/gst/returns/gstr1", { fp: r.period.fp, payload: r.json });
                    setRef(res.referenceId || "");
                    setStep("done");
                  })
                }
                className="w-full flex items-center justify-center gap-2 py-2.5 text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60"
              >
                {busy && <Loader2 className="w-4 h-4 animate-spin" />} Verify & upload
              </button>
            </>
          )}
          {step === "uploading" && (
            <p className="flex items-center gap-2 text-gray-600">
              <Loader2 className="w-4 h-4 animate-spin" /> Uploading…
            </p>
          )}
          {step === "done" && (
            <div className="text-center space-y-2">
              <CheckCircle2 className="w-10 h-10 text-green-600 mx-auto" />
              <p className="font-semibold text-gray-900">Saved on the GST portal</p>
              {ref && <p className="text-gray-600">Reference ID: <span className="font-mono">{ref}</span></p>}
              <p className="text-gray-500">Log in at gst.gov.in → Returns → GSTR-1 to preview, submit and file with EVC/DSC.</p>
            </div>
          )}
          {error && (
            <p className="flex items-start gap-2 text-red-700 bg-red-50 border border-red-100 rounded-lg p-2.5">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> {error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function Gstr1View({ r }) {
  const [section, setSection] = useState("Summary");
  const [uploading, setUploading] = useState(false);
  const sections = ["Summary", "B2B", "B2CL", "B2CS", "Exports", "Credit Notes", "HSN Summary"];
  const s = r.summary;
  return (
    <Card
      title={`GSTR-1 · ${r.period.from} to ${r.period.to}`}
      actions={
        <>
        <button
          onClick={() => setUploading(true)}
          disabled={!r.json.gstin}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 disabled:opacity-50"
        >
          <UploadCloud className="w-3.5 h-3.5" /> Upload to GST portal
        </button>
        <button
          onClick={() => download(`GSTR1_${r.json.gstin || "GSTIN"}_${r.period.fp}.json`, JSON.stringify(r.json, null, 2))}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700"
        >
          <FileJson className="w-3.5 h-3.5" /> Download JSON for GST portal
        </button>
        </>
      }
    >
      {uploading && <UploadDialog r={r} onClose={() => setUploading(false)} />}
      <div className="px-4 pt-3 flex flex-wrap gap-1">
        {sections.map((x) => (
          <button key={x} onClick={() => setSection(x)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${section === x ? "bg-blue-50 text-blue-700" : "text-gray-600 hover:bg-gray-50"}`}>
            {x}
          </button>
        ))}
      </div>
      <div className="pt-2">
        {section === "Summary" && (
          <Table
            head={["Section", "Records", "Taxable value", "IGST", "CGST", "SGST"]}
            rows={[
              ["4A · B2B invoices", s.b2b.count, money(s.b2b.txval), money(s.b2b.iamt), money(s.b2b.camt), money(s.b2b.samt)],
              ["5 · B2C large (inter-state > ₹1 lakh)", s.b2cl.count, money(s.b2cl.txval), money(s.b2cl.iamt), "—", "—"],
              ["6A · Exports", s.exp.count, money(s.exp.txval), money(s.exp.iamt), "—", "—"],
              ["7 · B2C small", s.b2cs.count, money(s.b2cs.txval), money(s.b2cs.iamt), money(s.b2cs.camt), money(s.b2cs.samt)],
              ["9B · Credit notes (registered)", s.cdnr.count, money(s.cdnr.txval), money(s.cdnr.iamt), money(s.cdnr.camt), money(s.cdnr.samt)],
              ["9B · Credit notes (unregistered)", s.cdnur.count, money(s.cdnur.txval), money(s.cdnur.iamt), "—", "—"],
              ["11A · Advances received", s.at.count, money(s.at.txval), money(s.at.iamt), money(s.at.camt), money(s.at.samt)],
              ["11B · Advances adjusted", s.txpd.count, money(s.txpd.txval), money(s.txpd.iamt), money(s.txpd.camt), money(s.txpd.samt)],
              ["12 · HSN summary lines", s.hsn.count, money(s.hsn.txval), "", "", ""],
            ]}
          />
        )}
        {section === "B2B" && (
          <Table
            head={["Invoice", "Customer GSTIN", "Date", "Place of supply", "Invoice value", "Taxable", "Tax"]}
            rows={r.b2bInvoices.map((i) => [i.inum, i.ctin, i.idt, `${i.pos} ${stateName(i.pos)}`, money(i.val), money(itemSum(i.itms, "txval")), money(itemSum(i.itms, "iamt") + itemSum(i.itms, "camt") + itemSum(i.itms, "samt"))])}
          />
        )}
        {section === "Exports" && (
          <Table
            head={["Invoice", "Type", "Date", "Port / Shipping bill", "Value (₹)", "Taxable (₹)", "IGST"]}
            rows={r.expInvoices.map((i) => [i.inum, i.exp_typ === "WPAY" ? "With IGST" : "Under LUT", i.idt, [i.sbpcode, i.sbnum].filter(Boolean).join(" / ") || "—", money(i.val), money(i.itms.reduce((a, it) => a + it.txval, 0)), money(i.itms.reduce((a, it) => a + it.iamt, 0))])}
          />
        )}
        {section === "B2CL" && (
          <Table head={["Invoice", "Place of supply", "Date", "Invoice value", "Taxable", "IGST"]} rows={r.b2clInvoices.map((i) => [i.inum, `${i.pos} ${stateName(i.pos)}`, i.idt, money(i.val), money(itemSum(i.itms, "txval")), money(itemSum(i.itms, "iamt"))])} />
        )}
        {section === "B2CS" && (
          <Table
            head={["Supply", "Place of supply", "Rate", "Taxable", "IGST", "CGST", "SGST"]}
            rows={r.json.b2cs.map((b) => [b.sply_ty === "INTER" ? "Inter-state" : "Intra-state", `${b.pos} ${stateName(b.pos)}`, `${b.rt}%`, money(b.txval), money(b.iamt), money(b.camt), money(b.samt)])}
          />
        )}
        {section === "Credit Notes" && (
          <Table
            head={["Note", "Customer GSTIN", "Date", "Place of supply", "Note value", "Taxable"]}
            rows={[...r.notes.map((nt) => [nt.nt_num, nt.ctin, nt.nt_dt, `${nt.pos} ${stateName(nt.pos)}`, money(nt.val), money(itemSum(nt.itms, "txval"))]), ...r.json.cdnur.map((nt) => [nt.nt_num, "Unregistered (B2CL)", nt.nt_dt, `${nt.pos} ${stateName(nt.pos)}`, money(nt.val), money(itemSum(nt.itms, "txval"))])]}
          />
        )}
        {section === "HSN Summary" && (
          <Table
            head={["HSN/SAC", "Description", "Rate", "Quantity", "Taxable", "IGST", "CGST", "SGST", "Total value"]}
            rows={r.json.hsn.data.map((h) => [h.hsn_sc, h.desc, `${h.rt}%`, h.qty, money(h.txval), money(h.iamt), money(h.camt), money(h.samt), money(h.val)])}
          />
        )}
      </div>
    </Card>
  );
}

function Gstr3bView({ r }) {
  const row = (label, o) => [label, money(o.txval), money(o.iamt), money(o.camt), money(o.samt)];
  return (
    <div className="space-y-6">
      <Card
        title={`GSTR-3B · ${r.period.from} to ${r.period.to}`}
        actions={
          <button
            onClick={() =>
              download(
                `GSTR3B_${r.period.fp}.csv`,
                [
                  ["Table", "Taxable", "IGST", "CGST", "SGST"],
                  ["3.1(a) Outward taxable supplies", r.outward.txval, r.outward.iamt, r.outward.camt, r.outward.samt],
                  ["3.1(c) Nil rated / exempted", r.nil.txval, 0, 0, 0],
                  ["4(A)(5) All other ITC", "", r.itc.iamt, r.itc.camt, r.itc.samt],
                  ["6.1 Tax payable in cash", "", r.setOff.cash.igst, r.setOff.cash.cgst, r.setOff.cash.sgst],
                ]
                  .map((x) => x.join(","))
                  .join("\n"),
                "text/csv"
              )
            }
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <Download className="w-3.5 h-3.5" /> Export CSV
          </button>
        }
      >
        <Table
          head={["Table", "Taxable value", "IGST", "CGST", "SGST"]}
          rows={[
            row("3.1(a) Outward taxable supplies (net of credit notes)", r.outward),
            ["3.1(b) Zero-rated (exports, SEZ)", money(r.zeroRated.txval), money(r.zeroRated.iamt), "—", "—"],
            ["3.1(c) Nil rated & exempted", money(r.nil.txval), "—", "—", "—"],
            row("3.1(d) Inward supplies liable to reverse charge", r.inwardRcm),
            ["4(A)(3) ITC on reverse-charge inward supplies", "—", money(r.itcRcm.iamt), money(r.itcRcm.camt), money(r.itcRcm.samt)],
            ["4(A)(5) All other ITC (purchases − debit notes)", "—", money(r.itc.iamt), money(r.itc.camt), money(r.itc.samt)],
            ...(r.rcmOutward.txval ? [["Outward supplies where the buyer pays tax (RCM)", money(r.rcmOutward.txval), "—", "—", "—"]] : []),
          ]}
        />
      </Card>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card title="6.1 · Payment of tax">
          <Table
            head={["Head", "Output tax", "ITC used", "Payable in cash"]}
            rows={[
              ["IGST", r.outward.iamt + r.zeroRated.iamt],
              ["CGST", r.outward.camt],
              ["SGST", r.outward.samt],
            ].map(([head, outTax]) => {
              const cash = r.setOff.cash[head.toLowerCase()];
              return [head, money(outTax), money(Math.max(0, outTax - cash)), money(cash)];
            })}
          />
          {r.setOff.rcmCash.igst + r.setOff.rcmCash.cgst + r.setOff.rcmCash.sgst > 0 && (
            <div className="px-4 py-2 border-t border-gray-200 flex justify-between text-sm">
              <span>Reverse-charge tax (cash only)</span>
              <span className="tabular-nums">
                IGST ₹{money(r.setOff.rcmCash.igst)} · CGST ₹{money(r.setOff.rcmCash.cgst)} · SGST ₹{money(r.setOff.rcmCash.sgst)}
              </span>
            </div>
          )}
          {r.setOff.cess && r.setOff.cess.due + r.setOff.cess.credit > 0 && (
            <div className="px-4 py-2 border-t border-gray-200 flex justify-between text-sm">
              <span>Compensation cess (cess credit pays cess only)</span>
              <span className="tabular-nums">
                Due ₹{money(r.setOff.cess.due)} · ITC ₹{money(r.setOff.cess.credit)} · Cash ₹{money(r.setOff.cess.cash)}
              </span>
            </div>
          )}
          <div className="px-4 py-3 border-t border-gray-200 flex justify-between font-bold">
            <span>Total tax to pay in cash</span>
            <span className="tabular-nums">₹{money(r.setOff.totalCash)}</span>
          </div>
          <p className="px-4 pb-3 text-xs text-gray-500">
            ITC set-off order: IGST credit → IGST, CGST, SGST; CGST credit → CGST, IGST; SGST credit → SGST, IGST. Unused credit carried forward: IGST ₹{money(r.setOff.carryForward.igst)}, CGST ₹{money(r.setOff.carryForward.cgst)}, SGST ₹{money(r.setOff.carryForward.sgst)}.
          </p>
        </Card>
        <Card title="3.2 · Inter-state supplies to unregistered persons">
          <Table head={["Place of supply", "State", "Taxable", "IGST"]} rows={r.interUnregistered.map((x) => [x.pos, x.name, money(x.txval), money(x.iamt)])} empty="None this month." />
        </Card>
      </div>
    </div>
  );
}

const STATUS_TONE = {
  Matched: "bg-green-50 text-green-700 border-green-200",
  Mismatch: "bg-amber-50 text-amber-700 border-amber-200",
  "Missing in books": "bg-blue-50 text-blue-700 border-blue-200",
  "Missing in 2B": "bg-red-50 text-red-700 border-red-200",
  "ITC not available": "bg-gray-50 text-gray-700 border-gray-200",
};
const STATUS_HELP = {
  Matched: "Safe to claim ITC.",
  Mismatch: "Values differ — check the bill with the supplier.",
  "Missing in books": "Supplier uploaded it; you haven't recorded the purchase.",
  "Missing in 2B": "You recorded it; supplier hasn't uploaded it — ITC at risk.",
  "ITC not available": "Portal marks this ITC as not available.",
};

function Gstr2bView({ ym, purchases, suppliers }) {
  const [parsed, setParsed] = useState(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("");
  const period = monthPeriod(ym);
  const result = useMemo(() => (parsed ? reconcile2b(parsed.docs, purchases, suppliers, period) : null), [parsed, purchases, suppliers, period.from, period.to]); // eslint-disable-line react-hooks/exhaustive-deps

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    try {
      const p = parseGstr2b(JSON.parse(await file.text()));
      if (!p.docs.length) throw new Error("No invoices found in this file.");
      setParsed({ ...p, fileName: file.name });
    } catch (err) {
      setError(`Could not read the file: ${err.message}`);
      setParsed(null);
    }
  };

  const rows = (result?.rows || []).filter((r) => !filter || r.status === filter);

  return (
    <div className="space-y-6">
      <Card title="GSTR-2B reconciliation">
        <div className="p-4 space-y-3 text-sm">
          <p className="text-gray-600">
            Download GSTR-2B for {period.fp.slice(0, 2)}/{period.fp.slice(2)} from gst.gov.in → Returns → GSTR-2B → Download (JSON), then load it here. Purchase bills dated in the
            same month are matched by supplier GSTIN and bill number.
          </p>
          <label className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 cursor-pointer">
            <UploadCloud className="w-4 h-4" /> Load GSTR-2B JSON
            <input type="file" accept=".json,application/json" className="hidden" onChange={onFile} />
          </label>
          {parsed && (
            <span className="ml-3 text-gray-600">
              {parsed.fileName} · {parsed.docs.length} documents{parsed.period ? ` · period ${parsed.period}` : ""}
              {parsed.period && parsed.period !== period.fp && <span className="text-amber-700"> (selected month is {period.fp})</span>}
            </span>
          )}
          {error && <p className="text-red-600">{error}</p>}
        </div>
      </Card>

      {result && (
        <>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {["Matched", "Mismatch", "Missing in books", "Missing in 2B"].map((st) => (
              <button
                key={st}
                onClick={() => setFilter(filter === st ? "" : st)}
                className={`text-left p-4 rounded-lg border shadow-sm ${STATUS_TONE[st]} ${filter === st ? "ring-2 ring-offset-1 ring-blue-400" : ""}`}
              >
                <p className="text-xs font-semibold">{st}</p>
                <p className="text-lg font-bold">
                  {result.totals[st]?.count || 0} · ₹{money(result.totals[st]?.itc || 0)}
                </p>
                <p className="text-[11px] opacity-80">{STATUS_HELP[st]}</p>
              </button>
            ))}
          </div>
          <Card
            title={`${filter || "All documents"} · ${rows.length}`}
            actions={
              <button
                onClick={() =>
                  download(
                    `GSTR2B_reconciliation_${period.fp}.csv`,
                    [
                      ["Status", "Supplier GSTIN", "Supplier", "Bill no", "Portal taxable", "Books taxable", "Portal tax", "Books tax", "Notes"],
                      ...result.rows.map((r) => [
                        r.status,
                        r.portal?.ctin || r.books?.ctin,
                        r.portal?.supplierName || r.books?.supplierName,
                        r.portal?.number || r.books?.number,
                        r.portal?.taxable ?? "",
                        r.books?.taxable ?? "",
                        r.portal ? r.portal.igst + r.portal.cgst + r.portal.sgst : "",
                        r.books ? r.books.igst + r.books.cgst + r.books.sgst : "",
                        (r.diffs || []).map((d) => `${d.field}: portal ${d.portal} / books ${d.books}`).join("; "),
                      ]),
                    ]
                      .map((x) => x.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(","))
                      .join("\n"),
                    "text/csv"
                  )
                }
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                <Download className="w-3.5 h-3.5" /> Export CSV
              </button>
            }
          >
            <Table
              head={["Supplier / bill", "Status", "Date", "Taxable (portal)", "Taxable (books)", "Tax (portal)", "Tax (books)"]}
              rows={rows.map((r) => [
                <div key="s">
                  <p className="font-medium text-gray-900">{r.portal?.supplierName || r.books?.supplierName || "—"}</p>
                  <p className="text-xs text-gray-500 font-mono">
                    {r.portal?.ctin || r.books?.ctin} · {r.portal?.number || r.books?.number}
                  </p>
                  {r.diffs?.length > 0 && <p className="text-xs text-amber-700">{r.diffs.map((d) => `${d.field}: ${d.portal} vs ${d.books}`).join(" · ")}</p>}
                </div>,
                <span key="st" className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${STATUS_TONE[r.status]}`}>
                  {r.status}
                </span>,
                r.portal?.date || r.books?.date,
                r.portal ? money(r.portal.taxable) : "—",
                r.books ? money(r.books.taxable) : "—",
                r.portal ? money(r.portal.igst + r.portal.cgst + r.portal.sgst) : "—",
                r.books ? money(r.books.igst + r.books.cgst + r.books.sgst) : "—",
              ])}
            />
          </Card>
          {result.notes.length > 0 && (
            <p className="text-xs text-gray-500">{result.notes.length} credit/debit note(s) from suppliers in this 2B — record them as debit notes against the matching purchase.</p>
          )}
        </>
      )}
    </div>
  );
}

export default function GstReturnsPage() {
  const data = useBooksData();
  const { companyProfile } = useCompanyProfile();
  const now = new Date();
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const [ym, setYm] = useState(`${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, "0")}`);
  const [tab, setTab] = useState("GSTR-1");

  const gstr1 = useMemo(() => buildGstr1({ invoices: data.invoices, creditNotes: data.creditNotes, advances: data.advances, company: companyProfile, ym }), [data.invoices, data.creditNotes, data.advances, companyProfile, ym]);
  const gstr3b = useMemo(
    () => buildGstr3b({ invoices: data.invoices, creditNotes: data.creditNotes, purchases: data.purchases, debitNotes: data.debitNotes, advances: data.advances, company: companyProfile, ym }),
    [data.invoices, data.creditNotes, data.purchases, data.debitNotes, data.advances, companyProfile, ym]
  );

  return (
    <div className="min-h-screen text-slate-800 font-mazzard">
      <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 pb-8 pt-6">
        <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Landmark className="w-6 h-6 text-blue-600" /> GST Returns
            </h1>
            <p className="text-sm text-gray-600 mt-1">GSTR-1 and GSTR-3B prepared from your invoices, credit notes, purchases and debit notes.</p>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Return period</label>
            <input type="month" className={field} value={ym} onChange={(e) => e.target.value && setYm(e.target.value)} />
          </div>
        </header>

        {!companyProfile?.gstin && (
          <div className="mb-6 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>
              Add your GSTIN in{" "}
              <Link to="/settings" className="font-semibold underline">
                Settings → Business
              </Link>{" "}
              — it is required in the GSTR-1 file.
            </span>
          </div>
        )}

        <div className="w-fit overflow-x-auto pb-1 scrollbar-hide mb-6">
          <div className="flex p-1 bg-white border border-slate-300 rounded-xl whitespace-nowrap shadow-xs">
            {["GSTR-1", "GSTR-3B", "GSTR-2B Reconciliation"].map((t) => (
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

        {tab === "GSTR-1" && <Gstr1View r={gstr1} />}
        {tab === "GSTR-3B" && <Gstr3bView r={gstr3b} />}
        {tab === "GSTR-2B Reconciliation" && <Gstr2bView ym={ym} purchases={data.purchases || []} suppliers={data.suppliers || []} />}

        <p className="text-xs text-gray-500 mt-6">
          Check the JSON in the GST offline tool before uploading. E-invoice (IRN) and direct filing need a GST Suvidha Provider (GSP) connection.
        </p>
      </div>
    </div>
  );
}
