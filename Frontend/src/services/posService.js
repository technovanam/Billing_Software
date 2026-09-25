// Backend calls for POS: cashier login, device registration, cashier PINs and
// status, and shifts. Owner/cashier calls carry the Firebase ID token.
import axios from "axios";
import { signInWithCustomToken } from "firebase/auth";
import { auth } from "../lib/firebase/config";

const BACKEND = "http://localhost:5000";
const DEVICE_KEY = "pos_device";

// ---- this device's registration (secret stays on the device) ----
export function getRegisteredDevice() {
  try {
    const d = JSON.parse(localStorage.getItem(DEVICE_KEY) || "null");
    return d?.deviceId && d?.deviceSecret ? d : null;
  } catch (_) {
    return null;
  }
}
export function saveRegisteredDevice(device) {
  localStorage.setItem(DEVICE_KEY, JSON.stringify(device));
}
export function clearRegisteredDevice() {
  localStorage.removeItem(DEVICE_KEY);
}

function toError(err) {
  const wrapped = new Error(err?.response?.data?.error || err?.message || "Request failed.");
  wrapped.status = err?.response?.status;
  wrapped.code = err?.response?.data?.code;
  return wrapped;
}

async function call(method, path, data, { withAuth = true } = {}) {
  try {
    const headers = {};
    if (withAuth) {
      await auth.authStateReady();
      if (!auth.currentUser) throw new Error("Please sign in first.");
      headers.Authorization = `Bearer ${await auth.currentUser.getIdToken()}`;
    }
    const res = await axios({ method, url: `${BACKEND}/api/pos${path}`, data, headers, timeout: 20000 });
    return res.data;
  } catch (err) {
    throw toError(err);
  }
}

// ---- cashier login: device + ID + PIN -> Firebase custom token ----
export async function cashierLogin({ cashierId, pin }) {
  const device = getRegisteredDevice();
  if (!device) {
    const err = new Error("This device is not registered for POS. Ask the owner to register it in Cashier Management.");
    err.code = "DEVICE_NOT_REGISTERED";
    throw err;
  }
  const res = await call("post", "/cashier-login", { deviceId: device.deviceId, deviceSecret: device.deviceSecret, cashierId, pin }, { withAuth: false });
  await signInWithCustomToken(auth, res.token);
  const session = {
    cashierId: res.cashier.cashierId,
    cashierName: res.cashier.name,
    counterNumber: res.cashier.counter || device.counter || "Counter 01",
    shiftStartTime: new Date().toISOString(),
    ownerUid: device.businessUid,
  };
  localStorage.setItem("pos_cashier_session", JSON.stringify(session));
  return session;
}

// ---- owner: devices ----
export async function registerThisDevice({ name, counter }) {
  const device = await call("post", "/devices", { name, counter });
  saveRegisteredDevice(device);
  return device;
}
export const listDevices = () => call("get", "/devices").then((r) => r.devices);
export async function removeDevice(deviceId) {
  const res = await call("delete", `/devices/${encodeURIComponent(deviceId)}`);
  if (getRegisteredDevice()?.deviceId === deviceId) clearRegisteredDevice();
  return res;
}

// ---- owner: cashiers ----
export const listCashierStatus = () => call("get", "/cashiers").then((r) => r.cashiers);
export const setCashierPin = (cashierId, pin) => call("post", `/cashiers/${encodeURIComponent(cashierId)}/pin`, { pin });
export const setCashierActive = (cashierId, active) => call("post", `/cashiers/${encodeURIComponent(cashierId)}/status`, { active });
export const removeCashierAccess = (cashierId) => call("delete", `/cashiers/${encodeURIComponent(cashierId)}`);

// ---- shifts ----
export const openShift = ({ openingCash, counter, notes }) => call("post", "/shifts/open", { openingCash, counter, notes }).then((r) => r.shift);
export const closeShift = (shiftId, { closingCash, totals, notes }) => call("post", `/shifts/${encodeURIComponent(shiftId)}/close`, { closingCash, totals, notes }).then((r) => r.shift);
export const addShiftRefund = (amount) => call("post", "/shifts/refund", { amount }).then((r) => r.shift);
export const importShifts = (shifts) => call("post", "/shifts/import", { shifts });
