import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useStore } from "@/services/store";
import { cancelTask } from "@/services/taskService";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/PageHeader";
import { formatLocationPath } from "@/utils/location";
import { TaskListCard } from "@/components/TaskListCard";
import { toast } from "sonner";

export const Route = createFileRoute("/movements")({ component: MovementsPage });

const TYPES = ["LABEL_CREATED", "LABEL_ATTACHED", "LABEL_CANCELLED", "IN", "PUT", "MOVE", "PICK", "OUT", "ADJ"];

function MovementsPage() {
  const router = useRouter();
  const movements = useStore((s) => s.movements);
  const locations = useStore((s) => s.locations);
  const tasks = useStore((s) => s.tasks);
  const taskLines = useStore((s) => s.taskLines);
  const [type, setType] = useState("all");
  const [q, setQ] = useState("");

  const filtered = movements.filter((m) =>
    (type === "all" || m.movementType === type) &&
    (q === "" || m.palletId.toLowerCase().includes(q.toLowerCase()) || m.skuCode.toLowerCase().includes(q.toLowerCase()) || m.batchNo.toLowerCase().includes(q.toLowerCase())),
  );

  const allTasks = useMemo(() => tasks, [tasks]);

  const taskLineMap = useMemo(() => {
    const map = new Map<string, typeof taskLines>();
    for (const line of taskLines) {
      const arr = map.get(line.taskId) ?? [];
      arr.push(line);
      map.set(line.taskId, arr);
    }
    return map;
  }, [taskLines]);

  const openPrintTask = (taskNo: string) => {
    router.navigate({ to: "/tasks/$taskNo/print", params: { taskNo }, search: { autoprint: true } });
  };

  return (
    <div>
      <PageHeader title="Movement History" description="Toàn bộ giao dịch — không sửa, không xoá" />
      <Card className="rounded-2xl">
        <CardContent className="p-4">
          <div className="flex gap-2 mb-4">
            <Input placeholder="Search Pallet / SKU / Batch..." className="max-w-sm" value={q} onChange={(e) => setQ(e.target.value)} />
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Movement</TableHead><TableHead>Type</TableHead><TableHead>Pallet</TableHead>
                <TableHead>SKU</TableHead><TableHead>Batch</TableHead><TableHead className="text-right">Qty</TableHead>
                <TableHead>From → To</TableHead><TableHead>User</TableHead><TableHead>Time</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {filtered.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-mono text-xs">{m.movementId}</TableCell>
                    <TableCell><span className="text-xs font-medium px-2 py-1 rounded-md bg-secondary">{m.movementType}</span></TableCell>
                    <TableCell className="font-mono text-xs">{m.palletId}</TableCell>
                    <TableCell>{m.skuCode}</TableCell>
                    <TableCell className="font-mono text-xs">{m.batchNo}</TableCell>
                    <TableCell className="text-right">{m.qty}</TableCell>
                    <TableCell className="text-xs">{formatLocationPath(locations.find((l) => l.locationCode === m.fromLocation) ?? null)} → {formatLocationPath(locations.find((l) => l.locationCode === m.toLocation) ?? null)}</TableCell>
                    <TableCell className="text-xs">{m.user}</TableCell>
                    <TableCell className="text-xs">{new Date(m.timestamp).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && <TableRow><TableCell colSpan={9} className="text-center py-6 text-muted-foreground">Không có movement</TableCell></TableRow>}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <TaskListCard
        title="All Tasks"
        tasks={allTasks}
        lineMap={taskLineMap}
        emptyMessage="Không có task"
        onPrintTask={openPrintTask}
        onCancelTask={(task) => {
          try {
            cancelTask(task.id);
            toast.success("Cancelled task");
          } catch (e: any) {
            toast.error(e.message);
          }
        }}
      />
    </div>
  );
}
