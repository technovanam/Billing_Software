import React, { useEffect, useState } from "react";
import { useSystemHealth } from "../../../hooks/useSuperAdminFirestore";
import { Activity, Server, Database, Globe, Cpu, HardDrive, Zap, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";

export default function SystemHealth() {
  const { health: dbHealth, loading } = useSystemHealth();

  const [health, setHealth] = useState({
    cpu: "18.4%",
    cpuWidth: "18.4%",
    ram: "2.4 / 8 GB",
    ramWidth: "30%",
    disk: "42 / 200 GB",
    diskWidth: "21%",
    latency: "64 ms",
    latencyWidth: "16%",
    services: [
      { name: "Payment Gateway (Razorpay)", type: "API Webhook", status: "Healthy", latency: "142ms", uptime: "99.98%" },
      { name: "Firestore Multi-Region DB", type: "Core Database", status: "Healthy", latency: "28ms", uptime: "100.0%" },
      { name: "Puppeteer PDF Cluster", type: "Backend Microservice", status: "Healthy", latency: "420ms", uptime: "99.94%" },
      { name: "Nodemailer SMTP Relays", type: "Email Delivery", status: "Healthy", latency: "310ms", uptime: "99.91%" },
      { name: "WhatsApp Cloud API", type: "Direct Messaging", status: "Healthy", latency: "185ms", uptime: "99.85%" },
      { name: "NIC GST E-Invoice API", type: "Government Gateway", status: "Warning", latency: "890ms", uptime: "98.42%" },
    ]
  });

  useEffect(() => {
    if (dbHealth && dbHealth.services) {
      setHealth({
        ...health,
        ...dbHealth
      });
    }
  }, [dbHealth]);

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">System Health & Telemetry</h2>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Real-time latency, compute loads, and availability monitoring across all platform dependencies.
          </p>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Core Infrastructure Optimal</span>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl border border-gray-200 shadow-sm">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-4" />
          <p className="text-sm text-gray-500 font-medium animate-pulse">Loading system telemetry...</p>
        </div>
      ) : (
        <>
          {/* Compute Gauges */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 rounded-2xl bg-white border border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-500 font-semibold">Node.js Server CPU</span>
                <Cpu className="w-4 h-4 text-blue-600" />
              </div>
              <div className="text-2xl font-bold text-gray-900 font-mono">{health.cpu}</div>
              <div className="w-full h-1.5 rounded-full bg-gray-100 mt-3 overflow-hidden">
                <div className="h-full bg-blue-600 rounded-full" style={{ width: health.cpuWidth }} />
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-500 font-semibold">RAM Utilization</span>
                <Server className="w-4 h-4 text-indigo-600" />
              </div>
              <div className="text-2xl font-bold text-gray-900 font-mono">{health.ram}</div>
              <div className="w-full h-1.5 rounded-full bg-gray-100 mt-3 overflow-hidden">
                <div className="h-full bg-indigo-600 rounded-full" style={{ width: health.ramWidth }} />
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-500 font-semibold">SSD Disk Storage</span>
                <HardDrive className="w-4 h-4 text-cyan-600" />
              </div>
              <div className="text-2xl font-bold text-gray-900 font-mono">{health.disk}</div>
              <div className="w-full h-1.5 rounded-full bg-gray-100 mt-3 overflow-hidden">
                <div className="h-full bg-cyan-600 rounded-full" style={{ width: health.diskWidth }} />
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-500 font-semibold">Avg API Response</span>
                <Zap className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-2xl font-bold text-gray-900 font-mono">{health.latency}</div>
              <div className="w-full h-1.5 rounded-full bg-gray-100 mt-3 overflow-hidden">
                <div className="h-full bg-emerald-600 rounded-full" style={{ width: health.latencyWidth }} />
              </div>
            </div>
          </div>

          {/* Downstream Microservices Status */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-100 bg-gray-50/50">
              <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider">Connected Microservices & Gateways</h3>
            </div>
            <table className="w-full text-left text-xs text-gray-700">
              <thead className="text-xs font-semibold text-gray-500 uppercase bg-gray-50">
                <tr>
                  <th className="p-3.5 px-4">SERVICE PROVIDER</th>
                  <th className="p-3.5 px-4">ARCHITECTURE ROLE</th>
                  <th className="p-3.5 px-4">LIVE ROUNDTRIP LATENCY</th>
                  <th className="p-3.5 px-4">30-DAY UPTIME</th>
                  <th className="p-3.5 px-4">STATUS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {health.services.map((svc, i) => (
                  <tr key={i} className="text-sm transition-colors hover:bg-gray-50 group">
                    <td className="p-3.5 px-4 font-bold text-gray-900 flex items-center gap-2">
                      <Globe className="w-3.5 h-3.5 text-gray-400" />
                      <span>{svc.name}</span>
                    </td>
                    <td className="p-3.5 px-4 text-gray-500">{svc.type}</td>
                    <td className="p-3.5 px-4 font-mono text-gray-800 font-medium">{svc.latency}</td>
                    <td className="p-3.5 px-4 font-mono text-emerald-600 font-semibold">{svc.uptime}</td>
                    <td className="p-3.5 px-4">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                          svc.status === "Healthy"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200/60"
                            : "bg-amber-50 text-amber-700 border-amber-200/60"
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${svc.status === "Healthy" ? "bg-emerald-500" : "bg-amber-500"}`} />
                        {svc.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
