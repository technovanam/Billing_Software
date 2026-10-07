import React, { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import PropTypes from "prop-types";
import {
  Sparkles,
  Send,
  Bot,
  TrendingUp,
  AlertCircle,
  Package,
  DollarSign,
  PieChart,
  X,
  Minus,
  RefreshCw,
  Copy,
  Check,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Mic,
  MicOff,
  ShieldCheck,
  Calendar,
  Users,
  FileText,
  Wallet,
  HelpCircle,
  Loader2,
} from "lucide-react";
import { useAIAssistant } from "../context/AIAssistantContext";
import DraftPreviewPanel from "./ai-command/DraftPreviewPanel";

// `fill` puts the text in the input box to finish typing instead of sending it.
const DEFAULT_QUESTIONS = [
  { id: 1, icon: Calendar, label: "Today's sales", question: "What were today's sales?" },
  { id: 2, icon: AlertCircle, label: "Who owes me", question: "Who owes me money?" },
  { id: 3, icon: DollarSign, label: "Profit", question: "Profit this month" },
  { id: 4, icon: TrendingUp, label: "Top products", question: "Top selling products this month" },
  { id: 5, icon: Package, label: "Stock levels", question: "Show stock levels" },
  { id: 6, icon: PieChart, label: "GST", question: "GST this month" },
  { id: 7, icon: Users, label: "Best customers", question: "Best customers this year" },
  { id: 8, icon: FileText, label: "Create a bill", question: "create invoice for ", fill: true },
  { id: 9, icon: Wallet, label: "Record a payment", question: " paid 5000 by UPI", fill: true, cursorStart: true },
  { id: 10, icon: ShieldCheck, label: "Check GSTIN", question: "check GSTIN ", fill: true },
  { id: 11, icon: HelpCircle, label: "Everything I can do", question: "help" },
];

// **bold**, *italic* and `code` inside one line of a reply.
function renderInline(text) {
  const parts = String(text).split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*\s][^*]*\*)/g);
  return parts.map((part, i) => {
    if (/^\*\*[^*]+\*\*$/.test(part)) return <strong key={i} className="font-semibold text-slate-900">{part.slice(2, -2)}</strong>;
    if (/^`[^`]+`$/.test(part)) return <code key={i} className="rounded bg-slate-100 px-1 font-mono text-[10px]">{part.slice(1, -1)}</code>;
    if (/^\*[^*\s][^*]*\*$/.test(part)) return <em key={i}>{part.slice(1, -1)}</em>;
    return part;
  });
}

// `embedded` renders the same chat as a full page (/ai-assistant) instead of
// the floating popup; the popup hides itself on that page.
export default function AIAssistantWidget({ embedded = false }) {
  const {
    messages,
    isTyping,
    inputMessage,
    setInputMessage,
    copiedIndex,
    showQuickQuestions,
    setShowQuickQuestions,
    isListening,
    toggleVoiceRecognition,
    handleSendMessage,
    handleCopy,
    handleClearChat,
    billAI,
    draftTotalRows,
    draftCustomerBlockers,
    creatingInvoice,
    createInvoiceFromDraft,
    addCustomerFromDraft,
    cancelDraft,
    billMode,
    allCustomers,
    confirmAction,
    cancelAction,
    busyActionId,
  } = useAIAssistant();

  const navigate = useNavigate();
  const location = useLocation();
  const [popupOpen, setIsOpen] = useState(false);
  const isOpen = embedded || popupOpen;
  const chatFeedRef = useRef(null);
  const inputRef = useRef(null);
  const navigatedRef = useRef(new Set());

  // "open reports" moves to the page as soon as the reply arrives.
  useEffect(() => {
    const last = messages[messages.length - 1];
    if (last?.navigateTo && !navigatedRef.current.has(last.id)) {
      navigatedRef.current.add(last.id);
      navigate(last.navigateTo);
    }
  }, [messages, navigate]);

  const pickQuickQuestion = (q) => {
    if (!q.fill) {
      handleSendMessage(q.question);
      return;
    }
    setInputMessage(q.question);
    setShowQuickQuestions(false);
    setTimeout(() => {
      const el = inputRef.current;
      if (!el) return;
      el.focus();
      const pos = q.cursorStart ? 0 : q.question.length;
      el.setSelectionRange(pos, pos);
    }, 0);
  };

  const scrollToBottom = () => {
    if (chatFeedRef.current) {
      chatFeedRef.current.scrollTop = chatFeedRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isTyping, isOpen]);

  if (!embedded && location.pathname === "/ai-assistant") return null;

  const iconBtn = "flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors";

  return (
    <div className={embedded ? "font-mazzard h-[calc(100vh-3rem)]" : "fixed bottom-6 right-6 z-50 font-mazzard"}>
      {/* Closed: floating button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="group relative flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/30 hover:bg-blue-700 hover:-translate-y-0.5 transition-all duration-200 focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-200"
          title="Open Business Assistant"
          aria-label="Open Business Assistant"
        >
          <Sparkles className="h-6 w-6" />
          <span className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full bg-emerald-500 border-2 border-white" />
          <span className="pointer-events-none absolute right-full mr-3 whitespace-nowrap rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-white opacity-0 group-hover:opacity-100 transition-opacity">
            Ask your business
          </span>
        </button>
      )}

      {/* Open: chat panel */}
      {isOpen && (
        <div
          className={`flex flex-col bg-white overflow-hidden ${
            embedded
              ? "w-full h-full rounded-2xl border border-slate-200"
              : "rounded-2xl border border-slate-200 shadow-2xl w-[27rem] max-w-[calc(100vw-2rem)] h-[620px] max-h-[calc(100vh-3rem)]"
          }`}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-white select-none">
            <div className="flex items-center gap-3">
              <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
                <Sparkles className="h-5 w-5" />
                <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-500 border-2 border-white" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 leading-tight">Business Assistant</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">Answers from your live billing data</p>
              </div>
            </div>
            <div className="flex items-center gap-0.5">
              <button onClick={handleClearChat} className={iconBtn} title="Reset chat" aria-label="Reset chat">
                <RefreshCw className="h-4 w-4" />
              </button>
              <button hidden={embedded} onClick={() => setIsOpen(false)} className={iconBtn} title="Minimize" aria-label="Minimize">
                <Minus className="h-4 w-4" />
              </button>
              <button hidden={embedded} onClick={() => setIsOpen(false)} className={iconBtn} title="Close" aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div ref={chatFeedRef} data-lenis-prevent className="flex-1 px-4 py-4 space-y-4 overflow-y-auto overscroll-contain text-[13px] bg-slate-50">
            {messages.map((msg, index) => {
              const isUser = msg.sender === "user";
              const wide = msg.type === "invoiceDraft" || msg.type === "action";
              return (
                <div key={msg.id ?? index} className={`flex items-end gap-2 ${isUser ? "justify-end" : ""}`}>
                  {!isUser && (
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white border border-slate-200 text-blue-600 shadow-xs">
                      <Bot className="h-4 w-4" />
                    </div>
                  )}

                  <div className={`group relative ${wide ? "w-full" : "max-w-[82%]"}`}>
                    <div
                      className={`rounded-2xl px-3.5 py-2.5 leading-relaxed ${
                        isUser ? "bg-blue-600 text-white rounded-br-md" : "bg-white border border-slate-200 text-slate-700 rounded-bl-md shadow-xs"
                      }`}
                    >
                      {!isUser && (
                        <button
                          onClick={() => handleCopy(msg.text, index)}
                          className="absolute -right-1 -top-1 opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 flex items-center justify-center text-slate-400 hover:text-slate-700 rounded-md bg-white border border-slate-200 shadow-xs"
                          title="Copy"
                          aria-label="Copy reply"
                        >
                          {copiedIndex === index ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
                        </button>
                      )}

                      <div className="whitespace-pre-wrap break-words">
                        {msg.text.split("\n").map((line, lIdx) => {
                          if (line.startsWith("### ")) {
                            return (
                              <h3 key={lIdx} className={`font-bold mt-0.5 mb-1 ${isUser ? "" : "text-slate-900"}`}>
                                {renderInline(line.slice(4))}
                              </h3>
                            );
                          }
                          if (line.startsWith("#### ")) {
                            return (
                              <h4 key={lIdx} className={`font-semibold mt-1 mb-0.5 ${isUser ? "" : "text-slate-800"}`}>
                                {renderInline(line.slice(5))}
                              </h4>
                            );
                          }
                          if (line.startsWith("• ")) {
                            return (
                              <div key={lIdx} className="ml-1 py-0.5">
                                {renderInline(line)}
                              </div>
                            );
                          }
                          if (!line.trim()) return <div key={lIdx} className="h-1" />;
                          return (
                            <p key={lIdx} className="my-0.5">
                              {renderInline(line)}
                            </p>
                          );
                        })}
                      </div>

                      {msg.stats && (
                        <div className="mt-3 grid grid-cols-2 gap-2">
                          {msg.stats.map((st, sIdx) => (
                            <div key={sIdx} className="rounded-xl bg-slate-50 border border-slate-100 px-2.5 py-2">
                              <p className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold">{st.label}</p>
                              <p className={`text-sm font-bold mt-0.5 ${st.color}`}>{st.value}</p>
                            </div>
                          ))}
                        </div>
                      )}

                      {msg.type === "invoiceDraft" && (
                        <div className="mt-3 border-t border-slate-100 pt-3">
                          <DraftPreviewPanel
                            ai={{ ...billAI, discard: cancelDraft }}
                            customers={allCustomers}
                            totals={draftTotalRows}
                            onConfirm={createInvoiceFromDraft}
                            confirmLabel={billMode === "challan" ? "Create challan" : "Create invoice"}
                            onAddCustomer={addCustomerFromDraft}
                            extraBlockers={draftCustomerBlockers}
                            busy={creatingInvoice}
                          />
                        </div>
                      )}

                      {msg.type === "action" && msg.status === "pending" && (
                        <div className="mt-3 flex gap-2 border-t border-slate-100 pt-3">
                          <button
                            type="button"
                            onClick={() => cancelAction(msg.id)}
                            disabled={busyActionId === msg.id}
                            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => confirmAction(msg.id)}
                            disabled={busyActionId === msg.id}
                            className="flex-1 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-1.5"
                          >
                            {busyActionId === msg.id && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                            Confirm & save
                          </button>
                        </div>
                      )}

                      {msg.buttons?.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {msg.buttons.map((b) => (
                            <button
                              key={b.label}
                              type="button"
                              onClick={() => navigate(b.to)}
                              className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700 hover:bg-blue-100"
                            >
                              {b.label} <ChevronRight className="h-3 w-3" />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <span className={`block text-[10px] mt-1 px-1 text-slate-400 ${isUser ? "text-right" : ""}`}>{msg.timestamp}</span>
                  </div>
                </div>
              );
            })}

            {isTyping && (
              <div className="flex items-end gap-2">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white border border-slate-200 text-blue-600 shadow-xs">
                  <Bot className="h-4 w-4" />
                </div>
                <div className="rounded-2xl rounded-bl-md bg-white border border-slate-200 px-4 py-3 shadow-xs flex items-center gap-1" aria-label="Assistant is typing">
                  <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce" />
                  <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:0.15s]" />
                  <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:0.3s]" />
                </div>
              </div>
            )}
          </div>

          {/* Quick actions + input */}
          <div className="border-t border-slate-200 bg-white px-3 pt-2.5 pb-3">
            <div className="flex items-center justify-between mb-2 px-0.5">
              <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1.5">
                <Sparkles className="h-3 w-3 text-blue-600" /> Quick actions
              </span>
              <button
                type="button"
                onClick={() => setShowQuickQuestions(!showQuickQuestions)}
                className="h-6 w-6 flex items-center justify-center text-slate-400 hover:text-slate-700 rounded-md hover:bg-slate-100 transition-colors"
                title={showQuickQuestions ? "Hide quick actions" : "Show quick actions"}
                aria-label={showQuickQuestions ? "Hide quick actions" : "Show quick actions"}
              >
                {showQuickQuestions ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
              </button>
            </div>

            {showQuickQuestions && (
              <div className="flex flex-wrap gap-1.5 mb-2.5 max-h-[4.5rem] overflow-y-auto scrollbar-hide" data-lenis-prevent>
                {DEFAULT_QUESTIONS.map((q) => {
                  const Icon = q.icon;
                  return (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() => pickQuickQuestion(q)}
                      disabled={isTyping}
                      className="group inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-slate-700 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 transition-colors disabled:opacity-50"
                      title={q.fill ? "Fills the box for you to finish" : q.question}
                    >
                      {Icon && <Icon className="h-3.5 w-3.5 text-slate-400 group-hover:text-blue-600 shrink-0" />}
                      {q.label}
                    </button>
                  );
                })}
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className={`flex items-center gap-1 rounded-xl border bg-white pl-3 pr-1.5 py-1.5 transition-all ${
                isListening ? "border-red-300 ring-4 ring-red-100" : "border-slate-200 focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-100"
              }`}
            >
              <input
                ref={inputRef}
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder={isListening ? "Listening… speak now" : "Ask anything or give a command…"}
                className="flex-1 min-w-0 bg-transparent py-1.5 text-[13px] text-slate-800 placeholder-slate-400 outline-none"
              />
              <button
                type="button"
                onClick={toggleVoiceRecognition}
                className={`h-8 w-8 flex items-center justify-center rounded-lg transition-colors ${
                  isListening ? "bg-red-600 text-white animate-pulse" : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                }`}
                title={isListening ? "Stop listening" : "Speak"}
                aria-label={isListening ? "Stop listening" : "Speak"}
              >
                {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </button>
              <button
                type="submit"
                disabled={!inputMessage.trim() || isTyping}
                className="h-8 w-8 flex items-center justify-center rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 transition-colors"
                title="Send"
                aria-label="Send"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
            <p className="text-[10px] text-slate-400 text-center mt-2">Try &ldquo;sales today&rdquo;, &ldquo;Ravi paid 5000 by UPI&rdquo; or &ldquo;create invoice for…&rdquo;</p>
          </div>
        </div>
      )}
    </div>
  );
}

AIAssistantWidget.propTypes = { embedded: PropTypes.bool };
