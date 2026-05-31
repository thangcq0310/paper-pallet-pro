import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { useStore } from "@/services/store";
import { printTask } from "@/services/taskService";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { formatLocationPath } from "@/utils/location";

export const Route = createFileRoute("/tasks/$taskNo/print")({ component: TaskPrintPage });

function TaskPrintPage() {
  const { taskNo } = Route.useParams();
  const tasks = useStore((s) => s.tasks);
  const taskLines = useStore((s) => s.taskLines);
  const outbounds = useStore((s) => s.outbounds);
  const locations = useStore((s) => s.locations);
  const task = tasks.find((t) => t.taskNo === taskNo);
  const lines = taskLines.filter((l) => l.taskNo === taskNo).sort((a, b) => a.lineNo - b.lineNo);
  const outboundDoc = task?.outboundNo ? outbounds.find((o) => o.outboundNo === task.outboundNo) : undefined;
  const autoPrintedRef = useRef(false);

  if (!task) {
    return (
      <div className="p-6">
        <Card className="rounded-2xl">
          <CardContent className="p-6 text-muted-foreground">Task không tồn tại.</CardContent>
        </Card>
      </div>
    );
  }

  const doPrint = () => {
    try {
      printTask(task.id);
      window.print();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  useEffect(() => {
    if (!task || autoPrintedRef.current) return;
    autoPrintedRef.current = true;
    const t = window.setTimeout(() => {
      try {
        printTask(task.id);
        window.print();
      } catch (e: any) {
        toast.error(e.message);
      }
    }, 120);
    return () => window.clearTimeout(t);
  }, [task]);

  const instruction =
    task.instruction ||
    (task.taskType === "PUTAWAY"
      ? "Đưa pallet từ Receiving vào location chỉ định."
      : task.taskType === "MOVE"
        ? "Chuyển pallet từ location cũ sang location mới."
        : task.taskType === "PICK"
          ? "Lấy pallet từ location hiện tại và load/xuất luôn. Sau khi confirm, pallet được xem là Shipped."
          : "");

  return (
    <div className="print-area p-6">
      <div className="no-print flex justify-end mb-4">
        <Button onClick={doPrint}>Print Task</Button>
      </div>

      <Card className="rounded-2xl border-2 border-foreground">
        <CardContent className="p-8 space-y-6">
          <div className="text-center">
            <div className="text-xs uppercase tracking-widest text-muted-foreground">WAREHOUSE TASK</div>
            <div className="text-2xl font-bold mt-1">{task.taskType}</div>
            <div className="font-mono text-sm mt-1">{task.taskNo}</div>
            <div className="text-xs text-muted-foreground mt-1">Priority: {task.priority}</div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-xs text-muted-foreground uppercase">Plant/Warehouse</div>
              <div className="font-medium">Paper Pallet Pro Warehouse</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground uppercase">Movement Type</div>
              <div className="font-medium">{task.taskType === "PUTAWAY" ? "PUT" : task.taskType === "MOVE" ? "MOVE" : task.taskType === "PICK" ? "PICK" : task.taskType}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground uppercase">Status</div>
              <div className="font-medium">{task.status}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground uppercase">Ref Document</div>
              <div className="font-mono">{task.inboundNo || task.outboundNo || "-"}</div>
            </div>
          </div>

          <div className="text-sm">
            <div className="text-xs text-muted-foreground uppercase mb-2">Lines</div>
            <div className="border rounded-xl overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-muted/40">
                  <tr className="text-left">
                    <th className="p-2 w-10">No</th>
                    <th className="p-2">Pallet ID</th>
                    <th className="p-2">SKU</th>
                    <th className="p-2">Batch</th>
                    <th className="p-2 text-right">Qty/UOM</th>
                    <th className="p-2">From</th>
                    <th className="p-2">{task.taskType === "PICK" ? "Destination" : "To Bin"}</th>
                    <th className="p-2">{task.taskType === "PICK" ? "Actual" : "Actual Bin"}</th>
                    <th className="p-2">Remark</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l) => (
                    <tr key={l.id} className="border-t">
                      <td className="p-2">{l.lineNo}</td>
                      <td className="p-2 font-mono">{l.palletId}</td>
                      <td className="p-2">{l.skuCode}</td>
                      <td className="p-2 font-mono">{l.batchNo}</td>
                      <td className="p-2 text-right font-mono">{l.qty} {l.uom}</td>
                      <td className="p-2 font-mono">{formatLocationPath(locations.find((loc) => loc.locationCode === l.fromLocation) ?? null)}</td>
                      <td className="p-2">{task.taskType === "PICK" ? (outboundDoc?.destination ?? "External") : formatLocationPath(locations.find((loc) => loc.locationCode === l.toLocation) ?? null)}</td>
                      <td className="p-2">
                        {l.actualLocation
                          ? <span className="font-mono">{formatLocationPath(locations.find((loc) => loc.locationCode === l.actualLocation) ?? null)}</span>
                          : <div className="border-b border-foreground/40 h-4" />}
                      </td>
                      <td className="p-2">
                        <div className="border-b border-foreground/40 h-4" />
                      </td>
                    </tr>
                  ))}
                  {lines.length === 0 && (
                    <tr className="border-t">
                      <td className="p-3 text-muted-foreground" colSpan={9}>Không có line</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="text-sm">
            <div className="text-xs text-muted-foreground uppercase mb-1">Instruction</div>
            <div className="whitespace-pre-line">{instruction}</div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-muted-foreground">
            <div>
              <div>Created By: {task.createdBy}</div>
              <div>Created At: {new Date(task.createdAt).toLocaleString()}</div>
            </div>
            <div>
              <div>Printed By: {task.printedBy ?? "-"}</div>
              <div>Printed At: {task.printedAt ? new Date(task.printedAt).toLocaleString() : "-"}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4">
            <div>
              <div className="text-xs text-muted-foreground mb-1">Executed By (Signature)</div>
              <div className="border-b border-foreground/40 h-8" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Confirmed By (Signature)</div>
              <div className="border-b border-foreground/40 h-8" />
            </div>
            <div className="sm:col-span-2">
              <div className="text-xs text-muted-foreground mb-1">Remark</div>
              <div className="border border-foreground/30 rounded-lg h-20" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
