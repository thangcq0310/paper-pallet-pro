// Central reactive store. Swap with Firestore later by replacing read/write functions.
import { useSyncExternalStore, useRef } from "react";
import type { SKU, Batch, Plant, Sloc, Location, Pallet, Movement, WarehouseTask, WarehouseTaskLine, OutboundDocument, ScanEvent } from "@/types";
import {
  mockSKUs, mockBatches, mockPlants, mockSlocs, mockLocations, mockPallets, mockMovements, mockTasks, mockTaskLines, mockOutbounds,
} from "@/data/mockData";

interface State {
  skus: SKU[];
  batches: Batch[];
  plants: Plant[];
  slocs: Sloc[];
  locations: Location[];
  pallets: Pallet[];
  movements: Movement[];
  tasks: WarehouseTask[];
  taskLines: WarehouseTaskLine[];
  outbounds: OutboundDocument[];
  scanEvents: ScanEvent[];
}

const STORAGE_KEY = "mini-wms-state-v2";

function normalizeLocation(raw: any, index: number): Location {
  const zone = String(raw?.zone ?? "");
  const fallbackPlant = mockPlants[0]?.plantCode ?? "PLANT-HCM";
  const fallbackSloc = zone.startsWith("DRY")
    ? "HCM-DRY"
    : zone.startsWith("FZ") || zone.startsWith("CHL")
      ? "HCM-COLD"
      : "HCM-OPS";
  return {
    id: String(raw?.id ?? `loc-${index}`),
    locationCode: String(raw?.locationCode ?? ""),
    locationName: raw?.locationName ? String(raw.locationName) : undefined,
    plantCode: String(raw?.plantCode ?? fallbackPlant),
    slocCode: String(raw?.slocCode ?? fallbackSloc),
    locationType: raw?.locationType,
    zone,
    block: String(raw?.block ?? "-"),
    aisle: raw?.aisle ? String(raw.aisle) : undefined,
    tier: raw?.tier ? String(raw.tier) : undefined,
    capacityPallet: Number.isFinite(raw?.capacityPallet) ? raw.capacityPallet : 0,
    currentPalletCount: Number.isFinite(raw?.currentPalletCount) ? raw.currentPalletCount : 0,
    status: raw?.status ?? "Active",
    createdAt: raw?.createdAt ?? new Date().toISOString(),
    updatedAt: raw?.updatedAt ?? new Date().toISOString(),
  };
}

function normalizeTasksAndLines(input: {
  rawTasks: any;
  rawTaskLines: any;
  pallets: Pallet[];
}): { tasks: WarehouseTask[]; taskLines: WarehouseTaskLine[] } {
  const { rawTasks, rawTaskLines, pallets } = input;

  // v2+
  if (Array.isArray(rawTasks) && Array.isArray(rawTaskLines)) {
    const tasks: WarehouseTask[] = rawTasks.map((t: any) => ({
      id: String(t?.id ?? Math.random().toString(36).slice(2, 11)),
      taskNo: String(t?.taskNo ?? "TASK-0000"),
      taskType: t?.taskType,
      inboundNo: t?.inboundNo,
      outboundNo: t?.outboundNo,
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
    }));

    const taskLines: WarehouseTaskLine[] = rawTaskLines.map((l: any) => {
      const p = pallets.find((x) => x.palletId === l?.palletId);
      return {
        id: String(l?.id ?? Math.random().toString(36).slice(2, 11)),
        taskId: String(l?.taskId ?? ""),
        taskNo: String(l?.taskNo ?? ""),
        lineNo: Number.isFinite(l?.lineNo) ? l.lineNo : 1,
        palletId: String(l?.palletId ?? ""),
        skuCode: String(l?.skuCode ?? p?.skuCode ?? ""),
        skuName: String(l?.skuName ?? p?.skuName ?? ""),
        batchNo: String(l?.batchNo ?? p?.batchNo ?? ""),
        qty: Number.isFinite(l?.qty) ? l.qty : (p?.qty ?? 0),
        uom: String(l?.uom ?? p?.uom ?? ""),
        weight: Number.isFinite(l?.weight) ? l.weight : (p?.weight ?? 0),
        fromLocation: l?.fromLocation ?? p?.currentLocation ?? null,
        toLocation: l?.toLocation ?? null,
        actualLocation: l?.actualLocation ?? null,
        status: l?.status ?? "Open",
        confirmedAt: l?.confirmedAt,
        confirmedBy: l?.confirmedBy,
        note: l?.note,
      };
    });

    return { tasks, taskLines };
  }

  // v1 fallback (tasks had pallet fields, no lines)
  if (Array.isArray(rawTasks)) {
    const tasks: WarehouseTask[] = rawTasks.map((t: any) => ({
      id: String(t?.id ?? Math.random().toString(36).slice(2, 11)),
      taskNo: String(t?.taskNo ?? "TASK-0000"),
      taskType: t?.taskType,
      inboundNo: t?.inboundNo,
      outboundNo: t?.outboundNo,
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
    }));

    const taskLines: WarehouseTaskLine[] = rawTasks.map((t: any, idx: number) => {
      const p = pallets.find((x) => x.palletId === t?.palletId);
      return {
        id: String(t?.id ? `${t.id}-L1` : `migr-${idx}`),
        taskId: String(t?.id ?? ""),
        taskNo: String(t?.taskNo ?? "TASK-0000"),
        lineNo: 1,
        palletId: String(t?.palletId ?? ""),
        skuCode: String(t?.skuCode ?? p?.skuCode ?? ""),
        skuName: String(t?.skuName ?? p?.skuName ?? ""),
        batchNo: String(t?.batchNo ?? p?.batchNo ?? ""),
        qty: Number.isFinite(t?.qty) ? t.qty : (p?.qty ?? 0),
        uom: String(t?.uom ?? p?.uom ?? ""),
        weight: Number.isFinite(t?.weight) ? t.weight : (p?.weight ?? 0),
        fromLocation: t?.fromLocation ?? p?.currentLocation ?? null,
        toLocation: t?.toLocation ?? null,
        actualLocation: t?.actualLocation ?? null,
        status: t?.status === "Cancelled" ? "Cancelled" : t?.status === "Confirmed" ? "Confirmed" : "Open",
        confirmedAt: t?.confirmedAt,
        confirmedBy: t?.confirmedBy,
        note: t?.note,
      };
    });

    return { tasks, taskLines };
  }

  return { tasks: mockTasks, taskLines: mockTaskLines };
}

function load(): State {
  if (typeof window === "undefined") {
    return { skus: mockSKUs, batches: mockBatches, plants: mockPlants, slocs: mockSlocs, locations: mockLocations, pallets: mockPallets, movements: mockMovements, tasks: mockTasks, taskLines: mockTaskLines, outbounds: mockOutbounds, scanEvents: [] };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<State>;
      const pallets = Array.isArray(parsed.pallets) ? (parsed.pallets as Pallet[]) : mockPallets;
      const { tasks, taskLines } = normalizeTasksAndLines({
        rawTasks: (parsed as any).tasks,
        rawTaskLines: (parsed as any).taskLines,
        pallets,
      });
      const plants = Array.isArray((parsed as any).plants) ? (parsed as Plant[]) : mockPlants;
      const slocs = Array.isArray((parsed as any).slocs) ? (parsed as Sloc[]) : mockSlocs;
      const locations = Array.isArray(parsed.locations)
        ? parsed.locations.map((loc, index) => normalizeLocation(loc, index))
        : mockLocations;
      return {
        skus: Array.isArray(parsed.skus) ? (parsed.skus as SKU[]) : mockSKUs,
        batches: Array.isArray(parsed.batches) ? (parsed.batches as Batch[]) : mockBatches,
        plants,
        slocs,
        locations,
        pallets,
        movements: Array.isArray(parsed.movements) ? (parsed.movements as Movement[]) : mockMovements,
        tasks,
        taskLines,
        outbounds: Array.isArray(parsed.outbounds) ? (parsed.outbounds as OutboundDocument[]) : mockOutbounds,
        scanEvents: Array.isArray((parsed as any).scanEvents) ? (parsed as ScanEvent[]) : [],
      };
    }
  } catch {}
  return { skus: mockSKUs, batches: mockBatches, plants: mockPlants, slocs: mockSlocs, locations: mockLocations, pallets: mockPallets, movements: mockMovements, tasks: mockTasks, taskLines: mockTaskLines, outbounds: mockOutbounds, scanEvents: [] };
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
