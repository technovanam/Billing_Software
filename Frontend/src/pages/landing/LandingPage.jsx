import { useEffect, useContext } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  Receipt,
  Truck,
  Repeat,
  Users,
  Package,
  Wallet,
  Coins,
  BarChart3,
  Archive,
  Sparkles,
  ShieldCheck,
  Lock,
  Timer,
  Link2,
  CreditCard,
  FileText,
  Download,
  ArrowRight,
  Plus,
  TrendingUp,
  BadgePercent,
  Bot,
  Send,
  UserCheck,
  CheckCircle2,
} from "lucide-react";
import { AuthContext } from "../../context/AuthContext";
import { CONTAINER, MarketingLayout, IconChip, Badge, SectionHeader } from "./marketing";
import { PricingPlans, ContactSalesSection, usePublicPlans, useContactSales } from "./sales";
import { FaqSection } from "./faq";

/* ─── Data ──────────────────────────────────────────────────────────────── */

const features = [
  {
    icon: FileText,
    tone: "blue",
    title: "Smart Invoice Generation",
    desc: "Create professional GST-compliant invoices in seconds with client picker, product autocomplete and HSN codes.",
  },
  {
    icon: CreditCard,
    tone: "emerald",
    title: "Payment Tracking",
    desc: "Record full or partial payments including TDS. See outstanding, partly paid and settled bills at a glance.",
  },
  {
    icon: Users,
    tone: "indigo",
    title: "Customer Management",
    desc: "Keep GSTIN, address and contact details with per-client totals for invoices, revenue and outstanding amount.",
  },
  {
    icon: Package,
    tone: "purple",
    title: "Product & Service Catalogue",
    desc: "Maintain products with HSN codes, GST rates, units and price history, ready to add to any bill.",
  },
  {
    icon: BarChart3,
    tone: "orange",
    title: "Revenue Reports",
    desc: "Revenue charts, CGST / SGST / IGST breakdowns and month-wise or full financial year bill downloads.",
  },
  {
    icon: Download,
    tone: "rose",
    title: "PDF Export & Print",
    desc: "Print-ready invoice layouts with the amount in words. Download PDFs or print instantly from the same screen.",
  },
];

const modules = [
  { icon: Receipt, tone: "blue", title: "Invoices", desc: "GST bills, drafts, round-off and TDS" },
  { icon: Truck, tone: "indigo", title: "Delivery Challans", desc: "Reference numbers, items and print" },
  { icon: Repeat, tone: "purple", title: "Recurring Invoices", desc: "Auto-generated and emailed on schedule" },
  { icon: UserCheck, tone: "emerald", title: "Clients", desc: "Profiles, GSTIN and per-client totals" },
  { icon: Package, tone: "amber", title: "Products", desc: "Catalogue, price history, stock alerts" },
  { icon: Wallet, tone: "green", title: "Payments", desc: "Partial payments, history and Razorpay" },
  { icon: Coins, tone: "orange", title: "Expenses", desc: "Categories and receipt uploads" },
  { icon: Archive, tone: "rose", title: "FY Archives", desc: "Past financial years with yearly totals" },
];

const aiPrompts = ["Today's Sales", "Monthly Profit", "Top Product", "Who Owes Money?", "Customer Insights", "GST Tax", "Validate GSTIN"];

const steps = [
  { number: "01", title: "Add Your Clients", desc: "Register your clients with their GST, address, and contact details once." },
  { number: "02", title: "Build Your Catalogue", desc: "Add the products or services you sell with rates and tax information." },
  { number: "03", title: "Create an Invoice", desc: "Pick a client, select items, and your GST invoice is ready in under a minute." },
  { number: "04", title: "Track & Report", desc: "Mark payments, monitor pending dues, and export revenue reports anytime." },
];

const stats = [
  { value: "500+", label: "Invoices Generated", icon: Receipt, tone: "blue" },
  { value: "100%", label: "GST Compliant", icon: BadgePercent, tone: "purple" },
  { value: "< 1 min", label: "To Create an Invoice", icon: Timer, tone: "emerald" },
  { value: "Zero", label: "Setup Cost", icon: Wallet, tone: "orange" },
];

const securityPoints = [
  { icon: Lock, tone: "blue", title: "Secure sign-in", desc: "Firebase authentication with each business's data kept separate." },
  { icon: Timer, tone: "amber", title: "Auto logout", desc: "Inactive sessions sign out automatically after a timeout you choose." },
  { icon: Link2, tone: "indigo", title: "Secure pay links", desc: "Generate, regenerate or disable an online payment link per invoice." },
  { icon: ShieldCheck, tone: "green", title: "Online payments", desc: "Accept invoice payments through Razorpay, including refunds." },
];

/* ─── Hero ───────────────────────────────────────────────────────────────── */

// A static replica of the business dashboard, built from the same card styles
function DashboardPreview() {
  const now = new Date();
  const fyStart = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  const fyLabel = `FY ${fyStart}-${String(fyStart + 1).slice(-2)}`;
  const cards = [
    { title: "Total Bill Amount", value: "₹5,17,400.00", icon: TrendingUp, color: "text-blue-500" },
    { title: "Amount to Receive", value: "₹32,400.00", icon: TrendingUp, color: "text-red-500" },
    { title: "Revenue [Received]", value: "₹4,85,000.00", icon: TrendingUp, color: "text-green-500" },
  ];
  const activity = [
    { dot: "bg-green-500", text: "INV-0142 marked as paid", time: "2m ago" },
    { dot: "bg-blue-500", text: "INV-0143 created", time: "18m ago" },
    { dot: "bg-yellow-500", text: "INV-0144 saved as draft", time: "1h ago" },
  ];

  return (
    <div className="relative">
      <div className="absolute -inset-3 bg-blue-100/60 rounded-2xl rotate-1 hidden sm:block" aria-hidden="true" />
      <div className="relative bg-slate-50 rounded-xl border border-gray-200 shadow-xl overflow-hidden text-left">
        <div className="flex items-center gap-1.5 px-4 py-2.5 bg-white border-b border-gray-200">
          <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
          <span className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
          <span className="w-2.5 h-2.5 rounded-full bg-green-400" />
          <span className="ml-3 text-[11px] text-gray-400 font-medium">Dashboard</span>
        </div>
        <div className="p-4 sm:p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm font-bold text-gray-900">Welcome back!</p>
              <p className="text-xs text-gray-500">Here&apos;s what&apos;s happening with your business today.</p>
            </div>
            <span className="hidden sm:inline-flex items-center gap-1 bg-blue-600 text-white text-xs font-medium px-3 py-1.5 rounded-lg">
              <Plus className="w-3.5 h-3.5" /> Create Invoice
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
            {cards.map(({ title, value, icon: Icon, color }) => (
              <div key={title} className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm">
                <div className="flex justify-between items-start mb-1.5">
                  <h3 className="text-xs font-medium text-gray-600">{title}</h3>
                  <div className="p-1 bg-gray-50 rounded-md">
                    <Icon className={`w-4 h-4 ${color}`} />
                  </div>
                </div>
                <p className="text-base font-bold text-gray-900">{value}</p>
                <span className="inline-block mt-1.5 bg-blue-600 text-white text-[10px] px-2 py-0.5 rounded-full font-medium">{fyLabel}</span>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm">
              <div className="flex justify-between items-start mb-1.5">
                <h3 className="text-xs font-medium text-gray-600">Payment Status</h3>
                <div className="p-1 bg-gray-50 rounded-md">
                  <CreditCard className="w-4 h-4 text-emerald-600" />
                </div>
              </div>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-base font-bold text-gray-900">34</p>
                  <p className="text-[10px] text-green-600">Paid (89.5%)</p>
                </div>
                <div className="text-right">
                  <p className="text-base font-bold text-red-600">4</p>
                  <p className="text-[10px] text-gray-500">Unpaid</p>
                </div>
              </div>
              <div className="w-full h-2 rounded-full mt-2 overflow-hidden flex">
                <div className="h-2 bg-green-500" style={{ width: "89.5%" }} />
                <div className="h-2 bg-red-500 flex-1" />
              </div>
            </div>

            <div className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm">
              <h3 className="text-xs font-medium text-gray-600 mb-2">Recent Activity</h3>
              <ul className="space-y-2">
                {activity.map((a) => (
                  <li key={a.text} className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${a.dot}`} />
                    <span className="text-xs text-gray-700 flex-1 truncate">{a.text}</span>
                    <span className="text-[10px] text-gray-400">{a.time}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function HeroSection({ onGetStarted }) {
  return (
    <section id="top" className="relative min-h-screen flex flex-col bg-slate-50 border-b border-gray-200 pt-16 overflow-hidden">
      {/* Faint dot grid, like a canvas behind the dashboard */}
      <div
        className="absolute inset-0 opacity-60 pointer-events-none"
        style={{ backgroundImage: "radial-gradient(#cbd5e1 1px, transparent 1px)", backgroundSize: "22px 22px" }}
        aria-hidden="true"
      />
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-slate-50 to-transparent pointer-events-none" aria-hidden="true" />

      <div className="relative flex-1 flex items-center">
        <div className={`${CONTAINER} py-10 lg:py-12`}>
          <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
            <div className="text-center lg:text-left">
              <div className="inline-flex items-center gap-2 bg-white border border-gray-200 text-gray-700 text-xs font-medium px-3 py-1.5 rounded-full mb-6 shadow-sm">
                <span className="w-2 h-2 bg-green-500 rounded-full" />
                GST-Compliant Billing Software
              </div>

              <h1 className="text-4xl sm:text-5xl xl:text-6xl font-bold text-gray-900 leading-[1.1] mb-5">
                Billing made <span className="text-blue-600">simple</span> for your business
              </h1>

              <p className="text-base sm:text-lg text-gray-600 max-w-xl mx-auto lg:mx-0 mb-8 leading-relaxed">
                Create GST invoices, manage clients, track payments and see your revenue — all in one clean dashboard.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3 mb-8">
                <button
                  onClick={onGetStarted}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-3 rounded-lg shadow-sm transition-colors"
                >
                  Start Billing Now
                  <ArrowRight className="w-4 h-4" />
                </button>
                <Link
                  to="/pricing"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-white hover:bg-gray-50 text-gray-700 font-medium px-6 py-3 rounded-lg border border-gray-200 transition-colors"
                >
                  View Pricing
                </Link>
              </div>

              <ul className="flex flex-wrap items-center justify-center lg:justify-start gap-x-5 gap-y-2">
                {["GST-ready invoices", "Online payment links", "AI Assistant built in"].map((t) => (
                  <li key={t} className="flex items-center gap-1.5 text-sm text-gray-600">
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                    {t}
                  </li>
                ))}
              </ul>
            </div>

            <DashboardPreview />
          </div>
        </div>
      </div>

      <div className={`relative ${CONTAINER} pb-8`}>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {stats.map((s) => (
            <div key={s.label} className="bg-white p-3 sm:p-4 rounded-lg border border-gray-200 shadow-sm flex items-center gap-3">
              <IconChip icon={s.icon} tone={s.tone} />
              <div className="min-w-0">
                <div className="text-lg sm:text-xl font-bold text-gray-900">{s.value}</div>
                <div className="text-xs text-gray-500 truncate">{s.label}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Content sections ───────────────────────────────────────────────────── */

function FeaturesSection() {
  return (
    <section id="features" className="py-20 bg-white">
      <div className={CONTAINER}>
        <SectionHeader
          badge="Everything You Need"
          title="Powerful Features, Zero Complexity"
          desc="From invoicing to reports, every tool your business needs is built-in and ready to use."
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
          {features.map((f) => (
            <div
              key={f.title}
              className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm hover:shadow-md hover:border-blue-200 transition-all duration-200"
            >
              <IconChip icon={f.icon} tone={f.tone} />
              <h3 className="text-base font-semibold text-gray-900 mt-4 mb-1.5">{f.title}</h3>
              <p className="text-sm text-gray-600 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
        <div className="text-center mt-10">
          <Link
            to="/features"
            className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 border border-blue-200 bg-blue-50 hover:bg-blue-100 px-5 py-2.5 rounded-lg transition-colors"
          >
            Explore all features <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}

function ModulesSection() {
  return (
    <section id="modules" className="py-20 bg-slate-50 border-y border-gray-200">
      <div className={CONTAINER}>
        <SectionHeader
          badge="Modules"
          title="One Back Office for Your Whole Business"
          desc="Every part of your billing workflow has its own workspace, all sharing the same clients, products and payments."
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {modules.map((m) => (
            <div key={m.title} className="p-4 rounded-xl bg-white border border-gray-200 shadow-sm hover:shadow-md transition-shadow flex items-center gap-3">
              <IconChip icon={m.icon} tone={m.tone} size="sm" />
              <div className="min-w-0">
                <p className="text-sm font-bold text-gray-900">{m.title}</p>
                <p className="text-xs text-gray-500 mt-0.5">{m.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <div id="how-it-works" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mt-12">
          {steps.map((step) => (
            <div key={step.number}>
              <div className="flex items-center gap-3 mb-2">
                <span className="w-9 h-9 bg-blue-600 text-white font-bold text-sm rounded-xl flex items-center justify-center flex-shrink-0">
                  {step.number}
                </span>
                <h3 className="text-sm font-bold text-gray-900">{step.title}</h3>
              </div>
              <p className="text-sm text-gray-600 leading-relaxed">{step.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function AIAssistantSection() {
  return (
    <section id="ai-assistant" className="py-20 bg-white">
      <div className={CONTAINER}>
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <div>
            <div className="mb-4">
              <Badge icon={Sparkles}>AI Assistant</Badge>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4">Ask your billing data anything</h2>
            <p className="text-sm sm:text-base text-gray-600 leading-relaxed mb-6">
              The built-in assistant reads your live invoices, payments and products. Get answers in plain language instead of building reports by
              hand.
            </p>
            <div className="flex flex-wrap gap-2">
              {aiPrompts.map((p) => (
                <span key={p} className="text-xs font-medium text-gray-700 bg-slate-50 border border-gray-200 px-3 py-1.5 rounded-full">
                  {p}
                </span>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-lg overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 bg-slate-50">
              <IconChip icon={Bot} tone="blue" size="sm" />
              <div>
                <p className="text-sm font-bold text-gray-900">Billing Assistant</p>
                <p className="text-[10px] text-gray-500">Answers from your live data</p>
              </div>
            </div>
            <div className="p-4 space-y-3">
              <div className="flex justify-end">
                <div className="bg-blue-600 text-white text-sm px-3.5 py-2 rounded-lg rounded-br-sm max-w-[80%]">Who owes money?</div>
              </div>
              <div className="flex">
                <div className="bg-slate-50 border border-gray-200 text-sm text-gray-700 px-3.5 py-2.5 rounded-lg rounded-bl-sm max-w-[85%]">
                  <p className="mb-2">3 clients have pending balances:</p>
                  <ul className="space-y-1.5">
                    {[
                      ["Sri Lakshmi Traders", "₹18,200"],
                      ["Kaveri Textiles", "₹9,650"],
                      ["Arun Electricals", "₹4,550"],
                    ].map(([name, amt]) => (
                      <li key={name} className="flex justify-between gap-6 text-xs">
                        <span className="text-gray-600">{name}</span>
                        <span className="font-bold text-red-600">{amt}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2">
                <span className="text-sm text-gray-400 flex-1">Ask about sales, GST, customers…</span>
                <Send className="w-4 h-4 text-blue-600" />
              </div>
            </div>
          </div>
        </div>

        {/* About + security */}
        <div id="about" className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-20">
          {securityPoints.map((s) => (
            <div key={s.title} className="p-4 rounded-xl bg-slate-50 border border-slate-100 flex items-start gap-3">
              <IconChip icon={s.icon} tone={s.tone} size="sm" />
              <div>
                <p className="text-sm font-bold text-gray-900">{s.title}</p>
                <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function PricingSection({ plans, loading, onContactSales }) {
  return (
    <section id="pricing" className="py-20 bg-slate-50 border-y border-gray-200">
      <div className={CONTAINER}>
        <SectionHeader badge="Pricing" title="Simple, Transparent Pricing" desc="Pick the plan that fits your business today and upgrade as you grow." />
        <PricingPlans plans={plans} loading={loading} onContactSales={onContactSales} />
        <div className="text-center mt-4">
          <Link to="/pricing" className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-700 hover:text-blue-600">
            Compare all plan features <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ─── Main Page ──────────────────────────────────────────────────────────── */

export default function LandingPage() {
  const navigate = useNavigate();
  const { user, authInitialized } = useContext(AuthContext);
  const { plans, loading: plansLoading } = usePublicPlans();
  const { selectedPlan, contactSales } = useContactSales();

  // If already signed in, redirect to respective dashboard
  useEffect(() => {
    if (authInitialized && user) {
      navigate("/dashboard", { replace: true });
    }
  }, [authInitialized, user, navigate]);

  return (
    <MarketingLayout>
      <HeroSection onGetStarted={() => navigate("/signup")} />
      <FeaturesSection />
      <ModulesSection />
      <AIAssistantSection />
      <PricingSection plans={plans} loading={plansLoading} onContactSales={contactSales} />
      <FaqSection />
      <ContactSalesSection plans={plans} selectedPlan={selectedPlan} />
    </MarketingLayout>
  );
}
