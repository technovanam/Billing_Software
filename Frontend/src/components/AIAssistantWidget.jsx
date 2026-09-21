import React, { useState, useRef, useEffect, useContext } from "react";
import {
  Sparkles,
  Send,
  Bot,
  User,
  TrendingUp,
  AlertCircle,
  Package,
  DollarSign,
  PieChart,
  X,
  Minus,
  Maximize2,
  RefreshCw,
  Copy,
  Check,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  MessageSquare,
} from "lucide-react";
import { useAIAssistant } from "../context/AIAssistantContext";

const DEFAULT_QUESTIONS = [
  {
    id: 1,
    icon: TrendingUp,
    bgColor: "bg-blue-600",
    label: "Revenue & Profit",
    question: "What is my total revenue & net profit for this FY?",
  },
  {
    id: 2,
    icon: AlertCircle,
    bgColor: "bg-amber-600",
    label: "Unpaid Invoices",
    question: "List all unpaid and overdue invoices with customer names.",
  },
  {
    id: 3,
    icon: PieChart,
    bgColor: "bg-purple-600",
    label: "GST Tax Collected",
    question: "How much GST (CGST, SGST, IGST) have we collected so far?",
  },
  {
    id: 4,
    icon: DollarSign,
    bgColor: "bg-orange-600",
    label: "Expense Breakdown",
    question: "What are our total business expenses by category?",
  },
  {
    id: 5,
    icon: Package,
    bgColor: "bg-emerald-600",
    label: "Products & Customers",
    question: "Which are our top selling products and registered customers?",
  },
];

export default function AIAssistantWidget() {
  const {
    messages,
    isTyping,
    inputMessage,
    setInputMessage,
    copiedIndex,
    showQuickQuestions,
    setShowQuickQuestions,
    handleSendMessage,
    handleCopy,
    handleClearChat,
  } = useAIAssistant();

  const [isOpen, setIsOpen] = useState(false);
  const chatFeedRef = useRef(null);

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

  return (
    <div className="fixed bottom-6 right-6 z-50 font-mazzard">
      {/* Closed State: Floating Action Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="group relative flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-xl hover:bg-blue-700 transition-all duration-200 hover:scale-105 focus:outline-none"
          title="Open AI Assistant Chat"
          aria-label="Open AI Assistant Chat"
        >
          <Bot className="h-6 w-6" />
          <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-[9px] font-bold text-white border-2 border-white">
            ✓
          </span>
        </button>
      )}

      {/* Open State: Floating Chat Popup Window */}
      {isOpen && (
        <div className="flex flex-col bg-white rounded-2xl border border-slate-200 shadow-2xl transition-all duration-200 overflow-hidden w-96 max-w-[calc(100vw-2rem)] h-[540px]">
          {/* Header Bar */}
          <div className="flex items-center justify-between bg-slate-900 text-white px-4 py-3 select-none">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white">
                <Bot className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold leading-none">AI Assistant</h3>
                <span className="text-[10px] text-emerald-400 font-medium flex items-center gap-1 mt-0.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" /> Live Billing Sync
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={handleClearChat}
                className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors"
                title="Reset Chat"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors"
                title="Minimize"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors"
                title="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Chat Messages Feed */}
              <div ref={chatFeedRef} className="flex-1 p-3.5 space-y-4 overflow-y-auto text-xs bg-slate-50/50">
                {messages.map((msg, index) => (
                  <div
                    key={index}
                    className={`flex items-start gap-2.5 ${
                      msg.sender === "user" ? "flex-row-reverse" : ""
                    }`}
                  >
                    <div
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg font-bold text-[10px] ${
                        msg.sender === "user" ? "bg-blue-600 text-white" : "bg-slate-800 text-white"
                      }`}
                    >
                      {msg.sender === "user" ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                    </div>

                    <div
                      className={`group relative max-w-[85%] rounded-xl px-3 py-2.5 leading-relaxed ${
                        msg.sender === "user"
                          ? "bg-blue-600 text-white rounded-tr-none"
                          : "bg-white border border-slate-200 text-slate-800 rounded-tl-none shadow-xs"
                      }`}
                    >
                      {msg.sender === "ai" && (
                        <button
                          onClick={() => handleCopy(msg.text, index)}
                          className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 text-slate-400 hover:text-slate-600 rounded bg-slate-50 border border-slate-200"
                          title="Copy"
                        >
                          {copiedIndex === index ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
                        </button>
                      )}

                      <div className="whitespace-pre-wrap">
                        {msg.text.split("\n").map((line, lIdx) => {
                          if (line.startsWith("### ")) {
                            return <h3 key={lIdx} className="font-bold text-slate-900 mt-0.5 mb-1">{line.replace("### ", "")}</h3>;
                          }
                          if (line.startsWith("#### ")) {
                            return <h4 key={lIdx} className="font-semibold text-slate-800 mt-1 mb-0.5">{line.replace("#### ", "")}</h4>;
                          }
                          if (line.startsWith("• ")) {
                            return <div key={lIdx} className="ml-1 py-0.5">{line}</div>;
                          }
                          return <p key={lIdx} className="my-0.5">{line}</p>;
                        })}
                      </div>

                      {msg.stats && (
                        <div className="mt-2 grid grid-cols-2 gap-1.5 border-t border-slate-100 pt-2">
                          {msg.stats.map((st, sIdx) => (
                            <div key={sIdx} className="rounded bg-slate-50 p-1.5 text-center border border-slate-100">
                              <p className="text-[9px] uppercase text-slate-400 font-semibold">{st.label}</p>
                              <p className={`text-xs font-bold ${st.color}`}>{st.value}</p>
                            </div>
                          ))}
                        </div>
                      )}

                      <span className={`block text-[9px] mt-1 ${msg.sender === "user" ? "text-blue-100 text-right" : "text-slate-400"}`}>
                        {msg.timestamp}
                      </span>
                    </div>
                  </div>
                ))}

                {isTyping && (
                  <div className="flex items-start gap-2.5">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-white">
                      <Bot className="h-4 w-4" />
                    </div>
                    <div className="rounded-xl rounded-tl-none bg-white border border-slate-200 px-3 py-2 text-slate-500 text-xs flex items-center gap-1">
                      <span>Analyzing</span>
                      <span className="inline-flex gap-1">
                        <span className="h-1 w-1 rounded-full bg-blue-600 animate-bounce" />
                        <span className="h-1 w-1 rounded-full bg-blue-600 animate-bounce [animation-delay:0.2s]" />
                        <span className="h-1 w-1 rounded-full bg-blue-600 animate-bounce [animation-delay:0.4s]" />
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Quick Select Questions Strip */}
              <div className="border-t border-slate-200 bg-white p-2.5">
                {showQuickQuestions ? (
                  <>
                    <div className="flex items-center justify-between mb-2 px-0.5">
                      <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                        <Sparkles className="h-3 w-3 text-blue-600" /> Quick Actions
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowQuickQuestions(false)}
                        className="p-1 text-slate-400 hover:text-slate-600 rounded hover:bg-slate-100 transition-colors cursor-pointer flex items-center justify-center"
                        title="Close Quick Actions"
                        aria-label="Close Quick Actions"
                      >
                        <ChevronDown className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="flex flex-col gap-1 mb-2">
                      {DEFAULT_QUESTIONS.map((q) => {
                        const Icon = q.icon;
                        return (
                          <button
                            key={q.id}
                            onClick={() => handleSendMessage(q.question)}
                            className="w-full text-left text-[11px] bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200 rounded-lg px-2.5 py-1.5 transition-colors font-medium cursor-pointer flex items-center justify-between group"
                          >
                            <span className="flex items-center gap-2 text-left">
                              {Icon && <Icon className="h-3.5 w-3.5 text-slate-500 group-hover:text-blue-600 shrink-0" />}
                              <span className="line-clamp-2">{q.question}</span>
                            </span>
                            <ChevronRight className="h-3 w-3 text-slate-400 group-hover:text-blue-600 shrink-0" />
                          </button>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <div className="flex items-center justify-between mb-1 px-0.5">
                    <button
                      type="button"
                      onClick={() => setShowQuickQuestions(true)}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-700 cursor-pointer"
                      title="Show Quick Actions"
                    >
                      <Sparkles className="h-3 w-3" /> Quick Actions
                      <ChevronUp className="h-3.5 w-3.5 ml-0.5" />
                    </button>
                  </div>
                )}

                {/* Input Form */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSendMessage();
                  }}
                  className="flex items-center gap-2 mt-1.5"
                >
                  <input
                    type="text"
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    placeholder="Ask AI a question..."
                    className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 placeholder-slate-400 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                  <button
                    type="submit"
                    disabled={!inputMessage.trim() || isTyping}
                    className="inline-flex items-center justify-center rounded-lg bg-blue-600 p-2 text-white hover:bg-blue-700 disabled:opacity-50"
                    title="Send"
                  >
                    <Send className="h-3.5 w-3.5" />
                  </button>
                </form>
              </div>
        </div>
      )}
    </div>
  );
}
