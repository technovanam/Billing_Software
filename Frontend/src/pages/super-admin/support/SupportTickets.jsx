import React, { useState } from "react";
import { superAdminService } from "../../../services/superAdminDataService";
import { HelpCircle, Search, MessageSquare, Send, CheckCircle2, Clock, AlertTriangle, X } from "lucide-react";

export default function SupportTickets() {
  const [tickets, setTickets] = useState(() => superAdminService.getTickets());
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [replyText, setReplyText] = useState("");

  const handleSendReply = (e) => {
    e.preventDefault();
    if (!replyText.trim() || !selectedTicket) return;

    superAdminService.addTicketReply(selectedTicket.id, "admin", replyText.trim());
    const updatedTickets = superAdminService.getTickets();
    setTickets(updatedTickets);
    setSelectedTicket(updatedTickets.find((t) => t.id === selectedTicket.id));
    setReplyText("");
  };

  const handleStatusChange = (newStatus) => {
    if (!selectedTicket) return;
    superAdminService.updateTicket(selectedTicket.id, { status: newStatus });
    const updatedTickets = superAdminService.getTickets();
    setTickets(updatedTickets);
    setSelectedTicket(updatedTickets.find((t) => t.id === selectedTicket.id));
  };

  const filtered = tickets.filter((t) => {
    if (statusFilter !== "All" && t.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        t.id.toLowerCase().includes(q) ||
        t.subject.toLowerCase().includes(q) ||
        t.businessName.toLowerCase().includes(q) ||
        t.userName.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6 animate-fadeIn">
      <div>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">Support Tickets</h2>
        <p className="text-xs sm:text-sm text-gray-500 mt-1">
          Manage tenant customer service queries, POS hardware issues, and account requests.
        </p>
      </div>

      <div className="p-4 bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search ticket #, subject, or business…"
            className="w-full sm:w-80 bg-white border border-slate-300 rounded-xl pl-9 pr-4 py-2 text-sm text-slate-800 placeholder-slate-400 shadow-xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-700 shadow-sm focus:outline-none w-full sm:w-auto cursor-pointer"
        >
          <option value="All">All Ticket Statuses</option>
          <option value="Open">Open</option>
          <option value="In Progress">In Progress</option>
          <option value="Resolved">Resolved</option>
        </select>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-gray-700">
            <thead className="text-xs font-semibold text-gray-500 uppercase bg-gray-50">
              <tr>
                <th className="p-3.5 px-4">TICKET ID</th>
                <th className="p-3.5 px-4">BUSINESS & USER</th>
                <th className="p-3.5 px-4">SUBJECT</th>
                <th className="p-3.5 px-4">PRIORITY</th>
                <th className="p-3.5 px-4">STATUS</th>
                <th className="p-3.5 px-4">ASSIGNED STAFF</th>
                <th className="p-3.5 px-4">UPDATED</th>
                <th className="p-3.5 px-4 text-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((t) => (
                <tr key={t.id} className="text-sm transition-colors hover:bg-gray-50 group">
                  <td className="p-3.5 px-4 font-mono font-bold text-blue-600">{t.id}</td>
                  <td className="p-3.5 px-4">
                    <div className="font-bold text-gray-900">{t.businessName}</div>
                    <div className="text-[10px] text-gray-400">{t.userName}</div>
                  </td>
                  <td className="p-3.5 px-4 font-semibold text-gray-800 max-w-xs truncate">{t.subject}</td>
                  <td className="p-3.5 px-4">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                        t.priority === "High"
                          ? "bg-rose-50 text-rose-700 border-rose-200"
                          : t.priority === "Medium"
                          ? "bg-amber-50 text-amber-700 border-amber-200"
                          : "bg-slate-100 text-gray-600 border-slate-200"
                      }`}
                    >
                      {t.priority}
                    </span>
                  </td>
                  <td className="p-3.5 px-4">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                        t.status === "Open"
                          ? "bg-blue-50 text-blue-700 border-blue-200/60"
                          : t.status === "In Progress"
                          ? "bg-amber-50 text-amber-700 border-amber-200/60"
                          : "bg-emerald-50 text-emerald-700 border-emerald-200/60"
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${t.status === "Open" ? "bg-blue-500" : t.status === "In Progress" ? "bg-amber-500" : "bg-emerald-500"}`} />
                      {t.status}
                    </span>
                  </td>
                  <td className="p-3.5 px-4 text-gray-700">{t.assignedAdmin}</td>
                  <td className="p-3.5 px-4 text-gray-500">{t.updatedAt}</td>
                  <td className="p-3.5 px-4 text-right">
                    <button
                      type="button"
                      onClick={() => setSelectedTicket(t)}
                      className="px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold border border-blue-200 text-xs transition shadow-sm"
                    >
                      Open Thread
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Ticket Conversation Thread Modal */}
      {selectedTicket && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="w-full max-w-2xl rounded-2xl bg-white border border-slate-200 p-6 shadow-2xl flex flex-col max-h-[85vh]">
            <div className="flex items-start justify-between pb-3 border-b border-gray-100">
              <div>
                <span className="text-[10px] font-mono text-blue-600 font-bold uppercase">{selectedTicket.id}</span>
                <h3 className="text-base font-bold text-gray-900 mt-0.5">{selectedTicket.subject}</h3>
                <div className="text-xs text-gray-500 mt-0.5">
                  Tenant: {selectedTicket.businessName} • By: {selectedTicket.userName}
                </div>
              </div>
              <button onClick={() => setSelectedTicket(null)} className="text-gray-400 hover:text-gray-600 p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-2 py-3 border-b border-gray-100 text-xs">
              <span className="text-gray-500 font-medium">Status:</span>
              {["Open", "In Progress", "Resolved"].map((st) => (
                <button
                  key={st}
                  onClick={() => handleStatusChange(st)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                    selectedTicket.status === st
                      ? "bg-blue-600 text-white shadow-sm"
                      : "bg-gray-100 text-gray-600 hover:text-gray-900"
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>

            {/* Conversation Log */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 my-2 scrollbar-thin">
              {(selectedTicket.conversation || []).map((msg, i) => (
                <div
                  key={i}
                  className={`p-3 rounded-xl max-w-[85%] text-xs leading-relaxed ${
                    msg.sender === "admin"
                      ? "ml-auto bg-blue-600 text-white shadow-sm"
                      : "mr-auto bg-slate-50 border border-slate-100 text-gray-800"
                  }`}
                >
                  <div className="flex items-center justify-between gap-4 mb-1 text-[10px] opacity-75">
                    <strong>{msg.sender === "admin" ? "Staff Response" : selectedTicket.userName}</strong>
                    <span>{msg.time}</span>
                  </div>
                  <div>{msg.text}</div>
                </div>
              ))}
            </div>

            {/* Reply Input */}
            <form onSubmit={handleSendReply} className="flex gap-2 pt-3 border-t border-gray-100">
              <input
                type="text"
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Type response to business owner or cashier…"
                className="flex-1 p-2.5 rounded-xl bg-white border border-gray-200 text-xs text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-blue-500"
              />
              <button
                type="submit"
                className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1.5 transition shadow-sm"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Reply</span>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
