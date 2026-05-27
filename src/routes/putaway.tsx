import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useStore } from "@/services/store";
import { createTask, confirmTask, cancelTask } from "@/services/taskService";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/PageHeader";
import { TaskStatusBadge } from "@/components/StatusBadges";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/putaway")({ component: PutawayPage });

function PutawayPage() {
  const pallets=useStore((s)=>s.pallets);
  const locations=useStore((s)=>s.locations);
  const tasks=useStore((s)=>s.tasks);
  const [palletId, setPalletId] = useState("");
  const [toLocation, setToLocation] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTaskId, setConfirmTaskId] = useState<string>("");
  const [actualLocation, setActualLocation] = useState<string>("");

  const labeled = pallets.filter((p) => p.status === "Labeled" && p.labelAttached);
  const targets = locations.filter((l) => l.status === "Active" && !["RECEIVING", "STAGING-01", "DOCK-01", "SHIPPED"].includes(l.locationCode) && l.currentPalletCount < l.capacityPallet);
  const openTasks = tasks.filter((t) => t.taskType === "PUTAWAY" && (t.status === "Open" || t.status === "In Progress"));

  const create = () => {
    try {
      const p = pallets.find((x) => x.palletId === palletId);
      if (!p) throw new Error("Chọn pallet");
      createTask({ taskType: "PUTAWAY", palletId, fromLocation: p.currentLocation, toLocation });
      toast.success("Đã tạo Putaway Task");
      setPalletId(""); setToLocation("");
    } catch (e: any) { toast.error(e.message); }
  };

  const confirm = (taskId: string, actualLocation: string) => {
    try { confirmTask(taskId, actualLocation); toast.success("Đã putaway"); }
    catch (e: any) { toast.error(e.message); }
  };

  return (
    <div>
      <PageHeader title="Putaway" description="Tạo task putaway & xác nhận vị trí thực tế" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="rounded-2xl">
          <CardContent className="p-6 space-y-4">
            <h3 className="font-semibold">Tạo Putaway Task</h3>
            <div>
              <Label>Pallet (đã Labeled)</Label>
              <Select value={palletId} onValueChange={setPalletId}>
                <SelectTrigger><SelectValue placeholder="Chọn pallet" /></SelectTrigger>
                <SelectContent>{labeled.map((p) => <SelectItem key={p.id} value={p.palletId}>{p.palletId} — {p.skuCode}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Location đích</Label>
              <Select value={toLocation} onValueChange={setToLocation}>
                <SelectTrigger><SelectValue placeholder="Chọn location" /></SelectTrigger>
                <SelectContent>{targets.map((l) => <SelectItem key={l.id} value={l.locationCode}>{l.locationCode} ({l.currentPalletCount}/{l.capacityPallet})</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Button onClick={create} disabled={!palletId || !toLocation}>Tạo Task</Button>
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardContent className="p-6">
            <h3 className="font-semibold mb-4">Open Putaway Tasks</h3>
            <Table>
              <TableHeader><TableRow><TableHead>Task</TableHead><TableHead>Pallet</TableHead><TableHead>Đến</TableHead><TableHead>Status</TableHead><TableHead></TableHead></TableRow></TableHeader>
              <TableBody>
                {openTasks.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-mono text-xs">{t.taskNo}</TableCell>
                    <TableCell className="font-mono text-xs">{t.palletId}</TableCell>
                  <TableCell className="font-mono text-xs">{t.toLocation}</TableCell>
                  <TableCell><TaskStatusBadge status={t.status} /></TableCell>
                  <TableCell className="text-right space-x-2">
                      <Button
                        size="sm"
                        onClick={() => {
                          setConfirmTaskId(t.id);
                          setActualLocation(t.toLocation);
                          setConfirmOpen(true);
                        }}
                      >
                        Confirm
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => cancelTask(t.id)}>Cancel</Button>
                    </TableCell>
                  </TableRow>
                ))}
                {openTasks.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Không có task</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Putaway</DialogTitle>
            <DialogDescription>
              Chọn <span className="font-medium">Actual Location</span> (có thể khác location đề xuất trong task).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label>Actual Location</Label>
            <Select value={actualLocation} onValueChange={setActualLocation}>
              <SelectTrigger>
                <SelectValue placeholder="Chọn location thực tế" />
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

          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>Huỷ</Button>
            <Button
              onClick={() => {
                confirm(confirmTaskId, actualLocation);
                setConfirmOpen(false);
              }}
              disabled={!confirmTaskId || !actualLocation}
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
