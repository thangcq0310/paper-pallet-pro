import { getState } from "./store";
import { getTaskByNo, getTaskLineByTaskNoAndPalletId, confirmTaskLine } from "./taskService";
import { parseScannedCode } from "@/utils/scan";
import type { Location, Pallet, TaskType, UserRole, WarehouseTask } from "@/types";

export interface MobileLookupPalletResult {
  parsed: ReturnType<typeof parseScannedCode>;
  pallet: Pallet;
  openTasks: WarehouseTask[];
}

export interface MobileLookupLocationResult {
  parsed: ReturnType<typeof parseScannedCode>;
  location: Location;
  pallets: Pallet[];
  availableCapacity: number;
}

export interface MobileScanConfirmResult {
  parsed: ReturnType<typeof parseScannedCode>;
  task: WarehouseTask;
  lineId: string;
  result: "SUCCESS" | "WARNING";
  message: string;
  actualLocation: string | null;
}

const OPEN_TASK_STATUSES: WarehouseTask["status"][] = ["Open", "Printed", "Partially Confirmed"];

function expectScanType(parsed: ReturnType<typeof parseScannedCode>, expectedType: "PALLET" | "LOCATION" | "TASK", label: string) {
  if (parsed.parsedType !== expectedType || !parsed.parsedCode) {
    throw new Error(label);
  }
  return parsed.parsedCode;
}

function findPalletByCode(code: string) {
  const lookup = code.trim().toUpperCase();
  return getState().pallets.find((p) => p.palletId.toUpperCase() === lookup) ?? null;
}

function findLocationByCode(code: string) {
  const lookup = code.trim().toUpperCase();
  return getState().locations.find((l) => l.locationCode.toUpperCase() === lookup) ?? null;
}

function listOpenTasksForPallet(palletId: string) {
  const s = getState();
  const openTaskIds = new Set(s.tasks.filter((t) => OPEN_TASK_STATUSES.includes(t.status)).map((t) => t.id));
  return s.tasks.filter((t) =>
    openTaskIds.has(t.id) &&
    s.taskLines.some((l) => l.taskId === t.id && l.palletId === palletId && l.status === "Open"),
  );
}

export function lookupPalletByScan(scannedValue: string): MobileLookupPalletResult {
  const parsed = parseScannedCode(scannedValue);
  return lookupPalletByParsed(parsed);
}

export function lookupPalletByParsed(parsed: ReturnType<typeof parseScannedCode>): MobileLookupPalletResult {
  const palletCode = expectScanType(parsed, "PALLET", "Hãy scan Pallet ID hợp lệ");
  const pallet = findPalletByCode(palletCode);
  if (!pallet) throw new Error(`Pallet ${parsed.parsedCode} không tồn tại`);
  return {
    parsed,
    pallet,
    openTasks: listOpenTasksForPallet(pallet.palletId),
  };
}

export function lookupLocationByScan(scannedValue: string): MobileLookupLocationResult {
  const parsed = parseScannedCode(scannedValue);
  return lookupLocationByParsed(parsed);
}

export function lookupLocationByParsed(parsed: ReturnType<typeof parseScannedCode>): MobileLookupLocationResult {
  const locationCode = expectScanType(parsed, "LOCATION", "Hãy scan Location Code hợp lệ");
  const location = findLocationByCode(locationCode);
  if (!location) throw new Error(`Location ${parsed.parsedCode} không tồn tại`);
  const pallets = getState()
    .pallets
    .filter((p) => p.currentLocation === location.locationCode)
    .sort((a, b) => a.palletId.localeCompare(b.palletId));

  return {
    parsed,
    location,
    pallets,
    availableCapacity: Math.max(0, location.capacityPallet - location.currentPalletCount),
  };
}

export function getOpenTasksByType(taskType: TaskType) {
  return getState()
    .tasks
    .filter((t) => t.taskType === taskType && OPEN_TASK_STATUSES.includes(t.status))
    .sort((a, b) => a.taskNo.localeCompare(b.taskNo));
}

export function getTaskByScan(scannedValue: string) {
  const parsed = parseScannedCode(scannedValue);
  return getTaskByParsed(parsed);
}

export function getTaskByParsed(parsed: ReturnType<typeof parseScannedCode>) {
  const taskNo = expectScanType(parsed, "TASK", "Hãy scan Task No hợp lệ");
  const task = getTaskByNo(taskNo);
  if (!task) throw new Error(`Task ${parsed.parsedCode} không tồn tại`);
  return { parsed, task };
}

export function confirmTaskLineByScan(input: {
  taskNo: string;
  palletId: string;
  actualLocationCode?: string | null;
  allowOpenTaskConfirm: boolean;
  allowActualLocationOverride: boolean;
  role: UserRole;
}) {
  const task = getTaskByNo(input.taskNo.trim());
  if (!task) throw new Error(`Task ${input.taskNo} không tồn tại`);
  const line = getTaskLineByTaskNoAndPalletId(task.taskNo, input.palletId.trim());
  if (!line) throw new Error(`Pallet ${input.palletId} không thuộc task ${task.taskNo}`);
  if (line.status !== "Open") throw new Error(`Line ${line.lineNo} đã được xử lý`);
  if (!input.allowOpenTaskConfirm && task.status !== "Printed" && task.status !== "Partially Confirmed") {
    throw new Error("Task chưa Printed");
  }

  const actualLocationCode = input.actualLocationCode?.trim() || null;
  const canOverrideActualLocation = input.role !== "Operator" && input.allowActualLocationOverride;

  if (task.taskType === "PUTAWAY" || task.taskType === "MOVE") {
    const plannedLocation = (line.toLocation ?? "").trim();
    if (!plannedLocation) throw new Error("Task line chưa có To Bin");
    if (actualLocationCode && actualLocationCode !== plannedLocation && !canOverrideActualLocation) {
      return {
        parsed: parseScannedCode(actualLocationCode),
        task,
        lineId: line.id,
        result: "WARNING" as const,
        message: `Actual Bin ${actualLocationCode} khác To Bin ${plannedLocation}`,
        actualLocation: null,
      };
    }

    const confirmation = confirmTaskLine(line.id, {
      actualLocation: actualLocationCode ?? plannedLocation,
      allowOpenTask: input.allowOpenTaskConfirm,
      allowActualLocationOverride: input.allowActualLocationOverride,
    });

    return {
      parsed: parseScannedCode(actualLocationCode ?? plannedLocation),
      task,
      lineId: line.id,
      result: confirmation?.result ?? "SUCCESS",
      message: confirmation?.message ?? "Confirmed",
      actualLocation: actualLocationCode ?? plannedLocation,
    };
  }

  if (task.taskType === "PICK") {
    const pallet = getState().pallets.find((p) => p.palletId === line.palletId);
    if (!pallet) throw new Error(`Pallet ${line.palletId} không tồn tại`);
    if (actualLocationCode && pallet.currentLocation && actualLocationCode.toUpperCase() !== pallet.currentLocation.toUpperCase()) {
      return {
        parsed: parseScannedCode(actualLocationCode),
        task,
        lineId: line.id,
        result: "WARNING" as const,
        message: `Current location ${actualLocationCode} không khớp với pallet ${pallet.palletId}`,
        actualLocation: null,
      };
    }

    const confirmation = confirmTaskLine(line.id, {
      actualLocation: actualLocationCode,
      allowOpenTask: input.allowOpenTaskConfirm,
      allowActualLocationOverride: false,
    });

    return {
      parsed: parseScannedCode(actualLocationCode ?? line.fromLocation ?? ""),
      task,
      lineId: line.id,
      result: confirmation?.result ?? "SUCCESS",
      message: confirmation?.message ?? "Confirmed",
      actualLocation: null,
    };
  }

  throw new Error(`TaskType ${task.taskType} chưa hỗ trợ scan confirm`);
}
