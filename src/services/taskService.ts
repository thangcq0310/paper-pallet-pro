import { getState, setState } from "./store";
import { generateTaskNo, uid } from "@/utils/idGenerator";
import type { Pallet, TaskPriority, TaskType, WarehouseTask } from "@/types";
import { movePallet, pickAndShipPallet, putawayPallet } from "./palletService";
import { syncOutboundStatusByNo } from "./outboundService";

const CURRENT_USER = "demo";

function getPalletOrThrow(palletId: string): Pallet {
  const p = getState().pallets.find((x) => x.palletId === palletId);
  if (!p) throw new Error("Pallet không tồn tại");
  return p;
}

function validateLocationExistsActiveNotFull(locationCode: string) {
  const code = locationCode.trim();
  const loc = getState().locations.find((l) => l.locationCode === code);
  if (!loc) throw new Error("Location không tồn tại");
  if (loc.status !== "Active") throw new Error("Location đang Blocked");
  if (loc.currentPalletCount >= loc.capacityPallet) throw new Error("Location đã đầy");
  return loc;
}

function validatePutawayDestination(locationCode: string) {
  const code = locationCode.trim();
  if (!code) throw new Error("Chọn Target Location");
  const loc = validateLocationExistsActiveNotFull(code);
  if (loc.locationType !== "STORAGE") {
    throw new Error("Location putaway phải thuộc loại STORAGE");
  }
  return code;
}

function validateMoveDestination(fromLocation: string, locationCode: string) {
  const code = locationCode.trim();
  if (!code) throw new Error("Chọn Target Location");
  if (code === fromLocation) throw new Error("Đã ở location này rồi");
  const loc = validateLocationExistsActiveNotFull(code);
  if (loc.locationType === "RECEIVING" || loc.locationType === "DOCK") {
    throw new Error("Không được MOVE tới RECEIVING hoặc DOCK");
  }
  return code;
}

export function listTasks() {
  return getState().tasks;
}

export function getTaskByNo(taskNo: string) {
  return getState().tasks.find((t) => t.taskNo === taskNo);
}

export function createTask(input: {
  taskType: TaskType;
  palletId: string;
  toLocation?: string;
  priority?: TaskPriority;
  inboundNo?: string;
  outboundNo?: string;
  instruction?: string;
  note?: string;
}): WarehouseTask {
  const p = getPalletOrThrow(input.palletId);
  if (["PUTAWAY", "MOVE", "PICK"].includes(input.taskType)) {
    const hasOpen = getState().tasks.some(
      (t) =>
        t.palletId === p.palletId &&
        (t.status === "Open" || t.status === "Printed" || t.status === "In Progress"),
    );
    if (hasOpen) throw new Error("Pallet đang có task mở");
  }
  const now = new Date().toISOString();
  const taskNo = generateTaskNo(getState().tasks.map((t) => t.taskNo));

  const fromLocation = p.currentLocation;
  let toLocation = (input.toLocation ?? "").trim();
  let instruction = input.instruction?.trim();

  if (input.taskType === "PUTAWAY") {
    toLocation = validatePutawayDestination(toLocation);
    instruction ||= "Đưa pallet từ RECEIVING vào location chỉ định.";
  } else if (input.taskType === "MOVE") {
    toLocation = validateMoveDestination(fromLocation, toLocation);
    instruction ||= "Chuyển pallet từ location cũ sang location mới.";
  } else if (input.taskType === "PICK") {
    if (p.status !== "In Stock" && p.status !== "Staged") {
      throw new Error("Chỉ tạo PICK task cho pallet đang In Stock hoặc Staged");
    }
    toLocation = "";
    instruction ||= "Lấy pallet từ location hiện tại và load/xuất luôn. Sau khi confirm, pallet được xem là Shipped.";
  }

  const task: WarehouseTask = {
    id: uid(),
    taskNo,
    taskType: input.taskType,
    inboundNo: input.inboundNo,
    outboundNo: input.outboundNo,
    palletId: p.palletId,
    skuCode: p.skuCode,
    skuName: p.skuName,
    batchNo: p.batchNo,
    qty: p.qty,
    uom: p.uom,
    weight: p.weight,
    fromLocation,
    toLocation,
    status: "Open",
    printCount: 0,
    priority: input.priority ?? "Normal",
    createdBy: CURRENT_USER,
    createdAt: now,
    instruction,
    note: input.note,
  };

  setState((s) => ({ ...s, tasks: [task, ...s.tasks] }));
  return task;
}

export function printTask(taskId: string) {
  const t = getState().tasks.find((x) => x.id === taskId);
  if (!t) throw new Error("Task không tồn tại");
  if (t.status === "Cancelled") throw new Error("Task đã Cancelled");
  if (t.status === "Confirmed") throw new Error("Task đã Confirmed");

  const now = new Date().toISOString();
  setState((s) => ({
    ...s,
    tasks: s.tasks.map((x) =>
      x.id === taskId
        ? {
          ...x,
          status: x.status === "Open" ? "Printed" : x.status,
          printCount: x.printCount + 1,
          printedAt: now,
          printedBy: CURRENT_USER,
        }
        : x,
    ),
  }));
}

export function confirmTask(taskId: string, actualLocation?: string) {
  const t = getState().tasks.find((x) => x.id === taskId);
  if (!t) throw new Error("Task không tồn tại");
  if (t.status === "Cancelled") throw new Error("Task đã Cancelled");
  if (t.status === "Confirmed") throw new Error("Task đã Confirmed");
  if (t.status !== "Printed") throw new Error("Task chưa Printed");

  const dest = (actualLocation ?? t.toLocation).trim();

  if (t.taskType === "PUTAWAY") {
    const validated = validatePutawayDestination(dest);
    putawayPallet(t.palletId, validated, t.note);
  } else if (t.taskType === "MOVE") {
    const validated = validateMoveDestination(t.fromLocation, dest);
    movePallet(t.palletId, validated, t.note);
  } else if (t.taskType === "PICK") {
    pickAndShipPallet(t.palletId, t.note);
  } else {
    throw new Error(`TaskType ${t.taskType} chưa hỗ trợ confirm`);
  }

  const now = new Date().toISOString();
  setState((s) => ({
    ...s,
    tasks: s.tasks.map((x) =>
      x.id === taskId
        ? {
          ...x,
          status: "Confirmed",
          actualLocation: x.taskType === "PICK" ? "" : dest,
          toLocation: x.taskType === "PICK" ? "" : dest,
          confirmedAt: now,
          confirmedBy: CURRENT_USER,
        }
        : x,
    ),
  }));

  if (t.outboundNo) syncOutboundStatusByNo(t.outboundNo);
}

export function cancelTask(taskId: string) {
  const t = getState().tasks.find((x) => x.id === taskId);
  if (!t) throw new Error("Task không tồn tại");
  if (t.status === "Cancelled") throw new Error("Task đã Cancelled");
  if (t.status === "Confirmed") throw new Error("Task đã Confirmed");
  setState((s) => ({ ...s, tasks: s.tasks.map((x) => x.id === taskId ? { ...x, status: "Cancelled" } : x) }));
  if (t.outboundNo) syncOutboundStatusByNo(t.outboundNo);
}
