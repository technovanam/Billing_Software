import React, { useState } from "react";
import PropTypes from "prop-types";
import { Plus, Edit2, Trash2, X, Warehouse, AlertTriangle, Building2, MapPin } from "lucide-react";
import { useGodowns } from "../../hooks/useWarehouse";
import { useOperator, ROLES } from "../../context/OperatorContext";

const Modal = ({ children, onClose }) => (
  <div
    className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
    onClick={onClose}
    role="button"
    tabIndex={-1}
    onKeyDown={(e) => e.key === "Escape" && onClose()}
  >
    <div
      className="bg-white rounded-2xl shadow-2xl w-full max-w-md relative"
      onClick={(e) => e.stopPropagation()}
      role="dialog"
      aria-modal="true"
    >
      {children}
    </div>
  </div>
);
Modal.propTypes = { children: PropTypes.node.isRequired, onClose: PropTypes.func.isRequired };

const GodownForm = ({ initial = {}, onSave, onClose, title }) => {
  const [name, setName] = useState(initial.name || "");
  const [address, setAddress] = useState(initial.address || "");
  const [notes, setNotes] = useState(initial.notes || "");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    await onSave({ name: name.trim(), address: address.trim(), notes: notes.trim() });
    setSaving(false);
  };

  return (
    <Modal onClose={onClose}>
      <div className="p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-slate-900">{title}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Godown Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Central Warehouse, Shed 4"
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              required
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Address / Location</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="e.g. Plot 12, Industrial Area, Phase II"
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Storage capacity, contact person, access instructions…"
              rows={3}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm resize-none focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !name.trim()}
              className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save Godown"}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
};
GodownForm.propTypes = {
  initial: PropTypes.object,
  onSave: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
  title: PropTypes.string.isRequired,
};

export default function GodownManagement() {
  const { godowns, loading, addGodown, editGodown, removeGodown } = useGodowns();
  const { role, hasPermission } = useOperator();

  const [modal, setModal] = useState({ open: false, type: null, data: null });
  const [deletingId, setDeletingId] = useState(null);

  const canManageGodowns = hasPermission("manage_godowns");

  const handleSave = async (data) => {
    if (modal.type === "add") {
      const res = await addGodown(data);
      if (res.success) setModal({ open: false, type: null, data: null });
    } else if (modal.type === "edit") {
      const res = await editGodown(modal.data.id, data);
      if (res.success) setModal({ open: false, type: null, data: null });
    }
  };

  const handleDelete = async (godown) => {
    if (!window.confirm(`Are you sure you want to delete "${godown.name}"?`)) return;
    setDeletingId(godown.id);
    await removeGodown(godown.id);
    setDeletingId(null);
  };

  return (
    <div className="space-y-6">


      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center text-blue-700">
            <Building2 size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Godown Management</h1>
            <p className="text-sm text-slate-500">Configure warehouse physical locations and facilities</p>
          </div>
        </div>

        {canManageGodowns && (
          <button
            onClick={() => setModal({ open: true, type: "add", data: null })}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold shadow-sm transition-colors"
          >
            <Plus size={16} />
            Add Godown
          </button>
        )}
      </div>

      {!canManageGodowns && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 flex items-center gap-3 text-amber-800 text-sm">
          <AlertTriangle size={18} className="shrink-0 text-amber-600" />
          <span>You are in <strong>{role}</strong> role. Only <strong>Admin</strong> can create, edit, or delete godowns.</span>
        </div>
      )}

      {/* Godowns Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-slate-400">Loading godowns…</div>
        ) : godowns.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            <Warehouse className="mx-auto mb-2 text-slate-300" size={40} />
            <p className="text-sm">No godowns found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider text-xs border-b border-slate-100">
                <tr>
                  <th className="px-6 py-3.5 font-bold">Godown Name</th>
                  <th className="px-6 py-3.5 font-bold">Address / Location</th>
                  <th className="px-6 py-3.5 font-bold">Notes</th>
                  {canManageGodowns && <th className="px-6 py-3.5 font-bold text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {godowns.map((g) => (
                  <tr key={g.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-6 py-4 font-semibold text-slate-900 flex items-center gap-2">
                      <Warehouse size={16} className="text-blue-600 shrink-0" />
                      {g.name}
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      {g.address ? (
                        <span className="flex items-center gap-1.5">
                          <MapPin size={13} className="text-slate-400 shrink-0" />
                          {g.address}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-slate-500 max-w-xs truncate">
                      {g.notes || <span className="text-slate-400">—</span>}
                    </td>
                    {canManageGodowns && (
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setModal({ open: true, type: "edit", data: g })}
                            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-blue-600"
                            title="Edit"
                          >
                            <Edit2 size={15} />
                          </button>
                          <button
                            onClick={() => handleDelete(g)}
                            disabled={deletingId === g.id}
                            className="p-1.5 rounded-lg text-slate-500 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                            title="Delete"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal.open && (
        <GodownForm
          initial={modal.data || {}}
          onSave={handleSave}
          onClose={() => setModal({ open: false, type: null, data: null })}
          title={modal.type === "add" ? "Create New Godown" : "Edit Godown"}
        />
      )}
    </div>
  );
}
