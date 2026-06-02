import { getState, setState } from "./store";
import { generateTaskNo, uid } from "@/utils/idGenerator";
import type { Pallet, TaskPriority, TaskType, UserRole, WarehouseTask, WarehouseTaskLine } from "@/types";
import { movePallet, pickAndShipPallet, putawayPallet } from "./palletService";
import { syncOutboundStatusByNo } from "./outboundService";
import { hasOpenTaskLineForPallet } from "./taskQueryService";

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

export function getTaskLineByTaskNoAndPalletId(taskNo: string, palletId: string) {
  return getState().taskLines.find((l) => l.taskNo === taskNo && l.palletId === palletId);
}

export function getTaskWithLinesByNo(taskNo: string) {
  const task = getTaskByNo(taskNo);
  if (!task) return null;
  const lines = getTaskLinesByNo(taskNo);
  return { task, lines };
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

export function getOpenTaskLineCountToLocation(input: { locationCode: string; taskType: TaskType }) {
  const s = getState();
  const locationCode = input.locationCode.trim();
  const openHeaderIds = new Set(
    s.tasks
      .filter((t) => t.taskType === input.taskType && (t.status === "Open" || t.status === "Printed" || t.status === "Partially Confirmed"))
      .map((t) => t.id),
  );
  return s.taskLines.filter((l) => l.status === "Open" && l.toLocation === locationCode && openHeaderIds.has(l.taskId)).length;
}

function validateMoveAssignments(input: Array<{ palletId: string; toLocation: string }>) {
  const s = getState();
  if (!input.length) throw new Error("Chưa có pallet để tạo task MOVE");
  const seen = new Set<string>();
  const assignedCountByLoc = new Map<string, number>();
  for (const item of input) {
    const palletId = item.palletId.trim();
    const toLocation = item.toLocation.trim();
    if (!palletId) throw new Error("Assignment palletId không hợp lệ");
    if (!toLocation) throw new Error("Assignment targetLocation không hợp lệ");
    if (seen.has(palletId)) throw new Error(`Pallet ${palletId} bị chọn trùng`);
    seen.add(palletId);

    const pallet = getPalletOrThrow(palletId);
    if (pallet.status === "Pending Putaway" || pallet.status === "Cancelled" || pallet.status === "Shipped") {
      throw new Error(`Pallet ${palletId} không hợp lệ để MOVE`);
    }
    if (pallet.status !== "In Stock" && pallet.status !== "Staged") {
      throw new Error(`Pallet ${palletId} không ở trạng thái In Stock/Staged`);
    }
    if (!pallet.currentLocation) throw new Error(`Pallet ${palletId} chưa có currentLocation`);
    const fromLoc = s.locations.find((l) => l.locationCode === pallet.currentLocation);
    if (!fromLoc || fromLoc.locationType !== "STORAGE") throw new Error(`Pallet ${palletId} không nằm trong STORAGE`);
    validateMoveDestination(pallet.currentLocation, toLocation);
    if (hasOpenTaskLineForPallet(palletId)) throw new Error(`Pallet ${palletId} đang có task line mở`);

    assignedCountByLoc.set(toLocation, (assignedCountByLoc.get(toLocation) ?? 0) + 1);
  }

  for (const [locationCode, assigned] of assignedCountByLoc.entries()) {
    const loc = s.locations.find((l) => l.locationCode === locationCode);
    if (!loc) throw new Error(`Location ${locationCode} không tồn tại`);
    const openMoveLineCount = getOpenTaskLineCountToLocation({ locationCode, taskType: "MOVE" });
    const available = Math.max(0, loc.capacityPallet - loc.currentPalletCount - openMoveLineCount);
    if (assigned > available) {
      throw new Error(`Bin ${locationCode} không đủ capacity cho MOVE (assigned ${assigned} > available ${available})`);
    }
  }
}

export function createMoveTaskWithLines(input: {
  assignments: Array<{ palletId: string; targetLocation: string }>;
  note?: string;
}): { task: WarehouseTask; lines: WarehouseTaskLine[] } {
  const assignments = input.assignments.map((x) => ({
    palletId: x.palletId.trim(),
    toLocation: x.targetLocation.trim(),
  })).filter((x) => x.palletId && x.toLocation);

  validateMoveAssignments(assignments);

  const task = createTaskHeader({
    taskType: "MOVE",
    instruction: "Chuyển pallet từ location cũ sang location mới.",
    note: input.note?.trim() || undefined,
  });

  const lines = addTaskLines(task.id, assignments.map((x) => ({ palletId: x.palletId, toLocation: x.toLocation, note: input.note })));
  return { task, lines };
}

function validatePickPallets(palletIds: string[]) {
  if (!palletIds.length) throw new Error("Chưa chọn pallet để tạo PICK task");
  const seen = new Set<string>();
  for (const palletId of palletIds) {
    const id = palletId.trim();
    if (!id) throw new Error("Pallet ID không hợp lệ");
    if (seen.has(id)) throw new Error(`Pallet ${id} bị chọn trùng`);
    seen.add(id);
    const pallet = getPalletOrThrow(id);
    if (pallet.status === "Pending Putaway" || pallet.status === "Cancelled" || pallet.status === "Shipped") {
      throw new Error(`Pallet ${id} không hợp lệ để PICK`);
    }
    if (pallet.status !== "In Stock" && pallet.status !== "Staged") {
      throw new Error(`Pallet ${id} không ở trạng thái In Stock/Staged`);
    }
    if (!pallet.currentLocation) throw new Error(`Pallet ${id} chưa có currentLocation`);
    if (hasOpenTaskLineForPallet(id)) throw new Error(`Pallet ${id} đang có task line mở`);
  }
}

export function createPickTaskWithLines(input: {
  outboundNo: string;
  palletIds: string[];
  destination: string;
  note?: string;
}): { task: WarehouseTask; lines: WarehouseTaskLine[] } {
  const outboundNo = input.outboundNo.trim();
  if (!outboundNo) throw new Error("Thiếu outboundNo");
  const destination = input.destination.trim();
  if (!destination) throw new Error("Thiếu destination");

  const palletIds = input.palletIds.map((x) => x.trim()).filter(Boolean);
  validatePickPallets(palletIds);

  const task = createTaskHeader({
    taskType: "PICK",
    outboundNo,
    instruction: `PICK = lấy pallet từ bin và xuất trực tiếp (${destination}).`,
    note: input.note?.trim() || `Destination: ${destination}`,
  });

  const lines = addTaskLines(task.id, palletIds.map((palletId) => ({ palletId, toLocation: null, note: input.note })));
  return { task, lines };
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

  const openCount = lines.filter((l) => l.status === "Open").length;
  const cancelledCount = lines.filter((l) => l.status === "Cancelled").length;
  const confirmedCount = lines.filter((l) => l.status === "Confirmed").length;
  const allConfirmed = confirmedCount === lines.length;
  const anyConfirmed = confirmedCount > 0;
  const allCancelled = cancelledCount === lines.length;
  const noOpenRemaining = openCount === 0;

  const nextStatus: WarehouseTask["status"] =
    allConfirmed
      ? "Confirmed"
      : allCancelled
        ? "Cancelled"
        : anyConfirmed && noOpenRemaining
          ? "Confirmed"
          : anyConfirmed
            ? "Partially Confirmed"
            : task.status;

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

export interface ConfirmTaskLineOptions {
  actualLocation?: string | null;
  allowOpenTask?: boolean;
  allowActualLocationOverride?: boolean;
  role?: UserRole;
}

export function confirmTaskLine(taskLineId: string, actualLocation?: string): {
  taskNo: string;
  palletId: string;
  result: "SUCCESS" | "WARNING";
  message: string;
} | void;
export function confirmTaskLine(taskLineId: string, options?: ConfirmTaskLineOptions): {
  taskNo: string;
  palletId: string;
  result: "SUCCESS" | "WARNING";
  message: string;
} | void;
export function confirmTaskLine(taskLineId: string, actualLocationOrOptions?: string | ConfirmTaskLineOptions) {
  const s = getState();
  const line = s.taskLines.find((l) => l.id === taskLineId);
  if (!line) throw new Error("Task line không tồn tại");
  const task = s.tasks.find((t) => t.id === line.taskId);
  if (!task) throw new Error("Task không tồn tại");

  const actualLocation = typeof actualLocationOrOptions === "string"
    ? actualLocationOrOptions
    : actualLocationOrOptions?.actualLocation ?? "";
  const allowOpenTask = typeof actualLocationOrOptions === "object" && actualLocationOrOptions !== null
    ? Boolean(actualLocationOrOptions.allowOpenTask)
    : false;
  const allowActualLocationOverride = typeof actualLocationOrOptions === "object" && actualLocationOrOptions !== null
    ? Boolean(actualLocationOrOptions.allowActualLocationOverride)
    : false;
  const role = typeof actualLocationOrOptions === "object" && actualLocationOrOptions !== null
    ? actualLocationOrOptions.role ?? "Operator"
    : "Operator";
  const canOverrideActualLocation = role !== "Operator" && allowActualLocationOverride;

  if (line.status !== "Open") throw new Error("Line không ở trạng thái Open");
  if (!allowOpenTask && !(task.status === "Printed" || task.status === "Partially Confirmed")) throw new Error("Task chưa Printed");
  if (allowOpenTask && task.status === "Cancelled") throw new Error("Task đã Cancelled");

  const plannedLocation = (line.toLocation ?? "").trim();
  const fromLocation = (line.fromLocation ?? "").trim();
  let resolvedActualLocation: string | null = null;
  let result: "SUCCESS" | "WARNING" = "SUCCESS";
  let message = "Confirmed";

  if (task.taskType === "PUTAWAY") {
    const resolved = (actualLocation || plannedLocation).trim();
    if (!resolved) throw new Error("Thiếu Actual Bin");
    if (plannedLocation && resolved !== plannedLocation && !canOverrideActualLocation) {
      throw new Error("Actual Bin khác To Bin. Chỉ Supervisor/Admin mới được override");
    }
    const validated = validatePutawayDestination(resolved);
    putawayPallet(line.palletId, validated, line.note);
    resolvedActualLocation = validated;
    if (plannedLocation && validated !== plannedLocation) {
      result = "WARNING";
      message = `Override Actual Bin ${validated} thay cho To Bin ${plannedLocation}`;
    }
  } else if (task.taskType === "MOVE") {
    const resolved = (actualLocation || plannedLocation).trim();
    if (!resolved) throw new Error("Thiếu Actual Bin");
    if (plannedLocation && resolved !== plannedLocation && !canOverrideActualLocation) {
      throw new Error("Actual Bin khác To Bin. Chỉ Supervisor/Admin mới được override");
    }
    const validated = validateMoveDestination(fromLocation, resolved);
    movePallet(line.palletId, validated, line.note);
    resolvedActualLocation = validated;
    if (plannedLocation && validated !== plannedLocation) {
      result = "WARNING";
      message = `Override Actual Bin ${validated} thay cho To Bin ${plannedLocation}`;
    }
  } else if (task.taskType === "PICK") {
    if (actualLocation?.trim()) {
      const pallet = getPalletOrThrow(line.palletId);
      const currentLocation = (pallet.currentLocation ?? "").trim();
      if (currentLocation && actualLocation.trim() !== currentLocation) {
        throw new Error(`Current location ${actualLocation.trim()} không khớp với pallet ${pallet.palletId}`);
      }
    }
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
          actualLocation: task.taskType === "PICK" ? null : ((resolvedActualLocation ?? plannedLocation) || null),
          toLocation: task.taskType === "PICK" ? null : (l.toLocation ?? null),
          confirmedAt: now,
          confirmedBy: CURRENT_USER,
        }
        : l,
    ),
  }));

  recomputeTaskHeaderStatus(task.id);
  if (task.outboundNo) syncOutboundStatusByNo(task.outboundNo);

  return {
    taskNo: task.taskNo,
    palletId: line.palletId,
    result,
    message,
  };
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
  if (task.outboundNo) syncOutboundStatusByNo(task.outboundNo);
}
