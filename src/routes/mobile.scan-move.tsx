import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ScanInput } from "@/components/mobile/ScanInput";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useStore } from "@/services/store";
import { loadMobileScanSettings } from "@/services/mobileScanSettings";
import { appendScanEvent } from "@/services/scanService";
import { confirmTaskLineByScan, getOpenTasksByType, getTaskByParsed } from "@/services/mobileWorkflowService";
import { formatLocationPath } from "@/utils/location";
import { TaskStatusBadge } from "@/components/StatusBadges";
import { ArrowLeft, ScanLine, Package, MapPin } from "lucide-react";
import { expectParsedScanType, parseScannedCode } from "@/utils/scan";

export const Route = createFileRoute("/mobile/scan-move")({ component: MobileScanMovePage });

function MobileScanMovePage() {
  const tasks = useStore((s) => s.tasks);
  const taskLines = useStore((s) => s.taskLines);
  const locations = useStore((s) => s.locations);
  const settings = loadMobileScanSettings();
  const palletInputRef = useRef<HTMLInputElement | null>(null);

  const [taskNo, setTaskNo] = useState("");
  const [palletId, setPalletId] = useState("");
  const [actualLocationCode, setActualLocationCode] = useState("");
  const [message, setMessage] = useState("");
  const [lastConfirmation, setLastConfirmation] = useState<{
    palletId: string;
    lineNo: number;
    confirmedCount: number;
    totalCount: number;
    remainingCount: number;
    nextPalletId: string | null;
    nextTargetLocation: string | null;
  } | null>(null);

  const task = useMemo(() => tasks.find((t) => t.taskNo === taskNo) ?? null, [tasks, taskNo]);
  const lines = useMemo(
    () => taskLines.filter((l) => l.taskNo === taskNo).sort((a, b) => a.lineNo - b.lineNo),
    [taskLines, taskNo],
  );
  const line = useMemo(() => lines.find((l) => l.palletId === palletId) ?? null, [lines, palletId]);
  const openTasks = useMemo(() => getOpenTasksByType("MOVE"), [tasks, taskLines]);
  const targetLocation = line?.toLocation ?? "";
  const actualLocation = actualLocationCode.trim() ? actualLocationCode.trim() : targetLocation;
  const confirmedCount = lines.filter((item) => item.status === "Confirmed").length;
  const openLines = lines.filter((item) => item.status === "Open");
  const nextLine = openLines.find((item) => item.palletId !== palletId) ?? openLines[0] ?? null;
  const canOverrideActualLocation = settings.role !== "Operator" && settings.allowActualLocationOverride;

  useEffect(() => {
    if (taskNo || typeof window === "undefined") return;
    const queryTaskNo = new URLSearchParams(window.location.search).get("taskNo")?.trim();
    if (!queryTaskNo) return;
    const next = tasks.find((t) => t.taskNo === queryTaskNo);
    if (next?.taskType === "MOVE") {
      setTaskNo(next.taskNo);
      setMessage(`Đã mở task ${next.taskNo}`);
    }
  }, [taskNo, tasks]);

  useEffect(() => {
    if (!palletId) return;
    setLastConfirmation(null);
  }, [palletId]);

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
      const parsed = parseScannedCode(rawValue);
      const taskCode = expectParsedScanType(parsed, "TASK", "Hãy scan Task No hợp lệ");
      const next = getTaskByParsed(parsed);
      if (next.task.taskType !== "MOVE") {
        throw new Error(`Task ${next.task.taskNo} không phải MOVE`);
      }
      setTaskNo(next.task.taskNo);
      setPalletId("");
      setActualLocationCode("");
      setLastConfirmation(null);
      setMessage(`Chọn task ${next.task.taskNo}`);
      log({
        rawValue,
        parsedType: next.parsed.parsedType,
        parsedCode: taskCode,
        result: "SUCCESS",
        message: `Chọn task ${next.task.taskNo}`,
        taskNo: next.task.taskNo,
        scanType: "MOVE_TASK",
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
        scanType: "MOVE_TASK",
      });
    }
  };

  const handlePalletScan = (rawValue: string) => {
    try {
      if (!task) throw new Error("Hãy scan Task No trước");
      const parsed = parseScannedCode(rawValue);
      const palletCode = expectParsedScanType(parsed, "PALLET", "Hãy scan Pallet ID hợp lệ");
      const line = lines.find((item) => item.palletId.toUpperCase() === palletCode.toUpperCase());
      if (!line) throw new Error(`Pallet ${rawValue} không thuộc task ${task.taskNo}`);
      setPalletId(line.palletId);
      setActualLocationCode(line.toLocation ?? "");
      setLastConfirmation(null);
      setMessage(`Pallet ${line.palletId} -> ${line.toLocation}`);
      log({
        rawValue,
        parsedType: parsed.parsedType,
        parsedCode: palletCode,
        result: "SUCCESS",
        message: `Chọn pallet ${line.palletId}`,
        palletId: line.palletId,
        taskNo: task.taskNo,
        scanType: "MOVE_PALLET",
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
        scanType: "MOVE_PALLET",
      });
    }
  };

  const handleLocationScan = (rawValue: string) => {
    try {
      if (!task || !line) throw new Error("Hãy scan task và pallet trước");
      const parsed = parseScannedCode(rawValue);
      const locationCode = expectParsedScanType(parsed, "LOCATION", "Hãy scan Location hợp lệ");
      const next = confirmTaskLineByScan({
        taskNo: task.taskNo,
        palletId: line.palletId,
        actualLocationCode: locationCode,
        allowOpenTaskConfirm: settings.allowOpenTaskConfirm,
        allowActualLocationOverride: settings.allowActualLocationOverride,
        role: settings.role,
      });

      if (next.result === "WARNING" && !canOverrideActualLocation) {
        setMessage(next.message);
        log({
          rawValue,
          parsedType: parsed.parsedType,
          parsedCode: locationCode,
          result: "WARNING",
          message: next.message,
          palletId: line.palletId,
          locationCode,
          taskNo: task.taskNo,
          scanType: "MOVE_LOCATION",
        });
        return;
      }

      setMessage(next.message);
      setTaskNo(next.task.taskNo);
      setPalletId("");
      setActualLocationCode("");
      const remainingCount = Math.max(0, openLines.length - 1);
      setLastConfirmation({
        palletId: line.palletId,
        lineNo: line.lineNo,
        confirmedCount: confirmedCount + 1,
        totalCount: lines.length,
        remainingCount,
        nextPalletId: nextLine?.palletId ?? null,
        nextTargetLocation: nextLine?.toLocation ?? null,
      });
      window.requestAnimationFrame(() => palletInputRef.current?.focus());
      log({
        rawValue,
        parsedType: parsed.parsedType,
        parsedCode: locationCode,
        result: next.result,
        message: next.message,
        palletId: line.palletId,
        locationCode: next.actualLocation ?? locationCode,
        taskNo: task.taskNo,
        scanType: "MOVE_LOCATION",
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
        scanType: "MOVE_LOCATION",
      });
    }
  };

  return (
    <div className="space-y-4 pb-6">
      <div className="flex items-center gap-2">
        <Button asChild variant="outline" size="icon" className="h-11 w-11 rounded-2xl">
          <a href="/mobile">
            <ArrowLeft className="h-4 w-4" />
          </a>
        </Button>
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Scan</div>
          <h1 className="text-2xl font-semibold">Move</h1>
        </div>
      </div>

      <Card className="rounded-[1.75rem]">
        <CardContent className="space-y-3 p-4">
          <div className="flex items-center gap-2">
            <ScanLine className="h-4 w-4 text-primary" />
            <div className="text-sm font-semibold">1. Scan Task No</div>
          </div>
          <ScanInput label="Task No" placeholder="TASK:..." onScan={(rawValue) => handleTaskScan(rawValue)} />
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
                <div className="text-xs text-muted-foreground">{task.note || "-"}</div>
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
            <ScanInput
              label="Pallet ID"
              placeholder="PLT:..."
              inputRef={palletInputRef}
              onScan={(rawValue) => handlePalletScan(rawValue)}
            />

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
              <div className="text-sm font-semibold">3. Scan Target Location</div>
            </div>
            <ScanInput label="Target Location" placeholder="LOC:..." onScan={(rawValue) => handleLocationScan(rawValue)} />
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
              Demo setting · Role: {settings.role} · Open task confirm: {settings.allowOpenTaskConfirm ? "On" : "Off"} · Override: {settings.allowActualLocationOverride ? "On" : "Off"}
            </div>
          </CardContent>
        </Card>
      )}

      {lastConfirmation && (
        <Card className="rounded-[1.75rem] border-primary/40 bg-primary/5">
          <CardContent className="space-y-4 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Confirmed</div>
                <div className="mt-1 text-lg font-semibold">Pallet {lastConfirmation.palletId}</div>
                <div className="text-xs text-muted-foreground">Line {lastConfirmation.lineNo}</div>
              </div>
              <Badge variant="default">{lastConfirmation.remainingCount === 0 ? "Done" : "In progress"}</Badge>
            </div>

            <div className="grid grid-cols-3 gap-2 text-sm">
              <div className="rounded-2xl bg-background p-3">
                <div className="text-[11px] uppercase text-muted-foreground">Confirmed</div>
                <div className="mt-1 font-semibold">{lastConfirmation.confirmedCount}/{lastConfirmation.totalCount}</div>
              </div>
              <div className="rounded-2xl bg-background p-3">
                <div className="text-[11px] uppercase text-muted-foreground">Remaining</div>
                <div className="mt-1 font-semibold">{lastConfirmation.remainingCount}</div>
              </div>
              <div className="rounded-2xl bg-background p-3">
                <div className="text-[11px] uppercase text-muted-foreground">Next</div>
                <div className="mt-1 font-mono font-semibold">{lastConfirmation.nextPalletId ?? "—"}</div>
              </div>
            </div>

            {lastConfirmation.remainingCount === 0 ? (
              <div className="space-y-3">
                <div className="rounded-2xl border border-primary/20 bg-background p-3 text-sm font-semibold text-primary">
                  Task đã hoàn thành
                </div>
                <Button asChild className="h-12 w-full rounded-2xl">
                  <a href="/mobile/tasks">Về danh sách task</a>
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {lastConfirmation.nextPalletId ? (
                  <div className="rounded-2xl border border-dashed p-3 text-sm">
                    <div className="text-[11px] uppercase text-muted-foreground">Gợi ý line tiếp theo</div>
                    <div className="mt-1 font-mono font-semibold">{lastConfirmation.nextPalletId}</div>
                    <div className="text-xs text-muted-foreground">{lastConfirmation.nextTargetLocation ?? "—"}</div>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed p-3 text-sm text-muted-foreground">
                    Không còn line Open.
                  </div>
                )}
                <Button className="h-12 w-full rounded-2xl" onClick={() => palletInputRef.current?.focus()}>
                  Scan pallet tiếp theo
                </Button>
              </div>
            )}
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
