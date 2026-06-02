import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ScanInput } from "@/components/mobile/ScanInput";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { TaskStatusBadge } from "@/components/StatusBadges";
import { useStore } from "@/services/store";
import { formatLocationPath } from "@/utils/location";
import type { TaskType, WarehouseTask } from "@/types";
import { ArrowLeft, Printer, ScanLine, ListChecks, ArrowRight } from "lucide-react";
import { expectParsedScanType, parseScannedCode } from "@/utils/scan";

const ACTIVE_STATUSES: WarehouseTask["status"][] = ["Open", "Printed", "Partially Confirmed"];

function getTaskScanRoute(task: WarehouseTask) {
  if (task.taskType === "PUTAWAY") return `/mobile/scan-putaway?taskNo=${encodeURIComponent(task.taskNo)}`;
  if (task.taskType === "MOVE") return `/mobile/scan-move?taskNo=${encodeURIComponent(task.taskNo)}`;
  if (task.taskType === "PICK") return `/mobile/scan-pick?taskNo=${encodeURIComponent(task.taskNo)}`;
  return "/mobile";
}

export const Route = createFileRoute("/mobile/tasks")({ component: MobileTasksPage });

function MobileTasksPage() {
  const tasks = useStore((s) => s.tasks);
  const taskLines = useStore((s) => s.taskLines);
  const locations = useStore((s) => s.locations);
  const outbounds = useStore((s) => s.outbounds);

  const [taskFilter, setTaskFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | TaskType>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "printed" | "confirmed" | "cancelled">("all");
  const [message, setMessage] = useState("");

  const lineStats = useMemo(() => {
    const map = new Map<string, { lineCount: number; confirmedLineCount: number; cancelledLineCount: number }>();
    for (const line of taskLines) {
      const current = map.get(line.taskId) ?? { lineCount: 0, confirmedLineCount: 0, cancelledLineCount: 0 };
      current.lineCount += 1;
      if (line.status === "Confirmed") current.confirmedLineCount += 1;
      if (line.status === "Cancelled") current.cancelledLineCount += 1;
      map.set(line.taskId, current);
    }
    return map;
  }, [taskLines]);

  const filteredTasks = useMemo(() => {
    const query = taskFilter.trim().toUpperCase();
    const sorted = [...tasks].sort((a, b) => {
      const order: Record<WarehouseTask["status"], number> = {
        Open: 0,
        Printed: 1,
        "Partially Confirmed": 2,
        Confirmed: 3,
        Cancelled: 4,
      };
      const statusDelta = order[a.status] - order[b.status];
      if (statusDelta !== 0) return statusDelta;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return sorted.filter((task) => {
      const matchesQuery =
        !query ||
        task.taskNo.toUpperCase().includes(query) ||
        (task.inboundNo ?? "").toUpperCase().includes(query) ||
        (task.outboundNo ?? "").toUpperCase().includes(query) ||
        task.taskType.toUpperCase().includes(query);
      const matchesType = typeFilter === "all" || task.taskType === typeFilter;
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && ACTIVE_STATUSES.includes(task.status)) ||
        (statusFilter === "printed" && task.status === "Printed") ||
        (statusFilter === "confirmed" && task.status === "Confirmed") ||
        (statusFilter === "cancelled" && task.status === "Cancelled");
      return matchesQuery && matchesType && matchesStatus;
    });
  }, [tasks, taskFilter, typeFilter, statusFilter]);

  const activeCount = tasks.filter((task) => ACTIVE_STATUSES.includes(task.status)).length;
  const printedCount = tasks.filter((task) => task.status === "Printed").length;
  const confirmedCount = tasks.filter((task) => task.status === "Confirmed").length;

  const openTask = (task: WarehouseTask) => {
    window.location.assign(getTaskScanRoute(task));
  };

  const printTask = (taskNo: string) => {
    window.open(`/tasks/${encodeURIComponent(taskNo)}/print`, "_blank", "noopener,noreferrer");
  };

  const handleTaskScan = (rawValue: string) => {
    try {
      const parsed = parseScannedCode(rawValue);
      const taskCode = expectParsedScanType(parsed, "TASK", "Hãy scan Task No hợp lệ");
      const next = tasks.find((task) => task.taskNo === taskCode);
      if (!next) {
        throw new Error(`Task ${taskCode} không tồn tại`);
      }
      setTaskFilter(next.taskNo);
      setMessage(`Đã lọc task ${next.taskNo}`);
    } catch (error: any) {
      setMessage(error?.message ?? String(error));
    }
  };

  return (
    <div className="space-y-4 pb-6">
      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" size="icon" className="h-11 w-11 rounded-2xl" onClick={() => window.location.assign("/mobile")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Mobile</div>
          <h1 className="text-2xl font-semibold">Task list</h1>
        </div>
      </div>

      <Card className="rounded-[1.75rem]">
        <CardContent className="space-y-3 p-4">
          <div className="flex items-center gap-2">
            <ListChecks className="h-4 w-4 text-primary" />
            <div className="text-sm font-semibold">Scan hoặc lọc task</div>
          </div>
          <ScanInput
            label="Task No"
            placeholder="TASK:..."
            hint="Quét QR task hoặc nhập tay để lọc đúng task đang cầm."
            onScan={(_, rawValue) => handleTaskScan(rawValue)}
          />
          <div className="flex flex-wrap gap-2">
            <Button variant={taskFilter ? "outline" : "default"} className="h-10 rounded-full" onClick={() => setTaskFilter("")}>
              All
            </Button>
            <Button variant={statusFilter === "active" ? "default" : "outline"} className="h-10 rounded-full" onClick={() => setStatusFilter("active")}>
              Active
            </Button>
            <Button variant={statusFilter === "printed" ? "default" : "outline"} className="h-10 rounded-full" onClick={() => setStatusFilter("printed")}>
              Printed
            </Button>
            <Button variant={statusFilter === "confirmed" ? "default" : "outline"} className="h-10 rounded-full" onClick={() => setStatusFilter("confirmed")}>
              Confirmed
            </Button>
            <Button variant={statusFilter === "cancelled" ? "default" : "outline"} className="h-10 rounded-full" onClick={() => setStatusFilter("cancelled")}>
              Cancelled
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {(["all", "PUTAWAY", "MOVE", "PICK"] as const).map((type) => (
              <Button
                key={type}
                variant={typeFilter === type ? "default" : "outline"}
                className="h-10 rounded-full"
                onClick={() => setTypeFilter(type)}
              >
                {type === "all" ? "All types" : type}
              </Button>
            ))}
          </div>
          {message && <div className="rounded-2xl border p-3 text-sm">{message}</div>}
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Card className="rounded-[1.5rem]">
          <CardContent className="p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Total</div>
            <div className="mt-1 text-2xl font-semibold">{filteredTasks.length}</div>
          </CardContent>
        </Card>
        <Card className="rounded-[1.5rem]">
          <CardContent className="p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Active</div>
            <div className="mt-1 text-2xl font-semibold">{activeCount}</div>
          </CardContent>
        </Card>
        <Card className="rounded-[1.5rem]">
          <CardContent className="p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Printed</div>
            <div className="mt-1 text-2xl font-semibold">{printedCount}</div>
          </CardContent>
        </Card>
        <Card className="rounded-[1.5rem]">
          <CardContent className="p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Confirmed</div>
            <div className="mt-1 text-2xl font-semibold">{confirmedCount}</div>
          </CardContent>
        </Card>
      </div>

      {filteredTasks.length === 0 ? (
        <Card className="rounded-[1.75rem]">
          <CardContent className="p-4 text-sm text-muted-foreground">
            Không có task phù hợp bộ lọc hiện tại.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredTasks.map((task) => {
            const stats = lineStats.get(task.id) ?? { lineCount: 0, confirmedLineCount: 0, cancelledLineCount: 0 };
            const completion = stats.lineCount > 0 ? Math.round((stats.confirmedLineCount / stats.lineCount) * 100) : 0;
            const lines = taskLines.filter((line) => line.taskNo === task.taskNo).sort((a, b) => a.lineNo - b.lineNo);
            const outbound = task.outboundNo ? outbounds.find((o) => o.outboundNo === task.outboundNo) : null;
            return (
              <Card
                key={task.id}
                className={`rounded-[1.75rem] border-2 ${taskFilter && task.taskNo.toUpperCase() === taskFilter.trim().toUpperCase() ? "border-primary" : "border-border"}`}
              >
                <CardContent className="space-y-4 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">Task No</div>
                      <div className="font-mono text-xl font-semibold">{task.taskNo}</div>
                      <div className="mt-1 flex flex-wrap gap-2">
                        <Badge variant="secondary">{task.taskType}</Badge>
                        <TaskStatusBadge status={task.status} />
                      </div>
                    </div>
                    <div className="text-right text-xs text-muted-foreground">
                      <div>Print: {task.printCount}</div>
                      <div>{new Date(task.createdAt).toLocaleDateString()}</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div className="rounded-2xl bg-muted/40 p-3">
                      <div className="text-[11px] uppercase text-muted-foreground">Lines</div>
                      <div className="mt-1 font-semibold">{stats.lineCount}</div>
                    </div>
                    <div className="rounded-2xl bg-muted/40 p-3">
                      <div className="text-[11px] uppercase text-muted-foreground">Confirmed</div>
                      <div className="mt-1 font-semibold">{stats.confirmedLineCount}</div>
                    </div>
                    <div className="rounded-2xl bg-muted/40 p-3">
                      <div className="text-[11px] uppercase text-muted-foreground">Progress</div>
                      <div className="mt-1 font-semibold">{completion}%</div>
                    </div>
                  </div>

                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${completion}%` }} />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <Button className="h-11 rounded-2xl" onClick={() => openTask(task)}>
                      <ScanLine className="mr-2 h-4 w-4" />
                      {task.taskType === "PUTAWAY" ? "Scan Putaway" : task.taskType === "MOVE" ? "Scan Move" : "Scan Pick"}
                    </Button>
                    <Button
                      variant="outline"
                      className="h-11 rounded-2xl"
                      onClick={() => printTask(task.taskNo)}
                      disabled={task.status === "Confirmed" || task.status === "Cancelled"}
                    >
                      <Printer className="mr-2 h-4 w-4" />
                      Print
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">Lines</div>
                    <div className="max-h-64 space-y-2 overflow-auto pr-1">
                      {lines.map((line) => {
                        const fromLabel = formatLocationPath(locations.find((loc) => loc.locationCode === line.fromLocation) ?? null);
                        const toLabel =
                          task.taskType === "PICK"
                            ? `External${outbound?.destination ? ` · ${outbound.destination}` : ""}`
                            : line.toLocation ?? "—";
                        const actualLabel = line.actualLocation
                          ? formatLocationPath(locations.find((loc) => loc.locationCode === line.actualLocation) ?? null)
                          : "—";
                        return (
                          <div key={line.id} className="rounded-2xl border p-3 text-sm">
                            <div className="flex items-start justify-between gap-2">
                              <div className="font-mono font-semibold">{line.palletId}</div>
                              <Badge variant="outline">#{line.lineNo}</Badge>
                            </div>
                            <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                              <span className="rounded-full bg-muted px-2 py-1">From: {line.fromLocation ?? "—"}</span>
                              <ArrowRight className="h-3.5 w-3.5" />
                              <span className="rounded-full bg-muted px-2 py-1">{task.taskType === "PICK" ? "OUT" : "To"}: {toLabel}</span>
                            </div>
                            <div className="mt-1 text-[11px] text-muted-foreground">
                              {fromLabel}
                            </div>
                            <div className="mt-1 text-[11px] text-muted-foreground">
                              Actual: {actualLabel}
                            </div>
                            <div className="mt-2 text-xs text-muted-foreground">
                              {line.skuCode} / {line.batchNo} / {line.qty} {line.uom}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
