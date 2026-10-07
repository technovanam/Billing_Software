// Feature flags a subscription plan can switch on. Shared by the super admin
// plan editor and the public pricing section on the landing page.
export const AVAILABLE_FEATURES = [
  { id: "billing", name: "Billing & E-Way Bill" },
  { id: "multiBranch", name: "Multi-Outlet Sync" },
  { id: "reports", name: "Advanced Reports" },
  { id: "whatsapp", name: "WhatsApp Delivery" },
  { id: "api", name: "API Access" },
  { id: "crm", name: "CRM Module" },
  { id: "inventory", name: "Advanced Inventory" }
];

// Plans store features either as an array of ids/names or as { id: true }.
export function planHasFeature(plan, feat) {
  if (Array.isArray(plan.features)) {
    return plan.features.some(
      (f) => String(f).toLowerCase() === feat.id.toLowerCase() || String(f).toLowerCase() === feat.name.toLowerCase()
    );
  }
  return !!plan.features?.[feat.id];
}
