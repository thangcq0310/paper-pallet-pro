import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { Batch, SKU } from "@/types";
import { useStore } from "@/services/store";
import { cancelTask } from "@/services/taskService";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/PageHeader";
import { TaskListCard } from "@/components/TaskListCard";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Layers, Plus, Printer, Trash2, Zap } from "lucide-react";
import { formatLocationPath } from "@/utils/location";
import { uid } from "@/utils/idGenerator";
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

type SearchOption = {
  value: string;
  title: string;
  description?: string;
  meta?: string[];
};

type InboundLine = {
  id: string;
  skuCode: string;
  batchNo: string;
  totalQty: number;
  qtyPerPallet: number;
  uom: string;
  weightPerPallet: number;
  mfgDate: string;
  expDate: string;
  note: string;
  previewRows: PalletPreviewRow[];
  generatedPalletIds: string[];
};

function createEmptyInboundLine(): InboundLine {
  return {
    id: uid(),
    skuCode: "",
    batchNo: "",
    totalQty: 0,
    qtyPerPallet: 0,
    uom: "",
    weightPerPallet: 0,
    mfgDate: "",
    expDate: "",
    note: "",
    previewRows: [],
    generatedPalletIds: [],
  };
}

function SearchListField(props: {
  label: ReactNode;
  placeholder: string;
  options: SearchOption[];
  value: string;
  onSelect: (value: string) => void;
  disabled?: boolean;
  emptyText: string;
}) {
  const { label, placeholder, options, value, onSelect, disabled, emptyText } = props;
  const [query, setQuery] = useState("");

  const selected = useMemo(() => options.find((opt) => opt.value === value) ?? null, [options, value]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = options.filter((opt) => {
      if (!q) return true;
      const haystack = [opt.value, opt.title, opt.description, ...(opt.meta ?? [])].filter(Boolean).join(" ").toLowerCase();
      return haystack.includes(q);
    });
    return base.slice(0, 3);
  }, [options, query]);

  useEffect(() => {
    if (selected) {
      setQuery(selected.value);
      return;
    }
    if (!value) {
      setQuery("");
    }
  }, [selected, value]);

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
      />

      {selected && (
        <div className="text-xs text-muted-foreground">
          Đang chọn: <span className="font-mono text-foreground">{selected.value}</span>
          {selected.description ? ` — ${selected.description}` : ""}
        </div>
      )}

      <div className="max-h-44 overflow-auto rounded-xl border bg-background p-2">
        {!disabled && filtered.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">{emptyText}</div>
        ) : null}

        {!disabled &&
          filtered.map((opt) => {
            const active = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                className={`w-full rounded-lg border px-3 py-2 text-left transition ${
                  active ? "border-primary bg-primary/5" : "hover:border-primary/50"
                }`}
                onClick={() => {
                  onSelect(opt.value);
                  setQuery(opt.value);
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-mono text-sm">{opt.title}</div>
                    {opt.description && <div className="text-xs text-muted-foreground">{opt.description}</div>}
                  </div>
                  {opt.meta?.length ? (
                    <div className="flex flex-wrap justify-end gap-1">
                      {opt.meta.map((m) => (
                        <Badge key={m} variant="outline" className="text-[10px]">
                          {m}
                        </Badge>
                      ))}
                    </div>
                  ) : null}
                </div>
              </button>
            );
          })}

        {disabled && <div className="py-6 text-center text-sm text-muted-foreground">{placeholder}</div>}
      </div>
    </div>
  );
}

function InboundLineCard(props: {
  line: InboundLine;
  index: number;
  skus: SKU[];
  batches: Batch[];
  onUpdate: (lineId: string, patch: Partial<InboundLine>) => void;
  onRemove: (lineId: string) => void;
}) {
  const { line, index, skus, batches, onUpdate, onRemove } = props;
  const selectedSku = useMemo(() => skus.find((s) => s.skuCode === line.skuCode) ?? null, [line.skuCode, skus]);
  const availableBatches = useMemo(() => batches.filter((b) => b.skuCode === line.skuCode), [batches, line.skuCode]);
  const locked = line.generatedPalletIds.length > 0;

  return (
    <Card className="rounded-2xl border-dashed">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">SKU/Batch line {index + 1}</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">Mỗi line là 1 SKU + 1 batch trong cùng inbound.</p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Badge variant="outline">{line.skuCode || "Chưa chọn SKU"}</Badge>
            {locked ? <Badge>Đã generate {line.generatedPalletIds.length}</Badge> : <Badge variant="secondary">Draft</Badge>}
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={() => onRemove(line.id)}
              disabled={locked}
              title={locked ? "Không thể xóa line đã generate" : "Xóa line"}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        <div className="grid gap-4 lg:grid-cols-2">
          <SearchListField
            label={
              <>
                SKU <span className="text-destructive">*</span>
              </>
            }
            placeholder="Tìm SKU theo code hoặc tên"
            value={line.skuCode}
            onSelect={(v) =>
              onUpdate(line.id, {
                skuCode: v,
                batchNo: "",
                mfgDate: "",
                expDate: "",
                uom: "",
                weightPerPallet: 0,
                previewRows: [],
                generatedPalletIds: [],
              })
            }
            options={skus.map((s) => ({
              value: s.skuCode,
              title: `${s.skuCode} — ${s.skuName}`,
              description: `UOM: ${s.uom} | Weight/unit: ${s.weightPerUnit}`,
              meta: [s.storageType || "SKU"],
            }))}
            emptyText="Không tìm thấy SKU khớp từ khóa"
            disabled={locked}
          />

          <SearchListField
            key={line.skuCode || `${line.id}-batch-empty`}
            label={
              <>
                Batch <span className="text-destructive">*</span>
              </>
            }
            placeholder={line.skuCode ? "Tìm batch theo mã batch" : "Chọn SKU trước"}
            value={line.batchNo}
            onSelect={(v) => {
              const selected = availableBatches.find((b) => b.batchNo === v);
              onUpdate(line.id, {
                batchNo: v,
                mfgDate: selected?.mfgDate ?? "",
                expDate: selected?.expDate ?? "",
                previewRows: [],
                generatedPalletIds: [],
              });
            }}
            options={availableBatches.map((b) => ({
              value: b.batchNo,
              title: b.batchNo,
              description: `MFG: ${b.mfgDate} | EXP: ${b.expDate}`,
              meta: [line.skuCode || "SKU"],
            }))}
            disabled={!line.skuCode || locked}
            emptyText={line.skuCode ? "SKU này chưa có batch" : "Chọn SKU trước để tìm batch"}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <Label>Tổng số lượng <span className="text-destructive">*</span></Label>
            <Input type="number" value={line.totalQty || ""} onChange={(e) => onUpdate(line.id, { totalQty: +e.target.value })} disabled={locked} />
          </div>
          <div>
            <Label>Số lượng mỗi pallet <span className="text-destructive">*</span></Label>
            <Input type="number" value={line.qtyPerPallet || ""} onChange={(e) => onUpdate(line.id, { qtyPerPallet: +e.target.value })} disabled={locked} />
          </div>
          <div>
            <Label>Đơn vị tính (UOM) <span className="text-destructive">*</span></Label>
            <Input
              value={line.uom}
              onChange={(e) => onUpdate(line.id, { uom: e.target.value })}
              placeholder={selectedSku?.uom || "Unit"}
              disabled={locked}
            />
          </div>
          <div>
            <Label>Khối lượng mỗi pallet (kg)</Label>
            <Input type="number" value={line.weightPerPallet || ""} onChange={(e) => onUpdate(line.id, { weightPerPallet: +e.target.value })} disabled={locked} />
          </div>
          <div>
            <Label>Ngày sản xuất <span className="text-destructive">*</span></Label>
            <Input type="date" value={line.mfgDate} onChange={(e) => onUpdate(line.id, { mfgDate: e.target.value })} disabled={locked} />
          </div>
          <div>
            <Label>Hạn sử dụng <span className="text-destructive">*</span></Label>
            <Input type="date" value={line.expDate} onChange={(e) => onUpdate(line.id, { expDate: e.target.value })} disabled={locked} />
          </div>
          <div className="lg:col-span-3">
            <Label>Ghi chú</Label>
            <Textarea value={line.note} onChange={(e) => onUpdate(line.id, { note: e.target.value })} rows={2} disabled={locked} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function InboundPalletizePutawayPage() {
  const router = useRouter();
  const skus = useStore((s) => s.skus);
  const batches = useStore((s) => s.batches);
  const locations = useStore((s) => s.locations);
  const pallets = useStore((s) => s.pallets);
  const tasks = useStore((s) => s.tasks);
  const taskLines = useStore((s) => s.taskLines);

  const [inboundNo, setInboundNo] = useState("");
  const [lines, setLines] = useState<InboundLine[]>([createEmptyInboundLine()]);
  const [generatingLineId, setGeneratingLineId] = useState<string | null>(null);
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

  const updateLine = (lineId: string, patch: Partial<InboundLine>) => {
    setLines((prev) => prev.map((line) => (line.id === lineId ? { ...line, ...patch } : line)));
  };

  const addLine = () => setLines((prev) => [...prev, createEmptyInboundLine()]);

  const removeLine = (lineId: string) => {
    const line = lines.find((l) => l.id === lineId);
    if (!line) return;
    if (line.generatedPalletIds.length > 0) {
      toast.error("Không thể xóa line đã generate pallet");
      return;
    }
    setLines((prev) => (prev.length > 1 ? prev.filter((l) => l.id !== lineId) : prev));
  };

  const buildPreviewRows = (line: InboundLine) => {
    try {
      const sku = skus.find((s) => s.skuCode === line.skuCode) ?? null;
      const derivedWeightPerPallet = sku && line.qtyPerPallet > 0 ? sku.weightPerUnit * line.qtyPerPallet : 0;
      const effectiveWeightPerPallet = line.weightPerPallet > 0 ? line.weightPerPallet : derivedWeightPerPallet;
      return calculatePalletPreview({
        totalQty: line.totalQty,
        qtyPerPallet: line.qtyPerPallet,
        weightPerPallet: effectiveWeightPerPallet,
      }).map((r) => ({ ...r, weight: line.qtyPerPallet > 0 ? (r.qty / line.qtyPerPallet) * effectiveWeightPerPallet : 0 }));
    } catch (e: any) {
      toast.error(e.message);
      return [];
    }
  };

  const calculateLine = (lineId: string) => {
    const line = lines.find((l) => l.id === lineId);
    if (!line) return;
    const rows = buildPreviewRows(line);
    if (!rows.length) return;
    updateLine(lineId, { previewRows: rows });
    toast.success(`Đã tạo preview ${rows.length} pallet`);
  };

  const generateLine = (lineId: string) => {
    const line = lines.find((l) => l.id === lineId);
    if (!line) return;
    if (line.generatedPalletIds.length > 0) {
      toast.error("Line này đã generate pallet");
      return;
    }

    const sku = skus.find((s) => s.skuCode === line.skuCode);
    const batch = batches.find((b) => b.batchNo === line.batchNo && b.skuCode === line.skuCode);
    const derivedUom = sku?.uom ?? "";
    const effectiveUom = line.uom || derivedUom;
    const derivedWeightPerPallet = sku && line.qtyPerPallet > 0 ? sku.weightPerUnit * line.qtyPerPallet : 0;
    const effectiveWeightPerPallet = line.weightPerPallet > 0 ? line.weightPerPallet : derivedWeightPerPallet;

    try {
      if (!inboundNo.trim()) throw new Error("Nhập inboundNo");
      if (!line.skuCode) throw new Error("Chọn SKU");
      if (!line.batchNo) throw new Error("Chọn Batch");
      if (!effectiveUom) throw new Error("Nhập UOM");
      if (!line.mfgDate && !batch?.mfgDate) throw new Error("Nhập MFG Date");
      if (!line.expDate && !batch?.expDate) throw new Error("Nhập EXP Date");
      const previewRows = line.previewRows.length ? line.previewRows : buildPreviewRows(line);
      if (!previewRows.length) throw new Error("Chưa có pallet preview");

      setGeneratingLineId(lineId);
      const created = generatePalletIdsFromPreview({
        inboundNo,
        skuCode: line.skuCode,
        batchNo: line.batchNo,
        uom: effectiveUom,
        mfgDate: line.mfgDate || batch?.mfgDate || "",
        expDate: line.expDate || batch?.expDate || "",
        note: line.note || undefined,
        rows: previewRows.map((r) => ({ qty: r.qty, weight: r.weight || (line.qtyPerPallet > 0 ? (r.qty / line.qtyPerPallet) * effectiveWeightPerPallet : 0) })),
      });
      const ids = created.map((p) => p.palletId);
      updateLine(lineId, { generatedPalletIds: ids });
      setSelectedPallet((prev) => ({ ...prev, ...Object.fromEntries(ids.map((id) => [id, true])) }));
      toast.success(`Đã generate ${ids.length} pallet`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setGeneratingLineId(null);
    }
  };

  const calculateAllLines = () => {
    let updatedCount = 0;
    setLines((prev) =>
      prev.map((line) => {
        if (line.generatedPalletIds.length > 0) return line;
        const rows = buildPreviewRows(line);
        if (!rows.length) return line;
        updatedCount += 1;
        return { ...line, previewRows: rows };
      }),
    );
    if (updatedCount > 0) {
      toast.success(`Đã tạo preview cho ${updatedCount} line`);
    } else {
      toast.info("Không có line hợp lệ để tạo preview");
    }
  };

  const generateAllLines = () => {
    if (!inboundNo.trim()) {
      toast.error("Nhập inboundNo");
      return;
    }

    const candidateLines = lines.filter((line) => line.generatedPalletIds.length === 0);
    if (candidateLines.length === 0) {
      toast.info("Không còn line nào để generate");
      return;
    }

    setGeneratingLineId("ALL");
    try {
      let generatedCount = 0;
      for (const line of candidateLines) {
        const sku = skus.find((s) => s.skuCode === line.skuCode);
        const batch = batches.find((b) => b.batchNo === line.batchNo && b.skuCode === line.skuCode);
        const derivedUom = sku?.uom ?? "";
        const effectiveUom = line.uom || derivedUom;
        const derivedWeightPerPallet = sku && line.qtyPerPallet > 0 ? sku.weightPerUnit * line.qtyPerPallet : 0;
        const effectiveWeightPerPallet = line.weightPerPallet > 0 ? line.weightPerPallet : derivedWeightPerPallet;

        if (!line.skuCode) throw new Error("Chọn SKU");
        if (!line.batchNo) throw new Error("Chọn Batch");
        if (!effectiveUom) throw new Error("Nhập UOM");
        if (!line.mfgDate && !batch?.mfgDate) throw new Error("Nhập MFG Date");
        if (!line.expDate && !batch?.expDate) throw new Error("Nhập EXP Date");

        const previewRows = line.previewRows.length ? line.previewRows : buildPreviewRows(line);
        if (!previewRows.length) throw new Error("Chưa có pallet preview");

        const created = generatePalletIdsFromPreview({
          inboundNo,
          skuCode: line.skuCode,
          batchNo: line.batchNo,
          uom: effectiveUom,
          mfgDate: line.mfgDate || batch?.mfgDate || "",
          expDate: line.expDate || batch?.expDate || "",
          note: line.note || undefined,
          rows: previewRows.map((r) => ({ qty: r.qty, weight: r.weight || (line.qtyPerPallet > 0 ? (r.qty / line.qtyPerPallet) * effectiveWeightPerPallet : 0) })),
        });
        const ids = created.map((p) => p.palletId);
        updateLine(line.id, { generatedPalletIds: ids });
        setSelectedPallet((prev) => ({ ...prev, ...Object.fromEntries(ids.map((id) => [id, true])) }));
        generatedCount += ids.length;
      }
      toast.success(`Đã generate ${generatedCount} pallet`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setGeneratingLineId(null);
    }
  };

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

  const generatedPalletIds = useMemo(() => lines.flatMap((line) => line.generatedPalletIds), [lines]);

  const generatedPallets = useMemo(() => {
    const ids = new Set(generatedPalletIds);
    return pallets.filter((p) => ids.has(p.palletId));
  }, [generatedPalletIds, pallets]);

  useEffect(() => {
    setSelectedPallet((prev) => {
      const next: Record<string, boolean> = {};
      for (const id of generatedPalletIds) {
        next[id] = prev[id] ?? true;
      }
      return next;
    });
  }, [generatedPalletIds]);

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

  const selectedPalletIdsOrdered = useMemo(() => {
    const selected = new Set(Object.entries(selectedPallet).filter(([, v]) => v).map(([k]) => k));
    return lines.flatMap((line) => line.generatedPalletIds).filter((id) => selected.has(id));
  }, [lines, selectedPallet]);

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

  const canCreatePutaway =
    generatedPalletIds.length > 0 &&
    selectedPalletIdsOrdered.length > 0;

  const openPrintLabels = (ids: string[]) => {
    const cleaned = Array.from(new Set(ids.map((x) => x.trim()).filter(Boolean)));
    if (cleaned.length === 0) return;
    window.open(`/pallet/print-batch?ids=${encodeURIComponent(cleaned.join(","))}`, "_blank", "noopener,noreferrer");
  };

  const openPrintTask = (taskNo: string) => {
    router.navigate({ to: "/tasks/$taskNo/print", params: { taskNo }, search: { autoprint: true } });
  };

  const doAutoAllocate = () => {
    try {
      const asg = autoAllocatePalletsToBins({ palletIds: selectedPalletIdsOrdered, targetLocations: targetBins });
      setAssignments(Object.fromEntries(asg.map((a) => [a.palletId, a.targetLocation ?? ""]).filter(([, targetLocation]) => !!targetLocation)));
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
      // Create tasks without pre-assigning bins - workers scan actual bin on the floor
      const asg: PutawayAssignment[] = selectedPalletIdsOrdered.map((palletId) => ({
        palletId,
        targetLocation: null, // filled on floor during putaway
      }));
      const created = createPutawayTaskWithLines({ inboundNo, assignments: asg });
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

  // Get all open PUTAWAY tasks for display
  const openPutawayTasks = useMemo(
    () => tasks.filter((t) => t.taskType === "PUTAWAY" && (t.status === "Open" || t.status === "Printed" || t.status === "Partially Confirmed")),
    [tasks],
  );

  const putawayLineMap = useMemo(() => {
    const map = new Map<string, typeof taskLines>();
    for (const l of taskLines) {
      const arr = map.get(l.taskId) ?? [];
      arr.push(l);
      map.set(l.taskId, arr);
    }
    return map;
  }, [taskLines]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inbound Palletize & Putaway"
        description="Bước 1: nhập inbound và thêm nhiều SKU/Batch line → Bước 2: generate pallet ID, in label và chọn pallet → Bước 3: tạo PUTAWAY task, quét actual bin khi confirm"
      />

      <Card className="rounded-2xl">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-base">Bước 1 — Inbound và SKU/Batch lines</CardTitle>
            <Button type="button" variant="outline" onClick={addLine}>
              <Plus className="h-4 w-4 mr-1" />
              Add SKU/Batch line
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-5 pt-0 space-y-4">
          <div>
            <Label>Mã inbound <span className="text-destructive">*</span></Label>
            <Input value={inboundNo} onChange={(e) => setInboundNo(e.target.value)} placeholder="VD: INB-2026-001" />
          </div>

          <div className="space-y-4">
            {lines.map((line, index) => (
              <InboundLineCard
                key={line.id}
                line={line}
                index={index}
                skus={skus}
                batches={batches}
                onUpdate={updateLine}
                onRemove={removeLine}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base">Bước 2 — Generate pallet ID và in label</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Tập trung generate và in label cho toàn bộ inbound, không tách thành khu riêng theo từng SKU/batch.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={calculateAllLines}>
                <Zap className="h-4 w-4 mr-1" />
                Tính tất cả
              </Button>
              <Button type="button" variant="outline" onClick={generateAllLines} disabled={generatingLineId === "ALL"}>
                <Layers className="h-4 w-4 mr-1" />
                Generate tất cả
              </Button>
              <Button type="button" variant="outline" onClick={() => openPrintLabels(generatedPalletIds)} disabled={generatedPalletIds.length === 0}>
                <Printer className="h-4 w-4 mr-1" />
                In tất cả ({generatedPalletIds.length})
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-5 pt-0 space-y-4">
          {generatedPalletIds.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground border-2 border-dashed rounded-xl">
              Chưa có pallet nào được generate. Hãy hoàn tất ít nhất 1 SKU/Batch line ở Bước 1.
            </div>
          ) : (
            <>
              <div className="overflow-x-auto border rounded-xl">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Line</TableHead>
                      <TableHead>SKU / Batch</TableHead>
                      <TableHead className="text-right">Preview</TableHead>
                      <TableHead className="text-right">Generated</TableHead>
                      <TableHead>Trạng thái</TableHead>
                      <TableHead className="text-right">Thao tác</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lines.map((line, index) => {
                      const hasGenerated = line.generatedPalletIds.length > 0;
                      return (
                        <TableRow key={line.id}>
                          <TableCell className="font-mono text-xs">{index + 1}</TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <div className="font-mono text-xs">{line.skuCode || "—"}</div>
                              <div className="text-xs text-muted-foreground font-mono">{line.batchNo || "—"}</div>
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-mono">{line.previewRows.length}</TableCell>
                          <TableCell className="text-right font-mono">{line.generatedPalletIds.length}</TableCell>
                          <TableCell>
                            {hasGenerated ? (
                              <Badge>Đã generate</Badge>
                            ) : line.previewRows.length > 0 ? (
                              <Badge variant="secondary">Đã preview</Badge>
                            ) : (
                              <Badge variant="outline">Chưa xử lý</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex flex-wrap justify-end gap-2">
                              <Button size="sm" variant="outline" onClick={() => calculateLine(line.id)} disabled={!line.skuCode || !line.batchNo || hasGenerated}>
                                Tính pallet
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => generateLine(line.id)} disabled={!line.skuCode || !line.batchNo || hasGenerated || generatingLineId === line.id}>
                                Generate ID
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => openPrintLabels(line.generatedPalletIds)} disabled={line.generatedPalletIds.length === 0}>
                                <Printer className="h-3.5 w-3.5 mr-1" />
                                In label
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              <div className="rounded-xl border bg-muted/20 p-4 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold">Pallet đã generate</div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Chọn pallet cần putaway, kiểm tra bin hiện tại và in nhãn nếu cần trước khi tạo task.
                    </p>
                  </div>
                  <div className="text-xs text-muted-foreground text-right">
                    Đã generate <span className="font-mono text-foreground">{generatedPalletIds.length}</span> pallet
                  </div>
                </div>

                <div className="overflow-x-auto border rounded-xl bg-background">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10" />
                        <TableHead>Pallet ID</TableHead>
                        <TableHead className="text-right">Số lượng</TableHead>
                        <TableHead className="text-right">Khối lượng</TableHead>
                        <TableHead>Trạng thái</TableHead>
                        <TableHead>Bin hiện tại</TableHead>
                        <TableHead className="text-right">Thao tác</TableHead>
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
                            <TableCell className="font-mono text-xs">
                              <div>{p.currentLocation ?? "—"}</div>
                              <div className="text-[11px] text-muted-foreground">
                                {formatLocationPath(locations.find((l) => l.locationCode === p.currentLocation) ?? null)}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex gap-1 justify-end">
                                <Button size="sm" variant="outline" onClick={() => openPrintLabels([p.palletId])}>
                                  <Printer className="h-3.5 w-3.5" />
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => openCancelDialog(p.palletId)} disabled={p.status !== "Pending Putaway"}>
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {generatedPallets.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-6 text-muted-foreground">
                            Không có pallet
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => openPrintLabels(selectedPalletIdsOrdered)} disabled={selectedPalletIdsOrdered.length === 0}>
                  <Printer className="h-4 w-4 mr-1" />
                  In đã chọn ({selectedPalletIdsOrdered.length})
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Bước 3 — Tạo PUTAWAY task</CardTitle>
        </CardHeader>
        <CardContent className="p-5 pt-0 space-y-3">
          <div className="flex gap-2">
            <Button onClick={doCreatePutawayTasks} disabled={!canCreatePutaway}>
              <Layers className="h-4 w-4 mr-1" />
              Tạo PUTAWAY task ({selectedPalletIdsOrdered.length})
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                if (createdTask) openPrintTask(createdTask.taskNo);
              }}
              disabled={!createdTask}
            >
              <Printer className="h-4 w-4 mr-1" />
              In task
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
              Hủy task
            </Button>
          </div>

          <TaskListCard
            title="Danh sách PUTAWAY tasks đang mở"
            tasks={openPutawayTasks}
            lineMap={putawayLineMap}
            currentTaskNo={createdTaskNo || undefined}
            emptyMessage="Không có PUTAWAY task đang mở"
            onPrintTask={openPrintTask}
            onCancelTask={(task) => {
              try {
                cancelTask(task.id);
                toast.success("Cancelled task");
              } catch (e: any) {
                toast.error(e.message);
              }
            }}
          />

          {createdTask && (
            <div className="overflow-x-auto border rounded-xl">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pallet ID</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Batch</TableHead>
                    <TableHead className="text-right">Số lượng</TableHead>
                    <TableHead>Từ bin</TableHead>
                    <TableHead>Đến bin</TableHead>
                    <TableHead>Trạng thái dòng</TableHead>
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
            <Button variant="outline" onClick={() => setCancelDialogOpen(false)}>
              Đóng
            </Button>
            <Button onClick={doCancelUnused} disabled={!cancelPalletId || !cancelReason.trim()}>
              Cancel Pallet
            </Button>
          </DialogFooter>
        </DialogContent>
</Dialog>
    </div>
  );
}
