import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useStore } from "@/services/store";
import { createOutbound, syncOutboundStatusByNo } from "@/services/outboundService";
import { cancelTask, createPickTaskWithLines } from "@/services/taskService";
import {
  autoSelectPalletsByQty,
  getAvailableBatchSummaryBySku,
  getAvailableSkuSummary,
  listAvailablePalletsBySkuBatch,
} from "@/services/taskQueryService";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/PageHeader";
import { CreatedTaskBanner } from "@/components/CreatedTaskBanner";
import { SkuBatchSelectionSection } from "@/components/SkuBatchSelectionSection";
import { TaskListCard } from "@/components/TaskListCard";
import { formatLocationPath } from "@/utils/location";
import { toast } from "sonner";
import { X, CheckCircle, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/outbound")({ component: OutboundPage });

interface BatchEntry {
  id: string;
  skuCode: string;
  batchNo: string;
  requiredQty: number;
  autoSelectResult: { selectedQty: number; overQty: number; underQty: number } | null;
}

function newEntry(): BatchEntry {
  return { id: Math.random().toString(36), skuCode: "", batchNo: "", requiredQty: 0, autoSelectResult: null };
}

function OutboundPage() {
  const router = useRouter();
  const skus = useStore((s) => s.skus);
  const tasks = useStore((s) => s.tasks);
  const taskLines = useStore((s) => s.taskLines);
  const locations = useStore((s) => s.locations);

  const [outboundNo, setOutboundNo] = useState("");
  const [destination, setDestination] = useState("");
  const [batches, setBatches] = useState<BatchEntry[]>([newEntry()]);

  // selections: palletId -> { qty, batchNo, skuCode }
  const [selections, setSelections] = useState<Record<string, { qty: number; batchNo: string; skuCode: string }>>({});

  const [lastOutboundNo, setLastOutboundNo] = useState("");
  const [lastTaskNo, setLastTaskNo] = useState("");

  // ----- derived data for each batch entry -----
  const batchAvailablePallets = useMemo(() => {
    return Object.fromEntries(
      batches.map((b) => {
        if (!b.skuCode || !b.batchNo) return [b.id, []];
        return [b.id, listAvailablePalletsBySkuBatch({ skuCode: b.skuCode, batchNo: b.batchNo, purpose: "PICK" })];
      }),
    );
  }, [batches, tasks, taskLines, locations]);

  const batchSummaries = useMemo(() => {
    return Object.fromEntries(
      batches.map((b) => {
        if (!b.skuCode) return [b.id, []];
        return [b.id, getAvailableBatchSummaryBySku({ skuCode: b.skuCode, purpose: "PICK" })];
      }),
    );
  }, [batches, tasks, taskLines, locations]);

  const availableSkuSummaries = useMemo(() => getAvailableSkuSummary({ purpose: "PICK" }), [tasks, taskLines, locations]);

  const locationPathByCode = useMemo(
    () => Object.fromEntries((Array.isArray(locations) ? locations : []).map((l) => [l.locationCode, formatLocationPath(l)])),
    [locations],
  );

  const daysToExpiry = (expDate?: string) => {
    if (!expDate) return null;
    const diff = new Date(expDate).getTime() - new Date().getTime();
    if (!Number.isFinite(diff)) return null;
    return Math.ceil(diff / (24 * 60 * 60 * 1000));
  };

  const allSelectedPallets = useMemo(() => {
    const result: Array<{ palletId: string; qty: number; batchNo: string; skuCode: string; skuName: string; expDate?: string; currentLocation?: string; weight: number; uom: string }> = [];
    for (const [palletId, sel] of Object.entries(selections)) {
      const batchEntry = batches.find((b) => b.skuCode === sel.skuCode && b.batchNo === sel.batchNo);
      if (!batchEntry) continue;
      const pallets = batchAvailablePallets[batchEntry.id] ?? [];
      const p = pallets.find((pal) => pal.palletId === palletId);
      if (p) result.push({ ...p, batchNo: sel.batchNo, skuCode: sel.skuCode });
    }
    return result;
  }, [selections, batchAvailablePallets, batches]);

  const selectedPalletIds = useMemo(() => allSelectedPallets.map((p) => p.palletId), [allSelectedPallets]);
  const totalSelectedQty = useMemo(() => allSelectedPallets.reduce((sum, p) => sum + p.qty, 0), [allSelectedPallets]);

  const pickTasks = useMemo(
    () =>
      (Array.isArray(tasks) ? tasks : []).filter(
        (t) => t.taskType === "PICK" && (t.status === "Open" || t.status === "Printed" || t.status === "Partially Confirmed"),
      ),
    [tasks],
  );

  const lineMap = useMemo(() => {
    const map = new Map<string, typeof taskLines>();
    for (const l of (Array.isArray(taskLines) ? taskLines : [])) {
      const arr = map.get(l.taskId) ?? [];
      arr.push(l);
      map.set(l.taskId, arr);
    }
    return map;
  }, [taskLines]);

  const createdTask = useMemo(
    () => (lastTaskNo ? (Array.isArray(tasks) ? tasks : []).find((t) => t.taskNo === lastTaskNo) ?? null : null),
    [lastTaskNo, tasks],
  );

  const stepIndex = !destination.trim()
    ? 0
    : batches.every((b) => !b.skuCode)
      ? 1
      : batches.some((b) => !b.batchNo)
        ? 2
        : selectedPalletIds.length === 0
          ? 3
          : 4;

  // ----- batch entry management -----
  const updateBatch = (id: string, patch: Partial<BatchEntry>) => {
    setBatches((prev) =>
      prev.map((b) => {
        if (b.id !== id) return b;
        const next = { ...b, ...patch };
        if (patch.skuCode !== undefined) next.batchNo = "";
        if (patch.skuCode !== undefined || patch.batchNo !== undefined) {
          next.requiredQty = 0;
          next.autoSelectResult = null;
        }
        return next;
      }),
    );
  };

  const removeBatch = (id: string) => {
    setBatches((prev) => {
      const b = prev.find((x) => x.id === id);
      if (b) {
        setSelections((sel) => {
          const next = { ...sel };
          for (const [palletId, s] of Object.entries(next)) {
            if (s.skuCode === b.skuCode && s.batchNo === b.batchNo) delete next[palletId];
          }
          return next;
        });
      }
      return prev.filter((x) => x.id !== id);
    });
  };

  const addBatch = () => setBatches((prev) => [...prev, newEntry()]);

  // ----- per-batch auto select -----
  const doAutoSelect = (batchId: string) => {
    const b = batches.find((x) => x.id === batchId);
    if (!b || !b.skuCode || !b.batchNo || b.requiredQty <= 0) {
      toast.error("Thiếu SKU, batch hoặc required qty");
      return;
    }
    try {
      const pallets = batchAvailablePallets[batchId] ?? [];
      const result = autoSelectPalletsByQty({ skuCode: b.skuCode, batchNo: b.batchNo, requiredQty: b.requiredQty, purpose: "PICK" });
      setSelections((prev) => {
        const next = { ...prev };
        for (const [pid, s] of Object.entries(next)) {
          if (s.skuCode === b.skuCode && s.batchNo === b.batchNo) delete next[pid];
        }
        for (const pid of result.palletIds) {
          const p = pallets.find((pal) => pal.palletId === pid);
          if (p) next[pid] = { qty: p.qty, batchNo: b.batchNo, skuCode: b.skuCode };
        }
        return next;
      });
      setBatches((prev) =>
        prev.map((x) =>
          x.id === batchId ? { ...x, autoSelectResult: { selectedQty: result.selectedQty, overQty: result.overQty, underQty: result.underQty } } : x,
        ),
      );
      toast.success(`Đã auto select ${result.palletIds.length} pallet (${result.selectedQty} qty)`);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  // ----- per-batch pallet selection (inline) -----
  const togglePallet = (palletId: string, p: { palletId: string; qty: number; batchNo: string; skuCode: string; skuName: string; expDate?: string; currentLocation?: string; weight: number; uom: string }) => {
    setSelections((prev) => {
      if (prev[palletId]) {
        const next = { ...prev };
        delete next[palletId];
        return next;
      }
      return { ...prev, [palletId]: { qty: p.qty, batchNo: p.batchNo, skuCode: p.skuCode } };
    });
  };

  const selectAllBatchPallets = (batchId: string) => {
    const b = batches.find((x) => x.id === batchId);
    if (!b) return;
    const pallets = batchAvailablePallets[batchId] ?? [];
    setSelections((prev) => {
      const next = { ...prev };
      // clear this batch selections first
      for (const [pid, s] of Object.entries(next)) {
        if (s.skuCode === b.skuCode && s.batchNo === b.batchNo) delete next[pid];
      }
      // select all
      for (const p of pallets) {
        next[p.palletId] = { qty: p.qty, batchNo: b.batchNo, skuCode: b.skuCode };
      }
      return next;
    });
  };

  const deselectAllBatchPallets = (batchId: string) => {
    const b = batches.find((x) => x.id === batchId);
    if (!b) return;
    setSelections((prev) => {
      const next = { ...prev };
      for (const [pid, s] of Object.entries(next)) {
        if (s.skuCode === b.skuCode && s.batchNo === b.batchNo) delete next[pid];
      }
      return next;
    });
  };

  const doCreatePickTask = () => {
    try {
      if (!destination.trim()) throw new Error("Thiếu destination");
      if (!selectedPalletIds.length) throw new Error("Chưa chọn pallet nào");

      const batchesWithSelection = batches.filter((b) =>
        Object.values(selections).some((s) => s.skuCode === b.skuCode && s.batchNo === b.batchNo),
      );

      const doc = createOutbound({
        outboundNo: outboundNo.trim() || undefined,
        destination: destination.trim(),
        batches: batchesWithSelection.map((b) => ({ skuCode: b.skuCode, batchNo: b.batchNo, requiredQty: b.requiredQty })),
        selectedPalletIds,
      });

      const created = createPickTaskWithLines({
        outboundNo: doc.outboundNo,
        palletIds: selectedPalletIds,
        destination: doc.destination,
        note: `Outbound ${doc.outboundNo}`,
      });

      syncOutboundStatusByNo(doc.outboundNo);
      setLastTaskNo(created.task.taskNo);
      setLastOutboundNo(doc.outboundNo);
      setOutboundNo(doc.outboundNo);
      setSelections({});
      setBatches([newEntry()]);
      toast.success(`Đã tạo PICK task ${created.task.taskNo} (${created.lines.length} lines)`);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const canCreate = !!destination.trim() && selectedPalletIds.length > 0;

  return (
    <div className="space-y-6">
      <PageHeader title="Outbound / PICK" description="Chọn SKU/Batch → chọn pallet đúng SKU+Batch+requiredQty → tạo 1 PICK task nhiều lines" />

      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>Bước: </span>
        {["Thông tin outbound", "Chọn SKU/Batch", "Chọn pallet", "Tạo task"].map((label, i) => (
          <span key={i} className={i <= stepIndex ? "font-medium text-foreground" : ""}>
            {i > 0 ? " › " : ""}{label}
          </span>
        ))}
      </div>

      {createdTask && (
        <CreatedTaskBanner
          label="PICK task vừa tạo"
          taskNo={createdTask.taskNo}
          status={createdTask.status}
          taskType={createdTask.taskType}
          onPrint={() => router.navigate({ to: "/tasks/$taskNo/print", params: { taskNo: createdTask.taskNo }, search: { autoprint: true } })}
        />
      )}

      <Card className="rounded-2xl">
        <CardHeader className="pb-2"><CardTitle className="text-base">Thông tin outbound</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <Label>Outbound No</Label>
              <Input value={outboundNo} onChange={(e) => setOutboundNo(e.target.value)} placeholder="Để trống để auto" />
            </div>
            <div>
              <Label>Destination</Label>
              <Input value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="External / Truck / Container" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-base">Chọn SKU / Batch ({batches.length})</CardTitle>
          <Button variant="outline" size="sm" onClick={addBatch}>+ Thêm batch</Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {batches.map((batch, idx) => {
            const summary = batchSummaries[batch.id] ?? [];
            const batchPallets = batchAvailablePallets[batch.id] ?? [];
            const selectedForBatch = Object.entries(selections).filter(
              ([, s]) => s.skuCode === batch.skuCode && s.batchNo === batch.batchNo,
            );
            const selectedBatchQty = selectedForBatch.reduce((sum, [, s]) => sum + s.qty, 0);
            const selectedBatchIds = new Set(selectedForBatch.map(([id]) => id));
            const allSelected = batchPallets.length > 0 && selectedForBatch.length === batchPallets.length;
            const someSelected = selectedForBatch.length > 0 && selectedForBatch.length < batchPallets.length;

            // qty status for this batch
            const availableForBatch = batchPallets.reduce((sum, p) => sum + p.qty, 0);
            const qtyOk = batch.requiredQty > 0 && selectedBatchQty >= batch.requiredQty;
            const qtyShort = batch.requiredQty > 0 && selectedBatchQty < batch.requiredQty;

            return (
              <div key={batch.id} className="rounded-xl border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">Batch {idx + 1}</span>
                    {batch.skuCode && batch.batchNo && (
                      <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded">
                        {batch.skuCode} / {batch.batchNo}
                      </span>
                    )}
                  </div>
                  {batches.length > 1 && (
                    <button onClick={() => removeBatch(batch.id)} className="text-muted-foreground hover:text-destructive">
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>

                <SkuBatchSelectionSection
                  title=""
                  purposeLabel="PICK"
                  skus={Array.isArray(skus) ? skus : []}
                  availableSkuSummaries={availableSkuSummaries}
                  availableBatchSummaries={summary}
                  selectedSkuCode={batch.skuCode}
                  selectedBatchNo={batch.batchNo}
                  onSkuSelect={(skuCode) => updateBatch(batch.id, { skuCode })}
                  onBatchSelect={(batchNo) => updateBatch(batch.id, { batchNo })}
                  formatLocationLabel={(code) => locationPathByCode[code] ?? code}
                >
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <Label>Required Qty</Label>
                      <Input
                        type="number"
                        value={batch.requiredQty || ""}
                        onChange={(e) => updateBatch(batch.id, { requiredQty: +e.target.value })}
                        placeholder="Nhập số lượng cần pick"
                      />
                    </div>
                    <div className="flex flex-col justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => doAutoSelect(batch.id)}
                        disabled={!batch.skuCode || !batch.batchNo || batch.requiredQty <= 0}
                      >
                        Auto select FEFO
                      </Button>
                      {batch.autoSelectResult && (
                        <div className="flex items-center gap-2 text-xs">
                          {batch.autoSelectResult.underQty === 0 ? (
                            <CheckCircle className="h-3 w-3 text-green-600" />
                          ) : (
                            <AlertTriangle className="h-3 w-3 text-amber-500" />
                          )}
                          <span>
                            Selected <span className="font-mono">{batch.autoSelectResult.selectedQty}</span>
                            {batch.autoSelectResult.overQty > 0 && <span className="text-green-600"> (+{batch.autoSelectResult.overQty} over)</span>}
                            {batch.autoSelectResult.underQty > 0 && <span className="text-amber-500"> (-{batch.autoSelectResult.underQty} short)</span>}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Inline pallet table for this batch */}
                  {!batch.skuCode || !batch.batchNo ? (
                    <div className="text-center py-6 text-sm text-muted-foreground border-2 border-dashed rounded-xl">
                      Chọn SKU và Batch để xem pallet khả dụng
                    </div>
                  ) : batchPallets.length === 0 ? (
                    <div className="text-center py-6 text-sm text-muted-foreground border-2 border-dashed rounded-xl">
                      Không có pallet khả dụng cho batch này
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span>
                          Pallet: <span className="font-mono">{selectedForBatch.length}/{batchPallets.length}</span>
                          {batch.requiredQty > 0 && (
                            <> — Qty: <span className="font-mono">{selectedBatchQty}</span> / {batch.requiredQty}</>
                          )}
                        </span>
                        <div className="flex gap-2">
                          <Button variant="ghost" size="sm" onClick={() => selectAllBatchPallets(batch.id)}>
                            Chọn tất cả
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => deselectAllBatchPallets(batch.id)}>
                            Bỏ chọn tất cả
                          </Button>
                        </div>
                      </div>

                      {/* qty warning */}
                      {batch.requiredQty > 0 && (
                        <div className={qtyOk ? "text-green-600 text-xs" : "text-amber-500 text-xs"}>
                          {qtyOk ? (
                            <CheckCircle className="h-3 w-3 inline mr-1" />
                          ) : (
                            <AlertTriangle className="h-3 w-3 inline mr-1" />
                          )}
                          {qtyOk
                            ? `Đủ qty (${selectedBatchQty} / ${batch.requiredQty})`
                            : `Thiếu ${batch.requiredQty - selectedBatchQty} qty (${selectedBatchQty} / ${batch.requiredQty})`}
                        </div>
                      )}

                      <div className="overflow-x-auto border rounded-xl">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-10">
                                <input
                                  type="checkbox"
                                  checked={allSelected}
                                  ref={(el) => { if (el) el.indeterminate = someSelected; }}
                                  onChange={(e) => {
                                    if (e.target.checked) selectAllBatchPallets(batch.id);
                                    else deselectAllBatchPallets(batch.id);
                                  }}
                                />
                              </TableHead>
                              <TableHead>Pallet ID</TableHead>
                              <TableHead className="text-right">Qty</TableHead>
                              <TableHead>Current Bin</TableHead>
                              <TableHead>EXP</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {batchPallets.map((p) => {
                              const days = p.expDate ? daysToExpiry(p.expDate) : null;
                              return (
                                <TableRow key={p.palletId} className={!selections[p.palletId] ? "opacity-60" : ""}>
                                  <TableCell>
                                    <input
                                      type="checkbox"
                                      checked={!!selections[p.palletId]}
                                      onChange={() => togglePallet(p.palletId, { ...p, batchNo: batch.batchNo, skuCode: batch.skuCode })}
                                    />
                                  </TableCell>
                                  <TableCell className="font-mono text-xs">{p.palletId}</TableCell>
                                  <TableCell className="text-right font-mono">{p.qty} {p.uom}</TableCell>
                                  <TableCell className="font-mono text-xs">
                                    <div>{p.currentLocation ?? "—"}</div>
                                    <div className="text-[11px] text-muted-foreground">
                                      {locationPathByCode[p.currentLocation ?? ""] ?? "—"}
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-xs">
                                    {p.expDate ? (
                                      <span className={days !== null && days <= 7 ? "text-destructive" : ""}>
                                        {p.expDate} {days !== null ? `(${days}d)` : ""}
                                      </span>
                                    ) : "—"}
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}
                </SkuBatchSelectionSection>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Summary + Create */}
      <Card className="rounded-2xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            Tổng hợp đã chọn ({selectedPalletIds.length} pallet — {totalSelectedQty} qty)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          {selectedPalletIds.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-xl text-sm">
              Chưa chọn pallet nào. Chọn SKU/Batch bên trên rồi tick chọn pallet.
            </div>
          ) : (
            <div className="overflow-x-auto border rounded-xl">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SKU</TableHead>
                    <TableHead>Batch</TableHead>
                    <TableHead className="text-right">Pallet count</TableHead>
                    <TableHead className="text-right">Total Qty</TableHead>
                    <TableHead className="text-right">Required</TableHead>
                    <TableHead className="text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {batches
                    .filter((b) =>
                      Object.values(selections).some((s) => s.skuCode === b.skuCode && s.batchNo === b.batchNo),
                    )
                    .map((b) => {
                      const selectedForBatch = Object.entries(selections).filter(
                        ([, s]) => s.skuCode === b.skuCode && s.batchNo === b.batchNo,
                      );
                      const selectedBatchQty = selectedForBatch.reduce((sum, [, s]) => sum + s.qty, 0);
                      const palletCount = selectedForBatch.length;
                      const isQtyOk = b.requiredQty > 0 && selectedBatchQty >= b.requiredQty;
                      return (
                        <TableRow key={b.id}>
                          <TableCell className="font-mono text-xs">{b.skuCode}</TableCell>
                          <TableCell className="font-mono text-xs">{b.batchNo}</TableCell>
                          <TableCell className="text-right font-mono">{palletCount}</TableCell>
                          <TableCell className="text-right font-mono">{selectedBatchQty}</TableCell>
                          <TableCell className="text-right font-mono text-muted-foreground">{b.requiredQty || "—"}</TableCell>
                          <TableCell className="text-right">
                            {isQtyOk ? (
                              <span className="text-green-600 text-xs flex items-center justify-end gap-1">
                                <CheckCircle className="h-3 w-3" /> Đủ
                              </span>
                            ) : b.requiredQty > 0 ? (
                              <span className="text-amber-500 text-xs flex items-center justify-end gap-1">
                                <AlertTriangle className="h-3 w-3" /> Thiếu
                              </span>
                            ) : (
                              <span className="text-muted-foreground text-xs">—</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="space-y-3">
        <Button onClick={doCreatePickTask} disabled={!canCreate}>
          Tạo PICK Task ({selectedPalletIds.length} pallet — {totalSelectedQty} qty)
        </Button>
        <TaskListCard
          title="PICK tasks theo outbound"
          tasks={pickTasks}
          lineMap={lineMap}
          currentTaskNo={lastTaskNo}
          emptyMessage="Chưa có PICK task theo outbound hiện tại"
          onPrintTask={(taskNo) => router.navigate({ to: "/tasks/$taskNo/print", params: { taskNo }, search: { autoprint: true } })}
          onCancelTask={(task) => {
            try {
              cancelTask(task.id);
              toast.success("Cancelled");
            } catch (e: any) {
              toast.error(e.message);
            }
          }}
        />
      </div>
    </div>
  );
}
