import React, { useState } from "react";
import { useTickets } from "../../../hooks/useSuperAdminFirestore";
import { HelpCircle, Search, MessageSquare, Send, CheckCircle2, Clock, AlertTriangle, X, Loader2 } from "lucide-react";
import { doc, updateDoc, arrayUnion } from "firebase/firestore";
import { db } from "../../../lib/firebase/config";

export default function SupportTickets() {
  const { tickets, loading } = useTickets();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [replyText, setReplyText] = useState("");

  const handleSendReply = async (e) => {
    e.preventDefault();
    if (!replyText.trim() || !selectedTicket) return;

    try {
      const ticketRef = doc(db, "supportTickets", selectedTicket.id);
      const newReply = {
        author: "admin",
        text: replyText.trim(),
        timestamp: new Date().toISOString()
      };
      
      await updateDoc(ticketRef, {
        replies: arrayUnion(newReply),
        updatedAt: new Date().toISOString()
      });
      
      setSelectedTicket({
        ...selectedTicket,
        replies: [...(selectedTicket.replies || []), newReply]
      });
      setReplyText("");
    } catch (err) {
      console.error(err);
      alert("Failed to send reply.");
    }
  };

  const handleAssignment = async (assignee) => {
    if (!selectedTicket) return;
    try {
      const ticketRef = doc(db, "supportTickets", selectedTicket.id);
      await updateDoc(ticketRef, { 
        assignedTo: assignee,
        updatedAt: new Date().toISOString() 
      });
      setSelectedTicket({ ...selectedTicket, assignedTo: assignee });
    } catch (err) {
      console.error(err);
      alert("Failed to assign ticket.");
    }
  };

  const handleStatusChange = async (newStatus) => {
    if (!selectedTicket) return;
    try {
      const ticketRef = doc(db, "supportTickets", selectedTicket.id);
      await updateDoc(ticketRef, { 
        status: newStatus,
        updatedAt: new Date().toISOString() 
      });
      setSelectedTicket({ ...selectedTicket, status: newStatus });
    } catch (err) {
      console.error(err);
      alert("Failed to update status.");
    }
  };

  const filtered = tickets.filter((t) => {
    const status = t.status || "Open";
    if (statusFilter !== "All" && status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        t.id.toLowerCase().includes(q) ||
        (t.subject || "").toLowerCase().includes(q) ||
        (t.businessName || "").toLowerCase().includes(q) ||
        (t.userName || "").toLowerCase().includes(q)
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
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-4" />
            <p className="text-sm text-gray-500 font-medium animate-pulse">Loading tickets from Firebase...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center px-4">
            <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center mb-4">
              <HelpCircle className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">No support tickets found</h3>
            <p className="text-sm text-gray-500">There are no support tickets matching your criteria.</p>
          </div>
        ) : (
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
                    <td className="p-3.5 px-4 font-mono font-bold text-blue-600">{t.id.substring(0, 8).toUpperCase()}</td>
                    <td className="p-3.5 px-4">
                      <div className="font-bold text-gray-900">{t.businessName || "Unknown"}</div>
                      <div className="text-[10px] text-gray-400">{t.userName || "N/A"}</div>
                    </td>
                    <td className="p-3.5 px-4 text-gray-800 font-medium">{t.subject || "No Subject"}</td>
                    <td className="p-3.5 px-4">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold ${
                          t.priority === "High" || t.priority === "Critical"
                            ? "bg-rose-50 text-rose-700 border border-rose-200"
                            : t.priority === "Medium"
                            ? "bg-amber-50 text-amber-700 border border-amber-200"
                            : "bg-blue-50 text-blue-700 border border-blue-200"
                        }`}
                      >
                        {t.priority === "High" || t.priority === "Critical" ? <AlertTriangle className="w-3 h-3" /> : null}
                        {t.priority || "Low"}
                      </span>
                    </td>
                    <td className="p-3.5 px-4">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                          t.status === "Open"
                            ? "bg-rose-50 text-rose-700 border-rose-200/60"
                            : t.status === "In Progress"
                            ? "bg-blue-50 text-blue-700 border-blue-200/60"
                            : "bg-emerald-50 text-emerald-700 border-emerald-200/60"
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            t.status === "Open" ? "bg-rose-500" : t.status === "In Progress" ? "bg-blue-500" : "bg-emerald-500"
                          }`}
                        />
                        {t.status || "Open"}
                      </span>
                    </td>
                    <td className="p-3.5 px-4 font-medium text-gray-700">{t.assignedTo || "Unassigned"}</td>
                    <td className="p-3.5 px-4 text-gray-500 font-mono text-[11px]">{t.updatedAt ? new Date(t.updatedAt).toLocaleDateString() : "Unknown"}</td>
                    <td className="p-3.5 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => setSelectedTicket(t)}
                        className="px-3 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-gray-700 font-semibold border border-slate-200 transition shadow-sm"
                      >
                        Review
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedTicket && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="w-full max-w-2xl rounded-2xl bg-white border border-slate-200 shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-blue-600" />
                  Ticket {selectedTicket.id.substring(0, 8).toUpperCase()}
                </h3>
                <p className="text-xs text-gray-500 mt-1">{selectedTicket.subject}</p>
              </div>
              <button onClick={() => setSelectedTicket(null)} className="text-gray-400 hover:text-gray-600 p-2">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto flex-1 space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                  <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Status</p>
                  <p className="text-xs font-bold text-gray-900">{selectedTicket.status || "Open"}</p>
                </div>
                <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                  <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Priority</p>
                  <p className="text-xs font-bold text-gray-900">{selectedTicket.priority || "Low"}</p>
                </div>
                <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                  <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Tenant</p>
                  <p className="text-xs font-bold text-blue-600">{selectedTicket.businessName || "Unknown"}</p>
                </div>
                <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                  <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">User</p>
                  <p className="text-xs font-bold text-gray-900">{selectedTicket.userName || "Unknown"}</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600 shrink-0">
                    {(selectedTicket.userName || "U").charAt(0)}
                  </div>
                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100 text-sm text-gray-800 rounded-tl-none w-full">
                    <p>{selectedTicket.description || selectedTicket.subject}</p>
                    <span className="text-[10px] font-mono text-gray-400 mt-2 block">{selectedTicket.createdAt ? new Date(selectedTicket.createdAt).toLocaleString() : "Unknown"}</span>
                  </div>
                </div>

                {(selectedTicket.replies || []).map((reply, idx) => (
                  <div key={idx} className={`flex gap-3 ${reply.author === "admin" ? "flex-row-reverse" : ""}`}>
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                        reply.author === "admin" ? "bg-blue-600 text-white" : "bg-slate-200 text-slate-600"
                      }`}
                    >
                      {reply.author === "admin" ? "A" : (selectedTicket.userName || "U").charAt(0)}
                    </div>
                    <div
                      className={`p-3.5 rounded-xl border text-sm w-full ${
                        reply.author === "admin"
                          ? "bg-blue-50 border-blue-100 text-blue-900 rounded-tr-none"
                          : "bg-slate-50 border-slate-100 text-gray-800 rounded-tl-none"
                      }`}
                    >
                      <p>{reply.text}</p>
                      <span className={`text-[10px] font-mono mt-2 block ${reply.author === "admin" ? "text-blue-400" : "text-gray-400"}`}>
                        {new Date(reply.timestamp).toLocaleString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-5 border-t border-gray-100 bg-gray-50 shrink-0">
              <form onSubmit={handleSendReply} className="flex flex-col gap-3">
                <textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Type your official support response here..."
                  className="w-full p-3 rounded-xl border border-gray-200 focus:border-blue-500 outline-none text-sm resize-none h-24"
                  required
                />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <select
                      value={selectedTicket.status || "Open"}
                      onChange={(e) => handleStatusChange(e.target.value)}
                      className="p-2 rounded-lg border border-gray-200 text-xs font-bold bg-white text-gray-700 outline-none cursor-pointer"
                    >
                      <option value="Open">Keep Open</option>
                      <option value="In Progress">Mark In Progress</option>
                      <option value="Resolved">Mark Resolved</option>
                    </select>
                    
                    <div className="flex items-center gap-2 border-l pl-2">
                        <span className="text-xs text-gray-500 font-medium">Assign:</span>
                        <input 
                            type="text" 
                            placeholder="Admin Email..." 
                            value={selectedTicket.assignedTo || ""}
                            onChange={(e) => setSelectedTicket({...selectedTicket, assignedTo: e.target.value})}
                            onBlur={(e) => handleAssignment(e.target.value)}
                            className="p-2 rounded-lg border border-gray-200 text-xs bg-white text-gray-700 outline-none w-32 focus:border-blue-500 focus:w-48 transition-all"
                        />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={!replyText.trim()}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl shadow-sm transition flex items-center gap-2"
                  >
                    <span>Send Reply</span>
                    <Send className="w-3 h-3" />
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
