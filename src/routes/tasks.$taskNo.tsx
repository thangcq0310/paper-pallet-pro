import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useStore } from "@/services/store";
import { cancelTask, cancelTaskLine, confirmAllTaskLines, confirmTaskLine } from "@/services/taskService";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/PageHeader";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TaskStatusBadge } from "@/components/StatusBadges";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { formatLocationPath } from "@/utils/location";

export const Route = createFileRoute("/tasks/$taskNo")({ component: TaskDetailPage });

function TaskDetailPage() {
  const { taskNo } = Route.useParams();
  const tasks = useStore((s) => s.tasks);
  const taskLines = useStore((s) => s.taskLines);
  const locations = useStore((s) => s.locations);

  const task = tasks.find((t) => t.taskNo === taskNo);
  const lines = useMemo(
    () => taskLines.filter((l) => l.taskNo === taskNo).sort((a, b) => a.lineNo - b.lineNo),
    [taskLines, taskNo],
  );

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmLineId, setConfirmLineId] = useState("");
  const [actualLocation, setActualLocation] = useState("");
  const confirmLine = lines.find((l) => l.id === confirmLineId);

  const actualLocationOptions = useMemo(() => {
    if (!task) return [];
    if (task.taskType === "PUTAWAY" || task.taskType === "MOVE") {
      return locations.filter((l) => l.locationType === "STORAGE" && l.status === "Active" && l.currentPalletCount < l.capacityPallet);
    }
    return [];
  }, [locations, task]);

  if (!task) {
    return (
      <div className="p-6">
        <Card className="rounded-2xl">
          <CardContent className="p-6 text-muted-foreground">Task không tồn tại.</CardContent>
        </Card>
      </div>
    );
  }

  const confirmedLineCount = lines.filter((l) => l.status === "Confirmed").length;

  return (
    <div className="space-y-4">
      <PageHeader
        title={`Task ${task.taskNo}`}
        description={`${task.taskType} • ${task.inboundNo || task.outboundNo || "—"}`}
        action={
          <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => window.location.assign(`/tasks/${encodeURIComponent(task.taskNo)}/print`)}
                      disabled={task.status === "Cancelled" || task.status === "Confirmed"}
                    >
                      Print
                    </Button>
            <Button
              variant="outline"
              onClick={() => {
                try {
                  confirmAllTaskLines(task.taskNo);
                  toast.success("Confirmed all lines");
                } catch (e: any) {
                  toast.error(e.message);
                }
              }}
              disabled={task.status !== "Printed" && task.status !== "Partially Confirmed"}
            >
              Confirm All
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                try {
                  cancelTask(task.id);
                  toast.success("Cancelled task");
                } catch (e: any) {
                  toast.error(e.message);
                }
              }}
              disabled={task.status === "Cancelled" || task.status === "Confirmed"}
            >
              Cancel Task
            </Button>
          </div>
        }
      />

      <Card className="rounded-2xl">
        <CardContent className="p-5">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-sm">
            <div>
              <div className="text-xs text-muted-foreground uppercase">Status</div>
              <TaskStatusBadge status={task.status} />
            </div>
            <div>
              <div className="text-xs text-muted-foreground uppercase">Lines</div>
              <div className="font-mono font-semibold">{lines.length}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground uppercase">Confirmed</div>
              <div className="font-mono font-semibold">{confirmedLineCount}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground uppercase">Print Count</div>
              <div className="font-mono font-semibold">{task.printCount}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardContent className="p-5">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>No</TableHead>
                <TableHead>Pallet</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Batch</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead>From</TableHead>
                <TableHead>To</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lines.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="font-mono text-xs">{l.lineNo}</TableCell>
                  <TableCell className="font-mono text-xs">{l.palletId}</TableCell>
                  <TableCell className="text-xs">{l.skuCode}</TableCell>
                  <TableCell className="font-mono text-xs">{l.batchNo}</TableCell>
                  <TableCell className="text-right font-mono">{l.qty}</TableCell>
                  <TableCell className="font-mono text-xs">{l.fromLocation ?? "—"}</TableCell>
                  <TableCell className="font-mono text-xs">{l.toLocation ?? "—"}</TableCell>
                  <TableCell>{l.status}</TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        if (task.taskType === "PUTAWAY" || task.taskType === "MOVE") {
                          setConfirmLineId(l.id);
                          setActualLocation(l.toLocation ?? "");
                          setConfirmOpen(true);
                          return;
                        }
                        try {
                          confirmTaskLine(l.id);
                          toast.success("Confirmed");
                        } catch (e: any) {
                          toast.error(e.message);
                        }
                      }}
                      disabled={l.status !== "Open" || !(task.status === "Printed" || task.status === "Partially Confirmed")}
                    >
                      Confirm
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        try {
                          cancelTaskLine(l.id);
                          toast.success("Cancelled line");
                        } catch (e: any) {
                          toast.error(e.message);
                        }
                      }}
                      disabled={l.status !== "Open"}
                    >
                      Cancel
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {lines.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-6 text-muted-foreground">Không có line</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Task Line</DialogTitle>
            <DialogDescription>
              Chọn <span className="font-medium">Actual Bin</span> (nếu khác To Bin).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label>Actual Bin</Label>
            <Select value={actualLocation} onValueChange={setActualLocation}>
              <SelectTrigger>
                <SelectValue placeholder="Chọn bin thực tế" />
              </SelectTrigger>
              <SelectContent>
                {actualLocationOptions.map((l) => (
                  <SelectItem key={l.id} value={l.locationCode}>
                    {l.locationCode} · {formatLocationPath(l)} ({l.currentPalletCount}/{l.capacityPallet})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>Huỷ</Button>
            <Button
              onClick={() => {
                try {
                  if (!confirmLine) throw new Error("Line không tồn tại");
                  confirmTaskLine(confirmLine.id, actualLocation);
                  toast.success("Confirmed");
                  setConfirmOpen(false);
                } catch (e: any) {
                  toast.error(e.message);
                }
              }}
              disabled={!confirmLineId || !actualLocation}
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
