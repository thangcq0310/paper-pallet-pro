import { getState } from "./store";
import type { Pallet } from "@/types";

export type TaskPurpose = "MOVE" | "PICK";
export interface AvailableBatchSummary {
  batchNo: string;
  palletCount: number;
  totalQty: number;
  uom: string;
  nearestExpDate: string;
  locationCount: number;
  locations: string[];
  earliestCreatedAt: string;
  isFefoFirst: boolean;
}

export interface AutoSelectedPalletsResult {
  palletIds: string[];
  selectedQty: number;
  requiredQty: number;
  overQty: number;
  underQty: number;
}

function toTs(v?: string | null) {
  if (!v) return Number.MAX_SAFE_INTEGER;
  const ts = new Date(v).getTime();
  return Number.isFinite(ts) ? ts : Number.MAX_SAFE_INTEGER;
}

function getEligiblePalletsByPurpose(input: {
  skuCode: string;
  purpose: TaskPurpose;
}): Pallet[] {
  const skuCode = input.skuCode.trim();
  if (!skuCode) return [];
  const s = getState();

  return s.pallets.filter((p) => {
    if (p.skuCode !== skuCode) return false;
    if (!p.batchNo?.trim()) return false;
    if (!p.currentLocation) return false;
    if (p.status === "Cancelled" || p.status === "Shipped" || p.status === "Pending Putaway") return false;
    if (p.status !== "In Stock" && p.status !== "Staged") return false;
    if (hasOpenTaskLineForPallet(p.palletId)) return false;

    const loc = s.locations.find((l) => l.locationCode === p.currentLocation);
    if (!loc) return false;
    if (loc.locationType !== "STORAGE") return false;
    return true;
  });
}

export function hasOpenTaskLineForPallet(palletId: string) {
  const s = getState();
  const openHeaderIds = new Set(
    s.tasks
      .filter((t) => t.status === "Open" || t.status === "Printed" || t.status === "Partially Confirmed")
      .map((t) => t.id),
  );
  return s.taskLines.some((l) => l.palletId === palletId && l.status === "Open" && openHeaderIds.has(l.taskId));
}

export function listAvailablePalletsBySkuBatch(input: {
  skuCode: string;
  batchNo: string;
  purpose: TaskPurpose;
}): Pallet[] {
  const skuCode = input.skuCode.trim();
  const batchNo = input.batchNo.trim();
  if (!skuCode) return [];
  if (!batchNo) return [];

  const candidates = getEligiblePalletsByPurpose({ skuCode, purpose: input.purpose }).filter((p) => p.batchNo === batchNo);

  if (input.purpose === "PICK") {
    return [...candidates].sort((a, b) => {
      const ea = toTs(a.expDate);
      const eb = toTs(b.expDate);
      if (ea !== eb) return ea - eb;
      return toTs(a.createdAt) - toTs(b.createdAt);
    });
  }

  return candidates.sort((a, b) => a.palletId.localeCompare(b.palletId));
}

export function getAvailableBatchSummaryBySku(input: {
  skuCode: string;
  purpose: TaskPurpose;
}): AvailableBatchSummary[] {
  const pallets = getEligiblePalletsByPurpose(input);
  if (!pallets.length) return [];

  const fefoTs = pallets.reduce((min, p) => Math.min(min, toTs(p.expDate)), Number.MAX_SAFE_INTEGER);
  const map = new Map<string, AvailableBatchSummary>();

  for (const p of pallets) {
    const key = p.batchNo;
    const row = map.get(key);
    const expTs = toTs(p.expDate);
    const createdTs = toTs(p.createdAt);

    if (!row) {
      map.set(key, {
        batchNo: p.batchNo,
        palletCount: 1,
        totalQty: p.qty,
        uom: p.uom,
        nearestExpDate: p.expDate ?? "",
        locationCount: p.currentLocation ? 1 : 0,
        locations: p.currentLocation ? [p.currentLocation] : [],
        earliestCreatedAt: p.createdAt,
        isFefoFirst: expTs === fefoTs,
      });
      continue;
    }

    row.palletCount += 1;
    row.totalQty += p.qty;
    if (!row.uom && p.uom) row.uom = p.uom;
    if (expTs < toTs(row.nearestExpDate)) row.nearestExpDate = p.expDate ?? "";
    if (createdTs < toTs(row.earliestCreatedAt)) row.earliestCreatedAt = p.createdAt;
    if (p.currentLocation && !row.locations.includes(p.currentLocation)) {
      row.locations.push(p.currentLocation);
      row.locationCount = row.locations.length;
    }
  }

  const rows = Array.from(map.values());
  for (const r of rows) {
    r.locations.sort((a, b) => a.localeCompare(b));
    r.locationCount = r.locations.length;
  }

  if (input.purpose === "PICK") {
    return rows.sort((a, b) => {
      const expDiff = toTs(a.nearestExpDate) - toTs(b.nearestExpDate);
      if (expDiff !== 0) return expDiff;
      return toTs(a.earliestCreatedAt) - toTs(b.earliestCreatedAt);
    });
  }

  return rows.sort((a, b) => a.batchNo.localeCompare(b.batchNo));
}

export function autoSelectPalletsByQty(input: {
  skuCode: string;
  batchNo: string;
  requiredQty: number;
  purpose: "PICK";
}): AutoSelectedPalletsResult {
  const requiredQty = Number(input.requiredQty);
  if (!Number.isFinite(requiredQty) || requiredQty <= 0) {
    throw new Error("Required Qty phải > 0");
  }

  const pallets = listAvailablePalletsBySkuBatch({
    skuCode: input.skuCode,
    batchNo: input.batchNo,
    purpose: input.purpose,
  });

  const palletIds: string[] = [];
  let selectedQty = 0;
  for (const p of pallets) {
    if (selectedQty >= requiredQty) break;
    palletIds.push(p.palletId);
    selectedQty += p.qty;
  }

  return {
    palletIds,
    selectedQty,
    requiredQty,
    overQty: Math.max(0, selectedQty - requiredQty),
    underQty: Math.max(0, requiredQty - selectedQty),
  };
}
