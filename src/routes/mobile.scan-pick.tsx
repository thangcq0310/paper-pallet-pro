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
import { ArrowUpFromLine, ArrowLeft, ScanLine, Package, MapPin } from "lucide-react";

export const Route = createFileRoute("/mobile/scan-pick")({ component: MobileScanPickPage });

function MobileScanPickPage() {
  const tasks = useStore((s) => s.tasks);
  const taskLines = useStore((s) => s.taskLines);
  const locations = useStore((s) => s.locations);
  const settings = loadMobileScanSettings();

  const [taskNo, setTaskNo] = useState("");
  const [palletId, setPalletId] = useState("");
  const [currentLocationCode, setCurrentLocationCode] = useState("");
  const [message, setMessage] = useState("");

  const task = useMemo(() => tasks.find((t) => t.taskNo === taskNo) ?? null, [tasks, taskNo]);
  const lines = useMemo(
    () => taskLines.filter((l) => l.taskNo === taskNo).sort((a, b) => a.lineNo - b.lineNo),
    [taskLines, taskNo],
  );
  const line = useMemo(() => lines.find((l) => l.palletId === palletId) ?? null, [lines, palletId]);
  const openTasks = useMemo(() => getOpenTasksByType("PICK"), [tasks, taskLines]);

  useEffect(() => {
    if (taskNo || typeof window === "undefined") return;
    const queryTaskNo = new URLSearchParams(window.location.search).get("taskNo")?.trim();
    if (!queryTaskNo) return;
    const next = tasks.find((t) => t.taskNo === queryTaskNo);
    if (next?.taskType === "PICK") {
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
      locationCode: payload.locationCode ?? currentLocationCode ?? null,
      result: payload.result,
      message: payload.message,
      scannedBy: settings.operatorName,
    });
  };

  const handleTaskScan = (rawValue: string) => {
    try {
      const next = getTaskByScan(rawValue);
      if (next.task.taskType !== "PICK") {
        throw new Error(`Task ${next.task.taskNo} không phải PICK`);
      }
      setTaskNo(next.task.taskNo);
      setPalletId("");
      setCurrentLocationCode("");
      setMessage(`Chọn task ${next.task.taskNo}`);
      log({
        rawValue,
        parsedType: next.parsed.parsedType,
        parsedCode: next.parsed.parsedCode,
        result: "SUCCESS",
        message: `Chọn task ${next.task.taskNo}`,
        taskNo: next.task.taskNo,
        scanType: "PICK_TASK",
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
        scanType: "PICK_TASK",
      });
    }
  };

  const handlePalletScan = (rawValue: string) => {
    try {
      if (!task) throw new Error("Hãy scan Task No trước");
      const parsed = rawValue.trim().replace(/^PLT:/i, "").toUpperCase();
      const line = lines.find((item) => item.palletId.toUpperCase() === parsed);
      if (!line) throw new Error(`Pallet ${rawValue} không thuộc task ${task.taskNo}`);
      setPalletId(line.palletId);
      setCurrentLocationCode("");
      setMessage(`Pallet ${line.palletId} sẵn sàng xuất`);
      log({
        rawValue,
        parsedType: "PALLET",
        parsedCode: line.palletId,
        result: "SUCCESS",
        message: `Chọn pallet ${line.palletId}`,
        palletId: line.palletId,
        taskNo: task.taskNo,
        scanType: "PICK_PALLET",
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
        scanType: "PICK_PALLET",
      });
    }
  };

  const handleLocationScan = (rawValue: string) => {
    try {
      if (!task || !line) throw new Error("Hãy scan task và pallet trước");
      const trimmed = rawValue.trim().replace(/^LOC:/i, "");
      setCurrentLocationCode(trimmed);
      setMessage(`Đã scan location ${trimmed}`);
      log({
        rawValue,
        parsedType: "LOCATION",
        parsedCode: trimmed,
        result: "SUCCESS",
        message: `Scan current location ${trimmed}`,
        palletId: line.palletId,
        locationCode: trimmed,
        taskNo: task.taskNo,
        scanType: "PICK_LOCATION",
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
        scanType: "PICK_LOCATION",
      });
    }
  };

  const confirmPick = () => {
    try {
      if (!task || !line) throw new Error("Hãy scan task và pallet trước");
      const next = confirmTaskLineByScan({
        taskNo: task.taskNo,
        palletId: line.palletId,
        actualLocationCode: currentLocationCode.trim() || null,
        allowOpenTaskConfirm: settings.allowOpenTaskConfirm,
        allowActualLocationOverride: false,
      });
      setMessage(next.message);
      setTaskNo(next.task.taskNo);
      setPalletId("");
      setCurrentLocationCode("");
      log({
        rawValue: currentLocationCode.trim() || line.palletId,
        parsedType: currentLocationCode.trim() ? "LOCATION" : "PALLET",
        parsedCode: currentLocationCode.trim() || line.palletId,
        result: next.result,
        message: next.message,
        palletId: line.palletId,
        locationCode: currentLocationCode.trim() || null,
        taskNo: task.taskNo,
        scanType: "PICK_CONFIRM",
      });
    } catch (error: any) {
      const errorMessage = error?.message ?? String(error);
      setMessage(errorMessage);
      log({
        rawValue: currentLocationCode.trim() || line?.palletId || "",
        parsedType: currentLocationCode.trim() ? "LOCATION" : "PALLET",
        parsedCode: currentLocationCode.trim() || line?.palletId || null,
        result: "ERROR",
        message: errorMessage,
        palletId: line?.palletId ?? null,
        locationCode: currentLocationCode.trim() || null,
        taskNo: task?.taskNo ?? null,
        scanType: "PICK_CONFIRM",
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
          <h1 className="text-2xl font-semibold">Pick</h1>
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
                <div className="text-xs text-muted-foreground">{task.outboundNo || "-"}</div>
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
                <div className="mt-1 text-xs text-muted-foreground">From</div>
                <div className="font-mono text-sm">{line.fromLocation ?? "—"}</div>
                <div className="text-xs text-muted-foreground">{formatLocationPath(locations.find((l) => l.locationCode === line.fromLocation) ?? null)}</div>
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
              <div className="text-sm font-semibold">3. Optional Current Location</div>
            </div>
            <ScanInput label="Current Location" placeholder="LOC:..." onScan={handleLocationScan} />
            <div className="rounded-2xl border p-3 text-sm">
              <div className="text-[11px] uppercase text-muted-foreground">Scanned current location</div>
              <div className="font-mono">{currentLocationCode || "—"}</div>
              <div className="text-xs text-muted-foreground">{formatLocationPath(locations.find((l) => l.locationCode === currentLocationCode) ?? null)}</div>
            </div>
            <Button className="h-12 w-full rounded-2xl" onClick={confirmPick}>
              <ArrowUpFromLine className="mr-2 h-4 w-4" />
              Xác nhận xuất
            </Button>
            <div className="text-xs text-muted-foreground">
              Open task confirm: {settings.allowOpenTaskConfirm ? "On" : "Off"}
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
