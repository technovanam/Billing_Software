import React, { useCallback, useEffect, useState } from "react";
import { fetchHealth } from "../../../services/superAdminApi";
import { Server, Database, Globe, Cpu, HardDrive, Zap, Loader2 } from "lucide-react";

const gb = (bytes) => (bytes / 1024 ** 3).toFixed(1);
const pct = (n) => `${Math.min(100, Math.max(0, n)).toFixed(0)}%`;
const formatUptime = (sec) => {
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : `${m}m`;
};

// Live numbers from the backend's /api/super-admin/health check, refreshed every 30 seconds.
export default function SystemHealth() {
  const [health, setHealth] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const started = performance.now();
    try {
      const data = await fetchHealth();
      const roundTrip = Math.round(performance.now() - started);
      const used = data.memory.total - data.memory.free;
      setHealth({
        cpu: `${data.cpuPercent}%`,
        cpuWidth: pct(data.cpuPercent),
        ram: `${gb(used)} / ${gb(data.memory.total)} GB`,
        ramWidth: pct((used / data.memory.total) * 100),
        disk: data.disk ? `${gb(data.disk.total - data.disk.free)} / ${gb(data.disk.total)} GB` : "Unavailable",
        diskWidth: data.disk ? pct(((data.disk.total - data.disk.free) / data.disk.total) * 100) : "0%",
        latency: `${roundTrip} ms`,
        latencyWidth: pct(roundTrip / 10),
        uptime: formatUptime(data.uptimeSeconds),
        services: data.services,
        checkedAt: data.checkedAt,
      });
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 30000);
    return () => clearInterval(timer);
  }, [refresh]);

  const allHealthy = health && !error && health.services.every((s) => s.status === "Healthy" || s.status === "Not configured");

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">System Health & Telemetry</h2>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Real-time latency, compute loads, and availability monitoring across all platform dependencies.
          </p>
        </div>

        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold border ${allHealthy ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-rose-50 border-rose-200 text-rose-700"}`}>
          <span className={`w-2 h-2 rounded-full animate-pulse ${allHealthy ? "bg-emerald-500" : "bg-rose-500"}`} />
          <span>{loading ? "Checking..." : allHealthy ? `All services healthy · server up ${health.uptime}` : "Problem detected"}</span>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl border border-gray-200 shadow-sm">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-4" />
          <p className="text-sm text-gray-500 font-medium animate-pulse">Loading system telemetry...</p>
        </div>
      ) : !health ? (
        <div className="p-6 rounded-xl border border-rose-200 bg-rose-50 text-sm text-rose-700">
          Could not load server health: {error}
        </div>
      ) : (
        <>
          {error && (
            <div className="p-3 rounded-xl border border-amber-200 bg-amber-50 text-xs text-amber-700">
              Last refresh failed ({error}). Showing the previous reading from {new Date(health.checkedAt).toLocaleTimeString()}.
            </div>
          )}
          {/* Compute Gauges */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 rounded-2xl bg-white border border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-500 font-semibold">Node.js Process CPU</span>
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
                <span className="text-xs text-gray-500 font-semibold">Server Disk</span>
                <HardDrive className="w-4 h-4 text-cyan-600" />
              </div>
              <div className="text-2xl font-bold text-gray-900 font-mono">{health.disk}</div>
              <div className="w-full h-1.5 rounded-full bg-gray-100 mt-3 overflow-hidden">
                <div className="h-full bg-cyan-600 rounded-full" style={{ width: health.diskWidth }} />
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-500 font-semibold">API Round Trip</span>
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
                  <th className="p-3.5 px-4">DETAILS</th>
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
                    <td className="p-3.5 px-4 text-gray-500">{svc.detail}</td>
                    <td className="p-3.5 px-4">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                          svc.status === "Healthy"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200/60"
                            : svc.status === "Down"
                            ? "bg-rose-50 text-rose-700 border-rose-200/60"
                            : "bg-amber-50 text-amber-700 border-amber-200/60"
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${svc.status === "Healthy" ? "bg-emerald-500" : svc.status === "Down" ? "bg-rose-500" : "bg-amber-500"}`} />
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
