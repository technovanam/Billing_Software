// Business details, bank account and GST defaults. Everything here is printed
// on invoices, challans and reports, so each business's bills carry its own
// name, GSTIN, address and bank account.
import { useEffect, useState } from "react";
import { Building2, Landmark, Percent, Save, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { useCompanyProfile } from "../../context/CompanyProfileContext";
import { useSettings } from "../../hooks/useFirestore";
import { checkGstin } from "../../chatbot/gstin.js";
import { STATES, GST_RATES, stateCodeFromGstin, stateName } from "../../utils/gst.js";

const inputClass =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition";

function Field({ label, hint, children, wide }) {
  return (
    <label className={`block ${wide ? "sm:col-span-2" : ""}`}>
      <span className="block text-sm font-medium text-gray-700 mb-1">{label}</span>
      {children}
      {hint && <span className="block text-xs text-gray-500 mt-1">{hint}</span>}
    </label>
  );
}

function Card({ icon: Icon, title, desc, children }) {
  return (
    <section className="p-6 border-b border-gray-200 last:border-b-0">
      <div className="flex items-start gap-3 mb-5">
        <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-gray-900">{title}</h2>
          <p className="text-sm text-gray-500">{desc}</p>
        </div>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">{children}</div>
    </section>
  );
}

export default function BusinessSettings() {
  const { companyProfile, updateProfile } = useCompanyProfile();
  const { settings, updateSettings } = useSettings();

  const [biz, setBiz] = useState({ companyName: "", ownerName: "", gstin: "", phone: "", address: "", city: "", state: "", pincode: "" });
  const [bank, setBank] = useState({ bankName: "", accountName: "", accountNumber: "", ifsc: "", branch: "", upiId: "" });
  const [defaultGstRate, setDefaultGstRate] = useState(18);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    if (!companyProfile) return;
    setBiz((prev) => Object.fromEntries(Object.keys(prev).map((k) => [k, companyProfile[k] || ""])));
    setBank((prev) => Object.fromEntries(Object.keys(prev).map((k) => [k, companyProfile.bank?.[k] || ""])));
  }, [companyProfile]);

  useEffect(() => {
    const rate = settings?.systemSettings?.value?.systemConfig?.defaultGstRate;
    if (rate !== undefined) setDefaultGstRate(Number(rate));
  }, [settings]);

  const gstinCheck = biz.gstin.trim() ? checkGstin(biz.gstin) : null;
  const gstinState = stateCodeFromGstin(biz.gstin);

  const setBizField = (k) => (e) => {
    const value = e.target.value;
    setBiz((prev) => {
      const next = { ...prev, [k]: value };
      // The GSTIN's first two digits are the state code; keep the state in step.
      if (k === "gstin") {
        const code = stateCodeFromGstin(value);
        if (code) next.state = stateName(code);
      }
      return next;
    });
  };
  const setBankField = (k) => (e) => setBank((prev) => ({ ...prev, [k]: e.target.value }));

  const handleSave = async () => {
    setMessage(null);
    if (!biz.companyName.trim()) {
      setMessage({ type: "error", text: "Company name is required." });
      return;
    }
    if (gstinCheck && !gstinCheck.valid) {
      setMessage({ type: "error", text: `GSTIN looks wrong: ${gstinCheck.problems.join("; ")}.` });
      return;
    }
    if (bank.ifsc && !/^[A-Za-z]{4}0[A-Za-z0-9]{6}$/.test(bank.ifsc.trim())) {
      setMessage({ type: "error", text: "IFSC should be 11 characters, like SBIN0001234." });
      return;
    }
    setSaving(true);
    try {
      await updateProfile({ ...biz, bank });
      const current = settings?.systemSettings?.value || {};
      await updateSettings(
        "systemSettings",
        {
          systemConfig: { ...(current.systemConfig || {}), defaultGstRate: Number(defaultGstRate) },
          systemFeatures: current.systemFeatures || { autoInvoice: true, gstCalculation: true, roundOff: true },
        },
        "System configuration and features"
      );
      setMessage({ type: "success", text: "Business details saved. New invoices will use them." });
    } catch (err) {
      setMessage({ type: "error", text: `Could not save: ${err.message}` });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <Card icon={Building2} title="Business details" desc="Printed at the top of every invoice and challan.">
        <Field label="Company name *">
          <input className={inputClass} value={biz.companyName} onChange={setBizField("companyName")} maxLength={200} />
        </Field>
        <Field label="Owner / contact name">
          <input className={inputClass} value={biz.ownerName} onChange={setBizField("ownerName")} maxLength={200} />
        </Field>
        <Field
          label="GSTIN"
          hint={
            gstinCheck
              ? gstinCheck.valid
                ? `Valid · ${gstinCheck.state}`
                : gstinCheck.problems[0]
              : "Leave empty if you are not GST registered."
          }
        >
          <input
            className={`${inputClass} uppercase font-mono ${gstinCheck && !gstinCheck.valid ? "border-red-400" : ""}`}
            value={biz.gstin}
            onChange={setBizField("gstin")}
            maxLength={15}
            placeholder="33ABCDE1234F1Z5"
          />
        </Field>
        <Field label="Phone">
          <input className={inputClass} value={biz.phone} onChange={setBizField("phone")} maxLength={20} />
        </Field>
        <Field label="Address" wide>
          <input className={inputClass} value={biz.address} onChange={setBizField("address")} maxLength={500} />
        </Field>
        <Field label="City">
          <input className={inputClass} value={biz.city} onChange={setBizField("city")} maxLength={100} />
        </Field>
        <Field label="State" hint={gstinState ? "Set from your GSTIN" : "Decides CGST+SGST vs IGST on bills"}>
          <select className={inputClass} value={biz.state} onChange={setBizField("state")} disabled={Boolean(gstinState)}>
            <option value="">Select state</option>
            {STATES.map((s) => (
              <option key={s.code} value={s.name}>
                {s.name} ({s.code})
              </option>
            ))}
          </select>
        </Field>
        <Field label="Pincode">
          <input className={inputClass} value={biz.pincode} onChange={setBizField("pincode")} maxLength={6} inputMode="numeric" />
        </Field>
      </Card>

      <Card icon={Landmark} title="Bank details" desc="Shown on invoices so customers know where to pay.">
        <Field label="Bank name">
          <input className={inputClass} value={bank.bankName} onChange={setBankField("bankName")} placeholder="State Bank of India" />
        </Field>
        <Field label="Account holder name">
          <input className={inputClass} value={bank.accountName} onChange={setBankField("accountName")} />
        </Field>
        <Field label="Account number">
          <input className={`${inputClass} font-mono`} value={bank.accountNumber} onChange={setBankField("accountNumber")} inputMode="numeric" />
        </Field>
        <Field label="IFSC code">
          <input className={`${inputClass} font-mono uppercase`} value={bank.ifsc} onChange={setBankField("ifsc")} maxLength={11} placeholder="SBIN0001234" />
        </Field>
        <Field label="Branch">
          <input className={inputClass} value={bank.branch} onChange={setBankField("branch")} />
        </Field>
        <Field label="UPI ID (optional)">
          <input className={inputClass} value={bank.upiId} onChange={setBankField("upiId")} placeholder="business@okicici" />
        </Field>
      </Card>

      <Card icon={Percent} title="GST defaults" desc="Used when a product has no GST rate of its own.">
        <Field label="Default GST rate" hint="Set each product's own rate in Products for mixed-rate bills.">
          <select className={inputClass} value={defaultGstRate} onChange={(e) => setDefaultGstRate(Number(e.target.value))}>
            {GST_RATES.map((r) => (
              <option key={r} value={r}>
                {r}%
              </option>
            ))}
          </select>
        </Field>
      </Card>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-6 bg-gray-50 rounded-b-xl">
        <div className="min-h-[20px]">
          {message && (
            <p className={`flex items-center gap-2 text-sm ${message.type === "success" ? "text-green-700" : "text-red-600"}`}>
              {message.type === "success" ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
              {message.text}
            </p>
          )}
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center justify-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-60"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save business details
        </button>
      </div>
    </div>
  );
}
