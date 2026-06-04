import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useStore } from "@/services/store";
import { printTask } from "@/services/taskService";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { formatLocationPath } from "@/utils/location";
import { QrCode } from "@/components/qr/QrCode";
import { Download } from "lucide-react";

export const Route = createFileRoute("/tasks/$taskNo/print")({
  validateSearch: (search: Record<string, unknown>) => ({
    autoprint: search.autoprint === true || search.autoprint === "true" || search.autoprint === "1",
  }),
  component: TaskPrintPage,
});

function TaskPrintPage() {
  const { taskNo } = Route.useParams();
  const { autoprint } = Route.useSearch();
  const tasks = useStore((s) => s.tasks);
  const taskLines = useStore((s) => s.taskLines);
  const outbounds = useStore((s) => s.outbounds);
  const locations = useStore((s) => s.locations);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const task = (Array.isArray(tasks) ? tasks : []).find((t) => t.taskNo === taskNo);
  const lines = (Array.isArray(taskLines) ? taskLines : []).filter((l) => l.taskNo === taskNo).sort((a, b) => a.lineNo - b.lineNo);
  const outboundDoc = task?.outboundNo ? (Array.isArray(outbounds) ? outbounds : []).find((o) => o.outboundNo === task.outboundNo) : undefined;
  const autoPrintedRef = useRef(false);
  const printAreaRef = useRef<HTMLDivElement | null>(null);

  const triggerPrint = () => {
    window.focus();
    window.requestAnimationFrame(() => {
      window.setTimeout(() => window.print(), 300);
    });
  };

  const doPrint = () => {
    try {
      if (!task) throw new Error("Task không tồn tại");
      printTask(task.id);
      triggerPrint();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const doExportPdf = async () => {
    try {
      if (!task) throw new Error("Task không tồn tại");
      if (!printAreaRef.current) throw new Error("Không tìm thấy vùng in task");

      setIsExportingPdf(true);
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);

      const canvas = await html2canvas(printAreaRef.current, {
        scale: Math.min(window.devicePixelRatio || 2, 2),
        backgroundColor: "#ffffff",
        useCORS: true,
      });

      const pdf = new jsPDF("p", "mm", "a4");
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 8;
      const contentWidth = pageWidth - margin * 2;
      const contentHeight = pageHeight - margin * 2;

      const pxPerMm = canvas.width / contentWidth;
      const pageCanvasHeight = Math.floor(contentHeight * pxPerMm);

      let offsetY = 0;
      let pageIndex = 0;

      while (offsetY < canvas.height) {
        const sliceHeight = Math.min(pageCanvasHeight, canvas.height - offsetY);
        const pageCanvas = document.createElement("canvas");
        pageCanvas.width = canvas.width;
        pageCanvas.height = sliceHeight;

        const ctx = pageCanvas.getContext("2d");
        if (!ctx) throw new Error("Không tạo được canvas để export PDF");

        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
        ctx.drawImage(
          canvas,
          0,
          offsetY,
          canvas.width,
          sliceHeight,
          0,
          0,
          pageCanvas.width,
          sliceHeight,
        );

        const imageData = pageCanvas.toDataURL("image/png");
        const renderedHeight = sliceHeight / pxPerMm;

        if (pageIndex > 0) pdf.addPage();
        pdf.addImage(imageData, "PNG", margin, margin, contentWidth, renderedHeight, undefined, "FAST");

        offsetY += sliceHeight;
        pageIndex += 1;
      }

      pdf.save(`${task.taskNo}.pdf`);
      toast.success(`Đã xuất PDF ${task.taskNo}.pdf`);
    } catch (e: any) {
      toast.error(e.message ?? "Xuất PDF thất bại");
    } finally {
      setIsExportingPdf(false);
    }
  };

  useEffect(() => {
    if (!task || !autoprint || autoPrintedRef.current) return;
    autoPrintedRef.current = true;
    const t = window.setTimeout(() => {
      try {
        printTask(task.id);
        triggerPrint();
      } catch (e: any) {
        toast.error(e.message);
      }
    }, 800);
    return () => window.clearTimeout(t);
  }, [autoprint, task]);

  if (!task) {
    return (
      <div className="p-6">
        <Card className="rounded-2xl">
          <CardContent className="p-6 text-muted-foreground">Task không tồn tại.</CardContent>
        </Card>
      </div>
    );
  }

  const instruction =
    task.instruction ||
    (task.taskType === "PUTAWAY"
      ? "Đưa pallet từ Receiving vào location chỉ định."
      : task.taskType === "MOVE"
        ? "Chuyển pallet từ location cũ sang location mới."
        : task.taskType === "PICK"
          ? "Lấy pallet từ location hiện tại và load/xuất luôn. Sau khi confirm, pallet được xem là Shipped."
          : "");

  const plannedLocationLabel = (line: typeof lines[number]) => {
    if (task.taskType === "PICK") return outboundDoc?.destination ?? "External";
    if (line.toLocation) {
      return formatLocationPath((Array.isArray(locations) ? locations : []).find((loc) => loc.locationCode === line.toLocation) ?? null);
    }
    return task.taskType === "PUTAWAY" ? "Scan actual bin on floor" : "—";
  };

  const actualLocationLabel = (line: typeof lines[number]) => {
    if (line.actualLocation) {
      return formatLocationPath((Array.isArray(locations) ? locations : []).find((loc) => loc.locationCode === line.actualLocation) ?? null);
    }
    return task.taskType === "PICK" ? "—" : "________________";
  };

  return (
    <div className="print-area bg-white p-6">
      <div className="no-print flex justify-end mb-4">
        <div className="flex gap-2">
          <Button variant="outline" onClick={doExportPdf} disabled={isExportingPdf}>
            <Download className="mr-1 h-4 w-4" />
            {isExportingPdf ? "Đang xuất PDF..." : "Xuất PDF"}
          </Button>
          <Button onClick={doPrint}>Print Task</Button>
        </div>
      </div>

      <Card ref={printAreaRef} className="rounded-2xl border-2 border-foreground">
        <CardContent className="p-8 space-y-6">
          <div className="flex items-start justify-between gap-4 border-b-2 border-foreground pb-4">
            <div>
              <div className="text-xs uppercase tracking-widest text-muted-foreground">WAREHOUSE TASK TEMPLATE</div>
              <div className="text-2xl font-bold mt-1">{task.taskType}</div>
              <div className="font-mono text-sm mt-1">{task.taskNo}</div>
              <div className="text-xs text-muted-foreground mt-1">Priority: {task.priority}</div>
              <div className="mt-1 text-xs font-mono text-muted-foreground">{`TASK:${task.taskNo}`}</div>
            </div>
            <QrCode value={`TASK:${task.taskNo}`} className="h-28 w-28 shrink-0" />
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
                    <th className="p-2">{task.taskType === "PICK" ? "Destination" : "Planned Bin"}</th>
                    <th className="p-2">Actual Bin</th>
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
                      <td className="p-2 font-mono">{formatLocationPath((Array.isArray(locations) ? locations : []).find((loc) => loc.locationCode === l.fromLocation) ?? null)}</td>
                      <td className="p-2">{plannedLocationLabel(l)}</td>
                      <td className="p-2">
                        {l.actualLocation ? (
                          <span className="font-mono">{actualLocationLabel(l)}</span>
                        ) : (
                          <div className="min-h-5 border-b border-dashed border-foreground/50" />
                        )}
                      </td>
                      <td className="p-2">
                        <div className="min-h-5 border-b border-dashed border-foreground/40" />
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div className="rounded-xl border p-4">
              <div className="text-xs text-muted-foreground uppercase mb-2">Execution checklist</div>
              <div className="space-y-2">
                <div>1. Scan Task No</div>
                <div>2. Scan Pallet ID</div>
                <div>3. Scan actual bin if PUTAWAY/MOVE</div>
                <div>4. Confirm line trên hệ thống</div>
              </div>
            </div>
            <div className="rounded-xl border p-4">
              <div className="text-xs text-muted-foreground uppercase mb-2">Print note</div>
              <div className="space-y-2">
                <div>PUTAWAY: actual bin sẽ được quét khi làm thực tế.</div>
                <div>PICK: không dùng target bin.</div>
                <div>MOVE: chỉ nhập actual bin khi confirm nếu cần override.</div>
              </div>
            </div>
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
