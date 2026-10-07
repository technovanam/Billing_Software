import { useState } from "react";
import { Tag, BadgePercent, RefreshCcw, FileText, Wallet, Download, Users, Package, Sparkles, Lock, Link2 } from "lucide-react";
import { CONTAINER, MarketingLayout, PageHero, TrustRow, SectionHeader, IconChip } from "./marketing";
import {
  PricingPlans,
  PlanComparison,
  BillingToggle,
  ContactSalesSection,
  usePublicPlans,
  useContactSales,
  maxYearlySaving,
} from "./sales";
import { FaqSection } from "./faq";

const EVERY_PLAN = [
  { icon: FileText, tone: "blue", label: "GST invoices" },
  { icon: Wallet, tone: "emerald", label: "Payment tracking" },
  { icon: Link2, tone: "indigo", label: "Payment links" },
  { icon: Download, tone: "rose", label: "PDF & print" },
  { icon: Users, tone: "purple", label: "Client management" },
  { icon: Package, tone: "amber", label: "Product catalogue" },
  { icon: Sparkles, tone: "sky", label: "AI Assistant" },
  { icon: Lock, tone: "green", label: "Secure cloud storage" },
];

const PRICING_FAQS = [
  {
    category: "Plans",
    items: [
      {
        q: "Can I start for free?",
        a: "Yes. Start on the free Starter plan and upgrade whenever you need more users, branches or invoices.",
      },
      {
        q: "Can I change plans later?",
        a: "Yes. Contact our team and we'll move you to the plan that fits your business.",
      },
      {
        q: "How much do I save with yearly billing?",
        a: "Yearly plans are priced lower than paying month by month. Switch the toggle to Yearly to see the price and saving on each plan.",
      },
    ],
  },
  {
    category: "Enterprise",
    items: [
      {
        q: "Do you offer custom plans?",
        a: "Yes. For many outlets, larger teams or custom integrations, the Enterprise plan is priced for your business. Use the form below to talk to sales.",
      },
    ],
  },
];

export default function PricingPage() {
  const { plans, loading } = usePublicPlans();
  const { selectedPlan, contactSales } = useContactSales();
  const [annual, setAnnual] = useState(false);
  const saving = maxYearlySaving(plans);

  return (
    <MarketingLayout>
      <PageHero
        badge="Pricing"
        badgeIcon={Tag}
        title="Simple pricing that"
        highlight="grows with you"
        desc="Start free and upgrade when you need to. Every plan includes GST invoicing, payment tracking and secure cloud storage."
        stats={[
          { icon: Wallet, tone: "emerald", value: "Free", label: "Starter plan" },
          { icon: BadgePercent, tone: "purple", value: saving > 0 ? `Save ${saving}%` : "Yearly", label: "With yearly billing" },
          { icon: Sparkles, tone: "blue", value: "₹0", label: "Setup cost" },
          { icon: RefreshCcw, tone: "amber", value: "Anytime", label: "Upgrade your plan" },
        ]}
      >
        {!loading && plans.length > 0 && (
          <div className="flex justify-center mt-8">
            <BillingToggle annual={annual} onChange={setAnnual} saving={saving} />
          </div>
        )}
        <TrustRow center items={["Free plan available", "No setup cost", "Upgrade anytime"]} />
      </PageHero>

      <section id="plans" className="py-16 lg:py-20 bg-white">
        <div className={CONTAINER}>
          <PricingPlans plans={plans} loading={loading} onContactSales={contactSales} annual={annual} />
        </div>
      </section>

      {/* Included in every plan */}
      <section className="pb-16 bg-white">
        <div className={CONTAINER}>
          <div className="max-w-6xl mx-auto rounded-2xl border border-gray-200 bg-slate-50 p-6 sm:p-8">
            <p className="text-sm font-bold text-gray-900 text-center mb-6">Included in every plan</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {EVERY_PLAN.map((f) => (
                <div key={f.label} className="flex items-center gap-3">
                  <IconChip icon={f.icon} tone={f.tone} size="sm" />
                  <span className="text-sm font-medium text-gray-700">{f.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {!loading && plans.length > 0 && (
        <section id="compare" className="py-16 lg:py-20 bg-slate-50 border-y border-gray-200">
          <div className={CONTAINER}>
            <div className="max-w-6xl mx-auto">
              <SectionHeader badge="Compare" title="Compare plans in detail" desc="Every limit and feature, side by side." />
              <PlanComparison plans={plans} />
            </div>
          </div>
        </section>
      )}

      <FaqSection groups={PRICING_FAQS} title="Pricing questions" desc="Answers about plans, billing and custom pricing." />
      <ContactSalesSection plans={plans} selectedPlan={selectedPlan} />
    </MarketingLayout>
  );
}
