import { useEffect, useState } from "react";
import {
  Receipt,
  Wallet,
  Users,
  Package,
  Repeat,
  BarChart3,
  Sparkles,
  ShieldCheck,
  FileText,
  BadgePercent,
  Calculator,
  FilePen,
  PackagePlus,
  Printer,
  Download,
  Filter,
  Link2,
  CreditCard,
  SplitSquareHorizontal,
  History,
  Landmark,
  FileBarChart,
  IdCard,
  Languages,
  PieChart,
  Tags,
  LineChart,
  Barcode,
  CalendarClock,
  Mail,
  PauseCircle,
  Truck,
  Coins,
  Upload,
  Archive,
  MessageSquareText,
  Zap,
  BadgeCheck,
  TrendingUp,
  Lock,
  Timer,
  UserCog,
  Database,
  Layers,
  Bot,
  Check,
} from "lucide-react";
import { CONTAINER, MarketingLayout, PageHero, HeroActions, TrustRow, CtaBand, IconChip, TONES, scrollTo } from "./marketing";

/* ─── Data ──────────────────────────────────────────────────────────────── */

// Each category: its features plus a small "spotlight" mock drawn beside them
const CATEGORIES = [
  {
    id: "invoicing",
    label: "Invoicing",
    icon: Receipt,
    tone: "blue",
    title: "GST invoicing that takes under a minute",
    desc: "Pick a client, add items from your catalogue and the taxes, totals and amount in words are filled in for you.",
    items: [
      { icon: FileText, title: "GST invoices", desc: "Client picker and product autocomplete." },
      { icon: BadgePercent, title: "CGST, SGST & IGST", desc: "Tax from each item's HSN code and rate." },
      { icon: Calculator, title: "TDS & round-off", desc: "Deduct TDS, round the invoice total." },
      { icon: FilePen, title: "Drafts", desc: "Save now, finish the invoice later." },
      { icon: PackagePlus, title: "Save new products", desc: "Add items typed on a bill to the catalogue." },
      { icon: Printer, title: "Print-ready layout", desc: "Clean preview with amount in words." },
      { icon: Download, title: "PDF download", desc: "Pixel-perfect PDFs in one click." },
      { icon: Filter, title: "Filters & reports", desc: "By client, status, month or financial year." },
    ],
    spotlight: {
      type: "rows",
      title: "INV-0143 · Sri Lakshmi Traders",
      rows: [
        { label: "Steel rods · HSN 7214", value: "₹24,000.00" },
        { label: "Binding wire · HSN 7217", value: "₹3,600.00" },
        { label: "CGST 9%", value: "₹2,484.00", muted: true },
        { label: "SGST 9%", value: "₹2,484.00", muted: true },
      ],
      footer: { label: "Total", value: "₹32,568.00" },
    },
  },
  {
    id: "payments",
    label: "Payments",
    icon: Wallet,
    tone: "emerald",
    title: "Get paid faster and know exactly who owes what",
    desc: "Share a payment link, accept online payments and record cash or bank transfers against every invoice.",
    items: [
      { icon: Link2, title: "Payment links", desc: "Secure pay link for every invoice." },
      { icon: CreditCard, title: "Razorpay payments", desc: "Online payments and refunds." },
      { icon: SplitSquareHorizontal, title: "Partial payments", desc: "Balance due updates itself, TDS included." },
      { icon: Landmark, title: "Payment methods", desc: "Cash, bank transfer, transaction IDs." },
      { icon: History, title: "Transaction history", desc: "Every payment against an invoice." },
      { icon: FileBarChart, title: "Payment reports", desc: "Monthly, yearly and custom reports." },
    ],
    spotlight: {
      type: "progress",
      title: "Collections this month",
      rows: [
        { label: "INV-0139", paid: 100, amount: "₹18,400" },
        { label: "INV-0140", paid: 60, amount: "₹9,650" },
        { label: "INV-0141", paid: 35, amount: "₹12,200" },
        { label: "INV-0142", paid: 100, amount: "₹6,300" },
      ],
    },
  },
  {
    id: "customers",
    label: "Customers",
    icon: Users,
    tone: "indigo",
    title: "Every client, organised in one place",
    desc: "Keep complete client profiles and see each client's invoices, revenue and outstanding amount at a glance.",
    items: [
      { icon: IdCard, title: "Client profiles", desc: "Company, type, phone, address, remarks." },
      { icon: BadgeCheck, title: "GSTIN on file", desc: "Stored once, reused on every bill." },
      { icon: Languages, title: "Preferred language", desc: "English, Hindi, Gujarati or Marathi." },
      { icon: PieChart, title: "Per-client totals", desc: "Invoices, revenue and outstanding." },
    ],
    spotlight: {
      type: "rows",
      title: "Top clients",
      rows: [
        { label: "Kaveri Textiles", sub: "33AABCK1234F1Z5", value: "₹1,24,500" },
        { label: "Arun Electricals", sub: "33AAFCA5678K1Z2", value: "₹86,200" },
        { label: "Sri Lakshmi Traders", sub: "33AAGCS9012L1Z8", value: "₹72,940" },
      ],
    },
  },
  {
    id: "products",
    label: "Products",
    icon: Package,
    tone: "purple",
    title: "A catalogue ready for every invoice",
    desc: "Maintain products and services with tax details, units and pricing so billing is a few clicks.",
    items: [
      { icon: Tags, title: "Rich catalogue", desc: "Brand, category, HSN, unit and image." },
      { icon: LineChart, title: "Price history", desc: "See how prices changed over time." },
      { icon: Barcode, title: "SKU & purchase price", desc: "Alongside the selling price." },
    ],
    spotlight: {
      type: "rows",
      title: "Catalogue",
      rows: [
        { label: "LED Panel 18W", sub: "HSN 9405 · piece · 18%", value: "₹420" },
        { label: "Copper wire 1.5mm", sub: "HSN 7408 · metre", value: "₹38" },
        { label: "MCB 32A", sub: "HSN 8536 · piece", value: "₹265" },
      ],
    },
  },
  {
    id: "automation",
    label: "Automation",
    icon: Repeat,
    tone: "amber",
    title: "Let repeat billing run itself",
    desc: "Set up recurring invoices once and they are created and emailed to your clients on schedule.",
    items: [
      { icon: CalendarClock, title: "Recurring invoices", desc: "Frequencies and a due-date schedule." },
      { icon: Zap, title: "Automatic creation", desc: "Due invoices generated in the background." },
      { icon: Mail, title: "Email delivery", desc: "Sent to clients through your mail server." },
      { icon: PauseCircle, title: "Pause & resume", desc: "Edit or pause a schedule anytime." },
      { icon: Truck, title: "Delivery challans", desc: "Reference numbers, items and print." },
    ],
    spotlight: {
      type: "rows",
      title: "Upcoming recurring invoices",
      rows: [
        { label: "Website AMC · Monthly", sub: "Next: 1 Nov", value: "₹4,500", badge: "Active" },
        { label: "Cloud hosting · Quarterly", sub: "Next: 15 Nov", value: "₹12,000", badge: "Active" },
        { label: "Support retainer · Monthly", sub: "Paused", value: "₹8,000", badge: "Paused" },
      ],
    },
  },
  {
    id: "reports",
    label: "Expenses & Reports",
    icon: BarChart3,
    tone: "orange",
    title: "Know your numbers, every financial year",
    desc: "Track spending, see revenue trends and download everything your accountant needs.",
    items: [
      { icon: Coins, title: "Expense tracking", desc: "Category, customer, amount and date." },
      { icon: Upload, title: "Receipt uploads", desc: "Drag and drop up to 10 MB." },
      { icon: TrendingUp, title: "Revenue chart", desc: "Trends month by month." },
      { icon: BadgePercent, title: "GST breakdown", desc: "CGST, SGST and IGST totals." },
      { icon: Download, title: "Bulk bill download", desc: "A month or a whole financial year." },
      { icon: Archive, title: "FY archives", desc: "Past years with yearly totals." },
    ],
    spotlight: { type: "bars", title: "Revenue · last 6 months", bars: [42, 58, 51, 70, 64, 88], labels: ["May", "Jun", "Jul", "Aug", "Sep", "Oct"] },
  },
  {
    id: "ai",
    label: "AI Assistant",
    icon: Sparkles,
    tone: "sky",
    title: "Ask your billing data in plain language",
    desc: "The built-in assistant reads your live data and answers questions instantly.",
    items: [
      { icon: MessageSquareText, title: "Ask anything", desc: "Sales, profit, top product, dues." },
      { icon: Users, title: "Customer insights", desc: "Best customers and slow payers." },
      { icon: Package, title: "Stock prediction", desc: "Which products are running low." },
      { icon: BadgeCheck, title: "GSTIN validation", desc: "Check a GSTIN before you bill." },
    ],
    spotlight: { type: "chat", question: "What were today's sales?", answer: "₹46,850 across 12 invoices — 18% higher than yesterday." },
  },
  {
    id: "security",
    label: "Security",
    icon: ShieldCheck,
    tone: "green",
    title: "Secure by default",
    desc: "Your business data stays private, protected and separate from every other business.",
    items: [
      { icon: Lock, title: "Secure sign-in", desc: "Firebase authentication on every account." },
      { icon: Database, title: "Separate data", desc: "Each business stored on its own." },
      { icon: Timer, title: "Auto logout", desc: "Inactive sessions sign out automatically." },
      { icon: UserCog, title: "Role-based access", desc: "Rules control who can change what." },
    ],
    spotlight: {
      type: "checks",
      title: "Security status",
      rows: ["Signed in with Firebase Auth", "Business data isolated", "Auto logout when idle", "Payment links can be disabled"],
    },
  },
];

const TOTAL_FEATURES = CATEGORIES.reduce((n, c) => n + c.items.length, 0);

/* ─── Spotlight mocks ────────────────────────────────────────────────────── */

function MockFrame({ title, children }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-lg overflow-hidden">
      <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-gray-200 bg-slate-50">
        <span className="w-2 h-2 rounded-full bg-red-400" />
        <span className="w-2 h-2 rounded-full bg-yellow-400" />
        <span className="w-2 h-2 rounded-full bg-green-400" />
        <span className="ml-2 text-[11px] font-medium text-gray-500 truncate">{title}</span>
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </div>
  );
}

const BADGE_TONE = { "Low stock": "bg-red-50 text-red-600", Active: "bg-green-50 text-green-700", Paused: "bg-gray-100 text-gray-500" };

function Spotlight({ spot }) {
  if (spot.type === "rows") {
    return (
      <MockFrame title={spot.title}>
        <ul className="divide-y divide-gray-100">
          {spot.rows.map((r) => (
            <li key={r.label} className="flex items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <p className={`text-sm truncate ${r.muted ? "text-gray-500" : "font-medium text-gray-900"}`}>{r.label}</p>
                {r.sub && <p className="text-[11px] text-gray-400 font-mono">{r.sub}</p>}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {r.badge && <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${BADGE_TONE[r.badge]}`}>{r.badge}</span>}
                <span className={`text-sm ${r.muted ? "text-gray-500" : "font-semibold text-gray-900"}`}>{r.value}</span>
              </div>
            </li>
          ))}
        </ul>
        {spot.footer && (
          <div className="flex items-center justify-between mt-3 pt-3 border-t-2 border-dashed border-gray-200">
            <span className="text-sm font-bold text-gray-900">{spot.footer.label}</span>
            <span className="text-lg font-bold text-blue-600">{spot.footer.value}</span>
          </div>
        )}
      </MockFrame>
    );
  }

  if (spot.type === "progress") {
    return (
      <MockFrame title={spot.title}>
        <ul className="space-y-4">
          {spot.rows.map((r) => (
            <li key={r.label}>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="font-medium text-gray-700">{r.label}</span>
                <span className="text-gray-500">
                  {r.amount} · <span className={r.paid === 100 ? "text-green-600 font-semibold" : "text-amber-600 font-semibold"}>{r.paid === 100 ? "Paid" : `${r.paid}% paid`}</span>
                </span>
              </div>
              <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                <div className={`h-2 rounded-full ${r.paid === 100 ? "bg-green-500" : "bg-amber-400"}`} style={{ width: `${r.paid}%` }} />
              </div>
            </li>
          ))}
        </ul>
      </MockFrame>
    );
  }

  if (spot.type === "bars") {
    const max = Math.max(...spot.bars);
    return (
      <MockFrame title={spot.title}>
        <div className="flex items-end gap-3 h-40">
          {spot.bars.map((b, i) => (
            <div key={spot.labels[i]} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
              <div
                className={`w-full rounded-t-md ${i === spot.bars.length - 1 ? "bg-blue-600" : "bg-blue-200"}`}
                style={{ height: `${(b / max) * 100}%` }}
              />
              <span className="text-[10px] text-gray-400">{spot.labels[i]}</span>
            </div>
          ))}
        </div>
      </MockFrame>
    );
  }

  if (spot.type === "chat") {
    return (
      <MockFrame title="Billing Assistant">
        <div className="space-y-3">
          <div className="flex justify-end">
            <div className="bg-blue-600 text-white text-sm px-3.5 py-2 rounded-lg rounded-br-sm">{spot.question}</div>
          </div>
          <div className="flex items-start gap-2">
            <IconChip icon={Bot} tone="sky" size="sm" />
            <div className="bg-slate-50 border border-gray-200 text-sm text-gray-700 px-3.5 py-2.5 rounded-lg rounded-tl-sm">{spot.answer}</div>
          </div>
        </div>
      </MockFrame>
    );
  }

  // checks
  return (
    <MockFrame title={spot.title}>
      <ul className="space-y-3">
        {spot.rows.map((r) => (
          <li key={r} className="flex items-center gap-3 text-sm text-gray-700">
            <span className="w-6 h-6 rounded-full bg-green-100 text-green-600 flex items-center justify-center flex-shrink-0">
              <Check className="w-3.5 h-3.5" strokeWidth={3} />
            </span>
            {r}
          </li>
        ))}
      </ul>
    </MockFrame>
  );
}

/* ─── Hero visual ────────────────────────────────────────────────────────── */

function HeroVisual() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4">
      {CATEGORIES.map((c) => (
        <button
          key={c.id}
          onClick={() => scrollTo(`#${c.id}`)}
          className="group bg-white p-4 rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-blue-200 transition-all text-left flex items-center gap-3"
        >
          <IconChip icon={c.icon} tone={c.tone} />
          <div className="min-w-0">
            <p className="text-sm font-bold text-gray-900 truncate group-hover:text-blue-600 transition-colors">{c.label}</p>
            <p className="text-xs text-gray-500">{c.items.length} features</p>
          </div>
        </button>
      ))}
    </div>
  );
}

/* ─── Page sections ──────────────────────────────────────────────────────── */

// Highlights the category currently in view
function useActiveCategory() {
  const [active, setActive] = useState(CATEGORIES[0].id);
  useEffect(() => {
    if (!("IntersectionObserver" in window)) return undefined;
    const observer = new IntersectionObserver((entries) => entries.forEach((e) => e.isIntersecting && setActive(e.target.id)), {
      rootMargin: "-40% 0px -55% 0px",
    });
    CATEGORIES.forEach((c) => {
      const el = document.getElementById(c.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);
  return active;
}

function CategoryNav({ active }) {
  return (
    <div className="sticky top-16 z-30 bg-white/95 backdrop-blur border-b border-gray-200">
      <div className={CONTAINER}>
        <div className="flex gap-1 overflow-x-auto py-2.5 -mx-1 px-1 lg:justify-center">
          {CATEGORIES.map((c) => {
            const Icon = c.icon;
            const isActive = active === c.id;
            return (
              <button
                key={c.id}
                onClick={() => scrollTo(`#${c.id}`)}
                className={`flex items-center gap-2 whitespace-nowrap text-sm font-medium px-3.5 py-2 rounded-lg border transition-colors ${
                  isActive ? "bg-blue-600 border-blue-600 text-white shadow-sm" : "border-transparent text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                }`}
              >
                <Icon className="w-4 h-4" />
                {c.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function CategoryBlock({ category, index }) {
  const flip = index % 2 === 1;
  return (
    <section id={category.id} className={`py-16 lg:py-20 ${flip ? "bg-slate-50 border-y border-gray-200" : "bg-white"}`}>
      <div className={CONTAINER}>
        <div className="grid lg:grid-cols-12 gap-10 lg:gap-16 items-center">
          <div className={`lg:col-span-7 ${flip ? "lg:order-2" : ""}`}>
            <div className="flex items-center gap-3 mb-4">
              <IconChip icon={category.icon} tone={category.tone} />
              <span className={`text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${TONES[category.tone]}`}>
                {String(index + 1).padStart(2, "0")} · {category.label}
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 leading-tight">{category.title}</h2>
            <p className="text-sm sm:text-base text-gray-600 mt-3 leading-relaxed max-w-2xl">{category.desc}</p>

            <div className="grid sm:grid-cols-2 gap-x-8 gap-y-5 mt-8">
              {category.items.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.title} className="flex items-start gap-3">
                    <span className="w-8 h-8 rounded-lg bg-white border border-gray-200 shadow-sm flex items-center justify-center flex-shrink-0 text-gray-700">
                      <Icon className="w-4 h-4" />
                    </span>
                    <div>
                      <h3 className="text-sm font-bold text-gray-900">{item.title}</h3>
                      <p className="text-sm text-gray-500 mt-0.5 leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className={`lg:col-span-5 ${flip ? "lg:order-1" : ""}`}>
            <div className="relative">
              <div className={`absolute -inset-4 rounded-2xl opacity-60 ${TONES[category.tone].split(" ")[0]}`} aria-hidden="true" />
              <div className="relative">
                <Spotlight spot={category.spotlight} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function FeaturesPage() {
  const active = useActiveCategory();

  return (
    <MarketingLayout footerCta={false}>
      <PageHero
        badge="Features"
        badgeIcon={Layers}
        title="Everything you need to bill, get paid and"
        highlight="grow"
        desc={`From GST invoices to recurring billing, payment links and an AI assistant — ${TOTAL_FEATURES} features across ${CATEGORIES.length} areas, all in one dashboard.`}
        visual={<HeroVisual />}
        stats={[
          { icon: Layers, tone: "blue", value: TOTAL_FEATURES, label: "Features built in" },
          { icon: Receipt, tone: "purple", value: CATEGORIES.length, label: "Product areas" },
          { icon: Timer, tone: "emerald", value: "< 1 min", label: "To create an invoice" },
          { icon: BadgePercent, tone: "orange", value: "100%", label: "GST compliant" },
        ]}
      >
        <HeroActions secondary={{ label: "See pricing", to: "/pricing" }} />
        <TrustRow items={["GST compliant", "Free plan available", "No setup cost"]} />
      </PageHero>

      <CategoryNav active={active} />

      {CATEGORIES.map((c, i) => (
        <CategoryBlock key={c.id} category={c} index={i} />
      ))}

      <CtaBand
        title="Start billing the simple way"
        desc="Create your account in minutes and send your first GST invoice today."
        secondary={{ label: "Talk to sales", to: "/pricing#contact-sales" }}
      />
    </MarketingLayout>
  );
}
