import { getState } from "./store";
import type { Location, Pallet, SKU, WarehouseTask } from "@/types";
import { cancelPallet, createPallets } from "./palletService";
import { createTask } from "./taskService";

export interface PutawayAssignment {
  palletId: string;
  targetLocation: string;
}

export interface PalletPreviewRow {
  rowId: string;
  rowNo: number;
  qty: number;
  weight: number;
  type: "Full" | "Partial" | "Manual";
}

export function calculatePalletPreview(input: {
  totalQty: number;
  qtyPerPallet: number;
  weightPerPallet: number;
}): PalletPreviewRow[] {
  const totalQty = Number(input.totalQty);
  const qtyPerPallet = Number(input.qtyPerPallet);
  const weightPerPallet = Number(input.weightPerPallet);

  if (!Number.isFinite(totalQty) || totalQty <= 0) throw new Error("Total Qty phải > 0");
  if (!Number.isFinite(qtyPerPallet) || qtyPerPallet <= 0) throw new Error("Qty per Pallet phải > 0");
  if (!Number.isFinite(weightPerPallet) || weightPerPallet < 0) throw new Error("Weight per Pallet không hợp lệ");

  const fullCount = Math.floor(totalQty / qtyPerPallet);
  const partialQty = totalQty - fullCount * qtyPerPallet;

  const rows: PalletPreviewRow[] = [];
  let rowNo = 1;

  for (let i = 0; i < fullCount; i++) {
    rows.push({
      rowId: `auto-full-${Date.now()}-${i}`,
      rowNo: rowNo++,
      qty: qtyPerPallet,
      weight: weightPerPallet,
      type: "Full",
    });
  }

  if (partialQty > 0) {
    rows.push({
      rowId: `auto-partial-${Date.now()}`,
      rowNo: rowNo++,
      qty: partialQty,
      weight: qtyPerPallet > 0 ? (partialQty / qtyPerPallet) * weightPerPallet : 0,
      type: "Partial",
    });
  }

  return rows;
}

function getSkuOrThrow(skuCode: string): SKU {
  const sku = getState().skus.find((s) => s.skuCode === skuCode);
  if (!sku) throw new Error("SKU không tồn tại");
  return sku;
}

export function generatePalletIdsFromPreview(input: {
  inboundNo: string;
  skuCode: string;
  batchNo: string;
  receivingLocation: string;
  uom: string;
  mfgDate: string;
  expDate: string;
  note?: string;
  rows: Array<Pick<PalletPreviewRow, "qty" | "weight">>;
}): Pallet[] {
  const inboundNo = input.inboundNo.trim();
  if (!inboundNo) throw new Error("Nhập inboundNo");
  if (!input.skuCode) throw new Error("Chọn SKU");
  if (!input.batchNo) throw new Error("Chọn Batch");
  if (!input.receivingLocation) throw new Error("Chọn Receiving Location");
  if (!input.uom) throw new Error("Nhập UOM");
  if (!input.mfgDate) throw new Error("Nhập MFG Date");
  if (!input.expDate) throw new Error("Nhập EXP Date");
  if (!input.rows?.length) throw new Error("Chưa có pallet preview");

  getSkuOrThrow(input.skuCode);

  const inputs = input.rows.map((r) => {
    if (!Number.isFinite(r.qty) || r.qty <= 0) throw new Error("Qty pallet phải > 0");
    if (!Number.isFinite(r.weight) || r.weight < 0) throw new Error("Weight pallet không hợp lệ");
    return {
      referenceDocumentNo: inboundNo,
      receivingLocation: input.receivingLocation,
      skuCode: input.skuCode,
      batchNo: input.batchNo,
      qty: r.qty,
      uom: input.uom,
      weight: r.weight,
      mfgDate: input.mfgDate,
      expDate: input.expDate,
      note: input.note,
    };
  });

  return createPallets(inputs);
}

export function cancelUnusedPallet(palletId: string, reason: string) {
  return cancelPallet(palletId, reason);
}

export function getTargetBinCapacity(locationCode: string): {
  location: Location;
  openPutawayTaskCount: number;
  availableCapacity: number;
} {
  const code = locationCode.trim();
  const s = getState();
  const location = s.locations.find((l) => l.locationCode === code);
  if (!location) throw new Error("Location không tồn tại");
  if (location.locationType !== "STORAGE") throw new Error("Target Bin phải thuộc STORAGE");
  if (location.status !== "Active") throw new Error("Target Bin đang Blocked");

  const openPutawayTaskCount = s.tasks.filter(
    (t) =>
      t.taskType === "PUTAWAY" &&
      t.toLocation === code &&
      (t.status === "Open" || t.status === "Printed" || t.status === "In Progress"),
  ).length;

  const availableCapacity =
    Math.max(0, location.capacityPallet - location.currentPalletCount - openPutawayTaskCount);

  return { location, openPutawayTaskCount, availableCapacity };
}

export function getMultiTargetBinCapacity(locationCodes: string[]) {
  const codes = Array.from(new Set(locationCodes.map((c) => c.trim()).filter(Boolean)));
  return codes.map((c) => ({
    locationCode: c,
    ...getTargetBinCapacity(c),
  }));
}

export function autoAllocatePalletsToBins(input: { palletIds: string[]; targetLocations: string[] }): PutawayAssignment[] {
  const palletIds = input.palletIds.map((p) => p.trim()).filter(Boolean);
  if (palletIds.length === 0) throw new Error("Chọn pallet để allocate");
  const targetLocations = input.targetLocations.map((l) => l.trim()).filter(Boolean);
  if (targetLocations.length === 0) throw new Error("Chọn Target Bin");

  const caps = getMultiTargetBinCapacity(targetLocations);
  const remainingByLoc = new Map<string, number>(caps.map((c) => [c.location.locationCode, c.availableCapacity]));
  const totalAvailable = caps.reduce((s, c) => s + c.availableCapacity, 0);
  if (totalAvailable < palletIds.length) throw new Error("Tổng available capacity không đủ để allocate");

  const assignments: PutawayAssignment[] = [];
  let binIndex = 0;

  for (const palletId of palletIds) {
    while (binIndex < targetLocations.length) {
      const loc = targetLocations[binIndex];
      const remain = remainingByLoc.get(loc) ?? 0;
      if (remain > 0) {
        assignments.push({ palletId, targetLocation: loc });
        remainingByLoc.set(loc, remain - 1);
        break;
      }
      binIndex++;
    }
    if (assignments.length === 0 || assignments[assignments.length - 1].palletId !== palletId) {
      throw new Error("Allocate thất bại do thiếu capacity");
    }
  }
  return assignments;
}

function validatePutawayAssignments(input: { inboundNo?: string; assignments: PutawayAssignment[] }) {
  const inboundNo = input.inboundNo?.trim() ?? "";
  const assignments = input.assignments;
  if (!assignments?.length) throw new Error("Chưa có allocation hợp lệ");

  const s = getState();
  const palletIdSet = new Set<string>();
  const assignCountByLoc = new Map<string, number>();

  for (const a of assignments) {
    const palletId = a.palletId.trim();
    const targetLocation = a.targetLocation.trim();
    if (!palletId) throw new Error("Assignment palletId không hợp lệ");
    if (!targetLocation) throw new Error("Assignment targetLocation không hợp lệ");
    if (palletIdSet.has(palletId)) throw new Error(`Pallet ${palletId} bị assign trùng`);
    palletIdSet.add(palletId);

    const p = s.pallets.find((x) => x.palletId === palletId);
    if (!p) throw new Error(`Pallet ${palletId} không tồn tại`);
    if (p.status === "Cancelled") throw new Error(`Pallet ${palletId} đã Cancelled`);
    if (p.status !== "Pending Putaway") throw new Error(`Pallet ${palletId} không ở trạng thái Pending Putaway`);

    if (!p.currentLocation) throw new Error(`Pallet ${palletId} chưa có currentLocation`);
    const fromLoc = s.locations.find((l) => l.locationCode === p.currentLocation);
    if (!fromLoc) throw new Error(`Location ${p.currentLocation} không tồn tại`);
    if (fromLoc.locationType !== "RECEIVING") throw new Error(`Pallet ${palletId} không nằm ở RECEIVING`);

    const openTask = s.tasks.some(
      (t) =>
        t.palletId === palletId &&
        (t.status === "Open" || t.status === "Printed" || t.status === "In Progress"),
    );
    if (openTask) throw new Error(`Pallet ${palletId} đang có task mở`);

    if (inboundNo && (p.referenceDocumentNo ?? "").trim() !== inboundNo) {
      throw new Error(`Pallet ${palletId} không thuộc inboundNo ${inboundNo}`);
    }

    const target = s.locations.find((l) => l.locationCode === targetLocation);
    if (!target) throw new Error(`Target Bin ${targetLocation} không tồn tại`);
    if (target.locationType !== "STORAGE") throw new Error(`Target Bin ${targetLocation} không phải STORAGE`);
    if (target.status !== "Active") throw new Error(`Target Bin ${targetLocation} đang Blocked`);

    assignCountByLoc.set(targetLocation, (assignCountByLoc.get(targetLocation) ?? 0) + 1);
  }

  // capacity check per bin
  const caps = getMultiTargetBinCapacity(Array.from(assignCountByLoc.keys()));
  for (const cap of caps) {
    const assigned = assignCountByLoc.get(cap.location.locationCode) ?? 0;
    if (assigned > cap.availableCapacity) {
      throw new Error(`Bin ${cap.location.locationCode} không đủ capacity (assigned ${assigned} > available ${cap.availableCapacity})`);
    }
  }

  return {
    inboundNo,
    assignCountByLoc,
  };
}

export function createPutawayTasksFromAssignments(input: {
  inboundNo?: string;
  assignments: PutawayAssignment[];
}): WarehouseTask[] {
  const { inboundNo } = validatePutawayAssignments(input);

  // create tasks only after all validation passes
  const tasks: WarehouseTask[] = [];
  for (const a of input.assignments) {
    const t = createTask({
      taskType: "PUTAWAY",
      palletId: a.palletId,
      toLocation: a.targetLocation,
      inboundNo: inboundNo || undefined,
      instruction: "Đưa pallet từ RECEIVING vào location chỉ định.",
      note: inboundNo ? `Inbound ${inboundNo}` : undefined,
    });
    tasks.push(t);
  }
  return tasks;
}

export function createBulkPutawayTasks(input: {
  inboundNo: string;
  palletIds: string[];
  targetLocation: string;
}): WarehouseTask[] {
  const inboundNo = input.inboundNo.trim();
  if (!inboundNo) throw new Error("Nhập inboundNo");
  const targetLocation = input.targetLocation.trim();
  if (!targetLocation) throw new Error("Chọn Target Bin");
  const palletIds = Array.from(new Set(input.palletIds.map((p) => p.trim()).filter(Boolean)));
  if (palletIds.length === 0) throw new Error("Chọn pallet để tạo PUTAWAY task");

  const { availableCapacity } = getTargetBinCapacity(targetLocation);
  if (palletIds.length > availableCapacity) {
    throw new Error("Bin không đủ capacity để tạo PUTAWAY task");
  }

  const s = getState();
  for (const palletId of palletIds) {
    const p = s.pallets.find((x) => x.palletId === palletId);
    if (!p) throw new Error(`Pallet ${palletId} không tồn tại`);
    if (p.status === "Cancelled") throw new Error(`Pallet ${palletId} đã Cancelled`);
    if (p.status !== "Pending Putaway") throw new Error(`Pallet ${palletId} không ở trạng thái Pending Putaway`);
  }

  const tasks: WarehouseTask[] = [];
  for (const palletId of palletIds) {
    const t = createTask({
      taskType: "PUTAWAY",
      palletId,
      toLocation: targetLocation,
      inboundNo,
      instruction: "Đưa pallet từ RECEIVING vào location chỉ định.",
      note: `Inbound ${inboundNo}`,
    });
    tasks.push(t);
  }
  return tasks;
}

// Printing helpers (UI should open these URLs; task printCount is only recorded in print preview pages)
export function buildPalletLabelsPrintUrl(palletIds: string[]) {
  const cleaned = Array.from(new Set(palletIds.map((x) => x.trim()).filter(Boolean)));
  const ids = encodeURIComponent(cleaned.join(","));
  return `/pallet/print-batch?ids=${ids}`;
}

export function buildTaskPrintUrl(taskNo: string) {
  return `/tasks/${encodeURIComponent(taskNo)}/print`;
}
