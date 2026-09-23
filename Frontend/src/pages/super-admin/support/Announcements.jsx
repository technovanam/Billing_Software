import React, { useState } from "react";
import { superAdminService } from "../../../services/superAdminDataService";
import { Megaphone, Plus, Bell, Mail, Smartphone, Globe, Check, X } from "lucide-react";

export default function Announcements() {
  const [announcements, setAnnouncements] = useState(() => superAdminService.getAnnouncements());
  const [modalOpen, setModalOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [type, setType] = useState("Feature Update");
  const [target, setTarget] = useState("All Businesses");

  const handleCreate = (e) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;

    superAdminService.addAnnouncement({
      title: title.trim(),
      content: content.trim(),
      type,
      target,
      channels: ["In-app", "Email"],
    });

    setAnnouncements(superAdminService.getAnnouncements());
    setModalOpen(false);
    setTitle("");
    setContent("");
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">Platform Announcements</h2>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Broadcast emergency alerts, feature notices, or maintenance windows to merchant dashboards.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 font-bold text-xs text-white shadow-sm flex items-center gap-2 transition"
        >
          <Plus className="w-4 h-4" />
          <span>New Broadcast</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {announcements.map((anc) => (
          <div key={anc.id} className="p-5 rounded-2xl bg-white border border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)] flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span
                  className={`px-2.5 py-0.5 rounded text-[10px] font-bold border ${
                    anc.type === "Maintenance"
                      ? "bg-amber-50 text-amber-700 border-amber-200"
                      : "bg-blue-50 text-blue-700 border-blue-200"
                  }`}
                >
                  {anc.type}
                </span>
                <span className="text-[11px] text-gray-400 font-mono">{anc.publishedAt}</span>
              </div>
              <h3 className="text-sm font-bold text-gray-900 mb-2">{anc.title}</h3>
              <p className="text-xs text-gray-600 leading-relaxed">{anc.content}</p>
            </div>

            <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-400">
              <span>Target: <strong className="text-gray-700">{anc.target}</strong></span>
              <span className="text-emerald-600 font-bold">● Active Broadcast</span>
            </div>
          </div>
        ))}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="w-full max-w-lg rounded-2xl bg-white border border-slate-200 p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-4">
              <h3 className="text-base font-bold text-gray-900">Create Broadcast Announcement</h3>
              <button onClick={() => setModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4 text-xs">
              <div>
                <label className="block text-gray-600 font-medium mb-1">Headline Title</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Mandatory GST 1.2 Update Rollout"
                  className="w-full p-2.5 rounded-xl bg-white border border-gray-200 text-gray-900 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-600 font-medium mb-1">Announcement Type</label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-white border border-gray-200 text-gray-900 focus:border-blue-500 focus:outline-none"
                  >
                    <option value="Feature Update">Feature Update</option>
                    <option value="Maintenance">Maintenance</option>
                    <option value="Critical Security">Critical Security</option>
                  </select>
                </div>
                <div>
                  <label className="block text-gray-600 font-medium mb-1">Target Audience</label>
                  <select
                    value={target}
                    onChange={(e) => setTarget(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-white border border-gray-200 text-gray-900 focus:border-blue-500 focus:outline-none"
                  >
                    <option value="All Businesses">All Businesses</option>
                    <option value="Trial Users Only">Trial Users Only</option>
                    <option value="Enterprise Tier Only">Enterprise Tier Only</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-gray-600 font-medium mb-1">Message Content</label>
                <textarea
                  rows={4}
                  required
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Detailed notification content displayed inside tenant dashboard header…"
                  className="w-full p-2.5 rounded-xl bg-white border border-gray-200 text-gray-900 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-gray-600 hover:text-gray-900 font-medium"
                >
                  Cancel
                </button>
                <button type="submit" className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 font-bold text-white shadow-sm">
                  Broadcast Now
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
