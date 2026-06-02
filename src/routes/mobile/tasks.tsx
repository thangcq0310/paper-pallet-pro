import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useStore } from "@/services/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SimpleScanInput, normalizeScanCode } from "@/components/mobile/SimpleScanInput";
import { TaskStatusBadge } from "@/components/StatusBadges";
import { toast } from "sonner";
import { ArrowRight, ListChecks, Filter } from "lucide-react";

export const Route = createFileRoute("/mobile/tasks")({
  component: MobileTasks,
});

function MobileTasks() {
  const navigate = useNavigate();
  const tasks = useStore((s) => s.tasks);
  const taskLines = useStore((s) => s.taskLines);
  const [taskNoInput, setTaskNoInput] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  // Filter open tasks
  const openTasks = useMemo(() => {
    return tasks.filter((t) =>
      ["Open", "Printed", "Partially Confirmed"].includes(t.status) &&
      (typeFilter === "all" || t.taskType === typeFilter)
    );
  }, [tasks, typeFilter]);

  // Group lines by task
  const lineStats = useMemo(() => {
    const map = new Map<string, { total: number; confirmed: number }>();
    for (const l of taskLines) {
      const st = map.get(l.taskId) ?? { total: 0, confirmed: 0 };
      st.total += 1;
      if (l.status === "Confirmed") st.confirmed += 1;
      map.set(l.taskId, st);
    }
    return map;
  }, [taskLines]);

  const handleTaskNoScan = (value: string) => {
    const normalized = normalizeScanCode(value);
    if (normalized.type === "task" || normalized.type === "unknown") {
      const code = normalized.code;
      const found = tasks.find((t) => t.taskNo.toUpperCase() === code || t.taskNo === code);
      if (found) {
        navigate({ to: "/mobile/execute/$taskNo", params: { taskNo: found.taskNo } });
      } else {
        toast.error(`Không tìm thấy task: ${code}`);
      }
    } else {
      toast.error("Vui lòng nhập mã Task No");
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-xl font-semibold">Danh sách Task</h1>
        <p className="text-xs text-muted-foreground">Chọn task để thực hiện</p>
      </div>

      {/* Scan Task No */}
      <Card className="rounded-xl">
        <CardContent className="p-4 space-y-3">
          <label className="text-sm font-medium">Scan Task No</label>
          <SimpleScanInput
            placeholder="Nhập Task No (VD: TASK-0001)"
            onScan={handleTaskNoScan}
          />
        </CardContent>
      </Card>

      {/* Filter */}
      <div className="flex gap-2 flex-wrap">
        <Button
          size="sm"
          variant={typeFilter === "all" ? "default" : "outline"}
          onClick={() => setTypeFilter("all")}
        >
          All
        </Button>
        {["PUTAWAY", "MOVE", "PICK"].map((t) => (
          <Button
            key={t}
            size="sm"
            variant={typeFilter === t ? "default" : "outline"}
            onClick={() => setTypeFilter(t)}
          >
            {t}
          </Button>
        ))}
      </div>

      {/* Task List */}
      <div className="space-y-2">
        {openTasks.length === 0 ? (
          <Card className="rounded-xl">
            <CardContent className="p-6 text-center text-muted-foreground">
              Không có task cần làm
            </CardContent>
          </Card>
        ) : (
          openTasks.map((t) => {
            const stats = lineStats.get(t.id) ?? { total: 0, confirmed: 0 };
            const progress = stats.total > 0 ? Math.round((stats.confirmed / stats.total) * 100) : 0;
            return (
              <Card key={t.id} className="rounded-xl">
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="font-mono text-sm font-medium">{t.taskNo}</div>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline">{t.taskType}</Badge>
                        <TaskStatusBadge status={t.status} />
                      </div>
                    </div>
                    <Link
                      to="/mobile/execute/$taskNo"
                      params={{ taskNo: t.taskNo }}
                      className="p-2 rounded-md border border-input bg-background hover:bg-accent"
                    >
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Lines: {stats.confirmed}/{stats.total}</span>
                    <span className={progress === 100 ? "text-green-600" : ""}>{progress}%</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-1.5">
                    <div
                      className="bg-primary h-1.5 rounded-full transition-all"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}