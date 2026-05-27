import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useStore } from "@/services/store";
import { confirmTask, cancelTask } from "@/services/taskService";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/PageHeader";
import { TaskStatusBadge } from "@/components/StatusBadges";
import { toast } from "sonner";

export const Route = createFileRoute("/tasks")({ component: TasksPage });

function TasksPage() {
  const tasks = useStore((s) => s.tasks);
  const locations = useStore((s) => s.locations);
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTaskId, setConfirmTaskId] = useState<string>("");
  const [actualLocation, setActualLocation] = useState<string>("");

  const putawayTargets = locations.filter((l) =>
    l.status === "Active" &&
    !["RECEIVING", "STAGING-01", "DOCK-01", "SHIPPED"].includes(l.locationCode) &&
    l.currentPalletCount < l.capacityPallet
  );

  const filtered = tasks.filter((t) =>
    (typeFilter === "all" || t.taskType === typeFilter) &&
    (statusFilter === "all" || t.status === statusFilter),
  );

  return (
    <div>
      <PageHeader title="Tasks" description="Tất cả warehouse tasks" />
      <Card className="rounded-2xl">
        <CardContent className="p-4">
          <div className="flex gap-2 mb-4">
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {["PUTAWAY", "MOVE", "PICK", "LOAD"].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                {["Open", "In Progress", "Confirmed", "Cancelled"].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Table>
            <TableHeader><TableRow>
              <TableHead>Task No</TableHead><TableHead>Type</TableHead><TableHead>Pallet</TableHead>
              <TableHead>From</TableHead><TableHead>To</TableHead><TableHead>Priority</TableHead>
              <TableHead>Status</TableHead><TableHead>Created</TableHead><TableHead></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {filtered.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-mono text-xs">{t.taskNo}</TableCell>
                  <TableCell>{t.taskType}</TableCell>
                  <TableCell className="font-mono text-xs">{t.palletId}</TableCell>
                  <TableCell className="font-mono text-xs">{t.fromLocation}</TableCell>
                  <TableCell className="font-mono text-xs">{t.toLocation}</TableCell>
                  <TableCell>{t.priority}</TableCell>
                  <TableCell><TaskStatusBadge status={t.status} /></TableCell>
                  <TableCell className="text-xs">{new Date(t.createdAt).toLocaleString()}</TableCell>
                  <TableCell className="text-right space-x-2">
                    {(t.status === "Open" || t.status === "In Progress") && <>
                      <Button
                        size="sm"
                        onClick={() => {
                          if (t.taskType === "PUTAWAY") {
                            setConfirmTaskId(t.id);
                            setActualLocation(t.toLocation);
                            setConfirmOpen(true);
                            return;
                          }
                          try {
                            confirmTask(t.id);
                            toast.success("Confirmed");
                          } catch (e: any) {
                            toast.error(e.message);
                          }
                        }}
                      >
                        Confirm
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => cancelTask(t.id)}>Cancel</Button>
                    </>}
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && <TableRow><TableCell colSpan={9} className="text-center py-6 text-muted-foreground">Không có task</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Putaway</DialogTitle>
            <DialogDescription>Chọn Actual Location cho task PUTAWAY.</DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label>Actual Location</Label>
            <Select value={actualLocation} onValueChange={setActualLocation}>
              <SelectTrigger>
                <SelectValue placeholder="Chọn location thực tế" />
              </SelectTrigger>
              <SelectContent>
                {putawayTargets.map((l) => (
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
                try {
                  confirmTask(confirmTaskId, actualLocation);
                  toast.success("Confirmed");
                  setConfirmOpen(false);
                } catch (e: any) {
                  toast.error(e.message);
                }
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
