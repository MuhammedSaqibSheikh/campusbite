export const money = (n) => `₹${Number(n).toFixed(2)}`;

// The API returns naive UTC timestamps; mark them as UTC before formatting.
export const formatDate = (s) => {
  if (!s) return "";
  const iso = /Z|[+-]\d\d:\d\d$/.test(s) ? s : `${s}Z`;
  return new Date(iso).toLocaleString();
};

export const STATUS_FLOW = ["PLACED", "ACCEPTED", "PREPARING", "READY", "ASSIGNED", "OUT_FOR_DELIVERY", "DELIVERED"];
export const ALL_STATUSES = [...STATUS_FLOW, "CANCELLED", "REFUNDED"];

export const label = (s) => String(s).replace(/_/g, " ");

export const roleHome = (role) =>
  ({ customer: "/restaurants", restaurant_owner: "/owner", delivery_partner: "/delivery" })[role] || "/login";

export const roleName = (role) =>
  ({ customer: "Customer", restaurant_owner: "Restaurant owner", delivery_partner: "Delivery partner" })[role] || "";

export const initials = (name = "") =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("") || "?";

const CUISINE_EMOJI = [
  [/pizza|italian/i, "🍕"],
  [/indian|curry|biryani/i, "🍛"],
  [/chinese|asian|noodle/i, "🍜"],
  [/japan|sushi/i, "🍣"],
  [/\b(burger|american|fast ?food)\b/i, "🍔"],
  [/mexican|taco/i, "🌮"],
  [/cafe|coffee|bakery/i, "☕"],
  [/dessert|sweet|ice/i, "🍰"],
  [/salad|healthy|vegan/i, "🥗"],
  [/drink|juice|lassi|shake/i, "🥤"],
];

export const foodEmoji = (text = "") => (CUISINE_EMOJI.find(([re]) => re.test(text)) || [null, "🍽️"])[1];

const COVERS = [
  "linear-gradient(135deg, #ff5f3a, #ff9f45)",
  "linear-gradient(135deg, #7c3aed, #c084fc)",
  "linear-gradient(135deg, #0ea5e9, #67e8f9)",
  "linear-gradient(135deg, #16a34a, #86efac)",
  "linear-gradient(135deg, #e11d48, #fb7185)",
  "linear-gradient(135deg, #d97706, #fcd34d)",
];

// Stable, colourful cover per restaurant name.
export const coverFor = (name = "") => {
  let h = 0;
  for (let i = 0; i < name.length; i += 1) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return COVERS[h % COVERS.length];
};
