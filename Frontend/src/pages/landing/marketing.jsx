// Shared building blocks for the public marketing pages: header, footer,
// page hero and the small card helpers used across them.
import { useState, useEffect } from "react";
import { Link, NavLink, useNavigate, useLocation } from "react-router-dom";
import { Menu, X, ArrowRight, ArrowUp, Globe, Building2, CheckCircle2 } from "lucide-react";

export const LOGO_ICON = "/Icon@4x-8.png";

// Wide container used by every marketing section, header and footer
export const CONTAINER = "w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-10";

// Smooth-scroll to a section using Lenis (falls back to native scroll)
export function scrollTo(id) {
  const lenis = window.__lenis;
  const el = document.querySelector(id);
  if (!el) return;
  if (lenis) {
    // Page height changes between routes; refresh Lenis' cached scroll limit first
    lenis.resize?.();
    lenis.scrollTo(el, { offset: -64, duration: 1.4 });
  } else {
    el.scrollIntoView({ behavior: "smooth" });
  }
}

export function scrollToTop() {
  const lenis = window.__lenis;
  if (lenis) lenis.scrollTo(0, { duration: 1.4 });
  else window.scrollTo({ top: 0, behavior: "smooth" });
}

// Scrolls to the URL's #hash once the page has rendered (e.g. /#faq from another page)
export function useHashScroll() {
  const { hash } = useLocation();
  useEffect(() => {
    if (!hash) return undefined;
    const t = setTimeout(() => scrollTo(hash), 250);
    return () => clearTimeout(t);
  }, [hash]);
}

// Tinted icon chips, matching the cards in the admin dashboards
export const TONES = {
  blue: "bg-blue-100 text-blue-600",
  green: "bg-green-100 text-green-600",
  purple: "bg-purple-100 text-purple-600",
  indigo: "bg-indigo-100 text-indigo-600",
  orange: "bg-orange-100 text-orange-600",
  rose: "bg-rose-100 text-rose-600",
  amber: "bg-amber-100 text-amber-600",
  emerald: "bg-emerald-100 text-emerald-600",
  sky: "bg-sky-100 text-sky-600",
  slate: "bg-slate-100 text-slate-600",
};

export function IconChip({ icon: Icon, tone = "blue", size = "md" }) {
  const box = size === "sm" ? "w-8 h-8 rounded-lg" : size === "lg" ? "w-12 h-12 rounded-xl" : "w-10 h-10 rounded-xl";
  const glyph = size === "sm" ? "w-4 h-4" : size === "lg" ? "w-6 h-6" : "w-5 h-5";
  return (
    <div className={`${box} ${TONES[tone]} flex items-center justify-center flex-shrink-0`}>
      <Icon className={glyph} />
    </div>
  );
}

export function Badge({ children, icon: Icon }) {
  return (
    <span className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-700 border border-blue-100 text-xs font-semibold px-3 py-1 rounded-full">
      {Icon && <Icon className="w-3.5 h-3.5" />}
      {children}
    </span>
  );
}

export function SectionHeader({ badge, title, desc }) {
  return (
    <div className="text-center mb-12">
      <div className="mb-4">
        <Badge>{badge}</Badge>
      </div>
      <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">{title}</h2>
      <p className="text-sm sm:text-base text-gray-600 max-w-2xl mx-auto">{desc}</p>
    </div>
  );
}

export function Brand({ dark = false }) {
  return (
    <div className="flex items-center gap-2.5 flex-shrink-0">
      <img src={LOGO_ICON} alt="Kanakku Desk logo" className="h-9 w-auto object-contain" />
      <div className="leading-tight">
        <span className={`block text-base font-bold ${dark ? "text-white" : "text-gray-900"}`}>Kanakku Desk</span>
        <span className={`block text-[10px] font-semibold uppercase tracking-widest -mt-0.5 ${dark ? "text-blue-400" : "text-blue-600"}`}>
          GST Billing
        </span>
      </div>
    </div>
  );
}

// Hero band at the top of each inner marketing page, laid out like the home
// hero: one full screen, content centred, and an optional `stats` row of
// cards pinned to the bottom. With `visual` it splits into text + visual.
export function PageHero({ badge, badgeIcon, title, highlight, desc, children, visual, stats }) {
  const heading = (
    <h1
      className={`text-4xl sm:text-5xl xl:text-6xl font-bold text-gray-900 leading-[1.1] mb-5 ${visual ? "" : "max-w-4xl mx-auto"}`}
    >
      {title}
      {highlight && (
        <>
          {" "}
          <span className="text-blue-600">{highlight}</span>
        </>
      )}
    </h1>
  );

  return (
    <section className="relative min-h-screen flex flex-col bg-slate-50 border-b border-gray-200 pt-16 overflow-hidden">
      <div
        className="absolute inset-0 opacity-60 pointer-events-none"
        style={{ backgroundImage: "radial-gradient(#cbd5e1 1px, transparent 1px)", backgroundSize: "22px 22px" }}
        aria-hidden="true"
      />
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-slate-50 to-transparent pointer-events-none" aria-hidden="true" />

      <div className="relative flex-1 flex items-center">
        <div className={`${CONTAINER} py-10 lg:py-12`}>
          {visual ? (
            <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
              <div className="text-center lg:text-left">
                <div className="mb-6">
                  <Badge icon={badgeIcon}>{badge}</Badge>
                </div>
                {heading}
                <p className="text-base sm:text-lg text-gray-600 max-w-xl mx-auto lg:mx-0 leading-relaxed">{desc}</p>
                {children}
              </div>
              <div>{visual}</div>
            </div>
          ) : (
            <div className="text-center">
              <div className="mb-6">
                <Badge icon={badgeIcon}>{badge}</Badge>
              </div>
              {heading}
              <p className="text-base sm:text-lg text-gray-600 max-w-2xl mx-auto leading-relaxed">{desc}</p>
              {children}
            </div>
          )}
        </div>
      </div>

      {stats && (
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
      )}
    </section>
  );
}

// Primary + secondary call-to-action buttons used in page heroes
export function HeroActions({ primary = { label: "Start for free", to: "/signup" }, secondary, center = false }) {
  return (
    <div className={`flex flex-col sm:flex-row gap-3 mt-8 ${center ? "justify-center" : "justify-center lg:justify-start"}`}>
      <Link
        to={primary.to}
        className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-5 py-3 rounded-lg shadow-sm transition-colors"
      >
        {primary.label} <ArrowRight className="w-4 h-4" />
      </Link>
      {secondary && (
        <Link
          to={secondary.to}
          className="inline-flex items-center justify-center gap-2 bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 text-sm font-medium px-5 py-3 rounded-lg transition-colors"
        >
          {secondary.label}
        </Link>
      )}
    </div>
  );
}

// Row of green-tick reassurance points
export function TrustRow({ items, center = false }) {
  return (
    <ul className={`flex flex-wrap gap-x-5 gap-y-2 mt-6 ${center ? "justify-center" : "justify-center lg:justify-start"}`}>
      {items.map((t) => (
        <li key={t} className="flex items-center gap-1.5 text-sm text-gray-600">
          <CheckCircle2 className="w-4 h-4 text-green-500" />
          {t}
        </li>
      ))}
    </ul>
  );
}

// Dark call-to-action band placed at the bottom of inner pages
export function CtaBand({ title, desc, primary = { label: "Get started free", to: "/signup" }, secondary }) {
  return (
    <section className="py-16 bg-white">
      <div className={CONTAINER}>
        <div className="relative overflow-hidden rounded-2xl bg-blue-600 px-6 py-12 sm:px-12 text-center">
          <div
            className="absolute inset-0 opacity-20 pointer-events-none"
            style={{ backgroundImage: "radial-gradient(#ffffff 1px, transparent 1px)", backgroundSize: "20px 20px" }}
            aria-hidden="true"
          />
          <div className="relative">
            <h2 className="text-2xl sm:text-3xl font-bold text-white">{title}</h2>
            <p className="text-blue-100 text-sm sm:text-base mt-3 max-w-xl mx-auto">{desc}</p>
            <div className="flex flex-col sm:flex-row justify-center gap-3 mt-8">
              <Link
                to={primary.to}
                className="inline-flex items-center justify-center gap-2 bg-white hover:bg-blue-50 text-blue-700 text-sm font-semibold px-6 py-3 rounded-lg transition-colors"
              >
                {primary.label} <ArrowRight className="w-4 h-4" />
              </Link>
              {secondary && (
                <Link
                  to={secondary.to}
                  className="inline-flex items-center justify-center text-sm font-medium text-white border border-blue-400 hover:bg-blue-700 px-6 py-3 rounded-lg transition-colors"
                >
                  {secondary.label}
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── Header ─────────────────────────────────────────────────────────────── */

export const NAV_LINKS = [
  { label: "Features", to: "/features" },
  { label: "Solutions", to: "/solutions" },
  { label: "Integrations", to: "/integrations" },
  { label: "Pricing", to: "/pricing" },
  { label: "FAQ", to: "/#faq" },
];

function navClass(isActive) {
  return `text-sm font-medium px-3.5 py-1.5 rounded-lg transition-colors ${
    isActive ? "bg-white text-blue-600 shadow-sm" : "text-gray-600 hover:text-gray-900"
  }`;
}

export function Navbar() {
  const navigate = useNavigate();
  const { pathname, hash } = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => setMobileOpen(false), [pathname, hash]);

  // Same-page hash links scroll instead of re-navigating
  const handleHashLink = (e, to) => {
    const [path, anchor] = to.split("#");
    if (anchor && (path || "/") === pathname) {
      e.preventDefault();
      setMobileOpen(false);
      scrollTo(`#${anchor}`);
    }
  };

  const isActive = (to) => (to.includes("#") ? false : pathname === to);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-200 ${
        scrolled || mobileOpen ? "bg-white border-b border-gray-200 shadow-sm" : "bg-white/70 backdrop-blur-md border-b border-transparent"
      }`}
    >
      <div className={CONTAINER}>
        <div className="flex items-center justify-between h-16 gap-4">
          <Link to="/" onClick={() => pathname === "/" && scrollToTop()}>
            <Brand />
          </Link>

          <nav className="hidden lg:flex items-center gap-1 bg-slate-50 border border-gray-200 rounded-xl p-1">
            {NAV_LINKS.map((link) =>
              link.to.includes("#") ? (
                <Link key={link.to} to={link.to} onClick={(e) => handleHashLink(e, link.to)} className={navClass(false)}>
                  {link.label}
                </Link>
              ) : (
                <NavLink key={link.to} to={link.to} className={() => navClass(isActive(link.to))}>
                  {link.label}
                </NavLink>
              )
            )}
          </nav>

          <div className="hidden lg:flex items-center gap-2">
            <Link
              to="/signin"
              className="text-sm font-medium text-gray-700 hover:bg-gray-50 border border-gray-200 px-4 py-2 rounded-lg transition-colors"
            >
              Sign In
            </Link>
            <button
              onClick={() => navigate("/signup")}
              className="text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              Get Started
            </button>
          </div>

          <button
            className="lg:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-100"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {mobileOpen && (
          <div className="lg:hidden border-t border-gray-100 py-3 space-y-1">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                onClick={(e) => handleHashLink(e, link.to)}
                className={`block px-3 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                  isActive(link.to) ? "bg-blue-50 text-blue-600" : "text-gray-700 hover:bg-gray-50"
                }`}
              >
                {link.label}
              </Link>
            ))}
            <div className="pt-3 mt-2 border-t border-gray-100 grid grid-cols-2 gap-2 pb-1">
              <Link to="/signin" className="text-center py-2.5 text-sm font-medium text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50">
                Sign In
              </Link>
              <button
                onClick={() => navigate("/signup")}
                className="py-2.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Get Started
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}

/* ─── Footer ─────────────────────────────────────────────────────────────── */

const FOOTER_COLUMNS = [
  {
    title: "Product",
    links: [
      { label: "Features", to: "/features" },
      { label: "Solutions", to: "/solutions" },
      { label: "Integrations", to: "/integrations" },
      { label: "Pricing", to: "/pricing" },
    ],
  },
  {
    title: "Explore",
    links: [
      { label: "Modules", to: "/#modules" },
      { label: "AI Assistant", to: "/#ai-assistant" },
      { label: "How It Works", to: "/#how-it-works" },
      { label: "Security", to: "/#about" },
    ],
  },
  {
    title: "Support",
    links: [
      { label: "FAQ", to: "/#faq" },
      { label: "Contact Sales", to: "/pricing#contact-sales" },
      { label: "Sign In", to: "/signin" },
      { label: "Create Account", to: "/signup" },
    ],
  },
];

export function Footer({ showCta = true }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const year = new Date().getFullYear();

  const handleLink = (e, to) => {
    const [path, anchor] = to.split("#");
    if (anchor && (path || "/") === pathname) {
      e.preventDefault();
      scrollTo(`#${anchor}`);
    }
  };

  return (
    <footer className="bg-gray-900 text-gray-400">
      <div className={CONTAINER}>
        {/* CTA strip */}
        {showCta && (
        <div className="py-10 border-b border-gray-800 flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-white">Ready to simplify your billing?</h2>
            <p className="text-sm text-gray-400 mt-1">Create your account and send your first GST invoice in minutes.</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 flex-shrink-0 w-full sm:w-auto">
            <button
              onClick={() => navigate("/signup")}
              className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors"
            >
              Get Started <ArrowRight className="w-4 h-4" />
            </button>
            <Link
              to="/signin"
              className="inline-flex items-center justify-center text-sm font-medium text-gray-200 border border-gray-700 hover:bg-gray-800 px-5 py-2.5 rounded-lg transition-colors"
            >
              Sign In
            </Link>
          </div>
        </div>
        )}

        {/* Link columns */}
        <div className="py-12 grid grid-cols-2 md:grid-cols-5 gap-8">
          <div className="col-span-2">
            <Brand dark />
            <p className="text-sm leading-relaxed text-gray-500 max-w-xs mt-4">
              Professional billing and invoicing software built for Indian businesses. Simple, fast, and GST-ready.
            </p>
            <div className="mt-5 space-y-2">
              <a
                href="https://www.technovanam.in"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
              >
                <Globe className="w-4 h-4" /> www.technovanam.in
              </a>
              <Link
                to="/pricing#contact-sales"
                onClick={(e) => handleLink(e, "/pricing#contact-sales")}
                className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
              >
                <Building2 className="w-4 h-4" /> Talk to sales
              </Link>
            </div>
          </div>

          {FOOTER_COLUMNS.map((col) => (
            <div key={col.title}>
              <h4 className="text-white text-xs font-semibold mb-4 uppercase tracking-wider">{col.title}</h4>
              <ul className="space-y-2.5">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <Link to={l.to} onClick={(e) => handleLink(e, l.to)} className="text-sm text-gray-500 hover:text-white transition-colors">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-gray-800 py-6 flex items-center justify-between gap-3">
          <p className="text-xs text-gray-500">&copy; {year} Techno Vanam Innovations</p>
          <button
            onClick={scrollToTop}
            className="w-8 h-8 rounded-lg border border-gray-700 flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
            aria-label="Back to top"
          >
            <ArrowUp className="w-4 h-4" />
          </button>
        </div>
      </div>
    </footer>
  );
}

export function MarketingLayout({ children, footerCta = true }) {
  useHashScroll();
  return (
    <div className="font-mazzard text-slate-800 bg-white">
      <Navbar />
      <main>{children}</main>
      <Footer showCta={footerCta} />
    </div>
  );
}
