import { getState, setState } from "./store";
import { uid } from "@/utils/idGenerator";
import type { SKU, Batch, Plant, Sloc, Location } from "@/types";

// Plant
export function listPlants() { return getState().plants; }
export function addPlant(input: Omit<Plant, "id" | "createdAt" | "updatedAt">): Plant {
  if (getState().plants.some((p) => p.plantCode === input.plantCode)) throw new Error("Plant Code đã tồn tại");
  const now = new Date().toISOString();
  const plant: Plant = { ...input, id: uid(), createdAt: now, updatedAt: now };
  setState((s) => ({ ...s, plants: [plant, ...s.plants] }));
  return plant;
}
export function deletePlant(id: string) {
  const s = getState();
  const plant = s.plants.find((p) => p.id === id);
  if (!plant) throw new Error("Plant không tồn tại");
  if (s.slocs.some((sloc) => sloc.plantCode === plant.plantCode)) {
    throw new Error("Không thể xoá Plant đang được dùng bởi Sloc");
  }
  if (s.locations.some((location) => location.plantCode === plant.plantCode)) {
    throw new Error("Không thể xoá Plant đang được dùng bởi Bin");
  }
  setState((st) => ({ ...st, plants: st.plants.filter((p) => p.id !== id) }));
}

// Sloc
export function listSlocs() { return getState().slocs; }
export function addSloc(input: Omit<Sloc, "id" | "createdAt" | "updatedAt">): Sloc {
  if (getState().slocs.some((s) => s.slocCode === input.slocCode && s.plantCode === input.plantCode)) {
    throw new Error("Sloc Code đã tồn tại cho Plant này");
  }
  const now = new Date().toISOString();
  const sloc: Sloc = { ...input, id: uid(), createdAt: now, updatedAt: now };
  setState((s) => ({ ...s, slocs: [sloc, ...s.slocs] }));
  return sloc;
}
export function deleteSloc(id: string) {
  const s = getState();
  const sloc = s.slocs.find((x) => x.id === id);
  if (!sloc) throw new Error("Sloc không tồn tại");
  if (s.locations.some((location) => location.plantCode === sloc.plantCode && location.slocCode === sloc.slocCode)) {
    throw new Error("Không thể xoá Sloc đang được dùng bởi Bin");
  }
  setState((st) => ({ ...st, slocs: st.slocs.filter((x) => x.id !== id) }));
}

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
  const locationCode = input.locationCode.trim();
  const locationName = input.locationName?.trim();
  const plantCode = input.plantCode.trim();
  const slocCode = input.slocCode.trim();
  const zone = input.zone.trim();
  const aisle = input.aisle?.trim() || input.block.trim();
  const block = input.block.trim() || aisle || "-";
  const tier = input.tier?.trim();
  if (input.capacityPallet <= 0) throw new Error("Capacity phải > 0");
  if (getState().locations.some((l) => l.locationCode === locationCode)) throw new Error("Location Code đã tồn tại");
  if (!getState().plants.some((p) => p.plantCode === plantCode)) throw new Error("Plant Code không tồn tại");
  if (!getState().slocs.some((s) => s.slocCode === slocCode && s.plantCode === plantCode)) throw new Error("Sloc Code không tồn tại cho Plant này");
  const now = new Date().toISOString();
  const l: Location = {
    ...input,
    locationCode,
    locationName: locationName || undefined,
    plantCode,
    slocCode,
    zone,
    block,
    aisle,
    tier: tier || undefined,
    currentPalletCount: 0,
    id: uid(),
    createdAt: now,
    updatedAt: now,
  };
  setState((s) => ({ ...s, locations: [l, ...s.locations] }));
  return l;
}
export function toggleLocationBlock(id: string) {
  setState((s) => ({
    ...s,
    locations: s.locations.map((l) => l.id === id ? { ...l, status: l.status === "Active" ? "Blocked" : "Active", updatedAt: new Date().toISOString() } : l),
  }));
}
export function deleteLocation(id: string) {
  const s = getState();
  const location = s.locations.find((l) => l.id === id);
  if (!location) throw new Error("Bin không tồn tại");
  if (location.currentPalletCount > 0) throw new Error("Không thể xoá Bin đang có pallet");
  if (s.pallets.some((p) => p.currentLocation === location.locationCode)) {
    throw new Error("Không thể xoá Bin đang được pallet tham chiếu");
  }
  if (s.taskLines.some((line) => line.status === "Open" && (line.toLocation === location.locationCode || line.fromLocation === location.locationCode || line.actualLocation === location.locationCode))) {
    throw new Error("Không thể xoá Bin đang được task sử dụng");
  }
  setState((st) => ({ ...st, locations: st.locations.filter((l) => l.id !== id) }));
}
