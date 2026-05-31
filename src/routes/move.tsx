import { createFileRoute } from "@tanstack/react-router";
import { Fragment, useMemo, useState } from "react";
import { useStore } from "@/services/store";
import { cancelTask, createMoveTaskWithLines } from "@/services/taskService";
import { getAvailableBatchSummaryBySku, getAvailableSkuSummary, listAvailablePalletsBySkuBatch } from "@/services/taskQueryService";
import { autoAllocatePalletsToBins, getMultiTargetBinCapacityByTaskType } from "@/services/taskAllocationService";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/PageHeader";
import { TaskStatusBadge } from "@/components/StatusBadges";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import { formatLocationPath } from "@/utils/location";
import { toast } from "sonner";

export const Route = createFileRoute("/move")({ component: MovePage });

function MovePage() {
  const skus = useStore((s) => s.skus);
  const tasks = useStore((s) => s.tasks);
  const taskLines = useStore((s) => s.taskLines);
  const locations = useStore((s) => s.locations);

  const [skuCode, setSkuCode] = useState("");
  const [batchNo, setBatchNo] = useState("");
  const [search, setSearch] = useState("");
  const [showOnlyAvailableSku, setShowOnlyAvailableSku] = useState(true);
  const [viewMode, setViewMode] = useState<"table" | "card">("table");
  const [groupMode, setGroupMode] = useState<"location" | "zone">("location");

  const [selectedPallet, setSelectedPallet] = useState<Record<string, boolean>>({});
  const [targetBins, setTargetBins] = useState<string[]>([]);
  const [binPicker, setBinPicker] = useState("");
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [lastTaskNo, setLastTaskNo] = useState("");

  const availableBatchSummaries = useMemo(() => {
    if (!skuCode) return [];
    return getAvailableBatchSummaryBySku({ skuCode, purpose: "MOVE" });
  }, [skuCode, tasks, taskLines, locations]);

  const availableSkuSummaries = useMemo(() => getAvailableSkuSummary({ purpose: "MOVE" }), [tasks, taskLines, locations]);
  const skuSummaryByCode = useMemo(
    () => new Map(availableSkuSummaries.map((s) => [s.skuCode, s])),
    [availableSkuSummaries],
  );
  const skuOptions = useMemo(() => {
    const availableOrder = new Map(availableSkuSummaries.map((s, idx) => [s.skuCode, idx]));
    return [...skus]
      .map((sku) => ({ sku, summary: skuSummaryByCode.get(sku.skuCode) }))
      .filter(({ summary }) => !showOnlyAvailableSku || !!summary)
      .sort((a, b) => {
        const ai = availableOrder.get(a.sku.skuCode);
        const bi = availableOrder.get(b.sku.skuCode);
        if (showOnlyAvailableSku) {
          if (ai != null && bi != null && ai !== bi) return ai - bi;
          if (ai != null) return -1;
          if (bi != null) return 1;
          return a.sku.skuCode.localeCompare(b.sku.skuCode);
        }
        if (ai != null && bi != null && ai !== bi) return ai - bi;
        if (ai != null) return -1;
        if (bi != null) return 1;
        const aAvailable = !!a.summary;
        const bAvailable = !!b.summary;
        if (aAvailable !== bAvailable) return aAvailable ? -1 : 1;
        return a.sku.skuCode.localeCompare(b.sku.skuCode);
      });
  }, [availableSkuSummaries, skuSummaryByCode, showOnlyAvailableSku, skus]);

  const availablePallets = useMemo(() => {
    if (!skuCode || !batchNo) return [];
    return listAvailablePalletsBySkuBatch({ skuCode, batchNo, purpose: "MOVE" });
  }, [skuCode, batchNo, tasks, taskLines, locations]);

  const filteredPallets = useMemo(() => {
    if (!search.trim()) return availablePallets;
    const q = search.toLowerCase();
    return availablePallets.filter((p) => p.palletId.toLowerCase().includes(q) || (p.currentLocation ?? "").toLowerCase().includes(q));
  }, [availablePallets, search]);
  const locationZoneByCode = useMemo(
    () => Object.fromEntries(locations.map((l) => [l.locationCode, l.zone])),
    [locations],
  );
  const locationPathByCode = useMemo(
    () => Object.fromEntries(locations.map((l) => [l.locationCode, formatLocationPath(l)])),
    [locations],
  );
  const daysToExpiry = (expDate?: string) => {
    if (!expDate) return null;
    const diff = new Date(expDate).getTime() - new Date().getTime();
    if (!Number.isFinite(diff)) return null;
    return Math.ceil(diff / (24 * 60 * 60 * 1000));
  };
  const batchDaysToExpiry = (expDate?: string) => daysToExpiry(expDate);

  const selectedIds = useMemo(
    () => availablePallets.filter((p) => selectedPallet[p.palletId]).map((p) => p.palletId),
    [availablePallets, selectedPallet],
  );

  const storageBins = useMemo(
    () => locations.filter((l) => l.locationType === "STORAGE" && l.status === "Active"),
    [locations],
  );

  const binsForPicker = useMemo(
    () => storageBins.filter((l) => !targetBins.includes(l.locationCode)),
    [storageBins, targetBins],
  );

  const binCaps = useMemo(() => {
    if (!targetBins.length) return [];
    try {
      return getMultiTargetBinCapacityByTaskType({ locationCodes: targetBins, taskType: "MOVE" });
    } catch {
      return [];
    }
  }, [targetBins]);

  const assignedCountByBin = useMemo(() => {
    const map = new Map<string, number>();
    for (const palletId of selectedIds) {
      const bin = assignments[palletId];
      if (!bin) continue;
      map.set(bin, (map.get(bin) ?? 0) + 1);
    }
    return map;
  }, [assignments, selectedIds]);

  const totalSelectedQty = useMemo(
    () => availablePallets.filter((p) => selectedPallet[p.palletId]).reduce((sum, p) => sum + p.qty, 0),
    [availablePallets, selectedPallet],
  );

  const allocationStatus = useMemo(() => {
    const totalAvailable = binCaps.reduce((sum, c) => sum + c.availableCapacity, 0);
    const totalAssigned = selectedIds.filter((palletId) => !!assignments[palletId]).length;
    const perBinOver = binCaps.some((c) => (assignedCountByBin.get(c.locationCode) ?? 0) > c.availableCapacity);
    return { totalAvailable, totalAssigned, perBinOver };
  }, [assignedCountByBin, assignments, binCaps, selectedIds]);

  const groupedVisiblePallets = useMemo(() => {
    const map = new Map<string, { key: string; label: string; pallets: typeof filteredPallets }>();
    for (const pallet of filteredPallets) {
      const currentLocation = pallet.currentLocation ?? "";
      const key = groupMode === "location"
        ? (currentLocation || "Chưa có bin")
        : (locationZoneByCode[currentLocation] ?? "Chưa có zone");
      const label = groupMode === "location"
        ? (locationPathByCode[currentLocation] ?? key)
        : key;
      const row = map.get(key);
      if (row) {
        row.pallets.push(pallet);
      } else {
        map.set(key, { key, label, pallets: [pallet] });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.key.localeCompare(b.key));
  }, [filteredPallets, groupMode, locationPathByCode, locationZoneByCode]);

  const canCreateTask =
    !!skuCode &&
    !!batchNo &&
    selectedIds.length > 0 &&
    targetBins.length > 0 &&
    allocationStatus.totalAssigned === selectedIds.length &&
    !allocationStatus.perBinOver &&
    allocationStatus.totalAvailable >= selectedIds.length;

  const openMoveTasks = useMemo(
    () => tasks.filter((t) => t.taskType === "MOVE" && (t.status === "Open" || t.status === "Printed" || t.status === "Partially Confirmed")),
    [tasks],
  );

  const openTaskMap = useMemo(() => {
    const map = new Map<string, typeof taskLines>();
    for (const l of taskLines) {
      const arr = map.get(l.taskId) ?? [];
      arr.push(l);
      map.set(l.taskId, arr);
    }
    return map;
  }, [taskLines]);

  const createdTask = useMemo(
    () => (lastTaskNo ? tasks.find((t) => t.taskNo === lastTaskNo) ?? null : null),
    [lastTaskNo, tasks],
  );

  const toggleSelection = (palletId: string, checked: boolean) => {
    setSelectedPallet((prev) => ({ ...prev, [palletId]: checked }));
  };

  const selectPalletIds = (palletIds: string[]) => {
    setSelectedPallet((prev) => {
      const next = { ...prev };
      for (const palletId of palletIds) next[palletId] = true;
      return next;
    });
  };

  const clearVisibleSelection = () => {
    setSelectedPallet((prev) => {
      const next = { ...prev };
      for (const pallet of filteredPallets) {
        delete next[pallet.palletId];
      }
      return next;
    });
  };

  const selectGroup = (groupKey: string) => {
    const ids = filteredPallets.filter((p) => {
      if (groupMode === "location") return (p.currentLocation ?? "Chưa có bin") === groupKey;
      return (locationZoneByCode[p.currentLocation ?? ""] ?? "Chưa có zone") === groupKey;
    }).map((p) => p.palletId);
    selectPalletIds(ids);
  };

  const clearGroup = (groupKey: string) => {
    setSelectedPallet((prev) => {
      const next = { ...prev };
      for (const pallet of filteredPallets) {
        const matches = groupMode === "location"
          ? (pallet.currentLocation ?? "Chưa có bin") === groupKey
          : (locationZoneByCode[pallet.currentLocation ?? ""] ?? "Chưa có zone") === groupKey;
        if (matches) delete next[pallet.palletId];
      }
      return next;
    });
  };

  const stepIndex = !skuCode
    ? 0
    : !batchNo
      ? 1
      : selectedIds.length === 0
        ? 2
        : targetBins.length === 0
          ? 3
          : 4;

  const doAutoAllocate = () => {
    try {
      const auto = autoAllocatePalletsToBins({ palletIds: selectedIds, targetLocations: targetBins, taskType: "MOVE" });
      setAssignments(Object.fromEntries(auto.map((x) => [x.palletId, x.targetLocation])));
      toast.success("Đã auto allocate target bin");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const doCreateMoveTask = () => {
    try {
      const created = createMoveTaskWithLines({
        assignments: selectedIds.map((palletId) => ({ palletId, targetLocation: assignments[palletId] })),
        note: `MOVE ${skuCode}/${batchNo}`,
      });
      setLastTaskNo(created.task.taskNo);
      setSelectedPallet({});
      setAssignments({});
      toast.success(`Đã tạo MOVE task ${created.task.taskNo} (${created.lines.length} lines)`);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Move Bin" description="Chọn SKU/Batch → chọn pallet → allocate target bin → tạo 1 MOVE task nhiều lines" />

      <Card className="rounded-2xl">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
            {[
              "Chọn SKU/Batch",
              "Chọn pallet",
              "Phân bổ target bin",
              "Tạo/In MOVE task",
            ].map((label, idx) => {
              const done = stepIndex > idx;
              const active = stepIndex === idx;
              return (
                <div
                  key={label}
                  className={cn(
                    "flex items-center gap-3 rounded-xl border px-3 py-2",
                    active ? "border-primary bg-primary/5" : done ? "border-emerald-500/40 bg-emerald-500/5" : "opacity-75",
                  )}
                >
                  <div
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold",
                      active ? "bg-primary text-primary-foreground" : done ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground",
                    )}
                  >
                    {idx + 1}
                  </div>
                  <div>
                    <div className="text-sm font-medium">{label}</div>
                    <div className="text-xs text-muted-foreground">
                      {active ? "Đang làm" : done ? "Đã xong" : "Chưa tới"}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {createdTask && (
        <Card className="rounded-2xl border-primary/40 bg-primary/5">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <div className="text-xs uppercase text-muted-foreground">MOVE task vừa tạo</div>
              <div className="font-mono text-sm font-semibold">{createdTask.taskNo}</div>
              <div className="text-sm text-muted-foreground">{createdTask.status} • {createdTask.taskType}</div>
            </div>
            <Button variant="outline" onClick={() => window.open(`/tasks/${encodeURIComponent(createdTask.taskNo)}/print`, "_blank", "noopener,noreferrer")}>
              Print
            </Button>
          </CardContent>
        </Card>
      )}

      <Card className="rounded-2xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Section 1 - Chọn SKU/Batch</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>SKU khả dụng</Label>
            <div className="flex items-center gap-2">
              <Switch checked={showOnlyAvailableSku} onCheckedChange={setShowOnlyAvailableSku} />
              <span className="text-sm text-muted-foreground">
                Chỉ hiện SKU có pallet khả dụng
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {skuOptions.length === 0 && (
                <span className="text-sm text-muted-foreground">
                  {showOnlyAvailableSku ? "Chưa có SKU khả dụng để MOVE." : "Chưa có SKU nào."}
                </span>
              )}
              {skuOptions.map(({ sku, summary }) => (
                <button
                  key={sku.skuCode}
                  type="button"
                  onClick={() => {
                    setSkuCode(sku.skuCode);
                    setBatchNo("");
                    setSelectedPallet({});
                    setAssignments({});
                  }}
                  className={cn(
                    "flex min-w-56 items-center justify-between rounded-xl border px-3 py-2 text-left transition",
                    skuCode === sku.skuCode ? "border-primary bg-primary/5" : "hover:border-primary/60",
                    !summary ? "opacity-75" : "",
                  )}
                >
                  <div>
                    <div className="font-mono text-sm">{sku.skuCode}</div>
                    <div className="text-xs text-muted-foreground">{sku.skuName}</div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {summary ? (
                      <>
                        <Badge variant="outline">{summary.palletCount} pal</Badge>
                        <span className="text-xs text-muted-foreground">{summary.totalQty}</span>
                      </>
                    ) : (
                      <Badge variant="destructive">No available pallet</Badge>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <Label>SKU master</Label>
              <Select
                value={skuCode}
                onValueChange={(v) => {
                  setSkuCode(v);
                  setBatchNo("");
                  setSelectedPallet({});
                  setAssignments({});
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Chọn SKU" />
                </SelectTrigger>
                <SelectContent>
                  {skuOptions.map(({ sku, summary }) => {
                    return (
                      <SelectItem key={sku.id} value={sku.skuCode}>
                        <div className="flex w-full items-center justify-between gap-3">
                          <span>{sku.skuCode} - {sku.skuName}</span>
                          <Badge variant="outline" className="ml-3">
                            {summary ? `${summary.palletCount} / ${summary.totalQty}` : "No available pallet"}
                          </Badge>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              {skuCode && skuSummaryByCode.get(skuCode) && (
                <div className="mt-2 text-xs text-muted-foreground">
                  Khả dụng: {skuSummaryByCode.get(skuCode)?.palletCount} pallets, {skuSummaryByCode.get(skuCode)?.totalQty} {skuSummaryByCode.get(skuCode)?.uom}
                </div>
              )}
              {skuCode && !skuSummaryByCode.get(skuCode) && (
                <div className="mt-2 text-xs text-muted-foreground">SKU này hiện không có pallet khả dụng.</div>
              )}
            </div>

            <div>
              <Label>Batch đang có pallet khả dụng</Label>
              <div className="mt-2 flex flex-wrap gap-2 rounded-xl border p-3 min-h-12">
                {!skuCode && (
                  <span className="text-sm text-muted-foreground">Chọn SKU trước để hiện danh sách batch</span>
                )}
                {skuCode && availableBatchSummaries.length === 0 && (
                  <span className="text-sm text-muted-foreground">SKU này hiện không có pallet khả dụng để MOVE.</span>
                )}
                {availableBatchSummaries.map((b) => (
                  <button
                    key={b.batchNo}
                    type="button"
                    className={cn(
                      "text-left rounded-xl border p-3 min-w-56 transition",
                      batchNo === b.batchNo ? "border-primary bg-primary/5" : "hover:border-primary/60",
                    )}
                    onClick={() => {
                      setBatchNo(b.batchNo);
                      setSelectedPallet({});
                      setAssignments({});
                    }}
                  >
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-mono text-xs">{b.batchNo}</div>
                    <div className="flex gap-1">
                      {b.isFefoFirst && <Badge className="bg-amber-500 text-white hover:bg-amber-500">FEFO</Badge>}
                      {batchDaysToExpiry(b.nearestExpDate) != null && batchDaysToExpiry(b.nearestExpDate)! <= 60 && (
                        <Badge variant="destructive">Near Expiry</Badge>
                      )}
                    </div>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1">
                      <Badge variant="outline">{b.palletCount} pallets</Badge>
                      <Badge variant="outline">{b.totalQty} {b.uom || ""}</Badge>
                      <Badge variant="outline">EXP {b.nearestExpDate || "—"}</Badge>
                      <Badge variant="outline">{b.locationCount} locations</Badge>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {b.locations.slice(0, 2).map((code) => locationPathByCode[code] ?? code).join(", ")}
                      {b.locations.length > 2 ? ` +${b.locations.length - 2}` : ""}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      Created: {b.earliestCreatedAt ? new Date(b.earliestCreatedAt).toLocaleDateString() : "—"}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Pallet khả dụng của batch đã chọn</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              placeholder="Tìm Pallet ID / Current Bin"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-sm"
              disabled={!skuCode || !batchNo}
            />
            <Button variant="outline" disabled={!filteredPallets.length} onClick={() => selectPalletIds(filteredPallets.map((p) => p.palletId))}>
              Chọn tất cả đang hiển thị
            </Button>
            <Button variant="outline" disabled={!Object.values(selectedPallet).some(Boolean)} onClick={clearVisibleSelection}>
              Xóa chọn
            </Button>
            <div className="ml-auto flex items-center gap-2">
              <Button variant={viewMode === "table" ? "default" : "outline"} onClick={() => setViewMode("table")}>Dạng bảng</Button>
              <Button variant={viewMode === "card" ? "default" : "outline"} onClick={() => setViewMode("card")}>Dạng thẻ</Button>
              <Select value={groupMode} onValueChange={(v) => setGroupMode(v as "location" | "zone")}>
                <SelectTrigger className="w-48"><SelectValue placeholder="Nhóm theo" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="location">Nhóm theo Bin</SelectItem>
                  <SelectItem value="zone">Nhóm theo Zone</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="text-sm text-muted-foreground">
            Pallet đã chọn: {selectedIds.length}/{availablePallets.length} | Qty đã chọn: {totalSelectedQty}
          </div>

          {viewMode === "table" ? (
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
                    <TableHead>EXP Date</TableHead>
                    <TableHead>Days to Expiry</TableHead>
                    <TableHead>Current Bin</TableHead>
                    <TableHead>Bin Zone</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groupedVisiblePallets.map((group) => (
                    <Fragment key={group.key}>
                      <TableRow className="bg-muted/40">
                        <TableCell colSpan={11}>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium">{groupMode === "location" ? "Bin" : "Zone"}: {group.label}</span>
                            <Badge variant="outline">{group.pallets.length} pallets</Badge>
                            <Button size="sm" variant="outline" onClick={() => selectGroup(group.key)}>Chọn hết trong nhóm này</Button>
                            <Button size="sm" variant="outline" onClick={() => clearGroup(group.key)}>Bỏ chọn nhóm này</Button>
                          </div>
                        </TableCell>
                      </TableRow>
                      {group.pallets.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell>
                            <input
                              type="checkbox"
                              checked={!!selectedPallet[p.palletId]}
                              onChange={(e) => toggleSelection(p.palletId, e.target.checked)}
                            />
                          </TableCell>
                          <TableCell className="font-mono text-xs">{p.palletId}</TableCell>
                          <TableCell>{p.skuCode}</TableCell>
                          <TableCell className="font-mono text-xs">{p.batchNo}</TableCell>
                          <TableCell className="text-right font-mono">{p.qty}</TableCell>
                          <TableCell>{p.uom}</TableCell>
                          <TableCell className="text-xs">{p.expDate || "—"}</TableCell>
                          <TableCell className="text-xs">{daysToExpiry(p.expDate) ?? "—"}</TableCell>
                          <TableCell className="font-mono text-xs">
                            <div>{p.currentLocation ?? "—"}</div>
                            <div className="text-[11px] text-muted-foreground">
                              {locationPathByCode[p.currentLocation ?? ""] ?? "—"}
                            </div>
                          </TableCell>
                          <TableCell className="text-xs">{locationZoneByCode[p.currentLocation ?? ""] ?? "—"}</TableCell>
                          <TableCell>{p.status}</TableCell>
                        </TableRow>
                      ))}
                    </Fragment>
                  ))}
                  {filteredPallets.length === 0 && (
                    <TableRow><TableCell colSpan={11} className="py-6 text-center text-muted-foreground">Chọn SKU/Batch để xem pallet phù hợp</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="space-y-4">
              {groupedVisiblePallets.map((group) => (
                <div key={group.key} className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-muted/30 px-3 py-2">
                            <span className="font-medium">{groupMode === "location" ? "Bin" : "Zone"}: {group.label}</span>
                    <Badge variant="outline">{group.pallets.length} pallets</Badge>
                    <Button size="sm" variant="outline" onClick={() => selectGroup(group.key)}>Chọn hết trong nhóm này</Button>
                    <Button size="sm" variant="outline" onClick={() => clearGroup(group.key)}>Bỏ chọn nhóm này</Button>
                  </div>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {group.pallets.map((p) => {
                      const checked = !!selectedPallet[p.palletId];
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => toggleSelection(p.palletId, !checked)}
                          className={cn(
                            "rounded-2xl border p-4 text-left transition",
                            checked ? "border-primary bg-primary/5 shadow-sm" : "hover:border-primary/50",
                          )}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  toggleSelection(p.palletId, e.target.checked);
                                }}
                                onClick={(e) => e.stopPropagation()}
                              />
                              <div>
                                <div className="font-mono text-sm">{p.palletId}</div>
                                <div className="text-xs text-muted-foreground">{p.skuCode} / {p.batchNo}</div>
                              </div>
                            </div>
                            <Badge variant="outline">{p.status}</Badge>
                          </div>
                          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                            <div className="rounded-lg bg-muted/40 p-2">
                              <div className="text-muted-foreground">Qty/UOM</div>
                              <div className="font-medium">{p.qty} {p.uom}</div>
                            </div>
                            <div className="rounded-lg bg-muted/40 p-2">
                              <div className="text-muted-foreground">Current Bin</div>
                              <div className="font-mono">{p.currentLocation ?? "—"}</div>
                              <div className="mt-1 text-[11px] text-muted-foreground">
                                {locationPathByCode[p.currentLocation ?? ""] ?? "—"}
                              </div>
                            </div>
                            <div className="rounded-lg bg-muted/40 p-2">
                              <div className="text-muted-foreground">EXP Date</div>
                              <div className="font-medium">{p.expDate || "—"}</div>
                            </div>
                            <div className="rounded-lg bg-muted/40 p-2">
                              <div className="text-muted-foreground">Days to Expiry</div>
                              <div className={cn("font-medium", (daysToExpiry(p.expDate) ?? 9999) <= 60 ? "text-amber-600" : "")}>
                                {daysToExpiry(p.expDate) ?? "—"}
                              </div>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
              {filteredPallets.length === 0 && (
                <div className="rounded-xl border border-dashed p-6 text-center text-muted-foreground">Chọn SKU/Batch để xem pallet phù hợp</div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader className="pb-2"><CardTitle className="text-base">Phân bổ target bin</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Select value={binPicker} onValueChange={setBinPicker}>
              <SelectTrigger className="w-64"><SelectValue placeholder="Chọn target bin" /></SelectTrigger>
              <SelectContent>
                {binsForPicker.map((l) => <SelectItem key={l.id} value={l.locationCode}>{l.locationCode}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              onClick={() => {
                if (!binPicker) return;
                setTargetBins((prev) => Array.from(new Set([...prev, binPicker])));
                setBinPicker("");
              }}
              disabled={!binPicker}
            >
              Add Target Bin
            </Button>
            <Button variant="outline" onClick={doAutoAllocate} disabled={!selectedIds.length || !targetBins.length}>Auto Allocate</Button>
            <Button variant="outline" onClick={() => setAssignments({})} disabled={!Object.keys(assignments).length}>Clear Allocation</Button>
          </div>

          <div className="overflow-x-auto border rounded-xl">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Target Bin</TableHead>
                  <TableHead className="text-right">Capacity</TableHead>
                  <TableHead className="text-right">Current</TableHead>
                  <TableHead className="text-right">Open MOVE Lines</TableHead>
                  <TableHead className="text-right">Available</TableHead>
                  <TableHead className="text-right">Assigned</TableHead>
                  <TableHead className="text-right">Remaining</TableHead>
                  <TableHead className="text-right">Remove</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {binCaps.map((c) => {
                  const assigned = assignedCountByBin.get(c.locationCode) ?? 0;
                  const remaining = c.availableCapacity - assigned;
                  return (
                    <TableRow key={c.locationCode}>
                      <TableCell className="font-mono text-xs">{c.locationCode}</TableCell>
                      <TableCell className="text-right font-mono">{c.capacityPallet}</TableCell>
                      <TableCell className="text-right font-mono">{c.currentPalletCount}</TableCell>
                      <TableCell className="text-right font-mono">{c.openTaskLineCount}</TableCell>
                      <TableCell className="text-right font-mono">{c.availableCapacity}</TableCell>
                      <TableCell className="text-right font-mono">{assigned}</TableCell>
                      <TableCell className={`text-right font-mono ${remaining < 0 ? "text-destructive" : ""}`}>{remaining}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setTargetBins((prev) => prev.filter((x) => x !== c.locationCode));
                            setAssignments((prev) => {
                              const next = { ...prev };
                              for (const palletId of Object.keys(next)) {
                                if (next[palletId] === c.locationCode) delete next[palletId];
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
                  <TableRow><TableCell colSpan={8} className="py-6 text-center text-muted-foreground">Chưa chọn target bin</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="overflow-x-auto border rounded-xl">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pallet ID</TableHead>
                    <TableHead>Current Bin</TableHead>
                  <TableHead>Target Bin</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {selectedIds.map((palletId) => {
                  const pallet = availablePallets.find((x) => x.palletId === palletId);
                  if (!pallet) return null;
                  return (
                    <TableRow key={palletId}>
                      <TableCell className="font-mono text-xs">{palletId}</TableCell>
                      <TableCell className="font-mono text-xs">
                        <div>{pallet.currentLocation ?? "—"}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {locationPathByCode[pallet.currentLocation ?? ""] ?? "—"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={assignments[palletId] || ""}
                          onValueChange={(v) => setAssignments((prev) => ({ ...prev, [palletId]: v }))}
                        >
                          <SelectTrigger className="w-56"><SelectValue placeholder="Chọn target bin" /></SelectTrigger>
                          <SelectContent>
                            {targetBins.map((bin) => <SelectItem key={bin} value={bin}>{bin}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {selectedIds.length === 0 && (
                  <TableRow><TableCell colSpan={3} className="py-6 text-center text-muted-foreground">Chưa chọn pallet</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader className="pb-2"><CardTitle className="text-base">Tạo MOVE Task</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={doCreateMoveTask} disabled={!canCreateTask}>Tạo MOVE Task ({selectedIds.length})</Button>
            {allocationStatus.totalAssigned !== selectedIds.length && selectedIds.length > 0 && (
              <span className="text-sm text-destructive">Chưa allocate đủ target bin cho tất cả pallet.</span>
            )}
          </div>

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
                {openMoveTasks.map((t) => {
                  const lines = openTaskMap.get(t.id) ?? [];
                  return (
                    <TableRow key={t.id}>
                      <TableCell className="font-mono text-xs">{t.taskNo}{t.taskNo === lastTaskNo ? " (new)" : ""}</TableCell>
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
                {openMoveTasks.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="py-6 text-center text-muted-foreground">Không có MOVE task mở</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
