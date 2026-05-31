import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useStore } from "@/services/store";
import { cancelTask, confirmTaskLine, createSingleLineTask } from "@/services/taskService";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/PageHeader";
import { TaskStatusBadge } from "@/components/StatusBadges";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/move")({ component: MovePage });

function MovePage() {
  const pallets = useStore((s) => s.pallets);
  const locations = useStore((s) => s.locations);
  const tasks = useStore((s) => s.tasks);
  const taskLines = useStore((s) => s.taskLines);

  const [palletId, setPalletId] = useState("");
  const [toLocation, setToLocation] = useState("");
  const [note, setNote] = useState("");

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmLineId, setConfirmLineId] = useState<string>("");
  const [actualLocation, setActualLocation] = useState<string>("");

  const movable = pallets.filter((p) => p.status === "In Stock" || p.status === "Staged");
  const pallet = pallets.find((p) => p.palletId === palletId);

  const targets = useMemo(() => {
    if (!pallet) return [];
    return locations.filter(
      (l) =>
        l.status === "Active" &&
        l.locationCode !== pallet.currentLocation &&
        l.locationType === "STORAGE" &&
        l.currentPalletCount < l.capacityPallet,
    );
  }, [locations, pallet]);

  const openMoveTasks = tasks.filter(
    (t) => t.taskType === "MOVE" && (t.status === "Open" || t.status === "Printed" || t.status === "Partially Confirmed"),
  );

  const submit = () => {
    try {
      if (!pallet) throw new Error("Chọn pallet");
      createSingleLineTask({ taskType: "MOVE", palletId, toLocation, note });
      toast.success("Đã tạo MOVE task");
      setPalletId("");
      setToLocation("");
      setNote("");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const doPrint = (taskId: string) => {
    const t = tasks.find((x) => x.id === taskId);
    if (!t) { toast.error("Task không tồn tại"); return; }
    window.open(`/tasks/${encodeURIComponent(t.taskNo)}/print`, "_blank", "noopener,noreferrer");
  };

  const doConfirm = (lineId: string, loc?: string) => {
    try {
      confirmTaskLine(lineId, loc);
      toast.success("Đã confirm MOVE");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <div>
      <PageHeader title="Move Location" description="Tạo task MOVE → in → làm thực tế → confirm" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="rounded-2xl">
          <CardContent className="p-6 space-y-4">
            <h3 className="font-semibold">Tạo MOVE Task</h3>
            <div>
              <Label>Pallet</Label>
              <Select value={palletId} onValueChange={setPalletId}>
                <SelectTrigger>
                  <SelectValue placeholder="Chọn pallet" />
                </SelectTrigger>
                <SelectContent>
                  {movable.map((p) => (
                    <SelectItem key={p.id} value={p.palletId}>
                      {p.palletId} — {p.skuCode} @ {p.currentLocation}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>To Location</Label>
              <Select value={toLocation} onValueChange={setToLocation} disabled={!pallet}>
                <SelectTrigger>
                  <SelectValue placeholder="Chọn location đích" />
                </SelectTrigger>
                <SelectContent>
                  {targets.map((l) => (
                    <SelectItem key={l.id} value={l.locationCode}>
                      {l.locationCode} ({l.currentPalletCount}/{l.capacityPallet})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Note</Label>
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} />
            </div>

            <Button onClick={submit} disabled={!palletId || !toLocation}>
              Tạo Task
            </Button>
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardContent className="p-6">
            <h3 className="font-semibold mb-4">Open MOVE Tasks</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Task</TableHead>
                  <TableHead>Pallet</TableHead>
                  <TableHead>From</TableHead>
                  <TableHead>To</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {openMoveTasks.map((t) => (
                  (() => {
                    const line = taskLines.find((l) => l.taskId === t.id);
                    if (!line) return null;
                    return (
                  <TableRow key={t.id}>
                    <TableCell className="font-mono text-xs">{t.taskNo}</TableCell>
                    <TableCell className="font-mono text-xs">{line.palletId}</TableCell>
                    <TableCell className="font-mono text-xs">{line.fromLocation ?? "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{line.toLocation ?? "—"}</TableCell>
                    <TableCell>
                      <TaskStatusBadge status={t.status} />
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button size="sm" variant="outline" onClick={() => doPrint(t.id)} disabled={t.status === "Cancelled" || t.status === "Confirmed"}>
                        Print
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => {
                          setConfirmLineId(line.id);
                          setActualLocation(line.toLocation ?? "");
                          setConfirmOpen(true);
                        }}
                        disabled={t.status !== "Printed"}
                      >
                        Confirm
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => { try { cancelTask(t.id); toast.success("Cancelled"); } catch (e: any) { toast.error(e.message); } }} disabled={t.status === "Cancelled" || t.status === "Confirmed"}>
                        Cancel
                      </Button>
                    </TableCell>
                  </TableRow>
                    );
                  })()
                ))}
                {openMoveTasks.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                      Không có task
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm MOVE</DialogTitle>
            <DialogDescription>Chọn Actual Location (nếu khác Target Location).</DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label>Actual Location</Label>
            <Select value={actualLocation} onValueChange={setActualLocation}>
              <SelectTrigger>
                <SelectValue placeholder="Chọn location thực tế" />
              </SelectTrigger>
              <SelectContent>
                {locations
                  .filter((l) => l.status === "Active" && l.locationType === "STORAGE" && l.currentPalletCount < l.capacityPallet)
                  .map((l) => (
                    <SelectItem key={l.id} value={l.locationCode}>
                      {l.locationCode} ({l.currentPalletCount}/{l.capacityPallet})
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Huỷ
            </Button>
            <Button
              onClick={() => {
                doConfirm(confirmLineId, actualLocation);
                setConfirmOpen(false);
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
