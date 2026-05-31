import type { Location } from "@/types";

type LocationLike = Pick<Location, "locationCode" | "zone" | "block" | "aisle" | "tier">;

function normalizePart(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : "";
}

function formatTier(value?: string | null) {
  const tier = normalizePart(value);
  if (!tier || tier === "-") return "";
  return tier.toUpperCase().startsWith("T") ? tier : `T${tier}`;
}

export function formatLocationPath(location?: LocationLike | null) {
  if (!location) return "—";

  const zone = normalizePart(location.zone) || normalizePart(location.locationCode) || "—";
  const aisle = normalizePart(location.aisle) || normalizePart(location.block);
  const tier = formatTier(location.tier);

  if (!aisle || aisle === "-") return zone;

  const parts = [zone, aisle];
  if (tier) parts.push(tier);
  return parts.join(" > ");
}

