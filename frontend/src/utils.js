export const money = (n) => `₹${Number(n).toFixed(2)}`;

// The API returns naive UTC timestamps; mark them as UTC before formatting.
export const formatDate = (s) => {
  if (!s) return "";
  const iso = /Z|[+-]\d\d:\d\d$/.test(s) ? s : `${s}Z`;
  return new Date(iso).toLocaleString();
};

export const STATUS_FLOW = ["PLACED", "ACCEPTED", "PREPARING", "READY", "ASSIGNED", "OUT_FOR_DELIVERY", "DELIVERED"];
export const ALL_STATUSES = [...STATUS_FLOW, "CANCELLED", "REFUNDED"];

export const label = (s) => s.replaceAll("_", " ");

export const roleHome = (role) =>
  ({ customer: "/restaurants", restaurant_owner: "/owner", delivery_partner: "/delivery" })[role] || "/login";
