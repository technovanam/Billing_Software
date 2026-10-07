// FAQ section: category tabs on top, a help card on the left and an
// accordion of question cards on the right.
import { useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Minus, MessageCircleQuestion, ArrowRight } from "lucide-react";
import { CONTAINER, Badge, IconChip } from "./marketing";

export const LANDING_FAQS = [
  {
    category: "General",
    items: [
      {
        q: "Who is Kanakku Desk for?",
        a: "Small and medium businesses in India — shops, wholesalers, service providers, agencies and freelancers — that need GST invoices, payment tracking and clear reports.",
      },
      {
        q: "What does the AI Assistant do?",
        a: "It answers questions about your live billing data — today's sales, who owes money, top products, GST totals — and can validate a GSTIN.",
      },
      {
        q: "Is my data kept separate from other businesses?",
        a: "Yes. Every business's data is stored separately and protected by Firebase authentication. Inactive sessions are signed out automatically.",
      },
    ],
  },
  {
    category: "Invoicing",
    items: [
      {
        q: "Is the invoice format GST compliant?",
        a: "Yes. Invoices calculate CGST, SGST or IGST from HSN codes and tax rates, support TDS deduction and optional round-off, and print the amount in words.",
      },
      {
        q: "Can invoices be generated automatically?",
        a: "Recurring invoices are created automatically on their schedule and emailed to your clients. You can pause, resume or edit them at any time.",
      },
      {
        q: "Can I create delivery challans too?",
        a: "Yes. Delivery challans have their own module with reference numbers, items, an amount summary, declaration and a print-ready preview.",
      },
    ],
  },
  {
    category: "Payments",
    items: [
      {
        q: "Can I record partial payments?",
        a: "Yes. Record full or partial payments with method, transaction ID and date. The invoice shows the paid amount and balance due, and keeps a full transaction history.",
      },
      {
        q: "How do my clients pay online?",
        a: "Each invoice can have a secure payment link. Clients open it and pay through Razorpay, and the payment is recorded against the invoice.",
      },
    ],
  },
  {
    category: "Plans",
    items: [
      {
        q: "Is there a free plan?",
        a: "Yes, you can start on the free Starter plan and upgrade whenever your business needs more users, branches or invoices.",
      },
      {
        q: "Can I get a plan tailored to my business?",
        a: "Yes. Fill in the contact sales form with your team size and needs, and our team will get back to you with the right plan.",
      },
    ],
  },
];

function FaqItem({ index, item, open, onToggle }) {
  return (
    <div
      className={`rounded-xl border bg-white transition-all duration-200 ${
        open ? "border-blue-200 shadow-md ring-1 ring-blue-100" : "border-gray-200 shadow-sm hover:border-gray-300"
      }`}
    >
      <button onClick={onToggle} className="w-full flex items-center gap-4 px-5 py-4 text-left" aria-expanded={open}>
        <span
          className={`w-8 h-8 rounded-lg text-xs font-bold flex items-center justify-center flex-shrink-0 transition-colors ${
            open ? "bg-blue-600 text-white" : "bg-slate-100 text-gray-500"
          }`}
        >
          {String(index + 1).padStart(2, "0")}
        </span>
        <span className={`flex-1 text-sm sm:text-base font-semibold ${open ? "text-blue-700" : "text-gray-900"}`}>{item.q}</span>
        <span
          className={`w-7 h-7 rounded-full border flex items-center justify-center flex-shrink-0 transition-colors ${
            open ? "border-blue-200 bg-blue-50 text-blue-600" : "border-gray-200 text-gray-400"
          }`}
        >
          {open ? <Minus className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
        </span>
      </button>
      {/* grid-rows trick animates the height without measuring it */}
      <div className={`grid transition-all duration-300 ease-out ${open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
        <div className="overflow-hidden">
          <p className="pl-[4.25rem] pr-6 pb-5 text-sm text-gray-600 leading-relaxed">{item.a}</p>
        </div>
      </div>
    </div>
  );
}

export function FaqSection({
  id = "faq",
  groups = LANDING_FAQS,
  title = "Frequently Asked Questions",
  desc = "Everything you need to know about invoicing, payments and plans.",
  className = "bg-white",
}) {
  const [tab, setTab] = useState(0);
  const [open, setOpen] = useState(0);
  const items = groups[tab]?.items || [];

  const selectTab = (i) => {
    setTab(i);
    setOpen(0);
  };

  return (
    <section id={id} className={`py-20 ${className}`}>
      <div className={CONTAINER}>
        <div className="grid lg:grid-cols-12 gap-10 lg:gap-14">
          <div className="lg:col-span-4">
            <div className="lg:sticky lg:top-24">
              <div className="mb-4">
                <Badge>FAQ</Badge>
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">{title}</h2>
              <p className="text-sm sm:text-base text-gray-600 leading-relaxed mb-8">{desc}</p>

              <div className="rounded-xl bg-slate-50 border border-gray-200 p-5">
                <IconChip icon={MessageCircleQuestion} tone="blue" />
                <p className="text-sm font-bold text-gray-900 mt-4">Still have questions?</p>
                <p className="text-xs text-gray-500 mt-1 mb-4">Our team is happy to walk you through the product and pricing.</p>
                <Link
                  to="/pricing#contact-sales"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700"
                >
                  Talk to our team <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </div>

          <div className="lg:col-span-8">
            {groups.length > 1 && (
              <div className="flex flex-wrap gap-2 mb-6" role="tablist">
                {groups.map((g, i) => (
                  <button
                    key={g.category}
                    role="tab"
                    aria-selected={tab === i}
                    onClick={() => selectTab(i)}
                    className={`text-sm font-medium px-4 py-2 rounded-lg border transition-colors ${
                      tab === i ? "bg-blue-600 border-blue-600 text-white" : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    {g.category}
                    <span className={`ml-2 text-xs ${tab === i ? "text-blue-100" : "text-gray-400"}`}>{g.items.length}</span>
                  </button>
                ))}
              </div>
            )}

            <div className="space-y-3">
              {items.map((item, i) => (
                <FaqItem key={item.q} index={i} item={item} open={open === i} onToggle={() => setOpen(open === i ? -1 : i)} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
