// Food bundle preview — mirrors the server's utils/fnbBundle.js (owner, 23 Nov 2026): every full
// group of Finger Food items in one cart sells for the bundle price (any 3 for $10.50). The server
// prices the order itself; this only shows the customer what they'll pay.

export interface FoodBundleConfig {
  enabled: boolean;
  size: number;
  price: number;
  category?: string;
}

export const BUNDLE_CATEGORY = "finger_food";

const cents = (n: number) => Math.round(Number(n) * 100);

/** What the bundles take off a cart: `units` is one { category, price } per item. */
export function foodBundleSavings(units: { category: string; price: number }[], config?: FoodBundleConfig | null): { savings: number; bundles: number } {
  if (!config?.enabled || !(config.size >= 2) || !(config.price > 0)) return { savings: 0, bundles: 0 };
  const food = units.filter((u) => u.category === BUNDLE_CATEGORY).map((u) => cents(u.price)).sort((a, b) => b - a);
  const bundleCents = cents(config.price);
  let saved = 0;
  let bundles = 0;
  for (let g = 0; (g + 1) * config.size <= food.length; g++) {
    const listCents = food.slice(g * config.size, (g + 1) * config.size).reduce((t, c) => t + c, 0);
    if (listCents <= bundleCents) break;
    saved += listCents - bundleCents;
    bundles++;
  }
  return { savings: saved / 100, bundles };
}

/** Cart lines ({ category, price, qty }) to one unit per item. */
export const cartUnits = (lines: { category: string; price: number; qty: number }[]) =>
  lines.flatMap((l) => Array.from({ length: l.qty }, () => ({ category: l.category, price: l.price })));
