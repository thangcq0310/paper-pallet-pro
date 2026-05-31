import { getState } from "./store";
import { getOpenTaskLineCountToLocation } from "./taskService";
import type { TaskType } from "@/types";

export interface BinCapacityRow {
  locationCode: string;
  capacityPallet: number;
  currentPalletCount: number;
  openTaskLineCount: number;
  availableCapacity: number;
}

export function getMultiTargetBinCapacityByTaskType(input: {
  locationCodes: string[];
  taskType: Extract<TaskType, "PUTAWAY" | "MOVE">;
}): BinCapacityRow[] {
  const s = getState();
  const uniqueCodes = Array.from(new Set(input.locationCodes.map((x) => x.trim()).filter(Boolean)));

  return uniqueCodes.map((locationCode) => {
    const location = s.locations.find((l) => l.locationCode === locationCode);
    if (!location) throw new Error(`Location ${locationCode} không tồn tại`);
    if (location.locationType !== "STORAGE") throw new Error(`Location ${locationCode} không phải STORAGE`);
    if (location.status !== "Active") throw new Error(`Location ${locationCode} đang Blocked`);
    const openTaskLineCount = getOpenTaskLineCountToLocation({ locationCode, taskType: input.taskType });
    const availableCapacity = Math.max(0, location.capacityPallet - location.currentPalletCount - openTaskLineCount);
    return {
      locationCode,
      capacityPallet: location.capacityPallet,
      currentPalletCount: location.currentPalletCount,
      openTaskLineCount,
      availableCapacity,
    };
  });
}

export function autoAllocatePalletsToBins(input: {
  palletIds: string[];
  targetLocations: string[];
  taskType: Extract<TaskType, "PUTAWAY" | "MOVE">;
}) {
  const palletIds = input.palletIds.map((x) => x.trim()).filter(Boolean);
  if (!palletIds.length) throw new Error("Chọn pallet để allocate");
  const targetLocations = input.targetLocations.map((x) => x.trim()).filter(Boolean);
  if (!targetLocations.length) throw new Error("Chọn target bin");

  const caps = getMultiTargetBinCapacityByTaskType({ locationCodes: targetLocations, taskType: input.taskType });
  const remaining = new Map(caps.map((c) => [c.locationCode, c.availableCapacity]));
  const totalAvailable = caps.reduce((sum, c) => sum + c.availableCapacity, 0);
  if (totalAvailable < palletIds.length) {
    throw new Error(`Tổng capacity không đủ (available ${totalAvailable}, cần ${palletIds.length})`);
  }

  const assignments: Array<{ palletId: string; targetLocation: string }> = [];
  let binIndex = 0;

  for (const palletId of palletIds) {
    while (binIndex < targetLocations.length) {
      const locationCode = targetLocations[binIndex];
      const remain = remaining.get(locationCode) ?? 0;
      if (remain > 0) {
        assignments.push({ palletId, targetLocation: locationCode });
        remaining.set(locationCode, remain - 1);
        break;
      }
      binIndex += 1;
    }
    if (assignments[assignments.length - 1]?.palletId !== palletId) {
      throw new Error("Allocate thất bại do thiếu capacity");
    }
  }

  return assignments;
}

