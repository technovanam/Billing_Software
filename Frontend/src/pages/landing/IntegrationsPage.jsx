import { Printer, Sparkles, Puzzle, CreditCard, Mail, Wallet } from "lucide-react";
import { siRazorpay, siGooglepay, siPhonepe, siPaytm, siVisa, siMastercard, siGmail, siWhatsapp, siFirebase, siPuppeteer } from "simple-icons";
import { CONTAINER, MarketingLayout, PageHero, HeroActions, CtaBand, LOGO_ICON } from "./marketing";

/* ─── Logos ──────────────────────────────────────────────────────────────── */

// Brand mark from simple-icons, drawn in the brand's own colour
function BrandSvg({ icon, className = "w-6 h-6" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} role="img" aria-label={icon.title}>
      <path d={icon.path} fill={`#${icon.hex}`} />
    </svg>
  );
}

// A logo tile: one brand, several overlapping brands, or a lucide icon
function LogoTile({ logos, icon: Icon, size = "md" }) {
  const box = size === "lg" ? "w-14 h-14 rounded-2xl" : size === "sm" ? "w-10 h-10 rounded-xl" : "w-12 h-12 rounded-xl";
  const glyph = size === "lg" ? "w-7 h-7" : size === "sm" ? "w-5 h-5" : "w-6 h-6";

  if (logos?.length > 1) {
    return (
      <div className="flex -space-x-2">
        {logos.map((l) => (
          <div key={l.slug} className={`${box} bg-white border border-gray-200 shadow-sm flex items-center justify-center`}>
            <BrandSvg icon={l} className={size === "lg" ? "w-6 h-6" : "w-5 h-5"} />
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className={`${box} bg-white border border-gray-200 shadow-sm flex items-center justify-center flex-shrink-0`}>
      {logos ? <BrandSvg icon={logos[0]} className={glyph} /> : <Icon className={`${glyph} text-gray-700`} />}
    </div>
  );
}

/* ─── Data ──────────────────────────────────────────────────────────────── */

const INTEGRATIONS = [
  {
    name: "Razorpay",
    logos: [siRazorpay],
    status: "live",
    desc: "Accept invoice payments online and process refunds. Payments are recorded against the invoice automatically.",
  },
  {
    name: "UPI apps",
    logos: [siGooglepay, siPhonepe, siPaytm],
    status: "via",
    desc: "Clients pay with Google Pay, PhonePe, Paytm or any UPI app from the invoice payment link.",
  },
  {
    name: "Cards",
    logos: [siVisa, siMastercard],
    status: "via",
    desc: "Debit and credit card payments through the secure Razorpay checkout.",
  },
  {
    name: "Gmail & SMTP",
    logos: [siGmail],
    status: "live",
    desc: "Recurring invoices are emailed to clients through Gmail or any SMTP mail server you choose.",
  },
  {
    name: "WhatsApp",
    logos: [siWhatsapp],
    status: "soon",
    desc: "Send invoices and payment reminders to clients on WhatsApp.",
  },
  {
    name: "Firebase Authentication",
    logos: [siFirebase],
    status: "live",
    desc: "Secure sign-in for every business account, backed by Google's Firebase.",
  },
  {
    name: "PDF Export",
    logos: [siPuppeteer],
    status: "live",
    desc: "Print-quality invoice PDFs rendered on the server, identical to the on-screen preview.",
  },
  {
    name: "Print",
    icon: Printer,
    status: "live",
    desc: "Print invoices and delivery challans straight from the preview.",
  },
  {
    name: "AI Assistant",
    icon: Sparkles,
    status: "live",
    desc: "Ask questions about your live billing data and create bills from plain-language commands.",
  },
];

const STATUS = {
  live: { label: "Built in", className: "text-green-700 bg-green-50 border-green-100", dot: "bg-green-500" },
  via: { label: "Via Razorpay", className: "text-blue-700 bg-blue-50 border-blue-100", dot: "bg-blue-500" },
  soon: { label: "Coming soon", className: "text-amber-700 bg-amber-50 border-amber-100", dot: "bg-amber-500" },
};

function StatusBadge({ status }) {
  const s = STATUS[status];
  return (
    <span className={`inline-flex items-center gap-1.5 text-[10px] font-semibold border px-2 py-0.5 rounded-full whitespace-nowrap ${s.className}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

/* ─── Hero hub visual ────────────────────────────────────────────────────── */

const HUB = [siRazorpay, siGmail, siFirebase, siGooglepay, siWhatsapp, siVisa, siPhonepe, siPuppeteer];

function HubVisual() {
  // Logos placed on a circle around the app, with spokes drawn to the centre
  const r = 40; // percent of the box
  const points = HUB.map((_, i) => {
    const a = (i / HUB.length) * Math.PI * 2 - Math.PI / 2;
    return { x: 50 + r * Math.cos(a), y: 50 + r * Math.sin(a) };
  });

  return (
    <div className="relative w-full max-w-md mx-auto aspect-square">
      <div className="absolute inset-[10%] rounded-full border border-dashed border-gray-300" aria-hidden="true" />
      <div className="absolute inset-[30%] rounded-full bg-blue-100/60" aria-hidden="true" />
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" aria-hidden="true">
        {points.map((p, i) => (
          <line key={HUB[i].slug} x1="50" y1="50" x2={p.x} y2={p.y} stroke="#cbd5e1" strokeWidth="0.3" strokeDasharray="1 1" />
        ))}
      </svg>
      {points.map((p, i) => (
        <div
          key={HUB[i].slug}
          className="absolute -translate-x-1/2 -translate-y-1/2 w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-white border border-gray-200 shadow-md flex items-center justify-center"
          style={{ left: `${p.x}%`, top: `${p.y}%` }}
          title={HUB[i].title}
        >
          <BrandSvg icon={HUB[i]} className="w-7 h-7 sm:w-8 sm:h-8" />
        </div>
      ))}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-white border-2 border-blue-500 shadow-xl flex flex-col items-center justify-center gap-1">
        <img src={LOGO_ICON} alt="Kanakku Desk" className="w-10 h-10 sm:w-12 sm:h-12 object-contain" />
        <span className="text-[10px] font-bold text-gray-900">Billing</span>
      </div>
    </div>
  );
}

/* ─── Page ───────────────────────────────────────────────────────────────── */

function IntegrationCard({ item }) {
  return (
    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-blue-200 transition-all flex flex-col">
      <div className="flex items-start justify-between gap-3 mb-5">
        <LogoTile logos={item.logos} icon={item.icon} size="lg" />
        <StatusBadge status={item.status} />
      </div>
      <h3 className="text-base font-bold text-gray-900">{item.name}</h3>
      <p className="text-sm text-gray-600 mt-2 leading-relaxed">{item.desc}</p>
    </div>
  );
}

export default function IntegrationsPage() {
  const ready = INTEGRATIONS.filter((i) => i.status !== "soon").length;

  return (
    <MarketingLayout footerCta={false}>
      <PageHero
        badge="Integrations"
        badgeIcon={Puzzle}
        title="Connect billing with the tools you"
        highlight="already use"
        desc="Payments, email and documents work out of the box, so your billing runs end to end from day one."
        visual={<HubVisual />}
        stats={[
          { icon: Puzzle, tone: "blue", value: ready, label: "Integrations ready to use" },
          { icon: CreditCard, tone: "indigo", value: "UPI & cards", label: "Online payments via Razorpay" },
          { icon: Mail, tone: "rose", value: "Gmail & SMTP", label: "Invoice emails" },
          { icon: Wallet, tone: "emerald", value: "₹0", label: "Setup fees" },
        ]}
      >
        <HeroActions primary={{ label: "Start for free", to: "/signup" }} secondary={{ label: "See pricing", to: "/pricing" }} />
      </PageHero>

      <section className="py-16 lg:py-20 bg-white">
        <div className={CONTAINER}>
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">All integrations</h2>
            <p className="text-sm sm:text-base text-gray-600 mt-3">Everything that connects to Kanakku Desk, in one place.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 max-w-6xl mx-auto">
            {INTEGRATIONS.map((i) => (
              <IntegrationCard key={i.name} item={i} />
            ))}
          </div>
        </div>
      </section>

      <CtaBand
        title="Need another integration?"
        desc="Tell us which tools your business uses and we'll help you connect them."
        primary={{ label: "Request an integration", to: "/pricing#contact-sales" }}
      />
    </MarketingLayout>
  );
}
