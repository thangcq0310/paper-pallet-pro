import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useStore } from "@/services/store";
import { confirmTask, cancelTask } from "@/services/taskService";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/PageHeader";
import { TaskStatusBadge } from "@/components/StatusBadges";
import { toast } from "sonner";

export const Route = createFileRoute("/tasks")({ component: TasksPage });

function TasksPage() {
  const tasks = useStore((s) => s.tasks);
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

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
                      <Button size="sm" onClick={() => { try { confirmTask(t.id); toast.success("Confirmed"); } catch (e: any) { toast.error(e.message); } }}>Confirm</Button>
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
    </div>
  );
}
