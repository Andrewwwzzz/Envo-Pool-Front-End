// Pure helpers for the admin Vending tab: ordering slots by product type and
// turning slots into one sellable line per drink (grouped by type).
import type { VendingSlot } from "@/hooks/useVending";

export const CATEGORY_ORDER = ["soft_drinks", "beer", "finger_food", "snacks", "others"] as const;
export const CATEGORY_LABELS: Record<string, string> = {
  soft_drinks: "Soft drinks",
  beer: "Beer",
  finger_food: "Finger food",
  snacks: "Snacks",
  others: "Others",
};

export type SlotSort = "type" | "slot";

const categoryRank = (category: string | undefined) => {
  const i = CATEGORY_ORDER.indexOf((category ?? "") as (typeof CATEGORY_ORDER)[number]);
  return i === -1 ? CATEGORY_ORDER.length : i;
};

/** The machine has flagged the slot, or we set it aside after a failed vend. */
export const isSlotFaulty = (slot: Pick<VendingSlot, "status" | "stuckAt">) => (!!slot.status && slot.status !== "0") || !!slot.stuckAt;

/** Units the machine can still sell from this slot (0 when flagged or stuck). */
export const slotAvailable = (slot: Pick<VendingSlot, "status" | "quantity" | "reservedCount" | "stuckAt">) =>
  isSlotFaulty(slot) ? 0 : Math.max(0, (slot.quantity ?? 0) - (slot.reservedCount ?? 0));

/**
 * "type": product type, then product name, then slot number — slots with no
 * product go last, by slot number. "slot": plain slot-number order.
 */
export function sortSlots(slots: VendingSlot[], sort: SlotSort): VendingSlot[] {
  const bySlot = (a: VendingSlot, b: VendingSlot) => a.machineId.localeCompare(b.machineId) || a.slotNo - b.slotNo;
  if (sort === "slot") return [...slots].sort(bySlot);
  return [...slots].sort((a, b) => {
    const pa = a.productRef, pb = b.productRef;
    if (!pa && !pb) return bySlot(a, b);
    if (!pa) return 1;
    if (!pb) return -1;
    return categoryRank(pa.category) - categoryRank(pb.category)
      || (a.displayName || pa.name).localeCompare(b.displayName || pb.name)
      || bySlot(a, b);
  });
}

export interface SellableDrink {
  productId: string;
  name: string;
  category: string;
  priceCents: number;
  available: number;
  slots: number[];
}

/** One line per drink on sale (enabled, product assigned), stock added up across its slots. */
export function sellableDrinks(slots: VendingSlot[]): SellableDrink[] {
  const drinks = new Map<string, SellableDrink>();
  for (const s of slots) {
    if (!s.enabled || !s.productRef) continue;
    const cur = drinks.get(s.productRef._id) ?? {
      productId: s.productRef._id,
      name: s.displayName || s.productRef.name,
      category: s.productRef.category,
      priceCents: s.priceCents != null ? s.priceCents : Math.round(s.productRef.sellingPrice * 100),
      available: 0,
      slots: [],
    };
    drinks.set(s.productRef._id, { ...cur, available: cur.available + slotAvailable(s), slots: [...cur.slots, s.slotNo].sort((a, b) => a - b) });
  }
  return [...drinks.values()].sort((a, b) => categoryRank(a.category) - categoryRank(b.category) || a.name.localeCompare(b.name));
}

/** Sellable drinks grouped by type, in menu order. */
export function sellableByCategory(slots: VendingSlot[]): { category: string; label: string; drinks: SellableDrink[] }[] {
  const groups = new Map<string, SellableDrink[]>();
  for (const d of sellableDrinks(slots)) groups.set(d.category, [...(groups.get(d.category) ?? []), d]);
  return [...groups.entries()].map(([category, drinks]) => ({ category, label: CATEGORY_LABELS[category] ?? category, drinks }));
}
