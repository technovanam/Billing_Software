import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import {
  Store,
  Warehouse,
  Briefcase,
  UserRound,
  Factory,
  RefreshCcw,
  Check,
  X,
  ArrowRight,
  Lightbulb,
  Wallet,
  BadgePercent,
  Zap,
  BarChart3,
  ChevronRight,
} from "lucide-react";
import { CONTAINER, MarketingLayout, PageHero, HeroActions, TrustRow, CtaBand, IconChip, SectionHeader, TONES, scrollTo } from "./marketing";

const INDUSTRIES = [
  {
    id: "retail",
    icon: Store,
    tone: "blue",
    title: "Retail & Shops",
    tagline: "Fast counter billing with a catalogue that keeps up.",
    before: ["Handwritten or spreadsheet bills", "Working out GST by hand", "No idea what's running out of stock"],
    points: [
      "Product autocomplete with HSN codes and tax rates",
      "Item-wise GST rates on every product",
      "Daily sales answered by the AI assistant",
      "Print or PDF a bill in seconds",
    ],
    modules: ["Invoices", "Products", "AI Assistant"],
  },
  {
    id: "wholesale",
    icon: Warehouse,
    tone: "indigo",
    title: "Wholesale & Distribution",
    tagline: "Bulk orders, credit customers and goods on the move.",
    before: ["Credit sales tracked in notebooks", "Partial payments easy to lose", "Separate paperwork for every dispatch"],
    points: [
      "Delivery challans with reference numbers and print",
      "Partial payments with balance due on every invoice",
      "Per-client outstanding and revenue totals",
      "Who-owes-money answers in one question",
    ],
    modules: ["Delivery Challans", "Payments", "Clients"],
  },
  {
    id: "services",
    icon: Briefcase,
    tone: "purple",
    title: "Agencies & Service Firms",
    tagline: "Bill for retainers and projects without spreadsheets.",
    before: ["Remembering every monthly retainer", "TDS deductions muddling the books", "Chasing clients for payment"],
    points: [
      "Recurring invoices created and emailed on schedule",
      "TDS deduction recorded with each payment",
      "Secure online payment links for every invoice",
      "Client-wise yearly reports",
    ],
    modules: ["Recurring Invoices", "Payments", "Reports"],
  },
  {
    id: "freelancers",
    icon: UserRound,
    tone: "emerald",
    title: "Freelancers & Consultants",
    tagline: "Look professional from your very first invoice.",
    before: ["Invoices made in a word processor", "Receipts scattered across email", "Scrambling at year end for your CA"],
    points: [
      "Free Starter plan to begin billing today",
      "GST-ready invoices with amount in words",
      "Expense tracking with receipt uploads",
      "Financial-year bill downloads for your CA",
    ],
    modules: ["Invoices", "Expenses", "Reports"],
  },
  {
    id: "manufacturing",
    icon: Factory,
    tone: "orange",
    title: "Manufacturers",
    tagline: "From purchase price to dispatch, in one place.",
    before: ["Costs and prices in different files", "Dispatch notes written separately", "GST split worked out at filing time"],
    points: [
      "Purchase price, SKU and price history per product",
      "Delivery challans for every dispatch",
      "GST breakdown across CGST, SGST and IGST",
      "Revenue trends month by month",
    ],
    modules: ["Products", "Delivery Challans", "Reports"],
  },
  {
    id: "subscriptions",
    icon: RefreshCcw,
    tone: "rose",
    title: "Subscription Businesses",
    tagline: "Repeat billing that runs itself.",
    before: ["Manually re-creating the same bill", "Missed billing dates", "No view of who has paid this cycle"],
    points: [
      "Flexible recurring frequencies and due dates",
      "Pause or resume a customer's billing anytime",
      "Automatic email delivery to clients",
      "Payment status across every cycle",
    ],
    modules: ["Recurring Invoices", "Payments", "Clients"],
  },
];

const GOALS = [
  { icon: Wallet, tone: "emerald", title: "Get paid faster", desc: "Payment links, Razorpay checkout and clear balance-due tracking shorten the time to cash.", link: "/features#payments" },
  { icon: BadgePercent, tone: "purple", title: "Stay GST compliant", desc: "HSN-based tax, GST breakdowns and FY bill downloads keep filing simple.", link: "/features#invoicing" },
  { icon: Zap, tone: "amber", title: "Save hours every week", desc: "Recurring invoices, saved products and an AI assistant take the busywork away.", link: "/features#automation" },
  { icon: BarChart3, tone: "blue", title: "Know your numbers", desc: "A live dashboard, revenue charts and per-client totals show where you stand.", link: "/features#reports" },
];

function HeroVisual({ onPick }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
      {INDUSTRIES.map((ind) => (
        <button
          key={ind.id}
          onClick={() => onPick(ind.id)}
          className="group bg-white p-4 sm:p-5 rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:-translate-y-0.5 hover:border-blue-200 transition-all text-left"
        >
          <IconChip icon={ind.icon} tone={ind.tone} size="lg" />
          <p className="text-sm font-bold text-gray-900 mt-4 group-hover:text-blue-600 transition-colors">{ind.title}</p>
          <p className="text-xs text-gray-500 mt-1 line-clamp-2">{ind.tagline}</p>
        </button>
      ))}
    </div>
  );
}

// Scroll distance (in viewport heights) given to each business type while the
// section is pinned on desktop.
const STEP_VH = 70;

function useIsDesktop() {
  const query = "(min-width: 1024px)";
  const [isDesktop, setIsDesktop] = useState(() => typeof window !== "undefined" && window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setIsDesktop(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return isDesktop;
}

// Absolute page offset to scroll to so that business type `index` is showing
function offsetForIndex(section, index) {
  const top = section.getBoundingClientRect().top + window.scrollY;
  const travel = section.offsetHeight - window.innerHeight;
  return top + ((index + 0.5) / INDUSTRIES.length) * travel;
}

function goTo(y) {
  const lenis = window.__lenis;
  if (lenis) {
    lenis.resize?.();
    lenis.scrollTo(y, { duration: 1 });
  } else {
    window.scrollTo({ top: y, behavior: "smooth" });
  }
}

function IndustryPanel({ ind, visible }) {
  return (
    <div
      className={`col-start-1 row-start-1 rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden transition-all ease-out ${
        visible ? "opacity-100 translate-y-0 duration-500 delay-150" : "opacity-0 translate-y-4 duration-150 pointer-events-none"
      }`}
      aria-hidden={!visible}
    >
      <div className={`px-6 sm:px-8 py-6 border-b border-gray-200 ${TONES[ind.tone].split(" ")[0]}`}>
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-white shadow-sm flex items-center justify-center">
            <ind.icon className={`w-7 h-7 ${TONES[ind.tone].split(" ")[1]}`} />
          </div>
          <div>
            <h3 className="text-xl sm:text-2xl font-bold text-gray-900">{ind.title}</h3>
            <p className="text-sm text-gray-600 mt-0.5">{ind.tagline}</p>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 md:divide-x divide-gray-200">
        <div className="p-6 sm:p-8">
          <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-4">Without Kanakku Desk</p>
          <ul className="space-y-3">
            {ind.before.map((b) => (
              <li key={b} className="flex items-start gap-3 text-sm text-gray-500">
                <span className="w-5 h-5 rounded-full bg-red-50 text-red-400 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <X className="w-3 h-3" strokeWidth={3} />
                </span>
                {b}
              </li>
            ))}
          </ul>
        </div>
        <div className="p-6 sm:p-8 bg-slate-50/60 border-t md:border-t-0 border-gray-200">
          <p className="text-[11px] font-bold uppercase tracking-wider text-blue-600 mb-4">With Kanakku Desk</p>
          <ul className="space-y-3">
            {ind.points.map((p) => (
              <li key={p} className="flex items-start gap-3 text-sm text-gray-800">
                <span className="w-5 h-5 rounded-full bg-green-100 text-green-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Check className="w-3 h-3" strokeWidth={3} />
                </span>
                {p}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="px-6 sm:px-8 py-5 border-t border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-gray-500 mr-1">Key modules:</span>
          {ind.modules.map((m) => (
            <span key={m} className="text-xs font-medium text-blue-700 bg-blue-50 border border-blue-100 px-2.5 py-1 rounded-full">
              {m}
            </span>
          ))}
        </div>
        <Link
          to="/signup"
          tabIndex={visible ? 0 : -1}
          className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors flex-shrink-0"
        >
          Start billing <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}

// On desktop the section pins under the header and scrolling steps through
// each business type; on smaller screens it is a plain tab list.
function IndustryExplorer({ activeIndex, setActiveIndex, isDesktop }) {
  const sectionRef = useRef(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!isDesktop) return undefined;
    let frame = 0;
    const update = () => {
      frame = 0;
      const el = sectionRef.current;
      if (!el) return;
      const travel = el.offsetHeight - window.innerHeight;
      const p = Math.min(1, Math.max(0, -el.getBoundingClientRect().top / travel));
      setProgress(p);
      setActiveIndex(Math.min(INDUSTRIES.length - 1, Math.floor(p * INDUSTRIES.length)));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [isDesktop, setActiveIndex]);

  const select = (i) => {
    if (isDesktop && sectionRef.current) goTo(offsetForIndex(sectionRef.current, i));
    else setActiveIndex(i);
  };

  return (
    <section
      id="business-types"
      ref={sectionRef}
      className="relative bg-white"
      style={isDesktop ? { height: `${INDUSTRIES.length * STEP_VH + 100}vh` } : undefined}
    >
      <div className={isDesktop ? "sticky top-16 h-[calc(100vh-4rem)] flex flex-col justify-center" : "py-16"}>
        <div className={CONTAINER}>
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
            <div>
              <p className="text-xs font-semibold text-blue-600 uppercase tracking-wider">By business type</p>
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mt-2">Pick your business</h2>
              <p className="text-sm text-gray-600 mt-1">See how teams like yours use Kanakku Desk every day.</p>
            </div>
            {isDesktop && (
              <div className="flex items-center gap-3 text-sm text-gray-500">
                <span className="font-bold text-gray-900 tabular-nums">{String(activeIndex + 1).padStart(2, "0")}</span>
                <div className="w-32 h-1 rounded-full bg-gray-200 overflow-hidden">
                  <div className="h-1 bg-blue-600 rounded-full" style={{ width: `${progress * 100}%` }} />
                </div>
                <span className="tabular-nums">{String(INDUSTRIES.length).padStart(2, "0")}</span>
              </div>
            )}
          </div>

          <div className="grid lg:grid-cols-12 gap-6">
            <div className="lg:col-span-4 flex lg:flex-col gap-2 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0">
              {INDUSTRIES.map((ind, i) => {
                const isActive = i === activeIndex;
                return (
                  <button
                    key={ind.id}
                    onClick={() => select(i)}
                    className={`relative flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all duration-300 min-w-[220px] lg:min-w-0 ${
                      isActive ? "bg-white border-blue-500 ring-2 ring-blue-500/15 shadow-md" : "bg-slate-50 border-transparent hover:bg-white hover:border-gray-200"
                    }`}
                  >
                    <IconChip icon={ind.icon} tone={ind.tone} size="sm" />
                    <span className={`flex-1 text-sm font-semibold ${isActive ? "text-blue-700" : "text-gray-800"}`}>{ind.title}</span>
                    <ChevronRight className={`w-4 h-4 hidden lg:block transition-colors ${isActive ? "text-blue-600" : "text-gray-300"}`} />
                  </button>
                );
              })}
            </div>

            <div className="lg:col-span-8 grid">
              {INDUSTRIES.map((ind, i) => (
                <IndustryPanel key={ind.id} ind={ind} visible={i === activeIndex} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function SolutionsPage() {
  const [activeIndex, setActiveIndex] = useState(0);
  const isDesktop = useIsDesktop();

  const pick = (id) => {
    const i = INDUSTRIES.findIndex((ind) => ind.id === id);
    const section = document.getElementById("business-types");
    if (isDesktop && section) {
      goTo(offsetForIndex(section, i));
    } else {
      setActiveIndex(i);
      scrollTo("#business-types");
    }
  };

  return (
    <MarketingLayout footerCta={false}>
      <PageHero
        badge="Solutions"
        badgeIcon={Lightbulb}
        title="Billing built around the way your"
        highlight="business works"
        desc="Shops, distributors, agencies, freelancers and manufacturers — Kanakku Desk adapts to how you sell and get paid."
        visual={<HeroVisual onPick={pick} />}
        stats={[
          { icon: Store, tone: "blue", value: INDUSTRIES.length, label: "Business types covered" },
          { icon: Wallet, tone: "emerald", value: "Free", label: "Starter plan to begin" },
          { icon: BadgePercent, tone: "purple", value: "100%", label: "GST ready" },
          { icon: Zap, tone: "amber", value: "Minutes", label: "To get started" },
        ]}
      >
        <HeroActions secondary={{ label: "Explore features", to: "/features" }} />
        <TrustRow items={["Built for Indian GST", "Works for any team size"]} />
      </PageHero>

      <IndustryExplorer activeIndex={activeIndex} setActiveIndex={setActiveIndex} isDesktop={isDesktop} />

      <section className="py-16 lg:py-20 bg-slate-50 border-y border-gray-200">
        <div className={CONTAINER}>
          <SectionHeader badge="By goal" title="Solve what matters most" desc="Start with the outcome you need and the right tools follow." />
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {GOALS.map((g, i) => (
              <Link
                key={g.title}
                to={g.link}
                className="group relative bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-blue-200 transition-all flex flex-col"
              >
                <span className="absolute top-5 right-5 text-3xl font-bold text-gray-100 group-hover:text-blue-50 transition-colors">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <IconChip icon={g.icon} tone={g.tone} size="lg" />
                <h3 className="text-base font-bold text-gray-900 mt-5">{g.title}</h3>
                <p className="text-sm text-gray-600 mt-2 leading-relaxed flex-1">{g.desc}</p>
                <span className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 mt-5">
                  Learn more <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <CtaBand
        title="Not sure which setup fits you?"
        desc="Tell us about your business and we'll recommend the right plan and setup."
        primary={{ label: "Talk to sales", to: "/pricing#contact-sales" }}
        secondary={{ label: "Start for free", to: "/signup" }}
      />
    </MarketingLayout>
  );
}
