// Settings → Data: import from Tally / Excel / CSV, full backup (JSON + Excel)
// and restore.
import React, { useContext, useState } from "react";
import { addDoc, collection, doc, getDocs, serverTimestamp, Timestamp, writeBatch } from "firebase/firestore";
import { Upload, Download, FileSpreadsheet, DatabaseBackup, RotateCcw, CheckCircle2 } from "lucide-react";
import { db, auth } from "../../lib/firebase/config";
import { AuthContext } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { useCompanyProfile } from "../../context/CompanyProfileContext";
import {
  parseTallyMasters,
  decodeExport,
  parseCsv,
  rowsToRecords,
  dedupe,
  IMPORT_COLUMNS,
  BACKUP_COLLECTIONS,
  RESTORE_COLLECTIONS,
  toPlain,
  fromPlain,
  checkBackup,
  sheetRows,
} from "../../utils/dataImport.js";

const KINDS = { customers: "Customers", suppliers: "Suppliers", products: "Products", accounts: "Ledgers (bank, cash, capital…)" };
const btn = "flex items-center gap-2 px-4 py-2 text-sm rounded-lg font-medium disabled:opacity-50";
const stamp = () => new Date().toISOString().slice(0, 10);

function download(name, blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function readAll(uid, name) {
  try {
    const snap = await getDocs(collection(db, "users", uid, name));
    return snap.docs.map((d) => ({ id: d.id, ...toPlain(d.data()) }));
  } catch {
    return []; // e.g. payroll is owner-only
  }
}

// Writes in batches of 400 (Firestore allows 500 per batch).
async function commitAll(ops) {
  for (let i = 0; i < ops.length; i += 400) {
    const batch = writeBatch(db);
    for (const op of ops.slice(i, i + 400)) op(batch);
    await batch.commit();
  }
}

export default function DataSettings() {
  const { user } = useContext(AuthContext);
  const { companyProfile } = useCompanyProfile();
  const { success, error: toastError } = useToast();
  const uid = user?.businessUid || user?.uid;
  const isOwner = user?.role === "owner";
  const canWrite = user?.role !== "viewer";
  const [preview, setPreview] = useState(null); // { source, sets: { kind: { fresh, duplicates } }, skipped, notes }
  const [busy, setBusy] = useState("");
  const [excelKind, setExcelKind] = useState("customers");

  const existing = async () => ({
    customers: await readAll(uid, "customers"),
    suppliers: await readAll(uid, "suppliers"),
    products: await readAll(uid, "products"),
    accounts: (await readAll(uid, "ledgers")).filter((l) => l.kind === "account"),
  });

  const buildPreview = async (source, parsed, notes = []) => {
    const have = await existing();
    const sets = {};
    for (const kind of Object.keys(KINDS)) if (parsed[kind]?.length) sets[kind] = dedupe(parsed[kind], have[kind]);
    if (!Object.keys(sets).length) {
      toastError("Nothing to import was found in that file.");
      return;
    }
    setPreview({ source, sets, skipped: parsed.skipped || [], notes, counts: Object.fromEntries(Object.entries(have).map(([k, v]) => [k, v.length])) });
  };

  const onTally = async (file) => {
    if (!file) return;
    setBusy("tally");
    try {
      const text = decodeExport(await file.arrayBuffer());
      const parsed = parseTallyMasters(text);
      await buildPreview(`Tally · ${file.name}`, parsed);
    } catch (err) {
      toastError(`Could not read the Tally file: ${err.message}`);
    }
    setBusy("");
  };

  const onSheet = async (file) => {
    if (!file) return;
    setBusy("sheet");
    try {
      let rows;
      if (/\.csv$/i.test(file.name)) rows = parseCsv(await file.text());
      else {
        const { readSheet } = await import("read-excel-file/browser");
        rows = await readSheet(file);
      }
      const { records, unknownColumns, missingName } = rowsToRecords(rows, excelKind);
      if (missingName) toastError(`No name column found. Use a heading like "${IMPORT_COLUMNS[excelKind].name[0]}" or download the template.`);
      else await buildPreview(`${KINDS[excelKind]} · ${file.name}`, { [excelKind]: records }, unknownColumns.length ? [`Ignored columns: ${unknownColumns.join(", ")}`] : []);
    } catch (err) {
      toastError(`Could not read the file: ${err.message}`);
    }
    setBusy("");
  };

  const runImport = async () => {
    setBusy("import");
    try {
      const ops = [];
      const add = (name, data) => ops.push((b) => b.set(doc(collection(db, "users", uid, name)), data));
      const { sets, counts } = preview;
      let serial = counts.customers;
      for (const c of sets.customers?.fresh || []) add("customers", { serialNumber: String(++serial).padStart(2, "0"), customerType: c.gstin ? "Business" : "Individual", customerLanguage: "English", company: c.gstin || "", ...c, createdAt: serverTimestamp() });
      for (const s of sets.suppliers?.fresh || []) add("suppliers", { contactPerson: "", ...s, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
      serial = counts.products;
      for (const p of sets.products?.fresh || []) add("products", { serialNumber: String(++serial).padStart(2, "0"), isActive: true, unit: "", hsn: "", description: "", ...p, createdAt: serverTimestamp() });
      for (const a of sets.accounts?.fresh || []) add("ledgers", { kind: "account", ...a, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
      await commitAll(ops);
      const summary = Object.entries(sets)
        .map(([k, v]) => `${v.fresh.length} ${k}`)
        .join(", ");
      await addDoc(collection(db, "users", uid, "auditTrail"), { at: serverTimestamp(), clientAt: new Date().toISOString(), by: auth.currentUser?.uid, byEmail: auth.currentUser?.email || "", action: "create", collection: "import", docId: "", summary: `Imported ${summary} from ${preview.source}`.slice(0, 120), before: null, after: null }).catch(() => {});
      success(`Imported ${summary}.`);
      setPreview(null);
    } catch (err) {
      toastError(`Import failed: ${err.message}`);
    }
    setBusy("");
  };

  const template = async (kind) => {
    const { default: writeExcelFile } = await import("write-excel-file/browser");
    const heads = Object.values(IMPORT_COLUMNS[kind]).map((names) => names[0].replace(/\b\w/g, (c) => c.toUpperCase()));
    await writeExcelFile([heads]).toFile(`kanakku-${kind}-template.xlsx`);
  };

  const collectAll = async () => {
    const collections = {};
    for (const name of BACKUP_COLLECTIONS) collections[name] = await readAll(uid, name);
    return collections;
  };

  const backupJson = async () => {
    setBusy("json");
    try {
      const collections = await collectAll();
      const body = { app: "kanakku-desk", version: 1, exportedAt: new Date().toISOString(), business: toPlain(companyProfile || {}), collections };
      download(`kanakku-backup-${stamp()}.json`, new Blob([JSON.stringify(body)], { type: "application/json" }));
      const n = Object.values(collections).reduce((s, l) => s + l.length, 0);
      success(`Backup downloaded (${n} records). Keep it somewhere safe.`);
    } catch (err) {
      toastError(`Backup failed: ${err.message}`);
    }
    setBusy("");
  };

  const backupExcel = async () => {
    setBusy("xlsx");
    try {
      const { default: writeExcelFile } = await import("write-excel-file/browser");
      const collections = await collectAll();
      const sheets = Object.entries(collections)
        .filter(([name, docs]) => docs.length && name !== "auditTrail")
        .map(([name, docs]) => ({ sheet: name.slice(0, 31), data: sheetRows(docs) }));
      if (!sheets.length) return toastError("There's nothing to export yet.");
      await writeExcelFile(sheets).toFile(`kanakku-books-${stamp()}.xlsx`);
    } catch (err) {
      toastError(`Export failed: ${err.message}`);
    } finally {
      setBusy("");
    }
  };

  const restore = async (file) => {
    if (!file) return;
    let json;
    try {
      json = JSON.parse(await file.text());
    } catch {
      return toastError("That file isn't valid JSON.");
    }
    const problem = checkBackup(json);
    if (problem) return toastError(problem);
    const total = RESTORE_COLLECTIONS.reduce((s, c) => s + (json.collections[c]?.length || 0), 0);
    if (!window.confirm(`Restore ${total} records from the backup of ${String(json.exportedAt).slice(0, 10)}? Records with the same ID are overwritten; records added since the backup are kept.`)) return;
    setBusy("restore");
    try {
      const ops = [];
      for (const name of RESTORE_COLLECTIONS)
        for (const d of json.collections[name] || []) {
          if (!d?.id || typeof d.id !== "string" || d.id.includes("/")) continue;
          const { id, ...data } = d;
          ops.push((b) => b.set(doc(db, "users", uid, name, id), fromPlain(data, (dt) => Timestamp.fromDate(dt))));
        }
      await commitAll(ops);
      await addDoc(collection(db, "users", uid, "auditTrail"), { at: serverTimestamp(), clientAt: new Date().toISOString(), by: auth.currentUser?.uid, byEmail: auth.currentUser?.email || "", action: "update", collection: "restore", docId: "", summary: `Restored ${ops.length} records from backup of ${String(json.exportedAt).slice(0, 10)}`, before: null, after: null }).catch(() => {});
      success(`Restored ${ops.length} records. Reloading…`);
      setTimeout(() => window.location.reload(), 1200);
    } catch (err) {
      toastError(`Restore failed: ${err.message}`);
    }
    setBusy("");
  };

  const fileInput = (accept, onFile, label, key, disabled) => (
    <label className={`${btn} cursor-pointer text-white bg-blue-600 hover:bg-blue-700 ${disabled ? "opacity-50 pointer-events-none" : ""}`}>
      <Upload className="w-4 h-4" /> {busy === key ? "Reading…" : label}
      <input
        type="file"
        accept={accept}
        className="hidden"
        disabled={disabled}
        onChange={(e) => {
          onFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </label>
  );

  return (
    <div className="p-6 space-y-8">
      {canWrite && (
        <section>
          <h3 className="text-lg font-semibold text-gray-900">Import from Tally</h3>
          <p className="text-sm text-gray-600 mt-1">
            In Tally Prime: <b>Export → Masters</b> (format XML). Customers (Sundry Debtors), suppliers (Sundry Creditors), bank, cash, capital and loan ledgers with their opening balances, and stock items with HSN, GST rate and opening stock are
            brought in. Names that already exist are skipped.
          </p>
          <div className="mt-3">{fileInput(".xml,.txt", onTally, "Choose Tally XML", "tally", Boolean(busy))}</div>
        </section>
      )}

      {canWrite && (
        <section>
          <h3 className="text-lg font-semibold text-gray-900">Import from Excel / CSV</h3>
          <p className="text-sm text-gray-600 mt-1">One list per file, with a heading row. Download a template to see the columns.</p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <select value={excelKind} onChange={(e) => setExcelKind(e.target.value)} className="px-3 py-2 text-sm bg-gray-100 rounded-lg" aria-label="What the file contains">
              <option value="customers">Customers</option>
              <option value="suppliers">Suppliers</option>
              <option value="products">Products</option>
            </select>
            {fileInput(".xlsx,.csv", onSheet, "Choose Excel or CSV", "sheet", Boolean(busy))}
            <button onClick={() => template(excelKind)} className={`${btn} text-blue-700 bg-blue-50 hover:bg-blue-100`}>
              <FileSpreadsheet className="w-4 h-4" /> Template
            </button>
          </div>
        </section>
      )}

      {preview && (
        <section className="p-4 rounded-xl border border-blue-200 bg-blue-50/50">
          <h4 className="font-semibold text-gray-900">Ready to import · {preview.source}</h4>
          <table className="w-full text-sm mt-3">
            <thead className="text-xs uppercase text-gray-500">
              <tr>
                <th className="text-left py-1">List</th>
                <th className="text-right py-1">New</th>
                <th className="text-right py-1">Already exist (skipped)</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(preview.sets).map(([k, v]) => (
                <tr key={k} className="border-t border-blue-100">
                  <td className="py-1.5">{KINDS[k]}</td>
                  <td className="py-1.5 text-right font-semibold">{v.fresh.length}</td>
                  <td className="py-1.5 text-right text-gray-500" title={v.duplicates.map((d) => d.name).join(", ")}>
                    {v.duplicates.length}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {preview.skipped.length > 0 && <p className="text-xs text-gray-500 mt-2">{preview.skipped.length} ledgers (sales, purchase, tax, expense) are created automatically here and were not imported.</p>}
          {preview.notes.map((n) => (
            <p key={n} className="text-xs text-amber-700 mt-1">
              {n}
            </p>
          ))}
          <div className="mt-3 flex gap-2">
            <button onClick={runImport} disabled={busy === "import"} className={`${btn} text-white bg-green-600 hover:bg-green-700`}>
              <CheckCircle2 className="w-4 h-4" /> {busy === "import" ? "Importing…" : "Import"}
            </button>
            <button onClick={() => setPreview(null)} className={`${btn} text-gray-700 bg-white border border-gray-300`}>
              Cancel
            </button>
          </div>
        </section>
      )}

      <section>
        <h3 className="text-lg font-semibold text-gray-900">Backup &amp; export</h3>
        <p className="text-sm text-gray-600 mt-1">A full backup has every invoice, voucher, customer, product, ledger and setting. The Excel export has one sheet per list for your CA.</p>
        <div className="mt-3 flex flex-wrap gap-3">
          <button onClick={backupJson} disabled={Boolean(busy)} className={`${btn} text-white bg-slate-800 hover:bg-slate-900`}>
            <DatabaseBackup className="w-4 h-4" /> {busy === "json" ? "Preparing…" : "Download full backup"}
          </button>
          <button onClick={backupExcel} disabled={Boolean(busy)} className={`${btn} text-emerald-800 bg-emerald-50 hover:bg-emerald-100`}>
            <Download className="w-4 h-4" /> {busy === "xlsx" ? "Preparing…" : "Export to Excel"}
          </button>
        </div>
      </section>

      {isOwner && (
        <section>
          <h3 className="text-lg font-semibold text-gray-900">Restore from backup</h3>
          <p className="text-sm text-gray-600 mt-1">Puts back every record in a Kanakku Desk backup file. Records with the same ID are overwritten; anything added after the backup stays.</p>
          <label className={`${btn} mt-3 w-fit cursor-pointer text-amber-900 bg-amber-100 hover:bg-amber-200 ${busy ? "opacity-50 pointer-events-none" : ""}`}>
            <RotateCcw className="w-4 h-4" /> {busy === "restore" ? "Restoring…" : "Choose backup file"}
            <input
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={(e) => {
                restore(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </label>
        </section>
      )}
    </div>
  );
}
