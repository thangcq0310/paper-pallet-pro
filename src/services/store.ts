// Central reactive store. Swap with Firestore later by replacing read/write functions.
import { useSyncExternalStore, useRef } from "react";
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

function normalizeTasks(rawTasks: any, pallets: Pallet[]): WarehouseTask[] {
  if (!Array.isArray(rawTasks)) return mockTasks;
  return rawTasks.map((t: any) => {
    const p = pallets.find((x) => x.palletId === t?.palletId);
    return {
      id: String(t?.id ?? Math.random().toString(36).slice(2, 11)),
      taskNo: String(t?.taskNo ?? "TASK-0000"),
      taskType: t?.taskType,
      inboundNo: t?.inboundNo,
      outboundNo: t?.outboundNo,
      palletId: String(t?.palletId ?? ""),
      skuCode: String(t?.skuCode ?? p?.skuCode ?? ""),
      skuName: String(t?.skuName ?? p?.skuName ?? ""),
      batchNo: String(t?.batchNo ?? p?.batchNo ?? ""),
      qty: Number.isFinite(t?.qty) ? t.qty : (p?.qty ?? 0),
      uom: String(t?.uom ?? p?.uom ?? ""),
      weight: Number.isFinite(t?.weight) ? t.weight : (p?.weight ?? 0),
      fromLocation: String(t?.fromLocation ?? p?.currentLocation ?? ""),
      toLocation: String(t?.toLocation ?? ""),
      actualLocation: t?.actualLocation,
      status: t?.status,
      printCount: Number.isFinite(t?.printCount) ? t.printCount : 0,
      printedAt: t?.printedAt,
      printedBy: t?.printedBy,
      priority: t?.priority ?? "Normal",
      assignedTo: t?.assignedTo,
      createdBy: t?.createdBy ?? "demo",
      createdAt: t?.createdAt ?? new Date().toISOString(),
      confirmedAt: t?.confirmedAt,
      confirmedBy: t?.confirmedBy,
      instruction: t?.instruction,
      note: t?.note,
    } as WarehouseTask;
  });
}

function load(): State {
  if (typeof window === "undefined") {
    return { skus: mockSKUs, batches: mockBatches, locations: mockLocations, pallets: mockPallets, movements: mockMovements, tasks: mockTasks, outbounds: mockOutbounds };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<State>;
      const pallets = Array.isArray(parsed.pallets) ? (parsed.pallets as Pallet[]) : mockPallets;
      return {
        skus: Array.isArray(parsed.skus) ? (parsed.skus as SKU[]) : mockSKUs,
        batches: Array.isArray(parsed.batches) ? (parsed.batches as Batch[]) : mockBatches,
        locations: Array.isArray(parsed.locations) ? (parsed.locations as Location[]) : mockLocations,
        pallets,
        movements: Array.isArray(parsed.movements) ? (parsed.movements as Movement[]) : mockMovements,
        tasks: normalizeTasks(parsed.tasks, pallets),
        outbounds: Array.isArray(parsed.outbounds) ? (parsed.outbounds as OutboundDocument[]) : mockOutbounds,
      };
    }
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
  const cached = useRef<T>(undefined as T);
  return useSyncExternalStore(subscribe, () => {
    const next = selector(state);
    if (!Object.is(next, cached.current)) cached.current = next;
    return cached.current;
  }, () => selector(state));
}

export function resetStore() {
  if (typeof window !== "undefined") localStorage.removeItem(STORAGE_KEY);
  state = load();
  listeners.forEach((l) => l());
}
