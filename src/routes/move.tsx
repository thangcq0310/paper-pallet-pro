import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useStore } from "@/services/store";
import { cancelTask, createMoveTaskWithLines } from "@/services/taskService";
import { getAvailableBatchSummaryBySku, getAvailableSkuSummary, listAvailablePalletsBySkuBatch } from "@/services/taskQueryService";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/PageHeader";
import { CreatedTaskBanner } from "@/components/CreatedTaskBanner";
import { SkuBatchSelectionSection } from "@/components/SkuBatchSelectionSection";
import { TaskListCard } from "@/components/TaskListCard";
import { formatLocationPath } from "@/utils/location";
import { toast } from "sonner";

export const Route = createFileRoute("/move")({ component: MovePage });

function MovePage() {
  const router = useRouter();
  const skus = useStore((s) => s.skus);
  const slocs = useStore((s) => s.slocs);
  const pallets = useStore((s) => s.pallets);
  const tasks = useStore((s) => s.tasks);
  const taskLines = useStore((s) => s.taskLines);
  const locations = useStore((s) => s.locations);

  const [skuCode, setSkuCode] = useState("");
  const [batchNo, setBatchNo] = useState("");
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [lastTaskNo, setLastTaskNo] = useState("");
  const [slocFilter, setSlocFilter] = useState("");
  const [zoneFilter, setZoneFilter] = useState("");
  const [binSearch, setBinSearch] = useState("");

  const availableBatchSummaries = useMemo(() => {
    if (!skuCode) return [];
    return getAvailableBatchSummaryBySku({ skuCode, purpose: "MOVE" });
  }, [skuCode, tasks, taskLines, locations]);

  const availableSkuSummaries = useMemo(() => getAvailableSkuSummary({ purpose: "MOVE" }), [tasks, taskLines, locations]);

  const availablePallets = useMemo(() => {
    if (!skuCode || !batchNo) return [];
    return listAvailablePalletsBySkuBatch({ skuCode, batchNo, purpose: "MOVE" });
  }, [skuCode, batchNo, tasks, taskLines, locations]);

  const storageBins = useMemo(
    () => locations.filter((l) => l.locationType === "STORAGE" && l.status === "Active"),
    [locations],
  );

  const slocOptions = useMemo(
    () => {
      if (!Array.isArray(slocs)) return [];
      const used = new Set(storageBins.map((l) => l.slocCode));
      return slocs.filter((s) => used.has(s.slocCode));
    },
    [storageBins, slocs],
  );

  const zoneOptions = useMemo(() => {
    if (!slocFilter) return [];
    return Array.from(new Set(storageBins.filter((l) => l.slocCode === slocFilter).map((l) => l.zone))).sort();
  }, [storageBins, slocFilter]);

  const filteredBins = useMemo(() => {
    let result = storageBins;
    if (slocFilter) result = result.filter((l) => l.slocCode === slocFilter);
    if (zoneFilter) result = result.filter((l) => l.zone === zoneFilter);
    if (binSearch.trim()) {
      const q = binSearch.toLowerCase();
      result = result.filter((l) => l.locationCode.toLowerCase().includes(q));
    }
    return result;
  }, [storageBins, slocFilter, zoneFilter, binSearch]);

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

  const selectedPalletIds = useMemo(
    () => availablePallets.filter((p) => assignments[p.palletId]).map((p) => p.palletId),
    [availablePallets, assignments],
  );

  const totalSelectedQty = useMemo(
    () => availablePallets.filter((p) => assignments[p.palletId]).reduce((sum, p) => sum + p.qty, 0),
    [availablePallets, assignments],
  );

  const canCreateTask =
    !!skuCode &&
    !!batchNo &&
    selectedPalletIds.length > 0 &&
    selectedPalletIds.every((pid) => assignments[pid]);

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

  const doCreateMoveTask = () => {
    try {
      const created = createMoveTaskWithLines({
        assignments: selectedPalletIds.map((palletId) => ({ palletId, targetLocation: assignments[palletId] })),
        note: `MOVE ${skuCode}/${batchNo}`,
      });
      setLastTaskNo(created.task.taskNo);
      setAssignments({});
      toast.success(`Đã tạo MOVE task ${created.task.taskNo} (${created.lines.length} lines)`);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Move Bin" description="Chọn SKU/Batch, chọn pallet và target bin inline trong 1 bảng" />

      {createdTask && (
        <CreatedTaskBanner
          label="MOVE task vừa tạo"
          taskNo={createdTask.taskNo}
          status={createdTask.status}
          taskType={createdTask.taskType}
          onPrint={() => router.navigate({ to: "/tasks/$taskNo/print", params: { taskNo: createdTask.taskNo }, search: { autoexport: true } })}
        />
      )}

      <SkuBatchSelectionSection
        title="Chọn SKU/Batch"
        purposeLabel="MOVE"
        skus={skus}
        availableSkuSummaries={availableSkuSummaries}
        availableBatchSummaries={availableBatchSummaries}
        selectedSkuCode={skuCode}
        selectedBatchNo={batchNo}
        onSkuSelect={(nextSkuCode) => {
          setSkuCode(nextSkuCode);
          setBatchNo("");
          setAssignments({});
          setSlocFilter("");
          setZoneFilter("");
          setBinSearch("");
        }}
        onBatchSelect={(nextBatchNo) => {
          setBatchNo(nextBatchNo);
          setAssignments({});
          setSlocFilter("");
          setZoneFilter("");
          setBinSearch("");
        }}
        formatLocationLabel={(locationCode) => locationPathByCode[locationCode] ?? locationCode}
      >
        <div className="text-sm text-muted-foreground">
          Đã chọn: {selectedPalletIds.length} pallet | Qty: {totalSelectedQty}
        </div>
      </SkuBatchSelectionSection>

      <Card className="rounded-2xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Chọn pallet và target bin</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          <div className="flex flex-wrap items-center gap-2">
            <Select value={slocFilter} onValueChange={(v) => { setSlocFilter(v); setZoneFilter(""); setBinSearch(""); }}>
              <SelectTrigger className="w-40"><SelectValue placeholder="Chọn Sloc" /></SelectTrigger>
              <SelectContent>
                {slocOptions.map((s) => <SelectItem key={s.id} value={s.slocCode}>{s.slocCode} — {s.slocName}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={zoneFilter} onValueChange={(v) => { setZoneFilter(v); setBinSearch(""); }} disabled={!slocFilter}>
              <SelectTrigger className="w-40"><SelectValue placeholder="Chọn Zone" /></SelectTrigger>
              <SelectContent>
                {zoneOptions.map((z) => <SelectItem key={z} value={z}>{z}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input
              placeholder="Tìm bin..."
              value={binSearch}
              onChange={(e) => setBinSearch(e.target.value)}
              className="w-48"
            />
            {filteredBins.length > 0 && (
              <span className="text-xs text-muted-foreground ml-2">{filteredBins.length} bin</span>
            )}
          </div>

          {(!skuCode || !batchNo) ? (
            <div className="text-center py-10 text-muted-foreground border-2 border-dashed rounded-xl">
              Chọn SKU/Batch để xem pallet khả dụng
            </div>
          ) : availablePallets.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground border-2 border-dashed rounded-xl">
              Không có pallet khả dụng cho batch này
            </div>
          ) : (
            <div className="overflow-x-auto border rounded-xl">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <input
                        type="checkbox"
                        checked={selectedPalletIds.length === availablePallets.length && availablePallets.length > 0}
                        ref={(el) => {
                          if (el) el.indeterminate = selectedPalletIds.length > 0 && selectedPalletIds.length < availablePallets.length;
                        }}
                        onChange={(e) => {
                          if (e.target.checked) {
                            const all: Record<string, string> = {};
                            for (const p of availablePallets) {
                              all[p.palletId] = assignments[p.palletId] ?? "";
                            }
                            setAssignments(all);
                          } else {
                            setAssignments({});
                          }
                        }}
                      />
                    </TableHead>
                    <TableHead>Pallet ID</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Weight</TableHead>
                    <TableHead>Current Bin</TableHead>
                    <TableHead>EXP</TableHead>
                    <TableHead>Target Bin</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {availablePallets.map((p) => {
                    const days = p.expDate ? daysToExpiry(p.expDate) : null;
                    return (
                      <TableRow key={p.palletId} className={!assignments[p.palletId] ? "opacity-60" : ""}>
                        <TableCell>
                          <input
                            type="checkbox"
                            checked={!!assignments[p.palletId]}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setAssignments((prev) => ({ ...prev, [p.palletId]: "" }));
                              } else {
                                setAssignments((prev) => {
                                  const next = { ...prev };
                                  delete next[p.palletId];
                                  return next;
                                });
                              }
                            }}
                          />
                        </TableCell>
                        <TableCell className="font-mono text-xs">{p.palletId}</TableCell>
                        <TableCell className="text-right font-mono">{p.qty}</TableCell>
                        <TableCell className="text-right font-mono">{p.weight}</TableCell>
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
                        <TableCell className="min-w-[220px]">
                          <Select
                            value={assignments[p.palletId] || ""}
                            onValueChange={(v) => setAssignments((prev) => ({ ...prev, [p.palletId]: v }))}
                          >
                            <SelectTrigger className="w-48"><SelectValue placeholder="Chọn target bin" /></SelectTrigger>
                            <SelectContent>
                              {filteredBins.map((l) => <SelectItem key={l.id} value={l.locationCode}>{l.locationCode}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={doCreateMoveTask} disabled={!canCreateTask}>
              Tạo MOVE Task ({selectedPalletIds.length})
            </Button>
            {selectedPalletIds.length > 0 && selectedPalletIds.some((pid) => !assignments[pid]) && (
              <span className="text-sm text-destructive">Mỗi pallet phải chọn target bin.</span>
            )}
          </div>
        </CardContent>
      </Card>

      <TaskListCard
        title="MOVE task mở"
        tasks={openMoveTasks}
        lineMap={openTaskMap}
        currentTaskNo={lastTaskNo}
        emptyMessage="Không có MOVE task mở"
        onPrintTask={(taskNo) => router.navigate({ to: "/tasks/$taskNo/print", params: { taskNo }, search: { autoexport: true } })}
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
  );
}
