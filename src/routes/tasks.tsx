import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useStore } from "@/services/store";
import { cancelTask } from "@/services/taskService";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/PageHeader";
import { TaskStatusBadge } from "@/components/StatusBadges";
import { toast } from "sonner";
import { ArrowUpFromLine, Boxes, ListChecks, Move, Printer, Search, XCircle } from "lucide-react";
import type { TaskStatus, TaskType, WarehouseTask } from "@/types";

export const Route = createFileRoute("/tasks")({ component: WarehouseTasklistPage });

const typeMeta: Record<string, { label: string; icon: typeof ListChecks; accent: string }> = {
  PUTAWAY: { label: "Putaway", icon: Boxes, accent: "border-l-emerald-500" },
  MOVE: { label: "Move", icon: Move, accent: "border-l-sky-500" },
  PICK: { label: "Pick", icon: ArrowUpFromLine, accent: "border-l-amber-500" },
  ADJUST: { label: "Adjust", icon: ListChecks, accent: "border-l-violet-500" },
  COUNT: { label: "Count", icon: ListChecks, accent: "border-l-slate-500" },
};

const taskTypeOrder: TaskType[] = ["PUTAWAY", "MOVE", "PICK", "ADJUST", "COUNT"];

function WarehouseTasklistPage() {
  const router = useRouter();
  const tasks = useStore((s) => s.tasks);
  const taskLines = useStore((s) => s.taskLines);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [query, setQuery] = useState("");

  const lineStats = useMemo(() => {
    const map = new Map<string, { lineCount: number; confirmedLineCount: number; openLineCount: number }>();
    for (const line of taskLines) {
      const current = map.get(line.taskId) ?? { lineCount: 0, confirmedLineCount: 0, openLineCount: 0 };
      current.lineCount += 1;
      if (line.status === "Confirmed") current.confirmedLineCount += 1;
      if (line.status === "Open") current.openLineCount += 1;
      map.set(line.taskId, current);
    }
    return map;
  }, [taskLines]);

  const summary = useMemo(() => {
    return {
      total: tasks.length,
      open: tasks.filter((task) => task.status === "Open").length,
      printed: tasks.filter((task) => task.status === "Printed").length,
      partial: tasks.filter((task) => task.status === "Partially Confirmed").length,
      confirmed: tasks.filter((task) => task.status === "Confirmed").length,
    };
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return tasks
      .filter((task) => (typeFilter === "all" || task.taskType === typeFilter) && (statusFilter === "all" || task.status === statusFilter))
      .filter((task) => {
        if (!normalizedQuery) return true;
        const haystack = [task.taskNo, task.inboundNo, task.outboundNo, task.note, task.instruction]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(normalizedQuery);
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [query, statusFilter, tasks, typeFilter]);

  const groupedTasks = useMemo(() => {
    const grouped = new Map<TaskType, WarehouseTask[]>();
    for (const taskType of taskTypeOrder) grouped.set(taskType, []);
    for (const task of filteredTasks) {
      const bucket = grouped.get(task.taskType) ?? [];
      bucket.push(task);
      grouped.set(task.taskType, bucket);
    }
    return grouped;
  }, [filteredTasks]);

  const doPrint = (taskNo: string) => {
    router.navigate({ to: "/tasks/$taskNo/print", params: { taskNo }, search: { autoprint: true } });
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Warehouse Tasklist" description="Theo dõi task vận hành kho theo loại nghiệp vụ, trạng thái và tiến độ line." />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <SummaryCard label="Tổng task" value={summary.total} tone="neutral" />
        <SummaryCard label="Open" value={summary.open} tone="info" />
        <SummaryCard label="Printed" value={summary.printed} tone="primary" />
        <SummaryCard label="Partially Confirmed" value={summary.partial} tone="warning" />
        <SummaryCard label="Confirmed" value={summary.confirmed} tone="success" />
      </div>

      <Card className="rounded-2xl">
        <CardContent className="p-4">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_220px_220px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-9"
                placeholder="Tìm theo Task No / inbound / outbound / note"
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger><SelectValue placeholder="Loại task" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả loại task</SelectItem>
                {taskTypeOrder.map((taskType) => (
                  <SelectItem key={taskType} value={taskType}>{taskType}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger><SelectValue placeholder="Trạng thái" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả trạng thái</SelectItem>
                {["Open", "Printed", "Partially Confirmed", "Confirmed", "Cancelled"].map((status) => (
                  <SelectItem key={status} value={status}>{status}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-5">
        {taskTypeOrder.map((taskType) => {
          const items = groupedTasks.get(taskType) ?? [];
          const meta = typeMeta[taskType];
          const Icon = meta.icon;

          if (!items.length) return null;

          return (
            <Card key={taskType} className="rounded-2xl">
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-xl bg-muted">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{meta.label}</CardTitle>
                      <div className="text-xs text-muted-foreground">{items.length} task</div>
                    </div>
                  </div>
                  <Badge variant="outline">{taskType}</Badge>
                </div>
              </CardHeader>
              <CardContent className="grid gap-3">
                {items.map((task) => {
                  const stats = lineStats.get(task.id) ?? { lineCount: 0, confirmedLineCount: 0, openLineCount: 0 };
                  const progress = stats.lineCount > 0 ? Math.round((stats.confirmedLineCount / stats.lineCount) * 100) : 0;
                  const reference = task.inboundNo || task.outboundNo || "-";

                  return (
                    <div key={task.id} className={`rounded-2xl border border-l-4 ${meta.accent} bg-card p-4`}>
                      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                        <div className="min-w-0 flex-1 space-y-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="font-mono text-sm font-semibold">{task.taskNo}</div>
                            <TaskStatusBadge status={task.status} />
                            <Badge variant="outline">Ref: {reference}</Badge>
                          </div>

                          <div className="grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
                            <Metric label="Lines" value={String(stats.lineCount)} />
                            <Metric label="Confirmed" value={String(stats.confirmedLineCount)} />
                            <Metric label="Open lines" value={String(stats.openLineCount)} />
                            <Metric label="Print count" value={String(task.printCount)} />
                          </div>

                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                              <span>Progress</span>
                              <span>{progress}%</span>
                            </div>
                            <div className="h-2 rounded-full bg-muted">
                              <div className="h-2 rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
                            </div>
                          </div>

                          <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                            <div>Created: {new Date(task.createdAt).toLocaleString()}</div>
                            <div>Priority: {task.priority}</div>
                            <div>Instruction: {task.instruction || "-"}</div>
                            <div>Note: {task.note || "-"}</div>
                          </div>
                        </div>

                        <div className="flex shrink-0 flex-wrap gap-2 xl:w-[220px] xl:justify-end">
                          <Button size="sm" variant="outline" asChild>
                            <Link to={`/tasks/${task.taskNo}`}>View</Link>
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => doPrint(task.taskNo)} disabled={task.status === "Confirmed" || task.status === "Cancelled"}>
                            <Printer className="mr-1 h-3.5 w-3.5" />
                            Print
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              try {
                                cancelTask(task.id);
                                toast.success("Cancelled");
                              } catch (e: any) {
                                toast.error(e.message);
                              }
                            }}
                            disabled={task.status === "Confirmed" || task.status === "Cancelled"}
                          >
                            <XCircle className="mr-1 h-3.5 w-3.5" />
                            Cancel
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          );
        })}

        {filteredTasks.length === 0 && (
          <Card className="rounded-2xl">
            <CardContent className="py-10 text-center text-muted-foreground">
              Không có task phù hợp với bộ lọc hiện tại.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function SummaryCard(props: { label: string; value: number; tone: "neutral" | "info" | "primary" | "warning" | "success" }) {
  const toneClass = {
    neutral: "bg-card",
    info: "bg-info/10",
    primary: "bg-primary/10",
    warning: "bg-warning/15",
    success: "bg-success/10",
  }[props.tone];

  return (
    <Card className={`rounded-2xl ${toneClass}`}>
      <CardContent className="p-4">
        <div className="text-xs uppercase text-muted-foreground">{props.label}</div>
        <div className="mt-2 text-2xl font-semibold">{props.value}</div>
      </CardContent>
    </Card>
  );
}

function Metric(props: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-muted/20 p-3">
      <div className="text-[11px] uppercase text-muted-foreground">{props.label}</div>
      <div className="mt-1 font-mono text-sm font-semibold">{props.value}</div>
    </div>
  );
}
