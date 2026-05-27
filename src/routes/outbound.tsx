import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useStore } from "@/services/store";
import { suggestPalletsForOutbound } from "@/services/palletService";
import { createOutbound } from "@/services/outboundService";
import { cancelTask, confirmTask, createTask, printTask } from "@/services/taskService";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/PageHeader";
import { TaskStatusBadge } from "@/components/StatusBadges";
import { toast } from "sonner";

export const Route = createFileRoute("/outbound")({ component: OutboundPage });

function OutboundPage() {
  const skus = useStore((s) => s.skus);
  const tasks = useStore((s) => s.tasks);

  const [skuCode, setSkuCode] = useState("");
  const [destination, setDestination] = useState("");
  const [requiredQty, setRequiredQty] = useState(0);
  const [lastOutboundNo, setLastOutboundNo] = useState<string>("");

  const result = useMemo(() => {
    if (!skuCode || requiredQty <= 0) return null;
    return suggestPalletsForOutbound(skuCode, requiredQty);
  }, [requiredQty, skuCode]);

  const pickTasks = lastOutboundNo
    ? tasks.filter((t) => t.taskType === "PICK" && t.outboundNo === lastOutboundNo)
    : [];

  const createPickTasks = () => {
    try {
      if (!destination.trim()) throw new Error("Nhập Destination");
      if (!skuCode) throw new Error("Chọn SKU");
      if (requiredQty <= 0) throw new Error("Required Qty phải > 0");
      if (!result) throw new Error("Chưa có gợi ý pallet");
      if (result.selected.length === 0) throw new Error("Không có pallet phù hợp để pick");

      const selectedPalletIds = result.selected.map((p) => p.palletId);
      const doc = createOutbound({ destination: destination.trim(), skuCode, requiredQty, selectedPalletIds });

      for (const palletId of selectedPalletIds) {
        createTask({
          taskType: "PICK",
          palletId,
          outboundNo: doc.outboundNo,
          instruction: `PICK = lấy pallet và load/xuất luôn (Destination: ${doc.destination}).`,
          note: `Outbound ${doc.outboundNo}`,
        });
      }

      setLastOutboundNo(doc.outboundNo);
      toast.success(`Đã tạo ${selectedPalletIds.length} PICK task cho ${doc.outboundNo}`);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const doPrint = (taskId: string) => {
    try {
      const t = tasks.find((x) => x.id === taskId);
      if (!t) throw new Error("Task không tồn tại");
      printTask(taskId);
      window.open(`/tasks/${encodeURIComponent(t.taskNo)}/print`, "_blank", "noopener,noreferrer");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const doConfirm = (taskId: string) => {
    try {
      confirmTask(taskId);
      toast.success("Đã confirm PICK → Shipped");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <div>
      <PageHeader title="Outbound" description="TASK-FIRST: tạo PICK task → in → làm thực tế → confirm (PICK = xuất luôn)" />

      <Card className="rounded-2xl mb-6">
        <CardContent className="p-6 space-y-4">
          <h3 className="font-semibold">Outbound Request</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Destination</Label>
              <Input value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="Khách hàng / xe / container" />
            </div>
            <div>
              <Label>SKU</Label>
              <Select value={skuCode} onValueChange={setSkuCode}>
                <SelectTrigger>
                  <SelectValue placeholder="Chọn SKU" />
                </SelectTrigger>
                <SelectContent>
                  {skus.map((s) => (
                    <SelectItem key={s.id} value={s.skuCode}>
                      {s.skuCode}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Required Qty</Label>
              <Input type="number" value={requiredQty} onChange={(e) => setRequiredQty(+e.target.value)} />
            </div>
          </div>

          {result && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Gợi ý (FEFO → FIFO) — chọn {result.fulfilled}/{requiredQty}
                </p>
                <Button onClick={createPickTasks}>
                  Create PICK Tasks
                </Button>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pallet</TableHead>
                    <TableHead>Batch</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead>EXP</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.suggested.map((p) => {
                    const inSelected = result.selected.includes(p);
                    return (
                      <TableRow key={p.id} className={inSelected ? "bg-success/5" : ""}>
                        <TableCell className="font-mono text-xs">{p.palletId}</TableCell>
                        <TableCell className="font-mono text-xs">{p.batchNo}</TableCell>
                        <TableCell className="text-right">{p.qty}</TableCell>
                        <TableCell className="text-xs">{p.expDate}</TableCell>
                        <TableCell className="font-mono text-xs">{p.currentLocation}</TableCell>
                        <TableCell className="text-xs">{p.status}</TableCell>
                      </TableRow>
                    );
                  })}
                  {result.suggested.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-4 text-muted-foreground">
                        Không có pallet phù hợp
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}

          {!result && (
            <div className="text-sm text-muted-foreground">
              Chọn SKU và Required Qty để hệ thống gợi ý pallet theo FEFO/FIFO.
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardContent className="p-6">
          <h3 className="font-semibold mb-4">
            PICK Tasks {lastOutboundNo ? `(${lastOutboundNo})` : ""}
          </h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Task</TableHead>
                <TableHead>Pallet</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Batch</TableHead>
                <TableHead>From</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Print</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pickTasks.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-mono text-xs">{t.taskNo}</TableCell>
                  <TableCell className="font-mono text-xs">{t.palletId}</TableCell>
                  <TableCell className="text-xs">{t.skuCode}</TableCell>
                  <TableCell className="font-mono text-xs">{t.batchNo}</TableCell>
                  <TableCell className="font-mono text-xs">{t.fromLocation}</TableCell>
                  <TableCell><TaskStatusBadge status={t.status} /></TableCell>
                  <TableCell className="text-right">{t.printCount}</TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button size="sm" variant="outline" onClick={() => doPrint(t.id)} disabled={t.status === "Cancelled" || t.status === "Confirmed"}>
                      Print
                    </Button>
                    <Button size="sm" onClick={() => doConfirm(t.id)} disabled={t.status !== "Printed" && t.status !== "In Progress"}>
                      Confirm Pick/Ship
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
                      disabled={t.status === "Cancelled" || t.status === "Confirmed"}
                    >
                      Cancel
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {pickTasks.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-6 text-muted-foreground">
                    {lastOutboundNo ? "Chưa có task" : "Tạo Outbound Request để sinh PICK task"}
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
