// Pricing plans, plan comparison and the contact-sales form, shared by the
// landing page and the /pricing page.
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { collection, getDocs } from "firebase/firestore";
import {
  Check,
  X,
  Loader2,
  Headphones,
  ArrowRight,
  BadgePercent,
  ShieldCheck,
  Mail,
  Send,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { db } from "../../lib/firebase/config";
import { AVAILABLE_FEATURES, planHasFeature } from "../../utils/planFeatures";
import { CONTAINER, IconChip, Badge, scrollTo } from "./marketing";

import { BACKEND_URL } from "../../lib/backend";

const BACKEND = BACKEND_URL;

// Shown until the super admin publishes plans in Subscription Plans.
// PLACEHOLDER PRICES — replace with real pricing or create plans in the super admin portal.
const DEFAULT_PLANS = [
  {
    id: "default_starter",
    name: "Starter",
    description: "For freelancers and small shops getting started with GST billing.",
    monthlyPrice: 0,
    annualPrice: 0,
    limits: { users: 1, branches: 1, products: 100, invoices: 50 },
    features: { billing: true },
  },
  {
    id: "default_business",
    name: "Business",
    description: "For growing businesses that bill every day and need reports.",
    monthlyPrice: 499,
    annualPrice: 4990,
    popular: true,
    limits: { users: 5, branches: 2, products: 2000, invoices: 1000 },
    features: { billing: true, reports: true, whatsapp: true, inventory: true },
  },
  {
    id: "default_enterprise",
    name: "Enterprise",
    description: "Multiple outlets, larger teams and custom integrations.",
    isCustom: true,
    limits: { users: 50, branches: 20, products: 100000, invoices: 100000 },
    features: { billing: true, multiBranch: true, reports: true, whatsapp: true, api: true, crm: true, inventory: true },
  },
];

// Plans come from the super admin's Subscription Plans (publicly readable).
// Fetched once per session and shared, so moving between pages is instant.
let plansCache = null;
let plansRequest = null;

export function loadPublicPlans() {
  if (!plansRequest) {
    plansRequest = getDocs(collection(db, "subscriptionPlans"))
      .then((snap) => {
        const plans = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((p) => !p.status || String(p.status).toLowerCase() === "active")
          .sort((a, b) => (a.monthlyPrice || a.price || 0) - (b.monthlyPrice || b.price || 0));
        return plans.length ? plans : DEFAULT_PLANS;
      })
      .catch(() => DEFAULT_PLANS)
      .then((plans) => {
        plansCache = plans;
        return plans;
      });
  }
  return plansRequest;
}

export function usePublicPlans() {
  const [plans, setPlans] = useState(plansCache);

  useEffect(() => {
    if (plansCache) return undefined;
    let cancelled = false;
    loadPublicPlans().then((p) => !cancelled && setPlans(p));
    return () => {
      cancelled = true;
    };
  }, []);

  return { plans: plans || [], loading: !plans };
}

const formatINR = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;
const monthlyOf = (plan) => plan.monthlyPrice || plan.price || 0;
const yearlyOf = (plan) => plan.annualPrice || (plan.price || 0) * 10;

function planLimits(plan) {
  return [
    ["User seats", plan.limits?.users || 1],
    ["Branches", plan.limits?.branches || 1],
    ["Products", (plan.limits?.products || 50).toLocaleString("en-IN")],
    ["Invoices / month", (plan.limits?.invoices || 100).toLocaleString("en-IN")],
  ];
}

// Best yearly saving across paid plans, as a whole percentage
export function maxYearlySaving(plans) {
  return plans.reduce((best, p) => {
    const m = monthlyOf(p);
    if (p.isCustom || !m) return best;
    return Math.max(best, Math.round((1 - yearlyOf(p) / (m * 12)) * 100));
  }, 0);
}

function PlanCard({ plan, annual, onContactSales }) {
  const navigate = useNavigate();
  const monthly = monthlyOf(plan);
  const yearly = yearlyOf(plan);
  const included = AVAILABLE_FEATURES.filter((f) => planHasFeature(plan, f));
  const excluded = AVAILABLE_FEATURES.filter((f) => !planHasFeature(plan, f));
  const popular = !!plan.popular;

  let price;
  let note;
  if (plan.isCustom) {
    price = "Custom";
    note = "Tailored to your business";
  } else if (monthly === 0) {
    price = "Free";
    note = "Free forever, no card needed";
  } else if (annual) {
    price = formatINR(Math.round(yearly / 12));
    note = `${formatINR(yearly)} billed yearly`;
  } else {
    price = formatINR(monthly);
    note = `or ${formatINR(yearly)} billed yearly`;
  }

  const cta = plan.isCustom ? (
    <button
      onClick={() => onContactSales(plan.name)}
      className="w-full py-3 text-sm font-semibold rounded-lg border border-gray-300 text-gray-800 hover:bg-gray-50 transition-colors"
    >
      Contact Sales
    </button>
  ) : (
    <button
      onClick={() => navigate("/signup")}
      className={`w-full py-3 text-sm font-semibold rounded-lg transition-colors ${
        popular ? "bg-blue-600 text-white hover:bg-blue-700 shadow-sm" : "bg-gray-900 text-white hover:bg-gray-800"
      }`}
    >
      {monthly === 0 ? "Start for free" : `Choose ${plan.name}`}
    </button>
  );

  return (
    <div
      className={`relative rounded-2xl flex flex-col bg-white transition-shadow ${
        popular ? "border-2 border-blue-600 shadow-xl lg:-my-3" : "border border-gray-200 shadow-sm hover:shadow-md"
      }`}
    >
      {popular && (
        <div className="bg-blue-600 text-white text-[11px] font-bold uppercase tracking-wider text-center py-1.5 rounded-t-[14px]">
          Most popular
        </div>
      )}

      <div className={`p-6 ${popular ? "lg:pt-7" : ""}`}>
        <h3 className="text-lg font-bold text-gray-900">{plan.name}</h3>
        <p className="text-sm text-gray-500 mt-1 min-h-[40px] leading-snug">{plan.description}</p>

        <div className="mt-6 flex items-baseline gap-1.5">
          <span className="text-4xl font-bold text-gray-900 tracking-tight">{price}</span>
          {!plan.isCustom && monthly > 0 && <span className="text-sm text-gray-400">/month</span>}
        </div>
        <p className="text-xs text-gray-500 mt-1.5 h-4">{note}</p>

        <div className="mt-6">{cta}</div>
      </div>

      <div className="px-6 pb-6 flex-1 flex flex-col">
        <div className="grid grid-cols-2 gap-2">
          {planLimits(plan).map(([label, value]) => (
            <div key={label} className="rounded-lg bg-slate-50 border border-gray-100 px-3 py-2">
              <p className="text-sm font-bold text-gray-900">{value}</p>
              <p className="text-[10px] text-gray-500">{label}</p>
            </div>
          ))}
        </div>

        <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mt-6 mb-3">What&apos;s included</p>
        <ul className="space-y-2.5 text-sm flex-1">
          {included.map((feat) => (
            <li key={feat.id} className="flex items-center gap-2.5 text-gray-700">
              <span className="w-5 h-5 rounded-full bg-green-100 text-green-600 flex items-center justify-center flex-shrink-0">
                <Check className="w-3 h-3" strokeWidth={3} />
              </span>
              {feat.name}
            </li>
          ))}
          {excluded.map((feat) => (
            <li key={feat.id} className="flex items-center gap-2.5 text-gray-400">
              <span className="w-5 h-5 rounded-full bg-gray-50 text-gray-300 flex items-center justify-center flex-shrink-0">
                <X className="w-3 h-3" />
              </span>
              {feat.name}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function BillingToggle({ annual, onChange, saving = 0 }) {
  return (
    <div className="inline-flex items-center bg-white border border-gray-200 rounded-full p-1 shadow-sm">
      {[
        [false, "Monthly"],
        [true, "Yearly"],
      ].map(([value, label]) => (
        <button
          key={label}
          onClick={() => onChange(value)}
          className={`flex items-center gap-2 px-5 py-2 text-sm font-medium rounded-full transition-colors ${
            annual === value ? "bg-gray-900 text-white" : "text-gray-600 hover:text-gray-900"
          }`}
        >
          {label}
          {value && saving > 0 && (
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${annual ? "bg-green-400 text-gray-900" : "bg-green-100 text-green-700"}`}>
              Save {saving}%
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

// Plan cards with a monthly / yearly switch. Pass `annual` + `onAnnualChange`
// to control the switch from outside (it is then not rendered here).
export function PricingPlans({ plans, loading, onContactSales, annual: annualProp, onAnnualChange }) {
  const [annualState, setAnnualState] = useState(false);
  const controlled = typeof annualProp === "boolean";
  const annual = controlled ? annualProp : annualState;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-gray-500 gap-2">
        <Loader2 className="w-5 h-5 animate-spin text-blue-600" /> Loading plans…
      </div>
    );
  }

  if (!plans.length) {
    return (
      <div className="max-w-2xl mx-auto bg-white rounded-xl border border-gray-200 shadow-sm p-8 text-center">
        <div className="flex justify-center">
          <IconChip icon={Headphones} tone="blue" />
        </div>
        <h3 className="text-lg font-bold text-gray-900 mt-4 mb-2">Plans tailored to your business</h3>
        <p className="text-sm text-gray-600 mb-6">Tell us about your team and billing volume, and we&apos;ll recommend the right plan.</p>
        <button
          onClick={() => onContactSales("")}
          className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors"
        >
          Contact Sales <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <>
      {!controlled && (
        <div className="flex justify-center mb-12">
          <BillingToggle annual={annual} onChange={onAnnualChange || setAnnualState} saving={maxYearlySaving(plans)} />
        </div>
      )}
      <div
        className={`grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch ${
          plans.length >= 4 ? "xl:grid-cols-4" : plans.length === 3 ? "lg:grid-cols-3 max-w-6xl mx-auto" : "max-w-3xl mx-auto"
        }`}
      >
        {plans.map((plan) => (
          <PlanCard key={plan.id} plan={plan} annual={annual} onContactSales={onContactSales} />
        ))}
      </div>
      <p className="text-center text-sm text-gray-500 mt-10">
        Need something bigger?{" "}
        <button onClick={() => onContactSales("")} className="font-medium text-blue-600 hover:text-blue-700">
          Talk to our sales team
        </button>
      </p>
    </>
  );
}


// Side-by-side table of every plan's limits and features
export function PlanComparison({ plans }) {
  if (!plans.length) return null;
  const limitRows = planLimits(plans[0]).map(([label], i) => ({
    label,
    values: plans.map((p) => planLimits(p)[i][1]),
  }));
  const colClass = (p) => (p.popular ? "bg-blue-50/60" : "");

  const groupRow = (label) => (
    <tr>
      <td className="px-5 pt-6 pb-2 text-[11px] font-bold uppercase tracking-wider text-gray-400">{label}</td>
      {plans.map((p) => (
        <td key={p.id} className={colClass(p)} />
      ))}
    </tr>
  );

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-x-auto">
      <table className="w-full text-sm min-w-[640px]">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left font-semibold text-gray-500 px-5 py-5 w-1/3 align-bottom">Plans</th>
            {plans.map((p) => (
              <th key={p.id} className={`text-center px-5 py-5 align-bottom ${colClass(p)}`}>
                {p.popular && <span className="block text-[10px] font-bold text-blue-600 uppercase tracking-wider mb-1">Most popular</span>}
                <span className="block text-base font-bold text-gray-900">{p.name}</span>
                <span className="block text-xs font-medium text-gray-500 mt-0.5">
                  {p.isCustom ? "Custom" : monthlyOf(p) === 0 ? "Free" : `${formatINR(monthlyOf(p))}/mo`}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {groupRow("Usage limits")}
          {limitRows.map((row) => (
            <tr key={row.label} className="border-t border-gray-100">
              <td className="px-5 py-3.5 text-gray-700">{row.label}</td>
              {row.values.map((v, i) => (
                <td key={plans[i].id} className={`px-5 py-3.5 text-center font-semibold text-gray-900 ${colClass(plans[i])}`}>
                  {v}
                </td>
              ))}
            </tr>
          ))}
          {groupRow("Features")}
          {AVAILABLE_FEATURES.map((feat) => (
            <tr key={feat.id} className="border-t border-gray-100">
              <td className="px-5 py-3.5 text-gray-700">{feat.name}</td>
              {plans.map((p) => (
                <td key={p.id} className={`px-5 py-3.5 ${colClass(p)}`}>
                  <div className="flex justify-center">
                    {planHasFeature(p, feat) ? (
                      <span className="w-6 h-6 rounded-full bg-green-100 text-green-600 flex items-center justify-center">
                        <Check className="w-3.5 h-3.5" strokeWidth={3} />
                      </span>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </div>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ─── Contact sales ──────────────────────────────────────────────────────── */

const EMPTY_FORM = { name: "", email: "", phone: "", company: "", teamSize: "", plan: "", message: "", website: "" };
const TEAM_SIZES = ["Just me", "2–5 people", "6–20 people", "21–50 people", "50+ people"];

const inputClass =
  "w-full px-3 py-2.5 text-sm text-gray-900 bg-white border border-gray-200 rounded-lg placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition";

function Field({ label, required, children }) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold text-gray-700 mb-1.5">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </span>
      {children}
    </label>
  );
}

// Opens the contact form with a plan pre-selected
export function useContactSales() {
  // Wrapped in an object so picking the same plan twice still re-fills the form
  const [selectedPlan, setSelectedPlan] = useState({ name: "" });
  const contactSales = (planName) => {
    setSelectedPlan({ name: planName });
    scrollTo("#contact-sales");
  };
  return { selectedPlan, contactSales };
}

export function ContactSalesSection({ plans, selectedPlan }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [status, setStatus] = useState("idle"); // idle | sending | sent | error
  const [error, setError] = useState("");

  // A plan picked from the pricing cards pre-fills the form
  useEffect(() => {
    if (selectedPlan.name) setForm((f) => ({ ...f, plan: selectedPlan.name }));
  }, [selectedPlan]);

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus("sending");
    setError("");
    try {
      const res = await fetch(`${BACKEND}/api/public/contact-sales`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not send your message. Please try again.");
      setStatus("sent");
      setForm(EMPTY_FORM);
    } catch (err) {
      setError(err.message === "Failed to fetch" ? "Could not reach the server. Please try again shortly." : err.message);
      setStatus("error");
    }
  };

  const perks = [
    { icon: Headphones, tone: "blue", title: "Guided onboarding", desc: "We help you set up clients, products and invoice templates." },
    { icon: BadgePercent, tone: "purple", title: "Plans that fit", desc: "Get a plan matched to your team size and billing volume." },
    { icon: ShieldCheck, tone: "green", title: "Secure by default", desc: "Separate data per business, auto logout and secure pay links." },
  ];

  return (
    <section id="contact-sales" className="py-20 bg-slate-50 border-t border-gray-200">
      <div className={CONTAINER}>
        <div className="grid lg:grid-cols-5 gap-10 lg:gap-14 items-start">
          <div className="lg:col-span-2">
            <div className="mb-4">
              <Badge>Contact Sales</Badge>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">Let&apos;s find the right plan for you</h2>
            <p className="text-sm sm:text-base text-gray-600 leading-relaxed mb-8">
              Tell us a little about your business. Our team will reach out with a demo and pricing that fits.
            </p>
            <div className="space-y-3">
              {perks.map((p) => (
                <div key={p.title} className="p-4 rounded-xl bg-white border border-gray-200 shadow-sm flex items-start gap-3">
                  <IconChip icon={p.icon} tone={p.tone} size="sm" />
                  <div>
                    <p className="text-sm font-bold text-gray-900">{p.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{p.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-3 bg-white rounded-xl border border-gray-200 shadow-sm">
            {status === "sent" ? (
              <div className="p-10 text-center">
                <div className="w-14 h-14 rounded-full bg-green-100 text-green-600 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">Thanks, we&apos;ve got your message</h3>
                <p className="text-sm text-gray-600 mb-6">Our sales team will get back to you shortly.</p>
                <button onClick={() => setStatus("idle")} className="text-sm font-medium text-blue-600 hover:text-blue-700">
                  Send another message
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="p-6 sm:p-8">
                <div className="flex items-center gap-3 pb-5 mb-6 border-b border-gray-100">
                  <IconChip icon={Mail} tone="blue" size="sm" />
                  <div>
                    <p className="text-sm font-bold text-gray-900">Send us a message</p>
                    <p className="text-xs text-gray-500">Fields marked * are required</p>
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <Field label="Full name" required>
                    <input className={inputClass} value={form.name} onChange={update("name")} required maxLength={100} placeholder="Your name" />
                  </Field>
                  <Field label="Work email" required>
                    <input
                      type="email"
                      className={inputClass}
                      value={form.email}
                      onChange={update("email")}
                      required
                      maxLength={200}
                      placeholder="you@company.com"
                    />
                  </Field>
                  <Field label="Phone">
                    <input type="tel" className={inputClass} value={form.phone} onChange={update("phone")} maxLength={30} placeholder="+91 98765 43210" />
                  </Field>
                  <Field label="Company">
                    <input className={inputClass} value={form.company} onChange={update("company")} maxLength={150} placeholder="Business name" />
                  </Field>
                  <Field label="Team size">
                    <select className={inputClass} value={form.teamSize} onChange={update("teamSize")}>
                      <option value="">Select team size</option>
                      {TEAM_SIZES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Interested plan">
                    <select className={inputClass} value={form.plan} onChange={update("plan")}>
                      <option value="">Not sure yet</option>
                      {plans.map((p) => (
                        <option key={p.id} value={p.name}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <div className="sm:col-span-2">
                    <Field label="How can we help?" required>
                      <textarea
                        className={`${inputClass} resize-none`}
                        rows={4}
                        value={form.message}
                        onChange={update("message")}
                        required
                        maxLength={2000}
                        placeholder="Tell us about your business and what you need"
                      />
                    </Field>
                  </div>
                  {/* Honeypot for bots — hidden from people and screen readers */}
                  <input
                    type="text"
                    name="website"
                    value={form.website}
                    onChange={update("website")}
                    tabIndex={-1}
                    autoComplete="off"
                    aria-hidden="true"
                    className="hidden"
                  />
                </div>

                {status === "error" && (
                  <div className="mt-4 flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2.5">
                    <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    {error}
                  </div>
                )}

                <div className="mt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <p className="text-xs text-gray-500">We&apos;ll only use your details to respond to this enquiry.</p>
                  <button
                    type="submit"
                    disabled={status === "sending"}
                    className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors"
                  >
                    {status === "sending" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    {status === "sending" ? "Sending…" : "Send Message"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

