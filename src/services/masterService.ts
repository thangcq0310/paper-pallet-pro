import { getState, setState } from "./store";
import { uid } from "@/utils/idGenerator";
import type { SKU, Batch, Location } from "@/types";

// SKU
export function listSKUs() { return getState().skus; }
export function addSKU(input: Omit<SKU, "id" | "createdAt" | "updatedAt">): SKU {
  if (getState().skus.some((s) => s.skuCode === input.skuCode)) throw new Error("SKU Code đã tồn tại");
  const now = new Date().toISOString();
  const sku: SKU = { ...input, id: uid(), createdAt: now, updatedAt: now };
  setState((s) => ({ ...s, skus: [sku, ...s.skus] }));
  return sku;
}
export function updateSKU(id: string, patch: Partial<SKU>) {
  setState((s) => ({ ...s, skus: s.skus.map((x) => x.id === id ? { ...x, ...patch, updatedAt: new Date().toISOString() } : x) }));
}

// Batch
export function listBatches() { return getState().batches; }
export function addBatch(input: Omit<Batch, "id" | "createdAt" | "updatedAt">): Batch {
  if (getState().batches.some((b) => b.batchNo === input.batchNo && b.skuCode === input.skuCode)) throw new Error("Batch No đã tồn tại cho SKU này");
  const now = new Date().toISOString();
  const b: Batch = { ...input, id: uid(), createdAt: now, updatedAt: now };
  setState((s) => ({ ...s, batches: [b, ...s.batches] }));
  return b;
}

// Location
export function listLocations() { return getState().locations; }
export function addLocation(input: Omit<Location, "id" | "createdAt" | "updatedAt" | "currentPalletCount">): Location {
  if (input.capacityPallet <= 0) throw new Error("Capacity phải > 0");
  if (getState().locations.some((l) => l.locationCode === input.locationCode)) throw new Error("Location Code đã tồn tại");
  const now = new Date().toISOString();
  const l: Location = { ...input, currentPalletCount: 0, id: uid(), createdAt: now, updatedAt: now };
  setState((s) => ({ ...s, locations: [l, ...s.locations] }));
  return l;
}
export function toggleLocationBlock(id: string) {
  setState((s) => ({
    ...s,
    locations: s.locations.map((l) => l.id === id ? { ...l, status: l.status === "Active" ? "Blocked" : "Active", updatedAt: new Date().toISOString() } : l),
  }));
}
