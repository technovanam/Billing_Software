// Shared admin-portal-style building blocks for the warehouse portal.
// Class names mirror pages/dashboard/Dashboard.jsx and pages/products/ProductsList.jsx
// so both portals look the same.
import React from "react";
import PropTypes from "prop-types";
import { Search, X } from "lucide-react";

export const btnPrimary =
  "inline-flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
export const btnSecondary =
  "inline-flex items-center justify-center gap-2 bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
export const btnDanger =
  "inline-flex items-center justify-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
export const btnIcon =
  "inline-flex items-center justify-center p-2 border border-gray-300 bg-white rounded-lg text-gray-500 hover:bg-gray-50 transition-colors";

// Same as the admin product form inputs
export const inputClass =
  "w-full px-3 py-2 bg-gray-100 border-0 rounded-lg text-sm text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60";
export const labelClass = "block text-sm text-gray-700 mb-1";

export const theadClass = "text-xs font-semibold text-gray-500 uppercase bg-gray-50";
export const thClass = "px-4 sm:px-6 py-3 text-left whitespace-nowrap";
export const tdClass = "px-4 sm:px-6 py-4 text-sm text-gray-700";
export const tbodyClass = "divide-y divide-gray-200";

// Page wrapper: same font and spacing as admin pages
export function PageContainer({ children }) {
  return (
    <div className="min-h-screen text-slate-800 font-mazzard">
      <div className="max-w-full mx-auto lg:px-8 pb-8 lg:pt-6">
        <div className="flex flex-col gap-6">{children}</div>
      </div>
    </div>
  );
}
PageContainer.propTypes = { children: PropTypes.node };

export function PageHeader({ title, subtitle, actions }) {
  return (
    <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
      <div className="min-w-0">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">{title}</h1>
        {subtitle && <p className="text-sm text-gray-600 mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">{actions}</div>}
    </header>
  );
}
PageHeader.propTypes = { title: PropTypes.node.isRequired, subtitle: PropTypes.node, actions: PropTypes.node };

// Same markup as the admin Dashboard StatCard, plus optional onClick
export function StatCard({
  title,
  value,
  valueLabel,
  secondaryValue,
  secondaryValueLabel,
  subtext,
  subtextColor = "green",
  icon,
  footer,
  isSecondaryValueRed,
  onClick,
}) {
  const badgeColor =
    { blue: "bg-blue-600", orange: "bg-orange-600", red: "bg-red-600" }[subtextColor] || "bg-green-600";
  return (
    <div
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => (e.key === "Enter" || e.key === " ") && onClick() : undefined}
      className={`bg-white p-3 lg:p-4 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-200 ${
        onClick ? "cursor-pointer" : ""
      }`}
    >
      <div className="flex justify-between items-start mb-2">
        <h3 className="text-sm font-medium text-gray-600">{title}</h3>
        {icon && <div className="p-1 bg-gray-50 rounded-md">{icon}</div>}
      </div>
      <div className="mt-1">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-xl font-bold text-gray-900 truncate">{value}</p>
            {valueLabel && <p className="text-xs mt-0.5 text-gray-500">{valueLabel}</p>}
          </div>
          {secondaryValue && (
            <div className="text-right">
              <p className={`text-xl font-bold ${isSecondaryValueRed ? "text-red-600" : "text-gray-900"}`}>
                {secondaryValue}
              </p>
              {secondaryValueLabel && <p className="text-xs mt-0.5 text-gray-500">{secondaryValueLabel}</p>}
            </div>
          )}
        </div>
        {subtext && (
          <div className="flex items-center gap-2 text-xs mt-2">
            <span className={`${badgeColor} text-white px-2 py-0.5 rounded-full font-medium`}>{subtext}</span>
          </div>
        )}
        {footer && <div className="mt-2">{footer}</div>}
      </div>
    </div>
  );
}
StatCard.propTypes = {
  title: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  valueLabel: PropTypes.string,
  secondaryValue: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  secondaryValueLabel: PropTypes.string,
  subtext: PropTypes.string,
  subtextColor: PropTypes.string,
  icon: PropTypes.node,
  footer: PropTypes.node,
  isSecondaryValueRed: PropTypes.bool,
  onClick: PropTypes.func,
};

export function StatGrid({ children, cols = 4 }) {
  const lg = { 3: "lg:grid-cols-3", 4: "lg:grid-cols-4", 5: "lg:grid-cols-5" }[cols] || "lg:grid-cols-4";
  return <div className={`grid grid-cols-1 sm:grid-cols-2 ${lg} gap-4 lg:gap-6`}>{children}</div>;
}
StatGrid.propTypes = { children: PropTypes.node, cols: PropTypes.number };

// Panel card, like the admin "Recent Activity" card
export function Card({ title, subtitle, actions, children, className = "" }) {
  return (
    <div className={`bg-white p-4 lg:p-5 rounded-lg border border-gray-200 shadow-sm ${className}`}>
      {(title || actions) && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div className="min-w-0">
            {title && <h3 className="text-lg font-semibold text-gray-900">{title}</h3>}
            {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </div>
  );
}
Card.propTypes = {
  title: PropTypes.node,
  subtitle: PropTypes.node,
  actions: PropTypes.node,
  children: PropTypes.node,
  className: PropTypes.string,
};

// Table wrapper, like the admin Products table
export function TableCard({ children, minWidth = "min-w-[640px]" }) {
  return (
    <div className="overflow-x-auto bg-white rounded-xl border border-gray-200 shadow-sm">
      <table className={`w-full ${minWidth}`}>{children}</table>
    </div>
  );
}
TableCard.propTypes = { children: PropTypes.node, minWidth: PropTypes.string };

export function EmptyRow({ colSpan, message, hint }) {
  return (
    <tr>
      <td colSpan={colSpan} className="text-center text-sm text-gray-500 py-12">
        {message}
        {hint && <p className="text-xs text-slate-400 mt-1">{hint}</p>}
      </td>
    </tr>
  );
}
EmptyRow.propTypes = { colSpan: PropTypes.number.isRequired, message: PropTypes.node, hint: PropTypes.node };

export function SkeletonRows({ cols, rows = 5 }) {
  return Array.from({ length: rows }).map((_, i) => (
    <tr key={`skeleton-${i}`} className="animate-pulse">
      {Array.from({ length: cols }).map((__, j) => (
        <td key={j} className="px-4 sm:px-6 py-4">
          <div className="h-4 bg-gray-200 rounded w-20"></div>
        </td>
      ))}
    </tr>
  ));
}

export function SearchInput({ value, onChange, placeholder = "Search...", className = "" }) {
  return (
    <div className={`relative ${className || "w-full sm:w-80"}`}>
      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
      <input
        aria-label={placeholder}
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-white border border-slate-300 rounded-xl pl-9 pr-4 py-2 text-sm text-slate-800 placeholder-slate-400 shadow-xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
      />
    </div>
  );
}
SearchInput.propTypes = {
  value: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  placeholder: PropTypes.string,
  className: PropTypes.string,
};

export function Spinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

// Same shell as the admin ModalWrapper in ProductsList.jsx
export function Modal({ title, icon, onClose, children, footer, maxWidth = "max-w-lg" }) {
  return (
    <div
      className="fixed inset-0 bg-black/50 flex justify-center items-end sm:items-center z-50 p-0 sm:p-4"
      onClick={onClose}
      onKeyDown={(e) => e.key === "Escape" && onClose?.()}
      role="presentation"
    >
      <div
        className={`bg-white rounded-t-lg sm:rounded-lg shadow-xl w-full ${maxWidth} max-h-[92vh] flex flex-col`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {title && (
          <div className="flex items-center justify-between gap-3 px-5 sm:px-6 py-4 border-b border-gray-200">
            <div className="flex items-center gap-2 min-w-0">
              {icon}
              <h2 className="text-lg font-bold text-gray-900 truncate">{title}</h2>
            </div>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            )}
          </div>
        )}
        <div className="p-5 sm:p-6 overflow-y-auto">{children}</div>
        {footer && (
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 px-5 sm:px-6 py-4 border-t border-gray-200">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
Modal.propTypes = {
  title: PropTypes.node,
  icon: PropTypes.node,
  onClose: PropTypes.func,
  children: PropTypes.node,
  footer: PropTypes.node,
  maxWidth: PropTypes.string,
};
