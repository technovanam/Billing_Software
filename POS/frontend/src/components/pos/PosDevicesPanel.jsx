import React, { useCallback, useEffect, useState } from "react";
import PropTypes from "prop-types";
import { MonitorSmartphone, Trash2, Plus, CheckCircle2, Loader2 } from "lucide-react";
import { listDevices, registerThisDevice, removeDevice, getRegisteredDevice } from "../../services/posService";
import { useToast } from "../../context/ToastContext";

const when = (iso) => (iso ? new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }) : "—");

// Owner-only: POS devices allowed to show the cashier login. Removing a
// device signs out every cashier who used it.
export default function PosDevicesPanel({ counters }) {
  const { success: toastSuccess, error: toastError } = useToast();
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(null); // { name, counter } while registering
  const [busy, setBusy] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(null);
  const [thisDeviceId, setThisDeviceId] = useState(getRegisteredDevice()?.deviceId || null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setDevices(await listDevices());
    } catch (err) {
      toastError(err.message || "Could not load POS devices.");
    } finally {
      setLoading(false);
    }
  }, [toastError]);

  useEffect(() => {
    load();
  }, [load]);

  const register = async (e) => {
    e.preventDefault();
    if (!form?.name?.trim()) return;
    setBusy(true);
    try {
      const device = await registerThisDevice({ name: form.name.trim(), counter: form.counter || null });
      setThisDeviceId(device.deviceId);
      setForm(null);
      toastSuccess(`This device is registered as "${device.name}". Cashiers can now sign in here with their ID and PIN.`);
      load();
    } catch (err) {
      toastError(err.message || "Could not register this device.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (device) => {
    setBusy(true);
    try {
      const res = await removeDevice(device.deviceId);
      if (device.deviceId === thisDeviceId) setThisDeviceId(null);
      toastSuccess(`Removed "${device.name}".${res.revoked?.length ? ` Signed out: ${res.revoked.join(", ")}.` : ""}`);
      setConfirmRemove(null);
      load();
    } catch (err) {
      toastError(err.message || "Could not remove the device.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mt-6 rounded-xl border border-gray-200 bg-white" data-testid="pos-devices-panel">
      <div className="flex flex-col gap-2 border-b border-gray-200 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-bold text-gray-900">
            <MonitorSmartphone className="h-4 w-4 text-slate-500" /> Registered POS devices
          </h2>
          <p className="mt-0.5 text-xs text-gray-500">Cashiers can sign in only on devices registered here.</p>
        </div>
        {thisDeviceId ? (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
            <CheckCircle2 className="h-4 w-4" /> This device is registered
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setForm({ name: "", counter: counters[0] || "" })}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-700"
            data-testid="register-device"
          >
            <Plus className="h-3.5 w-3.5" /> Register this device for POS
          </button>
        )}
      </div>

      {form && (
        <form onSubmit={register} className="flex flex-col gap-2 border-b border-gray-200 bg-slate-50 px-6 py-4 sm:flex-row sm:items-end">
          <label className="flex-1 text-xs font-semibold text-slate-700">
            Device name
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Front counter tablet"
              maxLength={60}
              required
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
              data-testid="device-name"
            />
          </label>
          <label className="text-xs font-semibold text-slate-700">
            Counter
            <select value={form.counter} onChange={(e) => setForm({ ...form, counter: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs sm:w-44" data-testid="device-counter">
              {counters.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <div className="flex gap-2">
            <button type="button" onClick={() => setForm(null)} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700">
              Cancel
            </button>
            <button type="submit" disabled={busy} className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50" data-testid="device-save">
              {busy ? "Registering…" : "Register"}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="flex items-center gap-2 px-6 py-6 text-xs text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading devices…
        </p>
      ) : devices.length === 0 ? (
        <p className="px-6 py-6 text-xs text-slate-500">No devices registered yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-left text-sm">
            <thead className="border-b border-gray-200 bg-gray-50 text-xs font-semibold uppercase text-gray-500">
              <tr>
                <th className="px-6 py-3">Device</th>
                <th className="px-6 py-3">Counter</th>
                <th className="px-6 py-3">Registered</th>
                <th className="px-6 py-3">Last used</th>
                <th className="px-6 py-3 text-center">Remove</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {devices.map((d) => (
                <tr key={d.deviceId} data-testid="device-row">
                  <td className="px-6 py-3 font-semibold text-slate-900">
                    {d.name}
                    {d.deviceId === thisDeviceId && <span className="ml-2 rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">This device</span>}
                  </td>
                  <td className="px-6 py-3 text-slate-700">{d.counter || "—"}</td>
                  <td className="px-6 py-3 text-slate-600">{when(d.registeredAt)}</td>
                  <td className="px-6 py-3 text-slate-600">
                    {when(d.lastUsedAt)}
                    {d.lastCashierId && <span className="block text-[10px] text-slate-400">by {d.lastCashierId}</span>}
                  </td>
                  <td className="px-6 py-3 text-center">
                    {confirmRemove === d.deviceId ? (
                      <span className="inline-flex gap-1">
                        <button type="button" onClick={() => remove(d)} disabled={busy} className="rounded bg-red-600 px-2 py-1 text-[10px] font-bold text-white">
                          Remove and sign out
                        </button>
                        <button type="button" onClick={() => setConfirmRemove(null)} className="rounded border border-slate-300 px-2 py-1 text-[10px]">
                          Cancel
                        </button>
                      </span>
                    ) : (
                      <button type="button" onClick={() => setConfirmRemove(d.deviceId)} className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:border-red-200 hover:bg-red-50 hover:text-red-600" title="Remove device">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

PosDevicesPanel.propTypes = { counters: PropTypes.arrayOf(PropTypes.string).isRequired };
