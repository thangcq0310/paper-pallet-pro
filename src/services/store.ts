// Central reactive store. Swap with Firestore later by replacing read/write functions.
import { useSyncExternalStore } from "react";
import type { SKU, Batch, Location, Pallet, Movement, WarehouseTask, OutboundDocument } from "@/types";
import {
  mockSKUs, mockBatches, mockLocations, mockPallets, mockMovements, mockTasks, mockOutbounds,
} from "@/data/mockData";

interface State {
  skus: SKU[];
  batches: Batch[];
  locations: Location[];
  pallets: Pallet[];
  movements: Movement[];
  tasks: WarehouseTask[];
  outbounds: OutboundDocument[];
}

const STORAGE_KEY = "mini-wms-state-v1";

function load(): State {
  if (typeof window === "undefined") {
    return { skus: mockSKUs, batches: mockBatches, locations: mockLocations, pallets: mockPallets, movements: mockMovements, tasks: mockTasks, outbounds: mockOutbounds };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as State;
  } catch {}
  return { skus: mockSKUs, batches: mockBatches, locations: mockLocations, pallets: mockPallets, movements: mockMovements, tasks: mockTasks, outbounds: mockOutbounds };
}

let state: State = load();
const listeners = new Set<() => void>();

function persist() {
  if (typeof window !== "undefined") {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
  }
}

export function getState(): State { return state; }
export function setState(updater: (s: State) => State) {
  state = updater(state);
  persist();
  listeners.forEach((l) => l());
}
export function subscribe(l: () => void) { listeners.add(l); return () => listeners.delete(l); }

export function useStore<T>(selector: (s: State) => T): T {
  return useSyncExternalStore(subscribe, () => selector(state), () => selector(state));
}

export function resetStore() {
  if (typeof window !== "undefined") localStorage.removeItem(STORAGE_KEY);
  state = load();
  listeners.forEach((l) => l());
}
