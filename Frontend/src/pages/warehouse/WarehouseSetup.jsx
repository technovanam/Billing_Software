import React, { useState, useContext, useEffect } from "react";
import { Link2, CheckCircle2, AlertTriangle, Copy, RefreshCw } from "lucide-react";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../lib/firebase/config";
import { AuthContext } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { PageContainer, PageHeader, Card, btnPrimary, btnSecondary, inputClass } from "../../components/warehouse/WarehouseUI";

/**
 * WarehouseSetup
 * Allows the warehouse user to enter the admin's UID to link their account.
 * This makes the warehouse dashboard show all of the admin's products.
 *
 * How to get the admin UID:
 *   1. Admin logs in to the admin dashboard
 *   2. Admin opens browser console and runs: firebase.auth().currentUser.uid
 *      OR the admin visits their profile page which shows the UID.
 */
export default function WarehouseSetup() {
  const { user } = useContext(AuthContext);
  const toast = useToast();

  const [adminUid, setAdminUid] = useState("");
  const [currentLink, setCurrentLink] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Load current linked admin UID
  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const snap = await getDoc(doc(db, "users", user.uid, "settings", "profile"));
        if (snap.exists() && snap.data().linkedAdminUid) {
          setCurrentLink(snap.data().linkedAdminUid);
        }
      } catch (_) {}
      setLoading(false);
    })();
  }, [user]);

  const handleSave = async () => {
    const uid = adminUid.trim();
    if (!uid) {
      toast.error("Please enter the admin UID.");
      return;
    }
    if (uid === user?.uid) {
      toast.error("You cannot link to yourself.");
      return;
    }
    setSaving(true);
    try {
      await setDoc(
        doc(db, "users", user.uid, "settings", "profile"),
        { linkedAdminUid: uid, linkedAt: serverTimestamp() },
        { merge: true }
      );
      setCurrentLink(uid);
      setAdminUid("");
      toast.success("✅ Admin linked! Refresh the dashboard to see all products.");
    } catch (err) {
      toast.error("Failed to save: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    if (!window.confirm("Remove the admin link? Products will not be visible until re-linked.")) return;
    setSaving(true);
    try {
      await setDoc(
        doc(db, "users", user.uid, "settings", "profile"),
        { linkedAdminUid: null },
        { merge: true }
      );
      setCurrentLink(null);
      toast.success("Link removed.");
    } catch (err) {
      toast.error("Failed: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const copyUid = () => {
    navigator.clipboard.writeText(user?.uid || "");
    toast.success("Warehouse UID copied!");
  };

  return (
    <PageContainer>
      <PageHeader title="Warehouse Setup" subtitle="Link this warehouse to an admin account to see their products" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="flex flex-col gap-6">
          {/* Your UID card */}
          <Card title="Your Warehouse UID" subtitle="Share this with your admin so they can identify your account.">
            <div className="flex flex-col sm:flex-row gap-2">
              <code className="flex-1 min-w-0 text-sm bg-gray-100 rounded-lg px-3 py-2 font-mono text-gray-700 truncate">
                {user?.uid || "Loading…"}
              </code>
              <button onClick={copyUid} className={btnSecondary}>
                <Copy size={14} />
                Copy
              </button>
            </div>
          </Card>

          {/* Current link status */}
          <div className={`rounded-lg border p-4 lg:p-5 ${currentLink ? "bg-green-50 border-green-200" : "bg-amber-50 border-amber-200"}`}>
            <div className="flex items-start gap-3">
              {currentLink ? (
                <CheckCircle2 size={20} className="text-green-600 mt-0.5 flex-shrink-0" />
              ) : (
                <AlertTriangle size={20} className="text-amber-500 mt-0.5 flex-shrink-0" />
              )}
              <div className="min-w-0">
                <p className={`text-sm font-semibold ${currentLink ? "text-green-800" : "text-amber-800"}`}>
                  {loading ? "Checking link status…" : currentLink ? "Admin account linked" : "Not linked to any admin"}
                </p>
                {currentLink && <p className="text-xs font-mono text-green-700 mt-1 break-all">{currentLink}</p>}
                {!loading && !currentLink && (
                  <p className="text-sm text-amber-700 mt-1">
                    Link this warehouse to an admin account to see their full product catalog.
                  </p>
                )}
                {currentLink && (
                  <button
                    onClick={handleRemove}
                    disabled={saving}
                    className="mt-2 text-sm text-red-600 hover:text-red-800 font-medium"
                  >
                    Remove link
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Link form */}
          <Card
            title={currentLink ? "Change Admin Link" : "Link to Admin Account"}
            subtitle="Paste the admin's User UID from their Settings → Profile page."
          >
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={adminUid}
                onChange={(e) => setAdminUid(e.target.value)}
                placeholder="Paste admin UID here (e.g. xKy7z…)"
                aria-label="Admin UID"
                className={`${inputClass} flex-1 font-mono`}
              />
              <button onClick={handleSave} disabled={saving || !adminUid.trim()} className={btnPrimary}>
                {saving ? <RefreshCw size={14} className="animate-spin" /> : <Link2 size={14} />}
                {saving ? "Saving…" : "Link"}
              </button>
            </div>
          </Card>
        </div>

        {/* Instructions */}
        <Card title="How to get the Admin UID" className="h-fit">
          <ol className="space-y-2 text-sm text-gray-700 list-decimal list-inside">
            <li>Admin logs into the main dashboard (<code className="bg-gray-100 px-1 rounded">/dashboard</code>)</li>
            <li>Admin goes to <strong>Settings → Profile</strong></li>
            <li>Admin copies their <strong>User UID</strong> shown on the profile page</li>
            <li>Admin shares that UID with you</li>
            <li>Paste the UID and click <strong>Link</strong></li>
          </ol>
          <p className="text-sm text-gray-500 mt-3">
            After linking, the warehouse dashboard will show all products from the admin&apos;s catalog.
          </p>
        </Card>
      </div>
    </PageContainer>
  );
}
