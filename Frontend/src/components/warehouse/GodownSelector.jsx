import React, { useEffect } from "react";
import PropTypes from "prop-types";
import { Warehouse, ChevronDown } from "lucide-react";
import { useGodowns } from "../../hooks/useWarehouse";

const GODOWN_KEY = "wh_activeGodownId";

export default function GodownSelector({ activeGodown, onChange, className = "" }) {
  const { godowns, loading } = useGodowns();

  useEffect(() => {
    if (!godowns.length || activeGodown) return;
    const saved = localStorage.getItem(GODOWN_KEY);
    const found = saved ? godowns.find((g) => g.id === saved) : null;
    onChange(found || godowns[0]);
  }, [godowns, activeGodown, onChange]);

  const handleChange = (e) => {
    const selected = godowns.find((g) => g.id === e.target.value);
    if (selected) {
      localStorage.setItem(GODOWN_KEY, selected.id);
      onChange(selected);
    }
  };

  if (loading && !godowns.length) {
    return (
      <div className={`flex items-center gap-2 text-xs text-slate-400 ${className}`}>
        <Warehouse size={14} className="animate-pulse" />
        <span>Loading godowns…</span>
      </div>
    );
  }

  if (!godowns.length) {
    return (
      <div className={`flex items-center gap-2 text-xs text-rose-500 ${className}`}>
        <Warehouse size={14} />
        <span>No godowns available</span>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100 text-blue-700 shrink-0">
        <Warehouse size={14} />
      </div>
      <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 shrink-0">
        Godown:
      </span>
      {godowns.length === 1 ? (
        <span className="text-sm font-bold text-slate-800 bg-slate-100 px-2.5 py-1 rounded-lg">
          {godowns[0].name}
        </span>
      ) : (
        <div className="relative inline-block">
          <select
            value={activeGodown?.id || godowns[0]?.id}
            onChange={handleChange}
            className="appearance-none rounded-xl border border-slate-200 bg-white py-1.5 pl-3 pr-8 text-sm font-semibold text-slate-800 shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 cursor-pointer"
          >
            {godowns.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
          <ChevronDown
            size={14}
            className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400"
          />
        </div>
      )}
    </div>
  );
}

GodownSelector.propTypes = {
  activeGodown: PropTypes.object,
  onChange: PropTypes.func.isRequired,
  className: PropTypes.string,
};
