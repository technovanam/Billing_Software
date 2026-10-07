// Shown to anyone who has been added to another business's team (Settings → Team).
// Lets them switch between their own books and the books they work on.
import React, { useContext } from "react";
import { Users } from "lucide-react";
import { AuthContext } from "../context/AuthContext";

const ROLE_LABEL = { accountant: "Accountant", viewer: "View only" };

export default function WorkspaceBar() {
  const { user, memberships = [], switchWorkspace } = useContext(AuthContext);
  if (!user || !memberships.length) return null;
  const inMember = user.role !== "owner";
  return (
    <div className={`mb-4 flex flex-wrap items-center gap-3 px-4 py-2.5 rounded-xl border text-sm ${inMember ? "bg-amber-50 border-amber-200 text-amber-900" : "bg-white border-slate-200 text-slate-700"}`}>
      <Users className="w-4 h-4 shrink-0" />
      <span className="flex-1 min-w-0">
        {inMember ? (
          <>
            Working in <strong>{user.businessName || "a client business"}</strong> as {ROLE_LABEL[user.role] || user.role}
            {user.role === "viewer" && " — you can look but not change anything."}
          </>
        ) : (
          "You have access to other businesses' books."
        )}
      </span>
      <select
        aria-label="Switch business"
        value={inMember ? user.businessUid : ""}
        onChange={(e) => switchWorkspace(e.target.value || null)}
        className="px-3 py-1.5 text-sm bg-white border border-slate-300 rounded-lg"
      >
        <option value="">My business</option>
        {memberships.map((m) => (
          <option key={m.ownerUid} value={m.ownerUid}>
            {m.businessName || m.ownerEmail || m.ownerUid} · {ROLE_LABEL[m.role] || m.role}
          </option>
        ))}
      </select>
    </div>
  );
}
