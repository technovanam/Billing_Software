import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { Sparkles, X } from "lucide-react";
import { removeProductAlias } from "../../services/aiCommandService";

// Owner-only list of spoken names the AI has learned for this product.
// Removal goes through the backend so it is checked and written to aiLogs.
export default function ProductAliasesSection({ product }) {
  const [aliases, setAliases] = useState(Array.isArray(product.aliases) ? product.aliases : []);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    setAliases(Array.isArray(product.aliases) ? product.aliases : []);
  }, [product]);

  const remove = async (alias) => {
    setBusy(alias);
    setError(null);
    try {
      await removeProductAlias({ productId: product.id, alias });
      setAliases((prev) => prev.filter((a) => a !== alias));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="rounded-lg border border-gray-200 p-3" data-testid="product-aliases">
      <p className="flex items-center gap-1.5 text-xs font-semibold text-gray-700">
        <Sparkles className="h-3.5 w-3.5 text-amber-500" /> AI spoken names
      </p>
      <p className="mt-0.5 text-[11px] text-gray-500">
        Saved when someone picks this product for an AI bill. Remove any that point to the wrong product.
      </p>
      {aliases.length === 0 ? (
        <p className="mt-2 text-xs text-gray-400">None yet.</p>
      ) : (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {aliases.map((alias) => (
            <li key={alias} className="inline-flex items-center gap-1 rounded-full bg-gray-100 py-0.5 pl-2.5 pr-1 text-xs text-gray-800">
              {alias}
              <button
                type="button"
                onClick={() => remove(alias)}
                disabled={busy === alias}
                className="rounded-full p-0.5 text-gray-500 hover:bg-gray-200 hover:text-red-600 disabled:opacity-40"
                aria-label={`Remove alias ${alias}`}
              >
                <X className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

ProductAliasesSection.propTypes = {
  product: PropTypes.shape({ id: PropTypes.string.isRequired, aliases: PropTypes.arrayOf(PropTypes.string) }).isRequired,
};
