import type { WarehouseTask, WarehouseTaskLine } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TaskStatusBadge } from "@/components/StatusBadges";

export function TaskListCard(props: {
  title: string;
  tasks: WarehouseTask[];
  lineMap: Map<string, WarehouseTaskLine[]>;
  currentTaskNo?: string;
  emptyMessage: string;
  onPrintTask: (taskNo: string) => void;
  onCancelTask: (task: WarehouseTask) => void;
}) {
  const { title, tasks, lineMap, currentTaskNo, emptyMessage, onPrintTask, onCancelTask } = props;

  return (
    <Card className="rounded-2xl">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="overflow-x-auto border rounded-xl">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Task No</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Lines</TableHead>
                <TableHead className="text-right">Print</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasks.map((task) => {
                const lines = lineMap.get(task.id) ?? [];
                return (
                  <TableRow key={task.id}>
                    <TableCell className="font-mono text-xs">
                      {task.taskNo}{task.taskNo === currentTaskNo ? " (new)" : ""}
                    </TableCell>
                    <TableCell><TaskStatusBadge status={task.status} /></TableCell>
                    <TableCell className="text-right font-mono">{lines.length}</TableCell>
                    <TableCell className="text-right font-mono">{task.printCount}</TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button size="sm" variant="outline" onClick={() => onPrintTask(task.taskNo)}>
                        Print
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onCancelTask(task)}
                        disabled={task.status === "Cancelled" || task.status === "Confirmed"}
                      >
                        Cancel
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {tasks.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-6 text-center text-muted-foreground">
                    {emptyMessage}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
