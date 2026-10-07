// Settings → Team: give an accountant (or a read-only viewer) access to your books.
// users/{owner}/team/{email} is what the security rules check; teamInvites/{email}/owners/{owner}
// lets the invited person find the businesses they can open after signing in.
import React, { useContext, useEffect, useState } from "react";
import { collection, deleteDoc, doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { sendEmailVerification } from "firebase/auth";
import { Trash2, UserPlus, ShieldCheck } from "lucide-react";
import { db, auth } from "../../lib/firebase/config";
import { AuthContext } from "../../context/AuthContext";
import { useCompanyProfile } from "../../context/CompanyProfileContext";
import { useToast } from "../../context/ToastContext";

export const TEAM_ROLES = {
  accountant: "Accountant — create and edit invoices, vouchers, payments and books",
  viewer: "Viewer — read-only access to books and reports",
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const field = "px-3 py-2 text-sm bg-gray-100 border-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500";

export default function TeamSettings() {
  const { user, memberships = [], switchWorkspace } = useContext(AuthContext);
  const { companyProfile } = useCompanyProfile();
  const { success, error: toastError } = useToast();
  const [members, setMembers] = useState([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("accountant");
  const [busy, setBusy] = useState(false);
  const isOwner = user?.role === "owner";
  const ownerUid = user?.uid;

  useEffect(() => {
    if (!isOwner || !ownerUid) return undefined;
    return onSnapshot(
      collection(db, "users", ownerUid, "team"),
      (snap) => setMembers(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      () => setMembers([])
    );
  }, [isOwner, ownerUid]);

  const save = async (addr, r) => {
    const e = addr.trim().toLowerCase();
    if (!EMAIL_RE.test(e)) return toastError("Enter a valid email address.");
    if (e === String(user.email || "").toLowerCase()) return toastError("That's your own email.");
    setBusy(true);
    try {
      const info = { email: e, role: r, ownerUid, ownerEmail: user.email || "", businessName: companyProfile?.companyName || "", active: true, updatedAt: serverTimestamp() };
      await setDoc(doc(db, "users", ownerUid, "team", e), info, { merge: true });
      await setDoc(doc(db, "teamInvites", e, "owners", ownerUid), info, { merge: true });
      success(`${e} can now open your books as ${r === "viewer" ? "a viewer" : "an accountant"}.`);
      setEmail("");
    } catch (err) {
      toastError(`Could not save: ${err.message}`);
    }
    setBusy(false);
  };

  const remove = async (m) => {
    if (!window.confirm(`Remove ${m.email}'s access to your books?`)) return;
    try {
      await deleteDoc(doc(db, "users", ownerUid, "team", m.id));
      await deleteDoc(doc(db, "teamInvites", m.id, "owners", ownerUid));
      success(`${m.email} removed.`);
    } catch (err) {
      toastError(`Could not remove: ${err.message}`);
    }
  };

  const verify = async () => {
    try {
      await sendEmailVerification(auth.currentUser);
      success("Verification email sent. Open the link, then sign in again.");
    } catch (err) {
      toastError(err.message);
    }
  };

  return (
    <div className="p-6 space-y-8">
      {auth.currentUser && !auth.currentUser.emailVerified && (
        <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-900 flex flex-wrap items-center gap-3">
          <span className="flex-1">Your email isn't verified yet. Businesses that add you to their team can only be opened from a verified email.</span>
          <button onClick={verify} className="px-3 py-1.5 text-xs font-semibold text-white bg-amber-600 rounded-lg">
            Send verification email
          </button>
        </div>
      )}

      {isOwner ? (
        <section>
          <h3 className="text-lg font-semibold text-gray-900">Team access</h3>
          <p className="text-sm text-gray-600 mt-1">
            Add your accountant or auditor by email. They sign up for Kanakku Desk with that email, verify it, and then pick your business from the bar at the top of the app. Payroll, settings and subscription stay
            owner-only.
          </p>
          <div className="mt-4 flex flex-wrap gap-3 items-end">
            <label className="block">
              <span className="block text-xs text-gray-600 mb-1">Email</span>
              <input className={`${field} w-72`} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="accountant@firm.in" />
            </label>
            <label className="block">
              <span className="block text-xs text-gray-600 mb-1">Role</span>
              <select className={field} value={role} onChange={(e) => setRole(e.target.value)}>
                <option value="accountant">Accountant</option>
                <option value="viewer">Viewer (read-only)</option>
              </select>
            </label>
            <button disabled={busy} onClick={() => save(email, role)} className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60">
              <UserPlus className="w-4 h-4" /> Add member
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-2">{TEAM_ROLES[role]}</p>

          <table className="w-full text-sm mt-6">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-2.5 text-left">Email</th>
                <th className="px-4 py-2.5 text-left">Role</th>
                <th className="px-4 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {members.map((m) => (
                <tr key={m.id}>
                  <td className="px-4 py-2.5">{m.email}</td>
                  <td className="px-4 py-2.5">
                    <select className={field} value={m.role} onChange={(e) => save(m.email, e.target.value)}>
                      <option value="accountant">Accountant</option>
                      <option value="viewer">Viewer</option>
                    </select>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <button onClick={() => remove(m)} className="p-1.5 text-red-500 hover:bg-red-50 rounded" aria-label={`Remove ${m.email}`}>
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {!members.length && (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-gray-500">
                    Only you can open these books.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      ) : (
        <p className="text-sm text-gray-600">Team access is managed by the business owner.</p>
      )}

      {memberships.length > 0 && (
        <section>
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-blue-600" /> Businesses you can open
          </h3>
          <ul className="mt-3 divide-y divide-gray-100 border border-gray-200 rounded-lg">
            {memberships.map((m) => (
              <li key={m.ownerUid} className="px-4 py-3 flex items-center justify-between">
                <span>
                  <strong>{m.businessName || m.ownerEmail}</strong> <span className="text-xs text-gray-500">· {m.role}</span>
                </span>
                <button onClick={() => switchWorkspace(m.ownerUid)} className="px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100">
                  Open books
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
