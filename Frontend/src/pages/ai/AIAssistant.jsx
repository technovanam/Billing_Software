import React, { useState, useRef, useEffect, useContext } from "react";
import {
  Sparkles,
  Send,
  Bot,
  User,
  TrendingUp,
  FileText,
  DollarSign,
  AlertCircle,
  Package,
  Users,
  RefreshCw,
  Copy,
  Check,
  Zap,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  PieChart,
  Mic,
  MicOff,
  ShieldCheck,
  Calendar,
} from "lucide-react";
import { useAIAssistant } from "../../context/AIAssistantContext";

const DEFAULT_QUESTIONS = [
  {
    id: 1,
    icon: Calendar,
    bgColor: "bg-emerald-600",
    label: "Today's Sales",
    question: "What was today's sales and revenue?",
  },
  {
    id: 2,
    icon: TrendingUp,
    bgColor: "bg-blue-600",
    label: "Top Product",
    question: "Which product sold the most?",
  },
  {
    id: 3,
    icon: AlertCircle,
    bgColor: "bg-rose-600",
    label: "Who Owes Money?",
    question: "Who owes me money and which invoices are overdue?",
  },
  {
    id: 4,
    icon: PieChart,
    bgColor: "bg-purple-600",
    label: "GST Tax",
    question: "How much GST (CGST, SGST, IGST) did I collect?",
  },
  {
    id: 5,
    icon: DollarSign,
    bgColor: "bg-amber-600",
    label: "Monthly Profit",
    question: "Show last month vs this month profit and expenses.",
  },
  {
    id: 6,
    icon: Package,
    bgColor: "bg-indigo-600",
    label: "Stock Prediction",
    question: "Which products are low in stock and need reordering?",
  },
  {
    id: 7,
    icon: Users,
    bgColor: "bg-teal-600",
    label: "Customer Insights",
    question: "Show top customer insights and VIP clients.",
  },
  {
    id: 8,
    icon: ShieldCheck,
    bgColor: "bg-cyan-600",
    label: "Validate GSTIN",
    question: "Validate GSTIN 33ABCDE1234F1Z5",
  },
];

export default function AIAssistant() {
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
  } = useAIAssistant();

  const chatFeedRef = useRef(null);

  const scrollToBottom = () => {
    if (chatFeedRef.current) {
      chatFeedRef.current.scrollTop = chatFeedRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  return (
    <div className="min-h-[calc(100vh-3rem)] flex flex-col text-slate-800 font-mazzard">
      <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 pb-8 pt-6 flex-1 flex flex-col w-full">
        {/* Header Banner */}
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 shrink-0">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">AI Assistant</h1>
            <p className="mt-1 text-sm text-gray-600">
              Ask questions about billing, invoice totals, unpaid balances, GST tax breakdowns, and business analytics.
            </p>
          </div>
          <button
            onClick={handleClearChat}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 shadow-xs cursor-pointer"
            title="Reset conversation"
          >
            <RefreshCw className="h-4 w-4" />
            Reset Chat
          </button>
        </header>

        {/* Main Chat Container */}
        <div className="flex-1 min-h-0 rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden flex flex-col">
          {/* Chat Feed */}
          <div ref={chatFeedRef} className="flex-1 min-h-0 p-4 sm:p-6 space-y-6 overflow-y-auto">
            {messages.map((msg, index) => (
              <div
                key={index}
                className={`flex items-start gap-3 sm:gap-4 ${
                  msg.sender === "user" ? "flex-row-reverse" : ""
                }`}
              >
                {/* Avatar */}
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl font-bold text-xs shadow-xs ${
                    msg.sender === "user"
                      ? "bg-blue-600 text-white"
                      : "bg-slate-800 text-white"
                  }`}
                >
                  {msg.sender === "user" ? <User className="h-5 w-5" /> : <Bot className="h-5 w-5" />}
                </div>

                {/* Message Bubble */}
                <div
                  className={`group relative max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-3.5 text-sm ${
                    msg.sender === "user"
                      ? "bg-blue-600 text-white rounded-tr-xs"
                      : "bg-slate-50 border border-slate-200 text-slate-800 rounded-tl-xs"
                  }`}
                >
                  {/* Copy Button */}
                  {msg.sender === "ai" && (
                    <button
                      onClick={() => handleCopy(msg.text, index)}
                      className="absolute right-3 top-3 opacity-0 group-hover:opacity-100 transition-opacity p-1 text-slate-400 hover:text-slate-600 rounded bg-white border border-slate-200 shadow-xs"
                      title="Copy response"
                    >
                      {copiedIndex === index ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                  )}

                  {/* Text Content */}
                  <div className="whitespace-pre-wrap leading-relaxed">
                    {msg.text.split("\n").map((line, lIdx) => {
                      if (line.startsWith("### ")) {
                        return <h3 key={lIdx} className="text-base font-bold text-slate-900 mt-1 mb-2">{line.replace("### ", "")}</h3>;
                      }
                      if (line.startsWith("#### ")) {
                        return <h4 key={lIdx} className="text-sm font-semibold text-slate-800 mt-2 mb-1">{line.replace("#### ", "")}</h4>;
                      }
                      if (line.startsWith("• ")) {
                        return <div key={lIdx} className="ml-2 py-0.5">{line}</div>;
                      }
                      return <p key={lIdx} className="my-1">{line}</p>;
                    })}
                  </div>

                  {/* Optional Stats Cards */}
                  {msg.stats && (
                    <div className="mt-3 grid grid-cols-2 gap-2 border-t border-slate-200 pt-3">
                      {msg.stats.map((st, sIdx) => (
                        <div key={sIdx} className="rounded-lg bg-white p-2.5 border border-slate-200 text-center">
                          <p className="text-[10px] uppercase font-semibold text-slate-400">{st.label}</p>
                          <p className={`text-sm font-bold mt-0.5 ${st.color}`}>{st.value}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Timestamp */}
                  <span
                    className={`block text-[10px] mt-2 ${
                      msg.sender === "user" ? "text-blue-100 text-right" : "text-slate-400"
                    }`}
                  >
                    {msg.timestamp}
                  </span>
                </div>
              </div>
            ))}

            {/* Typing Indicator */}
            {isTyping && (
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-800 text-white shadow-xs">
                  <Bot className="h-5 w-5" />
                </div>
                <div className="rounded-2xl rounded-tl-xs bg-slate-50 border border-slate-200 px-4 py-3 text-slate-500 text-sm flex items-center gap-1.5">
                  <span className="font-medium text-xs">AI is analyzing billing data</span>
                  <span className="inline-flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-blue-600 animate-bounce" />
                    <span className="h-1.5 w-1.5 rounded-full bg-blue-600 animate-bounce [animation-delay:0.2s]" />
                    <span className="h-1.5 w-1.5 rounded-full bg-blue-600 animate-bounce [animation-delay:0.4s]" />
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Input Bar */}
          <div className="border-t border-slate-200 bg-slate-50 p-4 shrink-0">
            {/* Quick Questions Strip */}
            {showQuickQuestions ? (
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="flex-1 flex items-center gap-2 overflow-x-auto whitespace-nowrap pb-1 scrollbar-none min-w-0">
                  {DEFAULT_QUESTIONS.map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleSendMessage(item.question)}
                        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-xs transition-all hover:border-blue-500 hover:bg-blue-50 hover:text-blue-700 cursor-pointer group"
                      >
                        {Icon && <Icon className="h-3.5 w-3.5 text-slate-500 group-hover:text-blue-600 shrink-0" />}
                        <span className="whitespace-nowrap">{item.question}</span>
                      </button>
                    );
                  })}
                </div>
                <button
                  type="button"
                  onClick={() => setShowQuickQuestions(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded hover:bg-slate-200/60 transition-colors cursor-pointer shrink-0 flex items-center justify-center"
                  title="Close Quick Actions"
                  aria-label="Close Quick Actions"
                >
                  <ChevronDown className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between mb-2">
                <button
                  type="button"
                  onClick={() => setShowQuickQuestions(true)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 cursor-pointer"
                  title="Show Quick Actions"
                >
                  <Sparkles className="h-3.5 w-3.5" /> Quick Actions
                  <ChevronUp className="h-4 w-4" />
                </button>
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex items-center gap-2.5"
            >
              <div className="relative flex-1">
                <input
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  placeholder={isListening ? "Listening... Speak your question..." : "Ask AI: today sales, who owes money, top product, GST, validate GSTIN..."}
                  className={`w-full rounded-xl border px-4 py-3 pr-10 text-sm text-slate-800 placeholder-slate-400 outline-none transition-all shadow-xs ${
                    isListening
                      ? "border-red-400 bg-red-50/30 ring-2 ring-red-200 animate-pulse"
                      : "border-slate-200 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  }`}
                />
                <Bot className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              </div>

              {/* Voice Input Button */}
              <button
                type="button"
                onClick={toggleVoiceRecognition}
                className={`inline-flex items-center justify-center h-11 w-11 rounded-xl transition-all cursor-pointer shadow-xs ${
                  isListening
                    ? "bg-red-600 text-white animate-pulse hover:bg-red-700 ring-2 ring-red-300"
                    : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 hover:text-blue-600"
                }`}
                title={isListening ? "Stop listening" : "Speak question (Voice AI)"}
                aria-label={isListening ? "Stop listening" : "Speak question"}
              >
                {isListening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
              </button>

              <button
                type="submit"
                disabled={!inputMessage.trim() || isTyping}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                <span>Send</span>
                <Send className="h-4 w-4" />
              </button>
            </form>
            <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400 px-1">
              <span className="flex items-center gap-1">
                <Zap className="h-3 w-3 text-blue-600" /> Powered by Live Billing Data
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
