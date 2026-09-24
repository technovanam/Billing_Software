import { useState, useEffect, useContext, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { AuthContext } from "../../context/AuthContext";

// Smooth-scroll to a section using Lenis (falls back to native scroll)
function scrollTo(id) {
  const lenis = window.__lenis;
  const el = document.querySelector(id);
  if (!el) return;
  if (lenis) {
    lenis.scrollTo(el, { offset: -72, duration: 1.4 });
  } else {
    el.scrollIntoView({ behavior: "smooth" });
  }
}

const LOGO_ICON = "/Icon@4x-8.png";
const LOGO_FULL = "/logo@4x-8.png";

/* ─── Data ──────────────────────────────────────────────────────────────── */

const features = [
  {
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    title: "Smart Invoice Generation",
    desc: "Create professional GST-compliant invoices in seconds. Customize templates, add your logo, and send with one click.",
  },
  {
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2z" />
      </svg>
    ),
    title: "Payment Tracking",
    desc: "Track every rupee — outstanding, partially paid, and settled. Get real-time visibility into your cash flow.",
  },
  {
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    title: "Customer Management",
    desc: "Store all customer details, billing history, and transaction records in one organised, searchable place.",
  },
  {
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 10V7" />
      </svg>
    ),
    title: "Product & Service Catalogue",
    desc: "Maintain a rich catalogue of products and services with HSN codes, pricing, and tax rates ready to add to any invoice.",
  },
  {
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    title: "Revenue Reports",
    desc: "Visualise monthly and yearly revenue with interactive charts. Export detailed PDF reports for accounting.",
  },
  {
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
      </svg>
    ),
    title: "PDF Export & Print",
    desc: "Download pixel-perfect invoice PDFs, print them instantly, or share via email — all from the same screen.",
  },
];

const steps = [
  { number: "01", title: "Add Your Clients", desc: "Register your clients with their GST, address, and contact details once." },
  { number: "02", title: "Build Your Catalogue", desc: "Add the products or services you sell with rates and tax information." },
  { number: "03", title: "Create an Invoice", desc: "Pick a client, select items, and your GST invoice is ready in under a minute." },
  { number: "04", title: "Track & Report", desc: "Mark payments, monitor pending dues, and export revenue reports anytime." },
];

const stats = [
  { value: "500+", label: "Invoices Generated" },
  { value: "100%", label: "GST Compliant" },
  { value: "< 1 min", label: "To Create an Invoice" },
  { value: "Zero", label: "Setup Cost" },
];

/* ─── Sub-components ─────────────────────────────────────────────────────── */

function Navbar({ onGetStarted }) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const navLinks = [
    { label: "Features", target: "#features" },
    { label: "How It Works", target: "#how-it-works" },
    { label: "About", target: "#about" },
    { label: "Contact", target: "#contact" },
  ];

  const handleNav = useCallback((e, target) => {
    e.preventDefault();
    setMobileOpen(false);
    scrollTo(target);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? "bg-white shadow-md" : "bg-white/80 backdrop-blur-md"
      }`}
    >
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 md:h-18">
          {/* Left — Logo + Nav */}
          {/* Left — Logo */}
          <div className="flex items-center gap-2.5 flex-shrink-0">
            <img src={LOGO_ICON} alt="Techno Vanam Logo" className="h-9 w-auto object-contain" />
            <div className="leading-tight">
              <span className="block text-base md:text-lg font-bold text-gray-900">Techno Vanam</span>
              <span className="block text-[10px] font-semibold text-blue-600 uppercase tracking-widest -mt-0.5">Billing</span>
            </div>
          </div>

          {/* Center — Nav */}
          <nav className="hidden md:flex items-center gap-6 absolute left-1/2 -translate-x-1/2">
            {navLinks.map((link) => (
              <a
                key={link.target}
                href={link.target}
                onClick={(e) => handleNav(e, link.target)}
                className="text-sm font-medium text-gray-600 hover:text-blue-600 transition-colors"
              >
                {link.label}
              </a>
            ))}
          </nav>

          {/* Right — Sign In + Get Started */}
          <div className="hidden md:flex items-center gap-3">
            <Link
              to="/signin"
              className="text-sm font-medium text-gray-700 hover:text-blue-600 transition-colors px-4 py-2"
            >
              Sign In
            </Link>
            <button
              onClick={onGetStarted}
              className="text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl transition-colors shadow-sm"
            >
              Get Started
            </button>
          </div>

          {/* Mobile menu button */}
          <button
            className="md:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-100"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="md:hidden border-t border-gray-100 py-3 space-y-1">
            {navLinks.map((link) => (
              <a
                key={link.target}
                href={link.target}
                onClick={(e) => handleNav(e, link.target)}
                className="block px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors"
              >
                {link.label}
              </a>
            ))}
            <div className="pt-2 border-t border-gray-100 flex flex-col gap-2 px-4 pb-2">
              <Link to="/signin" className="w-full text-center py-2.5 text-sm font-medium text-gray-700 border border-gray-200 rounded-xl hover:bg-gray-50">
                Sign In
              </Link>
              <button
                onClick={onGetStarted}
                className="w-full py-2.5 text-sm font-semibold bg-blue-600 text-white rounded-xl hover:bg-blue-700"
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

function HeroSection({ onGetStarted }) {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 pt-16">
      {/* Background decorations */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -right-40 w-[600px] h-[600px] bg-blue-100 rounded-full opacity-40 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-[500px] h-[500px] bg-indigo-100 rounded-full opacity-40 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-sky-50 rounded-full opacity-30 blur-3xl" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold px-4 py-1.5 rounded-full mb-6 shadow-sm">
          <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
          GST-Compliant Billing Software
        </div>

        {/* Headline */}
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-gray-900 leading-tight mb-6 max-w-4xl mx-auto">
          Billing Made{" "}
          <span className="relative inline-block pb-2">
            <span className="relative z-10 text-blue-600">Simple</span>
            <svg className="absolute -bottom-0 left-0 w-full overflow-visible" height="10" viewBox="0 0 200 10" preserveAspectRatio="none">
              <path d="M0 7 Q50 2 100 7 Q150 12 200 7" stroke="#3b82f6" strokeWidth="3" fill="none" strokeLinecap="round" />
            </svg>
          </span>{" "}
          for Your Business
        </h1>

        {/* Sub-headline */}
        <p className="text-lg sm:text-xl text-gray-600 max-w-2xl mx-auto mb-10 leading-relaxed">
          Techno Vanam Billing lets you create GST invoices, manage clients, track payments, and generate revenue reports — all in one clean dashboard.
        </p>

        {/* CTA buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
          <button
            onClick={onGetStarted}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 py-3.5 rounded-xl shadow-lg hover:shadow-xl transition-all text-base"
          >
            Start Billing Now
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </button>
          <a
            href="#features"
            onClick={(e) => { e.preventDefault(); scrollTo("#features"); }}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-white hover:bg-gray-50 text-gray-700 font-semibold px-8 py-3.5 rounded-xl border border-gray-200 shadow-sm transition-all text-base"
          >
            See Features
          </a>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 max-w-3xl mx-auto">
          {stats.map((s) => (
            <div key={s.label} className="bg-white/80 backdrop-blur-sm rounded-2xl p-4 shadow-sm border border-white">
              <div className="text-2xl font-bold text-blue-600">{s.value}</div>
              <div className="text-xs text-gray-500 mt-0.5 font-medium">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Scroll indicator */}
      <a href="#features" onClick={(e) => { e.preventDefault(); scrollTo("#features"); }} className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 text-gray-400 hover:text-blue-500 transition-colors">
        <span className="text-xs font-medium">Scroll to explore</span>
        <svg className="w-4 h-4 animate-bounce" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </a>
    </section>
  );
}

function FeaturesSection() {
  return (
    <section id="features" className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <div className="text-center mb-16">
          <span className="inline-block bg-blue-50 text-blue-700 text-xs font-semibold px-4 py-1.5 rounded-full mb-4 uppercase tracking-wider">
            Everything You Need
          </span>
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
            Powerful Features, Zero Complexity
          </h2>
          <p className="text-gray-500 text-lg max-w-2xl mx-auto">
            From invoicing to reports, every tool your business needs is built-in and ready to use.
          </p>
        </div>

        {/* Feature cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f, i) => (
            <div
              key={i}
              className="group relative p-6 bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-lg hover:border-blue-100 transition-all duration-300"
            >
              <div className="w-12 h-12 bg-blue-50 group-hover:bg-blue-600 text-blue-600 group-hover:text-white rounded-xl flex items-center justify-center mb-4 transition-all duration-300">
                {f.icon}
              </div>
              <h3 className="text-base font-semibold text-gray-900 mb-2">{f.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function HowItWorksSection() {
  return (
    <section id="how-it-works" className="py-24 bg-gradient-to-b from-slate-50 to-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <span className="inline-block bg-indigo-50 text-indigo-700 text-xs font-semibold px-4 py-1.5 rounded-full mb-4 uppercase tracking-wider">
            Simple Workflow
          </span>
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
            Up and Running in Minutes
          </h2>
          <p className="text-gray-500 text-lg max-w-2xl mx-auto">
            No complicated setup. Just sign in and start billing your clients right away.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {steps.map((step, i) => (
            <div key={i} className="relative">
              {/* Connector line */}
              {i < steps.length - 1 && (
                <div className="hidden lg:block absolute top-10 left-full w-full h-px bg-gradient-to-r from-blue-200 to-transparent z-0" style={{ width: "calc(100% - 2.5rem)", left: "calc(50% + 1.25rem)" }} />
              )}
              <div className="relative bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow text-center">
                <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-bold text-lg rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-md">
                  {step.number}
                </div>
                <h3 className="text-base font-semibold text-gray-900 mb-2">{step.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function AboutSection() {
  return (
    <section id="about" className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left — text */}
          <div>
            <span className="inline-block bg-green-50 text-green-700 text-xs font-semibold px-4 py-1.5 rounded-full mb-5 uppercase tracking-wider">
              About Techno Vanam Billing
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-5 leading-tight">
              Built for Indian Businesses, Powered by Modern Technology
            </h2>
            <p className="text-gray-600 text-base leading-relaxed mb-5">
              Techno Vanam Billing is a purpose-built invoicing and billing platform designed for small and medium businesses in India. We understand the complexity of GST, the importance of professional invoices, and the need for clear financial visibility.
            </p>
            <p className="text-gray-600 text-base leading-relaxed mb-8">
              Our platform combines a clean, intuitive interface with powerful features — giving you everything from invoice creation to revenue analytics without any learning curve.
            </p>

            <div className="grid grid-cols-2 gap-4">
              {[
                { icon: "✓", text: "GST Invoice Compliant" },
                { icon: "✓", text: "Secure Firebase Auth" },
                { icon: "✓", text: "Financial Year Reports" },
                { icon: "✓", text: "PDF & Print Export" },
                { icon: "✓", text: "Multi-client Support" },
                { icon: "✓", text: "Real-time Dashboard" },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-2.5">
                  <span className="w-5 h-5 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
                    {item.icon}
                  </span>
                  <span className="text-sm font-medium text-gray-700">{item.text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right — visual card stack */}
          <div className="relative flex items-center justify-center h-80 lg:h-auto">
            <div className="relative w-full max-w-sm mx-auto">
              {/* Background card */}
              <div className="absolute -top-4 -right-4 w-full h-full bg-indigo-100 rounded-3xl rotate-3" />
              <div className="absolute -top-2 -right-2 w-full h-full bg-blue-100 rounded-3xl rotate-1" />

              {/* Main card */}
              <div className="relative bg-gradient-to-br from-blue-600 to-indigo-700 rounded-3xl p-8 text-white shadow-2xl">
                <div className="flex items-center gap-3 mb-6">
                  <img src={LOGO_ICON} alt="Techno Vanam Logo" className="w-10 h-10 object-contain" />
                  <div>
                    <div className="font-bold text-sm">Techno Vanam</div>
                    <div className="text-blue-200 text-xs">Billing Dashboard</div>
                  </div>
                </div>

                <div className="space-y-3 mb-6">
                  {[
                    { label: "Total Revenue", value: "₹4,85,000" },
                    { label: "Invoices This Month", value: "38" },
                    { label: "Pending Payments", value: "₹32,400" },
                  ].map((row, i) => (
                    <div key={i} className="flex justify-between items-center bg-white/10 rounded-xl px-4 py-2.5">
                      <span className="text-xs text-blue-100">{row.label}</span>
                      <span className="text-sm font-bold">{row.value}</span>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2">
                  <div className="flex-1 bg-white/20 rounded-lg py-2 text-center text-xs font-semibold">New Invoice</div>
                  <div className="flex-1 bg-white rounded-lg py-2 text-center text-xs font-semibold text-blue-600">View Report</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function CtaBanner({ onGetStarted }) {
  return (
    <section className="py-20 bg-gradient-to-r from-blue-600 to-indigo-700">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
          Ready to Simplify Your Billing?
        </h2>
        <p className="text-blue-100 text-lg mb-10 max-w-xl mx-auto">
          Join businesses that trust Techno Vanam Billing to manage their invoices and payments effortlessly.
        </p>
        <button
          onClick={onGetStarted}
          className="inline-flex items-center gap-2 bg-white hover:bg-blue-50 text-blue-700 font-bold px-10 py-4 rounded-xl text-base shadow-xl hover:shadow-2xl transition-all"
        >
          Sign In to Dashboard
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </button>
      </div>
    </section>
  );
}

function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer id="contact" className="bg-gray-900 text-gray-400">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 mb-12">
          {/* Brand */}
          <div className="md:col-span-1">
            <div className="flex items-center gap-3 mb-4">
              <img src={LOGO_ICON} alt="Techno Vanam Logo" className="h-9 w-auto object-contain" />
              <div>
                <div className="text-white font-bold text-base">Techno Vanam</div>
                <div className="text-blue-400 text-[10px] font-semibold uppercase tracking-widest">Billing</div>
              </div>
            </div>
            <p className="text-sm leading-relaxed text-gray-500 max-w-xs">
              Professional billing and invoicing software built for Indian businesses. Simple, fast, and GST-ready.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-white text-sm font-semibold mb-4 uppercase tracking-wider">Quick Links</h4>
            <ul className="space-y-2.5">
              {[
                { label: "Features", href: "#features" },
                { label: "How It Works", href: "#how-it-works" },
                { label: "About Us", href: "#about" },
                { label: "Sign In", href: "/signin" },
              ].map((l) => (
                <li key={l.label}>
                  <a href={l.href} className="text-sm text-gray-500 hover:text-blue-400 transition-colors">
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Features list */}
          <div>
            <h4 className="text-white text-sm font-semibold mb-4 uppercase tracking-wider">Features</h4>
            <ul className="space-y-2.5">
              {["GST Invoice Generation", "Payment Tracking", "Client Management", "Revenue Reports", "PDF Export"].map((f) => (
                <li key={f}>
                  <span className="text-sm text-gray-500">{f}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Divider + copyright */}
        <div className="border-t border-gray-800 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-gray-600">
            &copy; {year} Techno Vanam Billing. All rights reserved.
          </p>
          <a
            href="https://www.technovanam.in"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-gray-600 hover:text-white transition-colors"
          >
            Designed &amp; Developed by Techno Vanam
          </a>
        </div>
      </div>
    </footer>
  );
}

/* ─── Main Page ──────────────────────────────────────────────────────────── */

export default function LandingPage() {
  const navigate = useNavigate();
  const { user, authInitialized } = useContext(AuthContext);

  // If already signed in, redirect to respective dashboard
  useEffect(() => {
    if (authInitialized && user) {
      const email = (user.email || "").toLowerCase();
      const isWarehouse = email === "wh.demo@technovanam.in" || email.startsWith("wh.");
      navigate(isWarehouse ? "/warehouse" : "/dashboard", { replace: true });
    }
  }, [authInitialized, user, navigate]);

  const handleGetStarted = () => navigate("/signup");

  return (
    <div className="font-[Mazzard,sans-serif]">
      <Navbar onGetStarted={handleGetStarted} />
      <HeroSection onGetStarted={handleGetStarted} />
      <FeaturesSection />
      <HowItWorksSection />
      <AboutSection />
      <CtaBanner onGetStarted={handleGetStarted} />
      <Footer />
    </div>
  );
}
