/**
 * The Settings tab identifiers, shared between the server page (which needs
 * to validate the initial ?tab= value) and the client tab switcher (which
 * needs the same list to render nav buttons) — one source of truth instead
 * of two copies drifting apart.
 */
export const TABS = [
  { id: "company", label: "Company" },
  { id: "account", label: "Account" },
  { id: "billing", label: "Billing" },
] as const;

export type TabId = (typeof TABS)[number]["id"];

export function isTabId(value: string): value is TabId {
  return TABS.some((t) => t.id === value);
}
