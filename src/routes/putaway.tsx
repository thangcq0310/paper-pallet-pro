import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useStore } from "@/services/store";
import { cancelTask, confirmAllTaskLines } from "@/services/taskService";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/PageHeader";
import { TaskStatusBadge } from "@/components/StatusBadges";
import { toast } from "sonner";

export const Route = createFileRoute("/putaway")({ component: PutawayPage });

function PutawayPage() {
  const tasks=useStore((s)=>s.tasks);
  const taskLines=useStore((s)=>s.taskLines);

  const openTasks = tasks.filter((t) =>
    t.taskType === "PUTAWAY" && (t.status === "Open" || t.status === "Printed" || t.status === "Partially Confirmed"),
  );

  const taskLinesByTaskId = useMemo(() => {
    const map = new Map<string, typeof taskLines>();
    for (const l of taskLines) {
      const arr = map.get(l.taskId) ?? [];
      arr.push(l);
      map.set(l.taskId, arr);
    }
    for (const [k, arr] of map.entries()) {
      map.set(k, [...arr].sort((a, b) => a.lineNo - b.lineNo));
    }
    return map;
  }, [taskLines]);

  const openPrint = (taskId: string) => {
    const t = tasks.find((x) => x.id === taskId);
    if (!t) { toast.error("Task không tồn tại"); return; }
    window.open(`/tasks/${encodeURIComponent(t.taskNo)}/print`, "_blank", "noopener,noreferrer");
  };

  return (
    <div>
      <PageHeader
        title="Putaway"
        description="TASK-FIRST: tạo PUTAWAY task ở màn Inbound Palletize & Putaway → in nhãn → làm thực tế → confirm theo line"
        action={
          <Button variant="outline" onClick={() => (window.location.href = "/pallet/create")}>
            Mở Inbound Palletize & Putaway
          </Button>
        }
      />

      <Card className="rounded-2xl">
        <CardContent className="p-6">
          <h3 className="font-semibold mb-4">PUTAWAY task đang mở</h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mã task</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead className="text-right">Tổng line</TableHead>
                <TableHead className="text-right">Đã confirm</TableHead>
                <TableHead className="text-right">Số lần in</TableHead>
                <TableHead className="text-right">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {openTasks.map((t) => {
                const lines = taskLinesByTaskId.get(t.id) ?? [];
                const confirmed = lines.filter((l) => l.status === "Confirmed").length;
                return (
                  <TableRow key={t.id}>
                    <TableCell className="font-mono text-xs">{t.taskNo}</TableCell>
                    <TableCell><TaskStatusBadge status={t.status} /></TableCell>
                    <TableCell className="text-right font-mono">{lines.length}</TableCell>
                    <TableCell className="text-right font-mono">{confirmed}</TableCell>
                    <TableCell className="text-right font-mono">{t.printCount}</TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button size="sm" variant="outline" asChild>
                        <Link to={`/tasks/${t.taskNo}`}>View</Link>
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => openPrint(t.id)} disabled={t.status === "Cancelled" || t.status === "Confirmed"}>Print</Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          try {
                            confirmAllTaskLines(t.taskNo);
                            toast.success("Confirmed all lines");
                          } catch (e: any) {
                            toast.error(e.message);
                          }
                        }}
                        disabled={t.status !== "Printed" && t.status !== "Partially Confirmed"}
                      >
                        Confirm All
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => { try { cancelTask(t.id); toast.success("Cancelled"); } catch (e: any) { toast.error(e.message); } }} disabled={t.status === "Cancelled" || t.status === "Confirmed"}>Cancel</Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {openTasks.length === 0 && (
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
  );
}
