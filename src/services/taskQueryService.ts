import { getState } from "./store";
import type { Pallet } from "@/types";

export type TaskPurpose = "MOVE" | "PICK";

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

  const s = getState();

  const candidates = s.pallets.filter((p) => {
    if (p.skuCode !== skuCode) return false;
    if (p.batchNo !== batchNo) return false;
    if (!p.currentLocation) return false;
    if (p.status === "Cancelled" || p.status === "Shipped" || p.status === "Pending Putaway") return false;
    if (hasOpenTaskLineForPallet(p.palletId)) return false;

    const loc = s.locations.find((l) => l.locationCode === p.currentLocation);
    if (!loc) return false;
    if (loc.locationType !== "STORAGE") return false;

    if (input.purpose === "MOVE") {
      return p.status === "In Stock" || p.status === "Staged";
    }

    if (input.purpose === "PICK") {
      return p.status === "In Stock" || p.status === "Staged";
    }

    return false;
  });

  if (input.purpose === "PICK") {
    return [...candidates].sort((a, b) => {
      const ea = a.expDate ? new Date(a.expDate).getTime() : Number.MAX_SAFE_INTEGER;
      const eb = b.expDate ? new Date(b.expDate).getTime() : Number.MAX_SAFE_INTEGER;
      if (ea !== eb) return ea - eb;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
  }

  return candidates.sort((a, b) => a.palletId.localeCompare(b.palletId));
}

