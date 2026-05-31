import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useStore } from "@/services/store";
import { createOutbound, syncOutboundStatusByNo } from "@/services/outboundService";
import { cancelTask, createPickTaskWithLines } from "@/services/taskService";
import { listAvailablePalletsBySkuBatch } from "@/services/taskQueryService";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  const batches = useStore((s) => s.batches);
  const tasks = useStore((s) => s.tasks);
  const taskLines = useStore((s) => s.taskLines);

  const [outboundNo, setOutboundNo] = useState("");
  const [destination, setDestination] = useState("");
  const [skuCode, setSkuCode] = useState("");
  const [batchNo, setBatchNo] = useState("");
  const [requiredQty, setRequiredQty] = useState(0);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [lastOutboundNo, setLastOutboundNo] = useState("");

  const batchesBySku = useMemo(
    () => batches.filter((b) => b.skuCode === skuCode),
    [batches, skuCode],
  );

  const availablePallets = useMemo(() => {
    if (!skuCode || !batchNo) return [];
    return listAvailablePalletsBySkuBatch({ skuCode, batchNo, purpose: "PICK" });
  }, [skuCode, batchNo]);

  const filteredPallets = useMemo(() => {
    if (!search.trim()) return availablePallets;
    const q = search.toLowerCase();
    return availablePallets.filter((p) => p.palletId.toLowerCase().includes(q) || (p.currentLocation ?? "").toLowerCase().includes(q));
  }, [availablePallets, search]);

  const selectedPallets = useMemo(
    () => availablePallets.filter((p) => selected[p.palletId]),
    [availablePallets, selected],
  );

  const selectedQty = useMemo(
    () => selectedPallets.reduce((sum, p) => sum + p.qty, 0),
    [selectedPallets],
  );
  const remainingQty = Math.max(0, requiredQty - selectedQty);
  const isUnder = requiredQty > 0 && selectedQty < requiredQty;
  const isOver = requiredQty > 0 && selectedQty > requiredQty;

  const pickTasks = useMemo(() => {
    const no = outboundNo.trim() || lastOutboundNo;
    if (!no) return [];
    return tasks.filter((t) => t.taskType === "PICK" && t.outboundNo === no);
  }, [lastOutboundNo, outboundNo, tasks]);

  const lineMap = useMemo(() => {
    const map = new Map<string, typeof taskLines>();
    for (const l of taskLines) {
      const arr = map.get(l.taskId) ?? [];
      arr.push(l);
      map.set(l.taskId, arr);
    }
    return map;
  }, [taskLines]);

  const canCreate = !!skuCode && !!batchNo && !!destination.trim() && requiredQty > 0 && selectedPallets.length > 0;

  const doCreatePickTask = () => {
    try {
      if (!canCreate) throw new Error("Thiếu thông tin để tạo PICK task");
      const palletIds = selectedPallets.map((p) => p.palletId);
      const doc = createOutbound({
        outboundNo: outboundNo.trim() || undefined,
        destination: destination.trim(),
        skuCode,
        batchNo,
        requiredQty,
        selectedPalletIds: palletIds,
      });

      const created = createPickTaskWithLines({
        outboundNo: doc.outboundNo,
        palletIds,
        destination: doc.destination,
        note: `Outbound ${doc.outboundNo}`,
      });

      syncOutboundStatusByNo(doc.outboundNo);
      setLastOutboundNo(doc.outboundNo);
      setOutboundNo(doc.outboundNo);
      toast.success(`Đã tạo PICK task ${created.task.taskNo} (${created.lines.length} lines)`);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Outbound / PICK" description="Chọn SKU/Batch → chọn pallet → tạo 1 PICK task nhiều lines" />

      <Card className="rounded-2xl">
        <CardHeader className="pb-2"><CardTitle className="text-base">Section 1 - Outbound Info</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <Label>Outbound No</Label>
            <Input value={outboundNo} onChange={(e) => setOutboundNo(e.target.value)} placeholder="Để trống để auto" />
          </div>
          <div>
            <Label>Destination</Label>
            <Input value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="External / Truck / Container" />
          </div>
          <div>
            <Label>SKU</Label>
            <Select
              value={skuCode}
              onValueChange={(v) => {
                setSkuCode(v);
                setBatchNo("");
                setSelected({});
              }}
            >
              <SelectTrigger><SelectValue placeholder="Chọn SKU" /></SelectTrigger>
              <SelectContent>
                {skus.map((s) => <SelectItem key={s.id} value={s.skuCode}>{s.skuCode} - {s.skuName}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Batch</Label>
            <Select
              value={batchNo}
              onValueChange={(v) => {
                setBatchNo(v);
                setSelected({});
              }}
              disabled={!skuCode}
            >
              <SelectTrigger><SelectValue placeholder="Chọn Batch" /></SelectTrigger>
              <SelectContent>
                {batchesBySku.map((b) => <SelectItem key={b.id} value={b.batchNo}>{b.batchNo}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Required Qty</Label>
            <Input type="number" value={requiredQty} onChange={(e) => setRequiredQty(+e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader className="pb-2"><CardTitle className="text-base">Section 2 - Available Pallets (FEFO/FIFO)</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2 items-center">
            <Input
              placeholder="Search Pallet ID / Location"
              className="max-w-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              disabled={!skuCode || !batchNo}
            />
            <Button
              variant="outline"
              disabled={!filteredPallets.length}
              onClick={() => setSelected(Object.fromEntries(filteredPallets.map((p) => [p.palletId, true])))}
            >
              Select All Available
            </Button>
            <div className="text-sm text-muted-foreground">Selected pallet: {selectedPallets.length}/{availablePallets.length}</div>
          </div>

          <div className="overflow-x-auto border rounded-xl">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10" />
                  <TableHead>Pallet ID</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Batch</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead>UOM</TableHead>
                  <TableHead>EXP</TableHead>
                  <TableHead>Current Location</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPallets.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={!!selected[p.palletId]}
                        onChange={(e) => setSelected((prev) => ({ ...prev, [p.palletId]: e.target.checked }))}
                      />
                    </TableCell>
                    <TableCell className="font-mono text-xs">{p.palletId}</TableCell>
                    <TableCell>{p.skuCode}</TableCell>
                    <TableCell className="font-mono text-xs">{p.batchNo}</TableCell>
                    <TableCell className="text-right font-mono">{p.qty}</TableCell>
                    <TableCell>{p.uom}</TableCell>
                    <TableCell className="text-xs">{p.expDate}</TableCell>
                    <TableCell className="font-mono text-xs">{p.currentLocation}</TableCell>
                    <TableCell>{p.status}</TableCell>
                  </TableRow>
                ))}
                {filteredPallets.length === 0 && (
                  <TableRow><TableCell colSpan={9} className="py-6 text-center text-muted-foreground">Chọn SKU/Batch để hiển thị pallet phù hợp</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader className="pb-2"><CardTitle className="text-base">Section 3 - Selected Summary</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div>Required Qty: <span className="font-mono">{requiredQty}</span></div>
          <div>Selected Qty: <span className="font-mono">{selectedQty}</span></div>
          <div>Remaining Qty: <span className="font-mono">{remainingQty}</span></div>
          {isUnder && <div className="text-warning">Cảnh báo: Chọn thiếu so với Required Qty.</div>}
          {isOver && <div className="text-destructive">Cảnh báo: Chọn vượt Required Qty (được phép nếu xuất nguyên pallet).</div>}
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader className="pb-2"><CardTitle className="text-base">Section 4 - Create PICK Task</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Button onClick={doCreatePickTask} disabled={!canCreate}>Create PICK Task ({selectedPallets.length})</Button>

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
                {pickTasks.map((t) => {
                  const lines = lineMap.get(t.id) ?? [];
                  return (
                    <TableRow key={t.id}>
                      <TableCell className="font-mono text-xs">{t.taskNo}</TableCell>
                      <TableCell><TaskStatusBadge status={t.status} /></TableCell>
                      <TableCell className="text-right font-mono">{lines.length}</TableCell>
                      <TableCell className="text-right font-mono">{t.printCount}</TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button size="sm" variant="outline" onClick={() => window.open(`/tasks/${encodeURIComponent(t.taskNo)}/print`, "_blank", "noopener,noreferrer")}>Print</Button>
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
                  );
                })}
                {pickTasks.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="py-6 text-center text-muted-foreground">Chưa có PICK task theo outbound hiện tại</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
