import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useStore } from "@/services/store";
import { confirmTaskLine } from "@/services/taskService";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SimpleScanInput, normalizeScanCode } from "@/components/mobile/SimpleScanInput";
import { TaskStatusBadge } from "@/components/StatusBadges";
import { formatLocationPath } from "@/utils/location";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle, AlertTriangle, Package, MapPin } from "lucide-react";

export const Route = createFileRoute("/mobile/execute/$taskNo")({
  component: MobileExecuteTask,
});

function MobileExecuteTask() {
  const { taskNo } = Route.useParams();
  const tasks = useStore((s) => s.tasks);
  const taskLines = useStore((s) => s.taskLines);
  const pallets = useStore((s) => s.pallets);
  const locations = useStore((s) => s.locations);

  const [palletInput, setPalletInput] = useState("");
  const [locationInput, setLocationInput] = useState("");
  const [lastConfirmed, setLastConfirmed] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  const task = useMemo(() => tasks.find((t) => t.taskNo === taskNo), [tasks, taskNo]);

  const taskLinesForTask = useMemo(() => {
    if (!task) return [];
    return taskLines.filter((l) => l.taskId === task.id);
  }, [taskLines, task]);

  const unconfirmedLines = useMemo(() => {
    return taskLinesForTask.filter((l) => l.status === "Open");
  }, [taskLinesForTask]);

  const confirmedCount = taskLinesForTask.filter((l) => l.status === "Confirmed").length;
  const totalCount = taskLinesForTask.length;

  const locationPathByCode = useMemo(
    () => Object.fromEntries(locations.map((l) => [l.locationCode, formatLocationPath(l)])),
    [locations],
  );

  // Find matching line for scanned pallet
  const findMatchingLine = (palletId: string) => {
    return unconfirmedLines.find((l) => l.palletId?.toUpperCase() === palletId.toUpperCase());
  };

  const handlePalletScan = (value: string) => {
    const normalized = normalizeScanCode(value);
    const palletId = normalized.code;

    const matchedLine = findMatchingLine(palletId);
    if (!matchedLine) {
      toast.error(`Không tìm thấy line với pallet: ${palletId}`);
      return;
    }

    setPalletInput(palletId);
    setWarning(null);

    // Show target/current info based on task type
    const pallet = pallets.find((p) => p.palletId?.toUpperCase() === palletId.toUpperCase());
    const taskType = task?.taskType;

    if (taskType === "PUTAWAY" || taskType === "MOVE") {
      // Show target bin (toLocation in task lines)
      toast.info(`Target bin: ${matchedLine.toLocation}`);
      if (pallet) {
        toast.info(`Current location: ${pallet.currentLocation ?? "—"}`);
      }
    } else if (taskType === "PICK") {
      // Show current location
      toast.info(`Current location: ${pallet?.currentLocation ?? "—"}`);
    }
  };

  const handleLocationScan = (value: string) => {
    const normalized = normalizeScanCode(value);
    const locationCode = normalized.code;
    setLocationInput(locationCode);
  };

  const handleConfirm = () => {
    if (!task || !palletInput) return;

    const normalizedPallet = normalizeScanCode(palletInput);
    const palletId = normalizedPallet.code;
    const matchedLine = findMatchingLine(palletId);

    if (!matchedLine) {
      toast.error("Không tìm thấy line tương ứng");
      return;
    }

    const taskType = task.taskType;

    // ===== PUTAWAY/MOVE: bắt buộc scan Actual Location =====
    if (taskType === "PUTAWAY" || taskType === "MOVE") {
      if (!locationInput) {
        toast.error("Vui lòng scan/nhập Actual Location trước khi confirm");
        return;
      }

      const normalizedLoc = normalizeScanCode(locationInput);
      const actualLoc = normalizedLoc.code;
      if (actualLoc !== matchedLine.toLocation) {
        setWarning(`⚠️ Actual Location (${actualLoc}) khác Target Bin (${matchedLine.toLocation})`);
        return;
      }

      // Location đúng → confirm
      try {
        confirmTaskLine(matchedLine.id, { allowOpenTask: true, actualLocation: actualLoc });
        setPalletInput("");
        setLocationInput("");
        setWarning(null);

        const remaining = unconfirmedLines.length - 1;
        toast.success(`Đã confirm pallet ${palletId}. Còn ${remaining} line chưa confirm.`);
        if (remaining === 0) {
          toast.success("Task đã hoàn thành!");
        }
      } catch (e: any) {
        toast.error(e.message);
      }
      return;
    }

    // ===== PICK: bắt buộc scan Actual Location (verify pallet đã lấy đúng chỗ) =====
    if (taskType === "PICK") {
      if (!locationInput) {
        toast.error("Vui lòng scan/nhập Actual Location (vị trí lấy pallet thực tế) trước khi confirm");
        return;
      }

      const pallet = pallets.find((p) => p.palletId?.toUpperCase() === palletId.toUpperCase());
      const normalizedLoc = normalizeScanCode(locationInput);
      const actualLoc = normalizedLoc.code;

      if (pallet && pallet.currentLocation && actualLoc !== pallet.currentLocation) {
        setWarning(`⚠️ Location scan (${actualLoc}) khác Pallet current location (${pallet.currentLocation})`);
        return;
      }

      // Location đúng → confirm
      try {
        confirmTaskLine(matchedLine.id, { allowOpenTask: true, actualLocation: actualLoc });
        setPalletInput("");
        setLocationInput("");
        setWarning(null);

        const remaining = unconfirmedLines.length - 1;
        toast.success(`Đã confirm pallet ${palletId}. Còn ${remaining} line chưa confirm.`);
        if (remaining === 0) {
          toast.success("Task đã hoàn thành!");
        }
      } catch (e: any) {
        toast.error(e.message);
      }
      return;
    }
  };

  if (!task) {
    return (
      <div className="space-y-4">
        <Link to="/mobile/tasks" className="flex items-center gap-2 text-muted-foreground">
          <ArrowLeft className="h-4 w-4" /> Về danh sách task
        </Link>
        <Card className="rounded-xl">
          <CardContent className="p-6 text-center">
            <p className="text-muted-foreground">Không tìm thấy task: {taskNo}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isComplete = confirmedCount === totalCount && totalCount > 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <Link to="/mobile/tasks" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Quay lại
      </Link>

      <div className="text-center">
        <h1 className="text-xl font-semibold font-mono">{task.taskNo}</h1>
        <div className="flex items-center justify-center gap-2 mt-1">
          <Badge variant="outline">{task.taskType}</Badge>
          <TaskStatusBadge status={task.status} />
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Đã confirm: {confirmedCount}/{totalCount} lines
        </p>
      </div>

      {/* Task Complete Banner */}
      {isComplete ? (
        <Card className="rounded-xl border-green-500 bg-green-50">
          <CardContent className="p-6 text-center space-y-2">
            <CheckCircle className="h-10 w-10 text-green-600 mx-auto" />
            <p className="font-semibold text-green-700">Task đã hoàn thành!</p>
            <Link
              to="/mobile/tasks"
              className="mt-2 inline-flex items-center justify-center gap-2 w-full h-10 px-4 rounded-md border border-input bg-background font-medium hover:bg-accent"
            >
              Về danh sách task
            </Link>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Scan Pallet */}
          <Card className="rounded-xl">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Package className="h-5 w-5 text-muted-foreground" />
                <label className="text-sm font-medium">Scan/Nhập Pallet ID</label>
              </div>
              <SimpleScanInput
                placeholder="Nhập Pallet ID (VD: PLT-001)"
                onScan={handlePalletScan}
              />
              {palletInput && (
                <div className="text-sm text-muted-foreground">
                  Đã chọn: <span className="font-mono font-medium">{palletInput}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Scan Location (for PUTAWAY/MOVE) */}
          {(task.taskType === "PUTAWAY" || task.taskType === "MOVE") && palletInput && (
            <Card className="rounded-xl">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-muted-foreground" />
                  <label className="text-sm font-medium">Scan/Nhập Actual Location</label>
                </div>
                <SimpleScanInput
                  placeholder="Scan location thực tế..."
                  onScan={handleLocationScan}
                />
                {warning && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-yellow-50 text-yellow-800 text-sm">
                    <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                    {warning}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Confirm Button */}
          {palletInput && (
            <Button
              size="lg"
              className="w-full h-14 text-base"
              onClick={handleConfirm}
              disabled={!!warning}
            >
              <CheckCircle className="h-5 w-5 mr-2" />
              Confirm
            </Button>
          )}

          {/* Unconfirmed Lines */}
          <Card className="rounded-xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Lines chưa confirm ({unconfirmedLines.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {unconfirmedLines.length === 0 ? (
                <p className="text-sm text-muted-foreground">Tất cả đã confirm</p>
              ) : (
                unconfirmedLines.map((line) => {
                  const pallet = pallets.find((p) => p.palletId?.toUpperCase() === line.palletId?.toUpperCase());
                  return (
                    <div key={line.id} className="flex items-center justify-between text-sm p-2 rounded-lg bg-muted/50">
                      <div>
                        <span className="font-mono text-xs">{line.palletId ?? "—"}</span>
                        {task.taskType === "PUTAWAY" || task.taskType === "MOVE" ? (
                          <span className="text-xs text-muted-foreground ml-2">
                            → {line.toLocation}
                          </span>
                        ) : null}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {line.qty} {line.uom ?? "U"}
                      </span>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
