import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useStore } from "@/services/store";
import { cancelTask } from "@/services/taskService";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/PageHeader";
import { TaskStatusBadge } from "@/components/StatusBadges";
import { toast } from "sonner";

export const Route = createFileRoute("/tasks")({ component: TasksPage });

function TasksPage() {
  const router = useRouter();
  const tasks = useStore((s) => s.tasks);
  const taskLines = useStore((s) => s.taskLines);
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const lineStats = useMemo(() => {
    const map = new Map<string, { lineCount: number; confirmedLineCount: number }>();
    for (const l of taskLines) {
      const st = map.get(l.taskId) ?? { lineCount: 0, confirmedLineCount: 0 };
      st.lineCount += 1;
      if (l.status === "Confirmed") st.confirmedLineCount += 1;
      map.set(l.taskId, st);
    }
    return map;
  }, [taskLines]);

  const filtered = tasks.filter((t) =>
    (typeFilter === "all" || t.taskType === typeFilter) &&
    (statusFilter === "all" || t.status === statusFilter),
  );

  const doPrint = (taskNo: string) => {
    router.navigate({ to: "/tasks/$taskNo/print", params: { taskNo }, search: { autoprint: true } });
  };

  return (
    <div>
      <PageHeader title="Tasks" description="Task header + lines (confirm theo line)" />
      <Card className="rounded-2xl">
        <CardContent className="p-4">
          <div className="flex gap-2 mb-4">
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {["PUTAWAY", "MOVE", "PICK", "ADJUST", "COUNT"].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                {["Open", "Printed", "Partially Confirmed", "Confirmed", "Cancelled"].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Task No</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Lines</TableHead>
                <TableHead className="text-right">Confirmed</TableHead>
                <TableHead className="text-right">Print</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((t) => {
                const st = lineStats.get(t.id) ?? { lineCount: 0, confirmedLineCount: 0 };
                return (
                  <TableRow key={t.id}>
                    <TableCell className="font-mono text-xs">{t.taskNo}</TableCell>
                    <TableCell>{t.taskType}</TableCell>
                    <TableCell><TaskStatusBadge status={t.status} /></TableCell>
                    <TableCell className="text-right font-mono">{st.lineCount}</TableCell>
                    <TableCell className="text-right font-mono">{st.confirmedLineCount}</TableCell>
                    <TableCell className="text-right font-mono">{t.printCount}</TableCell>
                    <TableCell className="text-xs">{new Date(t.createdAt).toLocaleString()}</TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button size="sm" variant="outline" asChild>
                        <Link to={`/tasks/${t.taskNo}`}>View</Link>
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => doPrint(t.taskNo)} disabled={t.status === "Confirmed" || t.status === "Cancelled"}>
                        Print
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          try {
                            cancelTask(t.id);
                            toast.success("Cancelled");
                          } catch (e: any) {
                            toast.error(e.message);
                          }
                        }}
                        disabled={t.status === "Confirmed" || t.status === "Cancelled"}
                      >
                        Cancel
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center py-6 text-muted-foreground">Không có task</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
