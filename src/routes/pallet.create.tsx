import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useStore } from "@/services/store";
import { cancelTask } from "@/services/taskService";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/PageHeader";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { AlertCircle, Layers, Pencil, Plus, Printer, Trash2, Zap } from "lucide-react";
import {
  calculatePalletPreview,
  cancelUnusedPallet,
  autoAllocatePalletsToBins,
  createPutawayTaskWithLines,
  generatePalletIdsFromPreview,
  getMultiTargetBinCapacity,
  type PalletPreviewRow,
  type PutawayAssignment,
} from "@/services/inboundPalletizeService";

export const Route = createFileRoute("/pallet/create")({ component: InboundPalletizePutawayPage });

function InboundPalletizePutawayPage() {
  const skus = useStore((s) => s.skus);
  const batches = useStore((s) => s.batches);
  const locations = useStore((s) => s.locations);
  const pallets = useStore((s) => s.pallets);
  const tasks = useStore((s) => s.tasks);
  const taskLines = useStore((s) => s.taskLines);

  const [form, setForm] = useState({
    inboundNo: "",
    skuCode: "",
    batchNo: "",
    totalQty: 0,
    qtyPerPallet: 0,
    uom: "",
    weightPerPallet: 0,
    mfgDate: "",
    expDate: "",
    note: "",
  });

  const [previewRows, setPreviewRows] = useState<PalletPreviewRow[]>([]);
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [editQty, setEditQty] = useState(0);
  const [editWeight, setEditWeight] = useState(0);
  const [manualQty, setManualQty] = useState(0);
  const [generating, setGenerating] = useState(false);

  const [generatedPalletIds, setGeneratedPalletIds] = useState<string[]>([]);
  const [selectedPallet, setSelectedPallet] = useState<Record<string, boolean>>({});
  const [targetBins, setTargetBins] = useState<string[]>([]);
  const [binPicker, setBinPicker] = useState("");
  const [warehouseFilter, setWarehouseFilter] = useState("");
  const [zoneFilter, setZoneFilter] = useState("");
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [createdTaskNo, setCreatedTaskNo] = useState<string>("");

  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelPalletId, setCancelPalletId] = useState("");
  const [cancelReason, setCancelReason] = useState("");

  const sku = useMemo(() => skus.find((s) => s.skuCode === form.skuCode), [form.skuCode, skus]);
  const batch = useMemo(
    () => batches.find((b) => b.batchNo === form.batchNo && b.skuCode === form.skuCode),
    [batches, form.batchNo, form.skuCode],
  );

  const availableBatches = useMemo(() => batches.filter((b) => b.skuCode === form.skuCode), [batches, form.skuCode]);
  const storageBins = useMemo(
    () => locations.filter((l) => l.locationType === "STORAGE" && l.status === "Active"),
    [locations],
  );

  const zoneToWarehouse = (zone: string) => zone.split("-")[0] || zone;

  const warehouses = useMemo(() => {
    const items = storageBins.map((l) => zoneToWarehouse(l.zone)).filter(Boolean);
    return Array.from(new Set(items)).sort();
  }, [storageBins]);

  const zonesForWarehouse = useMemo(() => {
    if (!warehouseFilter) return [];
    const items = storageBins
      .filter((l) => zoneToWarehouse(l.zone) === warehouseFilter)
      .map((l) => l.zone)
      .filter(Boolean);
    return Array.from(new Set(items)).sort();
  }, [storageBins, warehouseFilter]);

  const binsForPicker = useMemo(() => {
    if (!warehouseFilter || !zoneFilter) return [];
    return storageBins
      .filter((l) => zoneToWarehouse(l.zone) === warehouseFilter && l.zone === zoneFilter)
      .filter((l) => !targetBins.includes(l.locationCode));
  }, [storageBins, targetBins, warehouseFilter, zoneFilter]);

  const derivedUom = sku?.uom ?? "";
  const effectiveUom = form.uom || derivedUom;
  const derivedWeightPerPallet = sku && form.qtyPerPallet > 0 ? sku.weightPerUnit * form.qtyPerPallet : 0;
  const effectiveWeightPerPallet = form.weightPerPallet > 0 ? form.weightPerPallet : derivedWeightPerPallet;
  const calcRowWeight = (qty: number) =>
    form.qtyPerPallet > 0 ? (qty / form.qtyPerPallet) * effectiveWeightPerPallet : 0;

  const totalPreviewQty = useMemo(() => previewRows.reduce((s, r) => s + r.qty, 0), [previewRows]);
  const totalPreviewWeight = useMemo(() => previewRows.reduce((s, r) => s + r.weight, 0), [previewRows]);
  const overLimit = form.totalQty > 0 && totalPreviewQty > form.totalQty;

  const generatedPallets = useMemo(() => {
    const ids = new Set(generatedPalletIds);
    return pallets.filter((p) => ids.has(p.palletId));
  }, [generatedPalletIds, pallets]);

  const openTaskCountByPallet = useMemo(() => {
    const map = new Map<string, number>();
    const openHeaderIds = new Set(
      tasks
        .filter((t) => t.status === "Open" || t.status === "Printed" || t.status === "Partially Confirmed")
        .map((t) => t.id),
    );
    for (const l of taskLines) {
      if (l.status !== "Open") continue;
      if (!openHeaderIds.has(l.taskId)) continue;
      map.set(l.palletId, (map.get(l.palletId) ?? 0) + 1);
    }
    return map;
  }, [taskLines, tasks]);

  const selectedPalletIds = useMemo(
    () => Object.entries(selectedPallet).filter(([, v]) => v).map(([k]) => k),
    [selectedPallet],
  );

  const selectedPalletIdsOrdered = useMemo(() => {
    const selected = new Set(selectedPalletIds);
    return generatedPalletIds.filter((id) => selected.has(id));
  }, [generatedPalletIds, selectedPalletIds]);

  const binCaps = useMemo(() => {
    if (targetBins.length === 0) return [];
    try {
      return getMultiTargetBinCapacity(targetBins);
    } catch {
      return [];
    }
  }, [targetBins]);

  const assignedCountByBin = useMemo(() => {
    const map = new Map<string, number>();
    for (const [palletId, bin] of Object.entries(assignments)) {
      if (!selectedPallet[palletId]) continue;
      if (!bin) continue;
      map.set(bin, (map.get(bin) ?? 0) + 1);
    }
    return map;
  }, [assignments, selectedPallet]);

  const allocationSummary = useMemo(() => {
    const caps = binCaps;
    const totalAvailable = caps.reduce((s, c) => s + c.availableCapacity, 0);
    const totalSelected = selectedPalletIdsOrdered.length;
    const totalAssigned = selectedPalletIdsOrdered.filter((id) => !!assignments[id]).length;
    const perBinOver = caps.some((c) => (assignedCountByBin.get(c.location.locationCode) ?? 0) > c.availableCapacity);
    return { totalAvailable, totalSelected, totalAssigned, perBinOver };
  }, [assignedCountByBin, assignments, binCaps, selectedPalletIdsOrdered]);

  const canGenerateIds =
    previewRows.length > 0 &&
    !overLimit &&
    !!form.inboundNo.trim() &&
    !!form.skuCode &&
    !!form.batchNo &&
    !!effectiveUom &&
    !!(form.mfgDate || batch?.mfgDate) &&
    !!(form.expDate || batch?.expDate) &&
    generatedPalletIds.length === 0;

  const canCreatePutaway =
    generatedPalletIds.length > 0 &&
    targetBins.length > 0 &&
    selectedPalletIdsOrdered.length > 0 &&
    allocationSummary.totalAssigned === allocationSummary.totalSelected &&
    allocationSummary.totalAvailable >= allocationSummary.totalSelected &&
    !allocationSummary.perBinOver;

  const doCalculate = () => {
    try {
      const rows = calculatePalletPreview({
        totalQty: form.totalQty,
        qtyPerPallet: form.qtyPerPallet,
        weightPerPallet: effectiveWeightPerPallet,
      }).map((r) => ({ ...r, weight: calcRowWeight(r.qty) }));
      setPreviewRows(rows);
      toast.success(`Đã tạo preview ${rows.length} pallet`);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const doAddRow = () => {
    if (manualQty <= 0) return;
    setPreviewRows((prev) => [
      ...prev,
      {
        rowId: `manual-${Date.now()}`,
        rowNo: prev.length + 1,
        qty: manualQty,
        weight: calcRowWeight(manualQty),
        type: "Manual",
      },
    ]);
    setManualQty(0);
  };

  const doRemoveRow = (rowId: string) => {
    if (generatedPalletIds.length > 0) return;
    setPreviewRows((prev) => prev.filter((r) => r.rowId !== rowId).map((r, idx) => ({ ...r, rowNo: idx + 1 })));
  };

  const startEdit = (row: PalletPreviewRow) => {
    setEditingRowId(row.rowId);
    setEditQty(row.qty);
    setEditWeight(row.weight);
  };

  const saveEdit = () => {
    if (!editingRowId) return;
    if (editQty <= 0) return toast.error("Qty phải > 0");
    if (editWeight < 0) return toast.error("Weight không hợp lệ");
    setPreviewRows((prev) => prev.map((r) => (r.rowId === editingRowId ? { ...r, qty: editQty, weight: editWeight } : r)));
    setEditingRowId(null);
  };

  const openPrintLabels = (ids: string[]) => {
    const cleaned = Array.from(new Set(ids.map((x) => x.trim()).filter(Boolean)));
    if (cleaned.length === 0) return;
    window.open(`/pallet/print-batch?ids=${encodeURIComponent(cleaned.join(","))}`, "_blank", "noopener,noreferrer");
  };

  const openPrintTask = (taskNo: string) => {
    window.open(`/tasks/${encodeURIComponent(taskNo)}/print`, "_blank", "noopener,noreferrer");
  };

  const doGenerateIds = () => {
    try {
      if (!canGenerateIds) throw new Error("Thiếu thông tin để generate pallet");
      setGenerating(true);
      const created = generatePalletIdsFromPreview({
        inboundNo: form.inboundNo,
        skuCode: form.skuCode,
        batchNo: form.batchNo,
        uom: effectiveUom,
        mfgDate: form.mfgDate || batch?.mfgDate || "",
        expDate: form.expDate || batch?.expDate || "",
        note: form.note || undefined,
        rows: previewRows.map((r) => ({ qty: r.qty, weight: r.weight })),
      });
      const ids = created.map((p) => p.palletId);
      setGeneratedPalletIds(ids);
      setSelectedPallet(Object.fromEntries(ids.map((id) => [id, true])));
      toast.success(`Đã generate ${ids.length} pallet`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setGenerating(false);
    }
  };

  const doAutoAllocate = () => {
    try {
      const asg = autoAllocatePalletsToBins({ palletIds: selectedPalletIdsOrdered, targetLocations: targetBins });
      setAssignments(Object.fromEntries(asg.map((a) => [a.palletId, a.targetLocation])));
      toast.success("Đã auto allocate");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const doClearAllocation = () => {
    setAssignments({});
  };

  const doCreatePutawayTasks = () => {
    try {
      const asg: PutawayAssignment[] = selectedPalletIdsOrdered.map((palletId) => ({
        palletId,
        targetLocation: assignments[palletId],
      }));
      const created = createPutawayTaskWithLines({ inboundNo: form.inboundNo, assignments: asg });
      setCreatedTaskNo(created.task.taskNo);
      toast.success(`Đã tạo PUTAWAY task ${created.task.taskNo} (${created.lines.length} lines)`);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const createdTask = useMemo(() => {
    if (!createdTaskNo) return null;
    return tasks.find((t) => t.taskNo === createdTaskNo) ?? null;
  }, [createdTaskNo, tasks]);

  const createdTaskLines = useMemo(() => {
    if (!createdTaskNo) return [];
    return taskLines.filter((l) => l.taskNo === createdTaskNo).sort((a, b) => a.lineNo - b.lineNo);
  }, [createdTaskNo, taskLines]);

  const openCancelDialog = (palletId: string) => {
    setCancelPalletId(palletId);
    setCancelReason("");
    setCancelDialogOpen(true);
  };

  const doCancelUnused = () => {
    try {
      cancelUnusedPallet(cancelPalletId, cancelReason);
      setSelectedPallet((prev) => ({ ...prev, [cancelPalletId]: false }));
      setAssignments((prev) => {
        const next = { ...prev };
        delete next[cancelPalletId];
        return next;
      });
      toast.success("Đã cancel pallet");
      setCancelDialogOpen(false);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inbound Palletize & Putaway"
        description="Nhập thông tin → tính pallet → generate pallet ID → in nhãn → tạo PUTAWAY task (không auto confirm)"
        action={
          <Button onClick={doGenerateIds} disabled={!canGenerateIds || generating}>
            <Layers className="h-4 w-4 mr-1" />
            {generating ? "Đang tạo..." : `Generate Pallet IDs (${previewRows.length})`}
          </Button>
        }
      />

      <Card className="rounded-2xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Section 1 — Inbound SKU/Batch Info</CardTitle>
        </CardHeader>
        <CardContent className="p-5 pt-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-3">
              <Label>inboundNo <span className="text-destructive">*</span></Label>
              <Input value={form.inboundNo} onChange={(e) => setForm((f) => ({ ...f, inboundNo: e.target.value }))} />
            </div>

            <div>
              <Label>skuCode <span className="text-destructive">*</span></Label>
              <Select
                value={form.skuCode}
                onValueChange={(v) =>
                  setForm((f) => ({
                    ...f,
                    skuCode: v,
                    batchNo: "",
                    mfgDate: "",
                    expDate: "",
                    uom: "",
                    weightPerPallet: 0,
                  }))
                }
              >
                <SelectTrigger><SelectValue placeholder="Chọn SKU" /></SelectTrigger>
                <SelectContent>
                  {skus.map((s) => (
                    <SelectItem key={s.id} value={s.skuCode}>
                      {s.skuCode} — {s.skuName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="sm:col-span-2">
              <Label>batchNo <span className="text-destructive">*</span></Label>
              <div className="mt-2 flex flex-wrap gap-2 rounded-xl border p-3 min-h-12">
                {!form.skuCode && (
                  <span className="text-sm text-muted-foreground">Chọn SKU trước để hiện danh sách batch</span>
                )}
                {form.skuCode && availableBatches.length === 0 && (
                  <span className="text-sm text-muted-foreground">SKU này chưa có batch</span>
                )}
                {availableBatches.map((b) => (
                  <Button
                    key={b.id}
                    type="button"
                    size="sm"
                    variant={form.batchNo === b.batchNo ? "default" : "outline"}
                    onClick={() => {
                      setForm((f) => ({ ...f, batchNo: b.batchNo, mfgDate: b.mfgDate ?? "", expDate: b.expDate ?? "" }));
                    }}
                  >
                    {b.batchNo}
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <Label>totalQty <span className="text-destructive">*</span></Label>
              <Input type="number" value={form.totalQty || ""} onChange={(e) => setForm((f) => ({ ...f, totalQty: +e.target.value }))} />
            </div>
            <div>
              <Label>qtyPerPallet <span className="text-destructive">*</span></Label>
              <Input type="number" value={form.qtyPerPallet || ""} onChange={(e) => setForm((f) => ({ ...f, qtyPerPallet: +e.target.value }))} />
            </div>

            <div>
              <Label>uom <span className="text-destructive">*</span></Label>
              <Input value={effectiveUom} onChange={(e) => setForm((f) => ({ ...f, uom: e.target.value }))} placeholder={derivedUom || "Unit"} />
            </div>
            <div>
              <Label>weightPerPallet (kg)</Label>
              <Input type="number" value={form.weightPerPallet || ""} onChange={(e) => setForm((f) => ({ ...f, weightPerPallet: +e.target.value }))} placeholder={derivedWeightPerPallet ? String(derivedWeightPerPallet) : "0"} />
              {derivedWeightPerPallet > 0 && (
                <div className="text-xs text-muted-foreground mt-1">
                  Default theo SKU: {derivedWeightPerPallet.toFixed(2)} kg/pallet
                </div>
              )}
            </div>

            <div>
              <Label>mfgDate <span className="text-destructive">*</span></Label>
              <Input type="date" value={form.mfgDate} onChange={(e) => setForm((f) => ({ ...f, mfgDate: e.target.value }))} />
            </div>
            <div>
              <Label>expDate <span className="text-destructive">*</span></Label>
              <Input type="date" value={form.expDate} onChange={(e) => setForm((f) => ({ ...f, expDate: e.target.value }))} />
            </div>

            <div className="lg:col-span-3">
              <Label>note</Label>
              <Textarea value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} rows={2} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Section 2 — Pallet Preview / Generated Pallets</CardTitle>
        </CardHeader>
        <CardContent className="p-5 pt-0 space-y-4">
          {generatedPalletIds.length === 0 ? (
            <>
              <div className="flex flex-wrap gap-3 items-end p-4 rounded-xl bg-muted/50 border">
                <Button variant="secondary" onClick={doCalculate} disabled={form.totalQty <= 0 || form.qtyPerPallet <= 0}>
                  <Zap className="h-4 w-4 mr-1" />
                  Calculate Pallets
                </Button>
                <div className="text-sm text-muted-foreground">
                  Preview: <span className="font-mono">{totalPreviewQty} {effectiveUom} · {totalPreviewWeight.toFixed(2)} kg · {previewRows.length} pallet</span>
                </div>
              </div>

              <div className="flex gap-3 items-end">
                <div>
                  <Label>Add Row (qty)</Label>
                  <Input type="number" className="w-32" min={1} value={manualQty || ""} onChange={(e) => setManualQty(+e.target.value)} />
                </div>
                <Button variant="outline" onClick={doAddRow} disabled={manualQty <= 0}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Row
                </Button>
              </div>

              {overLimit && (
                <div className="flex items-center gap-2 text-sm text-destructive p-3 rounded-lg bg-destructive/10">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  Preview Qty ({totalPreviewQty}) vượt Total Qty ({form.totalQty}). Disable generate.
                </div>
              )}

              {previewRows.length > 0 ? (
                <div className="overflow-x-auto border rounded-xl">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-14">rowNo</TableHead>
                        <TableHead className="text-right">qty</TableHead>
                        <TableHead className="text-right">weight</TableHead>
                        <TableHead>type</TableHead>
                        <TableHead className="text-right">action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {previewRows.map((row) => (
                        <TableRow key={row.rowId}>
                          <TableCell className="text-muted-foreground">{row.rowNo}</TableCell>
                          <TableCell className="text-right font-mono">
                            {editingRowId === row.rowId ? (
                              <Input type="number" className="w-24 text-right inline-block" value={editQty} onChange={(e) => setEditQty(+e.target.value)} min={1} />
                            ) : (
                              row.qty
                            )}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {editingRowId === row.rowId ? (
                              <Input type="number" className="w-24 text-right inline-block" value={editWeight} onChange={(e) => setEditWeight(+e.target.value)} min={0} />
                            ) : (
                              row.weight.toFixed(2)
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant={row.type === "Full" ? "default" : row.type === "Partial" ? "secondary" : "outline"}>{row.type}</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {editingRowId === row.rowId ? (
                              <div className="flex gap-1 justify-end">
                                <Button size="sm" onClick={saveEdit}>Save</Button>
                                <Button size="sm" variant="ghost" onClick={() => setEditingRowId(null)}>Cancel</Button>
                              </div>
                            ) : (
                              <div className="flex gap-1 justify-end">
                                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(row)}>
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => doRemoveRow(row.rowId)}>
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-10 text-muted-foreground border-2 border-dashed rounded-xl">
                  Chưa có preview. Nhập Total/QtyPerPallet rồi bấm Calculate.
                </div>
              )}
            </>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => openPrintLabels(generatedPalletIds)}>
                  <Printer className="h-4 w-4 mr-1" />
                  Print All Pallet Labels ({generatedPalletIds.length})
                </Button>
                <Button variant="outline" onClick={() => openPrintLabels(selectedPalletIds)} disabled={selectedPalletIds.length === 0}>
                  <Printer className="h-4 w-4 mr-1" />
                  Print Selected Labels ({selectedPalletIds.length})
                </Button>
              </div>

              <div className="overflow-x-auto border rounded-xl">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10" />
                      <TableHead>palletId</TableHead>
                      <TableHead className="text-right">qty</TableHead>
                      <TableHead className="text-right">weight</TableHead>
                      <TableHead>status</TableHead>
                      <TableHead>currentLocation</TableHead>
                      <TableHead className="text-right">action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {generatedPallets.map((p) => {
                      const hasOpenTask = (openTaskCountByPallet.get(p.palletId) ?? 0) > 0;
                      const selectable = p.status === "Pending Putaway" && !hasOpenTask;
                      return (
                        <TableRow key={p.id} className={!selectable ? "opacity-60" : ""}>
                          <TableCell>
                            <input
                              type="checkbox"
                              checked={!!selectedPallet[p.palletId]}
                              disabled={!selectable}
                              onChange={(e) => setSelectedPallet((prev) => ({ ...prev, [p.palletId]: e.target.checked }))}
                            />
                          </TableCell>
                          <TableCell className="font-mono text-xs">{p.palletId}</TableCell>
                          <TableCell className="text-right font-mono">{p.qty}</TableCell>
                          <TableCell className="text-right font-mono">{p.weight}</TableCell>
                          <TableCell>{p.status}</TableCell>
                          <TableCell className="font-mono text-xs">{p.currentLocation ?? "—"}</TableCell>
                          <TableCell className="text-right space-x-2">
                            <Button size="sm" variant="outline" onClick={() => openPrintLabels([p.palletId])}>
                              Print Label
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => openCancelDialog(p.palletId)} disabled={p.status !== "Pending Putaway"}>
                              Cancel Unused Pallet
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {generatedPallets.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-6 text-muted-foreground">Không có pallet</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Section 3 — Target Bin Allocation</CardTitle>
        </CardHeader>
        <CardContent className="p-5 pt-0 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
            <div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div>
                  <Label>Kho</Label>
                  <Select
                    value={warehouseFilter}
                    onValueChange={(v) => {
                      setWarehouseFilter(v);
                      setZoneFilter("");
                      setBinPicker("");
                    }}
                    disabled={generatedPalletIds.length === 0}
                  >
                    <SelectTrigger><SelectValue placeholder="Chọn kho" /></SelectTrigger>
                    <SelectContent>
                      {warehouses.map((w) => (
                        <SelectItem key={w} value={w}>{w}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Zone</Label>
                  <Select
                    value={zoneFilter}
                    onValueChange={(v) => {
                      setZoneFilter(v);
                      setBinPicker("");
                    }}
                    disabled={!warehouseFilter || generatedPalletIds.length === 0}
                  >
                    <SelectTrigger><SelectValue placeholder="Chọn zone" /></SelectTrigger>
                    <SelectContent>
                      {zonesForWarehouse.map((z) => (
                        <SelectItem key={z} value={z}>{z}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Target Bin</Label>
                  <Select
                    value={binPicker}
                    onValueChange={setBinPicker}
                    disabled={generatedPalletIds.length === 0 || !warehouseFilter || !zoneFilter}
                  >
                    <SelectTrigger><SelectValue placeholder="Chọn bin" /></SelectTrigger>
                    <SelectContent>
                      {binsForPicker.map((l) => (
                        <SelectItem key={l.id} value={l.locationCode}>
                          {l.locationCode} ({l.currentPalletCount}/{l.capacityPallet})
                        </SelectItem>
                      ))}
                      {binsForPicker.length === 0 && (
                        <SelectItem value="__empty" disabled>
                          Không có bin phù hợp
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  if (!binPicker) return;
                  setTargetBins((prev) => [...prev, binPicker]);
                  setBinPicker("");
                }}
                disabled={!binPicker}
              >
                Add Target Bin
              </Button>
              <Button variant="outline" onClick={doAutoAllocate} disabled={selectedPalletIdsOrdered.length === 0 || targetBins.length === 0}>
                Auto Allocate
              </Button>
              <Button variant="outline" onClick={doClearAllocation} disabled={Object.keys(assignments).length === 0}>
                Clear Allocation
              </Button>
              <Button onClick={doCreatePutawayTasks} disabled={!canCreatePutaway}>
                Create PUTAWAY Tasks ({selectedPalletIdsOrdered.length})
              </Button>
            </div>
          </div>

          <div className="overflow-x-auto border rounded-xl">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Target Bin</TableHead>
                  <TableHead className="text-right">Capacity</TableHead>
                  <TableHead className="text-right">Current</TableHead>
                  <TableHead className="text-right">Open Putaway Tasks</TableHead>
                  <TableHead className="text-right">Available</TableHead>
                  <TableHead className="text-right">Assigned</TableHead>
                  <TableHead className="text-right">Remaining</TableHead>
                  <TableHead className="text-right">Remove</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {binCaps.map((c) => {
                  const assigned = assignedCountByBin.get(c.location.locationCode) ?? 0;
                  const remaining = c.availableCapacity - assigned;
                  const warn = remaining < 0;
                  return (
                    <TableRow key={c.location.locationCode} className={warn ? "bg-destructive/5" : ""}>
                      <TableCell className="font-mono text-xs">{c.location.locationCode}</TableCell>
                      <TableCell className="text-right font-mono">{c.location.capacityPallet}</TableCell>
                      <TableCell className="text-right font-mono">{c.location.currentPalletCount}</TableCell>
                      <TableCell className="text-right font-mono">{c.openPutawayTaskCount}</TableCell>
                      <TableCell className="text-right font-mono">{c.availableCapacity}</TableCell>
                      <TableCell className="text-right font-mono">{assigned}</TableCell>
                      <TableCell className={`text-right font-mono ${warn ? "text-destructive" : ""}`}>{remaining}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            const loc = c.location.locationCode;
                            setTargetBins((prev) => prev.filter((x) => x !== loc));
                            setAssignments((prev) => {
                              const next: Record<string, string> = {};
                              for (const [palletId, b] of Object.entries(prev)) {
                                if (b === loc) continue;
                                next[palletId] = b;
                              }
                              return next;
                            });
                          }}
                        >
                          Remove
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {binCaps.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-6 text-muted-foreground">
                      Chưa chọn Target Bin nào
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="overflow-x-auto border rounded-xl">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pallet ID</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Batch</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead>Target Bin</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {selectedPalletIdsOrdered.map((palletId) => {
                  const p = generatedPallets.find((x) => x.palletId === palletId);
                  if (!p) return null;
                  const assignedBin = assignments[palletId] ?? "";
                  return (
                    <TableRow key={palletId}>
                      <TableCell className="font-mono text-xs">{p.palletId}</TableCell>
                      <TableCell className="text-xs">{p.skuCode}</TableCell>
                      <TableCell className="font-mono text-xs">{p.batchNo}</TableCell>
                      <TableCell className="text-right font-mono">{p.qty}</TableCell>
                      <TableCell>
                        <Select
                          value={assignedBin}
                          onValueChange={(v) => setAssignments((prev) => ({ ...prev, [palletId]: v }))}
                          disabled={targetBins.length === 0}
                        >
                          <SelectTrigger className="w-44"><SelectValue placeholder="Chọn bin" /></SelectTrigger>
                          <SelectContent>
                            {targetBins.map((b) => (
                              <SelectItem key={b} value={b}>{b}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {selectedPalletIdsOrdered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-6 text-muted-foreground">
                      Chưa chọn pallet
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {allocationSummary.totalAvailable < allocationSummary.totalSelected && (
            <div className="flex items-center gap-2 text-sm text-destructive p-3 rounded-lg bg-destructive/10">
              <AlertCircle className="h-4 w-4 shrink-0" />
              Tổng available capacity ({allocationSummary.totalAvailable}) không đủ cho pallet đã chọn ({allocationSummary.totalSelected}).
            </div>
          )}
          {allocationSummary.perBinOver && (
            <div className="flex items-center gap-2 text-sm text-destructive p-3 rounded-lg bg-destructive/10">
              <AlertCircle className="h-4 w-4 shrink-0" />
              Có bin bị assign vượt available capacity.
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Section 4 — Created Putaway Tasks</CardTitle>
        </CardHeader>
        <CardContent className="p-5 pt-0 space-y-3">
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                if (createdTask) openPrintTask(createdTask.taskNo);
              }}
              disabled={!createdTask}
            >
              <Printer className="h-4 w-4 mr-1" />
              Print Task
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                if (!createdTask) return;
                try {
                  cancelTask(createdTask.id);
                  toast.success("Cancelled task");
                } catch (e: any) {
                  toast.error(e.message);
                }
              }}
              disabled={!createdTask || createdTask.status === "Cancelled" || createdTask.status === "Confirmed"}
            >
              Cancel Task
            </Button>
          </div>

          <div className="overflow-x-auto border rounded-xl">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>taskNo</TableHead>
                  <TableHead>status</TableHead>
                  <TableHead className="text-right">totalLines</TableHead>
                  <TableHead className="text-right">actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {createdTask ? (
                  <TableRow key={createdTask.id}>
                    <TableCell className="font-mono text-xs">{createdTask.taskNo}</TableCell>
                    <TableCell>{createdTask.status}</TableCell>
                    <TableCell className="text-right font-mono">{createdTaskLines.length}</TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button size="sm" variant="outline" onClick={() => openPrintTask(createdTask.taskNo)} disabled={createdTask.status === "Cancelled" || createdTask.status === "Confirmed"}>
                        Print
                      </Button>
                    </TableCell>
                  </TableRow>
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-6 text-muted-foreground">Chưa có PUTAWAY task</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {createdTask && (
            <div className="overflow-x-auto border rounded-xl">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pallet ID</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Batch</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead>From</TableHead>
                    <TableHead>To</TableHead>
                    <TableHead>Line Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {createdTaskLines.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="font-mono text-xs">{l.palletId}</TableCell>
                      <TableCell className="text-xs">{l.skuCode}</TableCell>
                      <TableCell className="font-mono text-xs">{l.batchNo}</TableCell>
                      <TableCell className="text-right font-mono">{l.qty}</TableCell>
                      <TableCell className="font-mono text-xs">{l.fromLocation ?? "—"}</TableCell>
                      <TableCell className="font-mono text-xs">{l.toLocation ?? "—"}</TableCell>
                      <TableCell>{l.status}</TableCell>
                    </TableRow>
                  ))}
                  {createdTaskLines.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-6 text-muted-foreground">
                        Không có line
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Unused Pallet</DialogTitle>
            <DialogDescription>Pallet sẽ chuyển trạng thái Cancelled và không thể tạo PUTAWAY task.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Reason</Label>
            <Textarea value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} rows={3} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelDialogOpen(false)}>Đóng</Button>
            <Button onClick={doCancelUnused} disabled={!cancelPalletId || !cancelReason.trim()}>
              Cancel Pallet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
