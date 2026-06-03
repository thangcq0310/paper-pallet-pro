import type { Location } from "@/types";

type LocationLike = Pick<Location, "locationCode" | "plantCode" | "slocCode" | "zone" | "block" | "aisle" | "tier">;

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

  const plant = normalizePart(location.plantCode);
  const sloc = normalizePart(location.slocCode);
  const zone = normalizePart(location.zone) || normalizePart(location.locationCode) || "—";
  const aisle = normalizePart(location.aisle) || normalizePart(location.block);
  const tier = formatTier(location.tier);

  const parts = [plant, sloc, zone].filter((part) => part && part !== "-");
  if (!aisle || aisle === "-") return parts.length ? parts.join(" > ") : zone;

  const pathParts = [...parts, aisle];
  if (tier) pathParts.push(tier);
  return pathParts.join(" > ");
}
