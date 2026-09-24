import React, { useState, useEffect } from "react";
import { useSystemSettings } from "../../../hooks/useSuperAdminFirestore";
import { Settings, Save, Lock, Shield, Mail, Smartphone, MessageSquare, CreditCard, CheckCircle, Loader2 } from "lucide-react";
import { doc, setDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase/config";

export default function SystemSettings() {
  const { settings: dbSettings, loading } = useSystemSettings();
  const [settings, setSettings] = useState({
    platformName: "TechnoVanam Platform",
    supportEmail: "support@technovanam.com",
    defaultCurrency: "INR",
    timezone: "Asia/Kolkata",
    smtp: { host: "smtp.aws.com", port: 587, senderEmail: "no-reply@technovanam.com" },
    paymentGateway: { keyId: "rzp_live_xxxxxxxxxxx" },
    sms: { provider: "Twilio", senderId: "TECHNO" },
    whatsapp: { wabaId: "1234567890123" }
  });
  
  const [activeSection, setActiveSection] = useState("general");
  const [saved, setSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (dbSettings) {
      setSettings(prev => ({
        ...prev,
        ...dbSettings
      }));
    }
  }, [dbSettings]);

  const handleSave = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await setDoc(doc(db, "system", "settings"), {
        ...settings,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      console.error(err);
      alert("Failed to save settings.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">System Settings</h2>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Global platform branding, communication relays, payment gateways, and tax compliance APIs.
          </p>
        </div>

        {saved && (
          <div className="px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold flex items-center gap-1.5 animate-fadeIn">
            <CheckCircle className="w-4 h-4" />
            <span>Settings Saved Successfully</span>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl border border-gray-200 shadow-sm">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-4" />
          <p className="text-sm text-gray-500 font-medium animate-pulse">Loading settings from Firebase...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Navigation Section Pills */}
          <div className="p-3 rounded-2xl bg-white border border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)] space-y-1 h-fit">
            {[
              { id: "general", label: "General & Branding", icon: Settings },
              { id: "email", label: "Email (SMTP)", icon: Mail },
              { id: "sms", label: "SMS Gateway", icon: Smartphone },
              { id: "whatsapp", label: "WhatsApp Cloud", icon: MessageSquare },
              { id: "payment", label: "Payment Gateway", icon: CreditCard },
              { id: "integrations", label: "Tax & Integrations", icon: Shield },
            ].map((sec) => {
              const Icon = sec.icon;
              const active = activeSection === sec.id;
              return (
                <button
                  key={sec.id}
                  onClick={() => setActiveSection(sec.id)}
                  className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-bold transition text-left ${
                    active
                      ? "bg-blue-600 text-white shadow-sm"
                      : "text-gray-600 hover:text-gray-900 hover:bg-slate-50"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{sec.label}</span>
                </button>
              );
            })}
          </div>

          {/* Setting Form Fields */}
          <div className="lg:col-span-3 p-6 rounded-2xl bg-white border border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
            <form onSubmit={handleSave} className="space-y-4 text-xs">
              {activeSection === "general" && (
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-gray-900 mb-2">General Platform Preferences</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-gray-600 font-medium mb-1">Platform Brand Name</label>
                      <input
                        type="text"
                        value={settings.platformName}
                        onChange={(e) => setSettings({ ...settings, platformName: e.target.value })}
                        className="w-full p-2.5 rounded-xl bg-white border border-gray-200 text-gray-900 focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-600 font-medium mb-1">Support Official Email</label>
                      <input
                        type="email"
                        value={settings.supportEmail}
                        onChange={(e) => setSettings({ ...settings, supportEmail: e.target.value })}
                        className="w-full p-2.5 rounded-xl bg-white border border-gray-200 text-gray-900 focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-600 font-medium mb-1">Default Base Currency</label>
                      <input
                        type="text"
                        value={settings.defaultCurrency}
                        onChange={(e) => setSettings({ ...settings, defaultCurrency: e.target.value })}
                        className="w-full p-2.5 rounded-xl bg-white border border-gray-200 text-gray-900 focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-600 font-medium mb-1">Platform Timezone</label>
                      <input
                        type="text"
                        value={settings.timezone}
                        onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}
                        className="w-full p-2.5 rounded-xl bg-white border border-gray-200 text-gray-900 focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {activeSection === "email" && (
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-gray-900 mb-2">SMTP Mail Server (Nodemailer)</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-gray-600 font-medium mb-1">SMTP Host</label>
                      <input
                        type="text"
                        value={settings.smtp.host}
                        onChange={(e) => setSettings({ ...settings, smtp: { ...settings.smtp, host: e.target.value } })}
                        className="w-full p-2.5 rounded-xl bg-white border border-gray-200 text-gray-900 focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-600 font-medium mb-1">SMTP Port</label>
                      <input
                        type="number"
                        value={settings.smtp.port}
                        onChange={(e) => setSettings({ ...settings, smtp: { ...settings.smtp, port: Number(e.target.value) } })}
                        className="w-full p-2.5 rounded-xl bg-white border border-gray-200 text-gray-900 focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-600 font-medium mb-1">Sender Email</label>
                      <input
                        type="text"
                        value={settings.smtp.senderEmail}
                        onChange={(e) => setSettings({ ...settings, smtp: { ...settings.smtp, senderEmail: e.target.value } })}
                        className="w-full p-2.5 rounded-xl bg-white border border-gray-200 text-gray-900 focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-600 font-medium mb-1">SMTP Secret Password</label>
                      <input
                        type="password"
                        defaultValue="••••••••••••••••"
                        disabled
                        className="w-full p-2.5 rounded-xl bg-gray-50 border border-gray-200 text-gray-400 cursor-not-allowed"
                      />
                      <span className="text-[10px] text-gray-400 mt-1 block">Configured via Backend/.env securely</span>
                    </div>
                  </div>
                </div>
              )}

              {activeSection === "payment" && (
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-gray-900 mb-2">Razorpay Gateway Integration</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-gray-600 font-medium mb-1">Key ID</label>
                      <input
                        type="text"
                        value={settings.paymentGateway.keyId}
                        onChange={(e) => setSettings({ ...settings, paymentGateway: { ...settings.paymentGateway, keyId: e.target.value } })}
                        className="w-full p-2.5 rounded-xl bg-white border border-gray-200 text-gray-900 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-600 font-medium mb-1">Key Secret</label>
                      <input
                        type="password"
                        defaultValue="••••••••••••••••"
                        disabled
                        className="w-full p-2.5 rounded-xl bg-gray-50 border border-gray-200 text-gray-400 cursor-not-allowed"
                      />
                    </div>
                  </div>
                </div>
              )}

              {activeSection === "sms" && (
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-gray-900 mb-2">SMS Gateway Configuration</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-gray-600 font-medium mb-1">Provider</label>
                      <input
                        type="text"
                        value={settings.sms.provider}
                        onChange={(e) => setSettings({ ...settings, sms: { ...settings.sms, provider: e.target.value } })}
                        className="w-full p-2.5 rounded-xl bg-white border border-gray-200 text-gray-900"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-600 font-medium mb-1">Sender DLT Header</label>
                      <input
                        type="text"
                        value={settings.sms.senderId}
                        onChange={(e) => setSettings({ ...settings, sms: { ...settings.sms, senderId: e.target.value } })}
                        className="w-full p-2.5 rounded-xl bg-white border border-gray-200 text-gray-900 font-mono uppercase"
                      />
                    </div>
                  </div>
                </div>
              )}

              {activeSection === "whatsapp" && (
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-gray-900 mb-2">Meta WhatsApp Cloud API</h3>
                  <div>
                    <label className="block text-gray-600 font-medium mb-1">WABA Account ID</label>
                    <input
                      type="text"
                      value={settings.whatsapp.wabaId}
                      onChange={(e) => setSettings({ ...settings, whatsapp: { ...settings.whatsapp, wabaId: e.target.value } })}
                      className="w-full p-2.5 rounded-xl bg-white border border-gray-200 text-gray-900 font-mono"
                    />
                  </div>
                </div>
              )}

              {activeSection === "integrations" && (
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-gray-900 mb-2">Government Tax & Compliance Connectors</h3>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                      <div>
                        <div className="text-xs font-bold text-gray-900">NIC GST Portal E-Invoice System</div>
                        <div className="text-[10px] text-gray-500">IRN generation and QR code embedding for B2B</div>
                      </div>
                      <span className="text-emerald-600 font-bold">✓ Connected</span>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                      <div>
                        <div className="text-xs font-bold text-gray-900">E-Way Bill Direct Generation</div>
                        <div className="text-[10px] text-gray-500">Consignment transport numbers for Delivery Challans</div>
                      </div>
                      <span className="text-emerald-600 font-bold">✓ Connected</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="pt-4 border-t border-gray-100 flex justify-end">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 font-bold text-white flex items-center gap-2 shadow-sm"
                >
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  <span>{isSaving ? "Saving..." : "Save Platform Settings"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
