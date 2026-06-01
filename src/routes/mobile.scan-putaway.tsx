import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ScanInput } from "@/components/mobile/ScanInput";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useStore } from "@/services/store";
import { loadMobileScanSettings } from "@/services/mobileScanSettings";
import { appendScanEvent } from "@/services/scanService";
import { confirmTaskLineByScan, getOpenTasksByType, getTaskByScan } from "@/services/mobileWorkflowService";
import { formatLocationPath } from "@/utils/location";
import { TaskStatusBadge } from "@/components/StatusBadges";
import { ArrowLeft, ScanLine, Package, MapPin } from "lucide-react";

export const Route = createFileRoute("/mobile/scan-putaway")({ component: MobileScanPutawayPage });

function MobileScanPutawayPage() {
  const tasks = useStore((s) => s.tasks);
  const taskLines = useStore((s) => s.taskLines);
  const locations = useStore((s) => s.locations);
  const settings = loadMobileScanSettings();

  const [taskNo, setTaskNo] = useState("");
  const [palletId, setPalletId] = useState("");
  const [actualLocationCode, setActualLocationCode] = useState("");
  const [message, setMessage] = useState("");

  const task = useMemo(() => tasks.find((t) => t.taskNo === taskNo) ?? null, [tasks, taskNo]);
  const lines = useMemo(
    () => taskLines.filter((l) => l.taskNo === taskNo).sort((a, b) => a.lineNo - b.lineNo),
    [taskLines, taskNo],
  );
  const line = useMemo(() => lines.find((l) => l.palletId === palletId) ?? null, [lines, palletId]);
  const openTasks = useMemo(() => getOpenTasksByType("PUTAWAY"), [tasks, taskLines]);
  const targetLocation = line?.toLocation ?? "";
  const actualLocation = actualLocationCode.trim() ? actualLocationCode.trim() : targetLocation;

  useEffect(() => {
    if (taskNo || typeof window === "undefined") return;
    const queryTaskNo = new URLSearchParams(window.location.search).get("taskNo")?.trim();
    if (!queryTaskNo) return;
    const next = tasks.find((t) => t.taskNo === queryTaskNo);
    if (next?.taskType === "PUTAWAY") {
      setTaskNo(next.taskNo);
      setMessage(`Đã mở task ${next.taskNo}`);
    }
  }, [taskNo, tasks]);

  const log = (payload: {
    rawValue: string;
    parsedType: "PALLET" | "LOCATION" | "TASK" | "UNKNOWN";
    parsedCode: string | null;
    result: "SUCCESS" | "WARNING" | "ERROR";
    message: string;
    palletId?: string | null;
    locationCode?: string | null;
    taskNo?: string | null;
    scanType: string;
  }) => {
    appendScanEvent({
      scanType: payload.scanType,
      scannedValue: payload.rawValue,
      parsedType: payload.parsedType,
      parsedCode: payload.parsedCode,
      taskNo: payload.taskNo ?? taskNo ?? null,
      palletId: payload.palletId ?? palletId ?? null,
      locationCode: payload.locationCode ?? actualLocationCode ?? null,
      result: payload.result,
      message: payload.message,
      scannedBy: settings.operatorName,
    });
  };

  const handleTaskScan = (rawValue: string) => {
    try {
      const next = getTaskByScan(rawValue);
      if (next.task.taskType !== "PUTAWAY") {
        throw new Error(`Task ${next.task.taskNo} không phải PUTAWAY`);
      }
      setTaskNo(next.task.taskNo);
      setPalletId("");
      setActualLocationCode("");
      setMessage(`Chọn task ${next.task.taskNo}`);
      log({
        rawValue,
        parsedType: next.parsed.parsedType,
        parsedCode: next.parsed.parsedCode,
        result: "SUCCESS",
        message: `Chọn task ${next.task.taskNo}`,
        taskNo: next.task.taskNo,
        scanType: "PUTAWAY_TASK",
      });
    } catch (error: any) {
      const errorMessage = error?.message ?? String(error);
      setMessage(errorMessage);
      log({
        rawValue,
        parsedType: "UNKNOWN",
        parsedCode: null,
        result: "ERROR",
        message: errorMessage,
        scanType: "PUTAWAY_TASK",
      });
    }
  };

  const handlePalletScan = (rawValue: string) => {
    try {
      if (!task) throw new Error("Hãy scan Task No trước");
      const parsed = rawValue.trim();
      const line = lines.find((item) => item.palletId.toUpperCase() === parsed.replace(/^PLT:/i, "").toUpperCase());
      if (!line) throw new Error(`Pallet ${parsed} không thuộc task ${task.taskNo}`);
      setPalletId(line.palletId);
      setActualLocationCode(line.toLocation ?? "");
      setMessage(`Pallet ${line.palletId} -> ${line.toLocation}`);
      log({
        rawValue,
        parsedType: "PALLET",
        parsedCode: line.palletId,
        result: "SUCCESS",
        message: `Chọn pallet ${line.palletId}`,
        palletId: line.palletId,
        taskNo: task.taskNo,
        scanType: "PUTAWAY_PALLET",
      });
    } catch (error: any) {
      const errorMessage = error?.message ?? String(error);
      setMessage(errorMessage);
      log({
        rawValue,
        parsedType: "UNKNOWN",
        parsedCode: null,
        result: "ERROR",
        message: errorMessage,
        scanType: "PUTAWAY_PALLET",
      });
    }
  };

  const handleLocationScan = (rawValue: string) => {
    try {
      if (!task || !line) throw new Error("Hãy scan task và pallet trước");
      const trimmed = rawValue.trim().replace(/^LOC:/i, "");
      const next = confirmTaskLineByScan({
        taskNo: task.taskNo,
        palletId: line.palletId,
        actualLocationCode: trimmed,
        allowOpenTaskConfirm: settings.allowOpenTaskConfirm,
        allowActualLocationOverride: settings.allowActualLocationOverride,
      });

      if (next.result === "WARNING" && !settings.allowActualLocationOverride) {
        setMessage(next.message);
        log({
          rawValue,
          parsedType: "LOCATION",
          parsedCode: trimmed,
          result: "WARNING",
          message: next.message,
          palletId: line.palletId,
          locationCode: trimmed,
          taskNo: task.taskNo,
          scanType: "PUTAWAY_LOCATION",
        });
        return;
      }

      setMessage(next.message);
      setTaskNo(next.task.taskNo);
      setPalletId("");
      setActualLocationCode("");
      log({
        rawValue,
        parsedType: "LOCATION",
        parsedCode: trimmed,
        result: next.result,
        message: next.message,
        palletId: line.palletId,
        locationCode: next.actualLocation ?? trimmed,
        taskNo: task.taskNo,
        scanType: "PUTAWAY_LOCATION",
      });
    } catch (error: any) {
      const errorMessage = error?.message ?? String(error);
      setMessage(errorMessage);
      log({
        rawValue,
        parsedType: "UNKNOWN",
        parsedCode: null,
        result: "ERROR",
        message: errorMessage,
        scanType: "PUTAWAY_LOCATION",
      });
    }
  };

  return (
    <div className="space-y-4 pb-6">
      <div className="flex items-center gap-2">
        <Button asChild variant="outline" size="icon" className="h-11 w-11 rounded-2xl">
          <Link to="/mobile">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Scan</div>
          <h1 className="text-2xl font-semibold">Putaway</h1>
        </div>
      </div>

      <Card className="rounded-[1.75rem]">
        <CardContent className="space-y-3 p-4">
          <div className="flex items-center gap-2">
            <ScanLine className="h-4 w-4 text-primary" />
            <div className="text-sm font-semibold">1. Scan Task No</div>
          </div>
          <ScanInput label="Task No" placeholder="TASK:..." onScan={handleTaskScan} />
          <div className="flex flex-wrap gap-2">
            {openTasks.slice(0, 5).map((t) => (
              <Button key={t.id} variant="outline" className="h-10 rounded-full" onClick={() => setTaskNo(t.taskNo)}>
                {t.taskNo}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {task && (
        <Card className="rounded-[1.75rem]">
          <CardContent className="space-y-3 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Task</div>
                <div className="font-mono text-xl font-semibold">{task.taskNo}</div>
                <div className="text-xs text-muted-foreground">{task.inboundNo || "-"}</div>
              </div>
              <TaskStatusBadge status={task.status} />
            </div>
            <div className="grid grid-cols-3 gap-2 text-sm">
              <div className="rounded-2xl bg-muted/40 p-3">
                <div className="text-[11px] uppercase text-muted-foreground">Type</div>
                <div className="mt-1 font-medium">{task.taskType}</div>
              </div>
              <div className="rounded-2xl bg-muted/40 p-3">
                <div className="text-[11px] uppercase text-muted-foreground">Lines</div>
                <div className="mt-1 font-medium">{lines.length}</div>
              </div>
              <div className="rounded-2xl bg-muted/40 p-3">
                <div className="text-[11px] uppercase text-muted-foreground">Confirmed</div>
                <div className="mt-1 font-medium">{lines.filter((l) => l.status === "Confirmed").length}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {task && (
        <Card className="rounded-[1.75rem]">
          <CardContent className="space-y-3 p-4">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-primary" />
              <div className="text-sm font-semibold">2. Scan Pallet</div>
            </div>
            <ScanInput label="Pallet ID" placeholder="PLT:..." onScan={handlePalletScan} />

            {line && (
              <div className="rounded-2xl border p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-mono font-semibold">{line.palletId}</div>
                  <Badge variant="secondary">Line {line.lineNo}</Badge>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">Target bin</div>
                <div className="font-mono text-sm">{line.toLocation}</div>
                <div className="text-xs text-muted-foreground">{formatLocationPath(locations.find((l) => l.locationCode === line.toLocation) ?? null)}</div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {task && line && (
        <Card className="rounded-[1.75rem]">
          <CardContent className="space-y-3 p-4">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary" />
              <div className="text-sm font-semibold">3. Scan Location</div>
            </div>
            <ScanInput label="Actual Location" placeholder="LOC:..." onScan={handleLocationScan} />
            <div className="rounded-2xl border p-3 text-sm">
              <div className="text-[11px] uppercase text-muted-foreground">Planned</div>
              <div className="font-mono">{targetLocation || "—"}</div>
              <div className="text-xs text-muted-foreground">{formatLocationPath(locations.find((l) => l.locationCode === targetLocation) ?? null)}</div>
            </div>
            <div className="rounded-2xl border p-3 text-sm">
              <div className="text-[11px] uppercase text-muted-foreground">Actual</div>
              <div className="font-mono">{actualLocation || "—"}</div>
              <div className="text-xs text-muted-foreground">{formatLocationPath(locations.find((l) => l.locationCode === actualLocation) ?? null)}</div>
            </div>
            <div className="text-xs text-muted-foreground">
              Open task confirm: {settings.allowOpenTaskConfirm ? "On" : "Off"} · Override: {settings.allowActualLocationOverride ? "On" : "Off"}
            </div>
          </CardContent>
        </Card>
      )}

      {message && (
        <div className="rounded-2xl border p-3 text-sm">
          {message}
        </div>
      )}
    </div>
  );
}
