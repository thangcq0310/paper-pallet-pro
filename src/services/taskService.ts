import { getState, setState } from "./store";
import { generateTaskNo, uid } from "@/utils/idGenerator";
import type { Pallet, TaskPriority, TaskType, WarehouseTask, WarehouseTaskLine } from "@/types";
import { movePallet, pickAndShipPallet, putawayPallet } from "./palletService";
import { syncOutboundStatusByNo } from "./outboundService";

const CURRENT_USER = "demo";

function getPalletOrThrow(palletId: string): Pallet {
  const p = getState().pallets.find((x) => x.palletId === palletId);
  if (!p) throw new Error("Pallet không tồn tại");
  return p;
}

function getTaskByIdOrThrow(taskId: string) {
  const t = getState().tasks.find((x) => x.id === taskId);
  if (!t) throw new Error("Task không tồn tại");
  return t;
}

export function listTasks() {
  return getState().tasks;
}

export function listTaskLines() {
  return getState().taskLines;
}

export function getTaskByNo(taskNo: string) {
  return getState().tasks.find((t) => t.taskNo === taskNo);
}

export function getTaskLinesByNo(taskNo: string) {
  return getState().taskLines
    .filter((l) => l.taskNo === taskNo)
    .sort((a, b) => a.lineNo - b.lineNo);
}

export function getTaskWithLinesByNo(taskNo: string) {
  const task = getTaskByNo(taskNo);
  if (!task) return null;
  const lines = getTaskLinesByNo(taskNo);
  return { task, lines };
}

function hasOpenTaskLineForPallet(palletId: string) {
  const s = getState();
  const openHeaderIds = new Set(
    s.tasks
      .filter((t) => t.status === "Open" || t.status === "Printed" || t.status === "Partially Confirmed")
      .map((t) => t.id),
  );
  return s.taskLines.some(
    (l) => l.palletId === palletId && l.status === "Open" && openHeaderIds.has(l.taskId),
  );
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
  if (loc.locationType !== "STORAGE") throw new Error("Location putaway phải thuộc loại STORAGE");
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

export function createTaskHeader(input: {
  taskType: TaskType;
  inboundNo?: string;
  outboundNo?: string;
  priority?: TaskPriority;
  instruction?: string;
  note?: string;
}): WarehouseTask {
  const now = new Date().toISOString();
  const taskNo = generateTaskNo(getState().tasks.map((t) => t.taskNo));
  const task: WarehouseTask = {
    id: uid(),
    taskNo,
    taskType: input.taskType,
    inboundNo: input.inboundNo,
    outboundNo: input.outboundNo,
    status: "Open",
    printCount: 0,
    priority: input.priority ?? "Normal",
    createdBy: CURRENT_USER,
    createdAt: now,
    instruction: input.instruction?.trim() || undefined,
    note: input.note,
  };
  setState((s) => ({ ...s, tasks: [task, ...s.tasks] }));
  return task;
}

export function addTaskLines(taskId: string, linesInput: Array<{
  palletId: string;
  toLocation: string | null;
  note?: string;
}>): WarehouseTaskLine[] {
  const task = getTaskByIdOrThrow(taskId);
  if (task.status !== "Open") throw new Error("Chỉ được thêm line khi task đang Open");
  if (linesInput.length === 0) throw new Error("Chưa có line để thêm");

  const s = getState();
  const existingLines = s.taskLines.filter((l) => l.taskId === taskId);
  let nextLineNo = existingLines.reduce((m, l) => Math.max(m, l.lineNo), 0) + 1;

  const newLines: WarehouseTaskLine[] = linesInput.map((li) => {
    const p = getPalletOrThrow(li.palletId);
    if (hasOpenTaskLineForPallet(p.palletId)) throw new Error(`Pallet ${p.palletId} đang có task line mở`);
    if (task.inboundNo && (p.referenceDocumentNo ?? "").trim() !== task.inboundNo) {
      throw new Error(`Pallet ${p.palletId} không thuộc inboundNo ${task.inboundNo}`);
    }

    const fromLocation = p.currentLocation;
    if (!fromLocation) throw new Error(`Pallet ${p.palletId} chưa có currentLocation`);

    let toLocation = li.toLocation;
    if (task.taskType === "PUTAWAY") {
      if (p.status !== "Pending Putaway") throw new Error(`Pallet ${p.palletId} không ở trạng thái Pending Putaway`);
      const fromLoc = s.locations.find((l) => l.locationCode === fromLocation);
      if (!fromLoc) throw new Error(`Location ${fromLocation} không tồn tại`);
      if (fromLoc.locationType !== "RECEIVING") throw new Error(`Pallet ${p.palletId} không nằm ở RECEIVING`);
      toLocation = validatePutawayDestination(String(toLocation ?? ""));
    } else if (task.taskType === "MOVE") {
      toLocation = validateMoveDestination(fromLocation, String(toLocation ?? ""));
    } else if (task.taskType === "PICK") {
      if (p.status !== "In Stock" && p.status !== "Staged") {
        throw new Error(`Pallet ${p.palletId} không ở trạng thái In Stock/Staged`);
      }
      toLocation = null;
    }

    return {
      id: uid(),
      taskId: task.id,
      taskNo: task.taskNo,
      lineNo: nextLineNo++,
      palletId: p.palletId,
      skuCode: p.skuCode,
      skuName: p.skuName,
      batchNo: p.batchNo,
      qty: p.qty,
      uom: p.uom,
      weight: p.weight,
      fromLocation,
      toLocation,
      actualLocation: null,
      status: "Open",
      note: li.note,
    };
  });

  setState((st) => ({ ...st, taskLines: [...newLines, ...st.taskLines] }));
  return newLines;
}

export function createSingleLineTask(input: {
  taskType: TaskType;
  palletId: string;
  toLocation?: string;
  inboundNo?: string;
  outboundNo?: string;
  priority?: TaskPriority;
  instruction?: string;
  note?: string;
}): { task: WarehouseTask; line: WarehouseTaskLine } {
  // Pre-validate to avoid creating orphan task headers when line validation fails.
  const s = getState();
  const p = getPalletOrThrow(input.palletId);
  if (hasOpenTaskLineForPallet(p.palletId)) throw new Error(`Pallet ${p.palletId} đang có task line mở`);
  if (input.inboundNo && (p.referenceDocumentNo ?? "").trim() !== input.inboundNo.trim()) {
    throw new Error(`Pallet ${p.palletId} không thuộc inboundNo ${input.inboundNo.trim()}`);
  }

  const fromLocation = p.currentLocation;
  if (!fromLocation) throw new Error(`Pallet ${p.palletId} chưa có currentLocation`);

  let validatedToLocation: string | null = input.toLocation?.trim() || null;
  if (input.taskType === "PUTAWAY") {
    if (p.status !== "Pending Putaway") throw new Error(`Pallet ${p.palletId} không ở trạng thái Pending Putaway`);
    const fromLoc = s.locations.find((l) => l.locationCode === fromLocation);
    if (!fromLoc) throw new Error(`Location ${fromLocation} không tồn tại`);
    if (fromLoc.locationType !== "RECEIVING") throw new Error(`Pallet ${p.palletId} không nằm ở RECEIVING`);
    validatedToLocation = validatePutawayDestination(String(validatedToLocation ?? ""));
  } else if (input.taskType === "MOVE") {
    validatedToLocation = validateMoveDestination(fromLocation, String(validatedToLocation ?? ""));
  } else if (input.taskType === "PICK") {
    if (p.status !== "In Stock" && p.status !== "Staged") {
      throw new Error(`Pallet ${p.palletId} không ở trạng thái In Stock/Staged`);
    }
    validatedToLocation = null;
  }

  const task = createTaskHeader({
    taskType: input.taskType,
    inboundNo: input.inboundNo,
    outboundNo: input.outboundNo,
    priority: input.priority,
    instruction: input.instruction,
    note: input.note,
  });
  const [line] = addTaskLines(task.id, [{ palletId: input.palletId, toLocation: validatedToLocation, note: input.note }]);
  return { task, line };
}

export function printTask(taskId: string) {
  const t = getTaskByIdOrThrow(taskId);
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

function recomputeTaskHeaderStatus(taskId: string) {
  const s = getState();
  const task = s.tasks.find((t) => t.id === taskId);
  if (!task) return;
  const lines = s.taskLines.filter((l) => l.taskId === taskId);
  if (lines.length === 0) return;

  const confirmedCount = lines.filter((l) => l.status === "Confirmed").length;
  const allConfirmed = confirmedCount === lines.length;
  const anyConfirmed = confirmedCount > 0;

  const nextStatus: WarehouseTask["status"] =
    allConfirmed ? "Confirmed" : anyConfirmed ? "Partially Confirmed" : task.status;

  const now = new Date().toISOString();
  setState((st) => ({
    ...st,
    tasks: st.tasks.map((t) =>
      t.id === taskId
        ? {
          ...t,
          status: nextStatus,
          confirmedAt: allConfirmed ? now : t.confirmedAt,
          confirmedBy: allConfirmed ? CURRENT_USER : t.confirmedBy,
        }
        : t,
    ),
  }));
}

export function confirmTaskLine(taskLineId: string, actualLocation?: string) {
  const s = getState();
  const line = s.taskLines.find((l) => l.id === taskLineId);
  if (!line) throw new Error("Task line không tồn tại");
  const task = s.tasks.find((t) => t.id === line.taskId);
  if (!task) throw new Error("Task không tồn tại");

  if (line.status !== "Open") throw new Error("Line không ở trạng thái Open");
  if (!(task.status === "Printed" || task.status === "Partially Confirmed")) throw new Error("Task chưa Printed");

  const dest = (actualLocation ?? line.toLocation ?? "").trim();

  if (task.taskType === "PUTAWAY") {
    const validated = validatePutawayDestination(dest);
    putawayPallet(line.palletId, validated, line.note);
  } else if (task.taskType === "MOVE") {
    const validated = validateMoveDestination(String(line.fromLocation ?? ""), dest);
    movePallet(line.palletId, validated, line.note);
  } else if (task.taskType === "PICK") {
    pickAndShipPallet(line.palletId, line.note);
  } else {
    throw new Error(`TaskType ${task.taskType} chưa hỗ trợ confirm`);
  }

  const now = new Date().toISOString();
  setState((st) => ({
    ...st,
    taskLines: st.taskLines.map((l) =>
      l.id === taskLineId
        ? {
          ...l,
          status: "Confirmed",
          actualLocation: task.taskType === "PICK" ? null : dest || null,
          toLocation: task.taskType === "PICK" ? "SHIPPED" : (dest || null),
          confirmedAt: now,
          confirmedBy: CURRENT_USER,
        }
        : l,
    ),
  }));

  recomputeTaskHeaderStatus(task.id);
  if (task.outboundNo) syncOutboundStatusByNo(task.outboundNo);
}

export function confirmAllTaskLines(taskNo: string) {
  const tl = getTaskWithLinesByNo(taskNo);
  if (!tl) throw new Error("Task không tồn tại");
  for (const l of tl.lines.filter((x) => x.status === "Open")) {
    confirmTaskLine(l.id);
  }
}

export function cancelTask(taskId: string) {
  const s = getState();
  const t = s.tasks.find((x) => x.id === taskId);
  if (!t) throw new Error("Task không tồn tại");
  if (t.status === "Cancelled") throw new Error("Task đã Cancelled");
  if (t.status === "Confirmed") throw new Error("Task đã Confirmed");

  const lines = s.taskLines.filter((l) => l.taskId === taskId);
  const anyConfirmed = lines.some((l) => l.status === "Confirmed");
  if (anyConfirmed) throw new Error("Task đã Partially Confirmed, không thể cancel toàn bộ");

  setState((st) => ({
    ...st,
    tasks: st.tasks.map((x) => x.id === taskId ? { ...x, status: "Cancelled" } : x),
    taskLines: st.taskLines.map((l) => (l.taskId === taskId && l.status === "Open") ? { ...l, status: "Cancelled" } : l),
  }));
  if (t.outboundNo) syncOutboundStatusByNo(t.outboundNo);
}

export function cancelTaskLine(taskLineId: string) {
  const s = getState();
  const line = s.taskLines.find((l) => l.id === taskLineId);
  if (!line) throw new Error("Task line không tồn tại");
  const task = s.tasks.find((t) => t.id === line.taskId);
  if (!task) throw new Error("Task không tồn tại");

  if (task.status === "Cancelled" || task.status === "Confirmed") throw new Error("Task không cho phép cancel line");
  if (line.status !== "Open") throw new Error("Chỉ cancel line Open");

  setState((st) => ({
    ...st,
    taskLines: st.taskLines.map((l) => l.id === taskLineId ? { ...l, status: "Cancelled" } : l),
  }));
  recomputeTaskHeaderStatus(task.id);
}
