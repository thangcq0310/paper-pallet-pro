import { getState, setState } from "./store";
import { generateTaskNo, uid } from "@/utils/idGenerator";
import type { WarehouseTask, TaskType } from "@/types";
import { putawayPallet, movePallet, pickToStaging, loadPallet } from "./palletService";

export function listTasks() { return getState().tasks; }

export function createTask(input: { taskType: TaskType; palletId: string; fromLocation: string; toLocation: string; priority?: WarehouseTask["priority"]; note?: string }) {
  const taskNo = generateTaskNo(getState().tasks.map((t) => t.taskNo));
  const task: WarehouseTask = {
    id: uid(),
    taskNo,
    taskType: input.taskType,
    palletId: input.palletId,
    fromLocation: input.fromLocation,
    toLocation: input.toLocation,
    status: "Open",
    priority: input.priority ?? "Normal",
    createdAt: new Date().toISOString(),
    note: input.note,
  };
  setState((s) => ({ ...s, tasks: [task, ...s.tasks] }));
  return task;
}

export function confirmTask(taskId: string, actualLocation?: string) {
  const t = getState().tasks.find((x) => x.id === taskId);
  if (!t) throw new Error("Task không tồn tại");
  if (t.status === "Confirmed") throw new Error("Task đã Confirmed");
  const dest = actualLocation || t.toLocation;
  if (t.taskType === "PUTAWAY") putawayPallet(t.palletId, dest);
  else if (t.taskType === "MOVE") movePallet(t.palletId, dest);
  else if (t.taskType === "PICK") pickToStaging(t.palletId);
  else if (t.taskType === "LOAD") loadPallet(t.palletId);
  setState((s) => ({
    ...s,
    tasks: s.tasks.map((x) => x.id === taskId ? { ...x, status: "Confirmed", toLocation: dest, confirmedAt: new Date().toISOString(), confirmedBy: "demo" } : x),
  }));
}

export function cancelTask(taskId: string) {
  setState((s) => ({ ...s, tasks: s.tasks.map((x) => x.id === taskId ? { ...x, status: "Cancelled" } : x) }));
}
