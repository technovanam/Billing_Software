import React, { useEffect, useRef } from "react";
import PropTypes from "prop-types";
import { Sparkles, X, Send, Loader2, HelpCircle, Info } from "lucide-react";
import DraftPreviewPanel from "./DraftPreviewPanel";

const EXAMPLES = {
  invoice: "Ravi Traders ku 10 bag cement, 5 kg nails, 15 days credit",
  pos: "2 Parle-G, 1 litre Aavin milk, cash",
};

// Opens with the page's shortcut (F2 on invoices, Ctrl+K on POS) or the floating
// button. Hidden entirely when offline; manual billing is untouched.
export default function AICommandBar({ ai, shortcut, shortcutLabel, customers, totals, onConfirm }) {
  const inputRef = useRef(null);

  useEffect(() => {
    if (!ai.isOnline) return undefined;
    const onKey = (e) => {
      if (shortcut(e)) {
        e.preventDefault();
        ai.toggle();
      } else if (e.key === "Escape" && ai.isOpen) {
        ai.close();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ai, shortcut]);

  useEffect(() => {
    if (ai.isOpen) inputRef.current?.focus();
  }, [ai.isOpen]);

  if (!ai.isOnline) return null;

  return (
    <>
      {!ai.isOpen && (
        <button
          type="button"
          onClick={ai.open}
          className="fixed bottom-24 right-6 z-40 inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-lg hover:bg-slate-800"
          data-testid="ai-command-open"
        >
          <Sparkles className="h-4 w-4 text-amber-300" /> AI bill <span className="rounded bg-white/15 px-1.5 text-[10px]">{shortcutLabel}</span>
        </button>
      )}

      {ai.isOpen && (
        <aside
          className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-2xl"
          role="dialog"
          aria-label="AI command bar"
          data-testid="ai-command-bar"
        >
          <header className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <Sparkles className="h-4 w-4 text-amber-500" /> AI bill draft
            </h2>
            <button type="button" onClick={ai.close} className="rounded p-1 text-slate-500 hover:bg-slate-100" aria-label="Close AI command bar">
              <X className="h-4 w-4" />
            </button>
          </header>

          <form
            className="border-b border-slate-100 p-4"
            onSubmit={(e) => {
              e.preventDefault();
              ai.submit();
            }}
          >
            <div className="flex gap-2">
              <input
                ref={inputRef}
                value={ai.text}
                onChange={(e) => ai.setText(e.target.value)}
                placeholder={`e.g. ${EXAMPLES[ai.context]}`}
                className="min-w-0 flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                aria-label="Billing command"
                maxLength={500}
                data-testid="ai-command-input"
              />
              <button type="submit" disabled={ai.loading || !ai.text.trim()} className="rounded-xl bg-blue-600 px-3 text-white disabled:opacity-40" aria-label="Send command" data-testid="ai-command-send">
                {ai.loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            </div>
            <p className="mt-1.5 text-[11px] text-slate-400">Follow up to edit: &quot;remove nails&quot;, &quot;make cement 12 bags&quot;, &quot;customer name Kumar&quot;.</p>
          </form>

          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {ai.error && <p className="rounded-lg bg-red-50 p-2 text-xs text-red-700" data-testid="ai-error">{ai.error}</p>}
            {ai.clarification && (
              <p className="flex gap-1.5 rounded-lg bg-amber-50 p-2 text-xs text-amber-800" data-testid="ai-clarification">
                <HelpCircle className="h-4 w-4 shrink-0" /> {ai.clarification}
              </p>
            )}
            {ai.messages.map((m) => (
              <p key={m} className="flex gap-1.5 rounded-lg bg-slate-50 p-2 text-xs text-slate-700" data-testid="ai-message">
                <Info className="h-4 w-4 shrink-0" /> {m}
              </p>
            ))}
            {ai.aliasNotice && <p className="text-[11px] text-emerald-700" data-testid="ai-alias-notice">{ai.aliasNotice}</p>}
            <DraftPreviewPanel ai={ai} customers={customers} totals={totals} onConfirm={onConfirm} />
          </div>
        </aside>
      )}
    </>
  );
}

AICommandBar.propTypes = {
  ai: PropTypes.object.isRequired,
  shortcut: PropTypes.func.isRequired,
  shortcutLabel: PropTypes.string.isRequired,
  customers: PropTypes.array.isRequired,
  totals: PropTypes.array,
  onConfirm: PropTypes.func.isRequired,
};
