import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
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
import { PageHeader } from "@/components/PageHeader";
import { TaskStatusBadge } from "@/components/StatusBadges";
import { CreatedTaskBanner } from "@/components/CreatedTaskBanner";
import { SkuBatchSelectionSection } from "@/components/SkuBatchSelectionSection";
import { PalletSelectionPanel } from "@/components/PalletSelectionPanel";
import { WorkflowStepperCard } from "@/components/WorkflowStepperCard";
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
  const availablePallets = useMemo(() => {
    if (!skuCode || !batchNo) return [];
    return listAvailablePalletsBySkuBatch({ skuCode, batchNo, purpose: "MOVE" });
  }, [skuCode, batchNo, tasks, taskLines, locations]);
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

  const selectPalletIds = (palletIds: string[]) => {
    setSelectedPallet((prev) => {
      const next = { ...prev };
      for (const palletId of palletIds) next[palletId] = true;
      return next;
    });
  };

  const clearPalletIds = (palletIds: string[]) => {
    setSelectedPallet((prev) => {
      const next = { ...prev };
      for (const palletId of palletIds) {
        delete next[palletId];
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

      <WorkflowStepperCard
        steps={["Chọn SKU/Batch", "Chọn pallet", "Phân bổ target bin", "Tạo/In MOVE task"]}
        activeStepIndex={stepIndex}
      />

      {createdTask && (
        <CreatedTaskBanner
          label="MOVE task vừa tạo"
          taskNo={createdTask.taskNo}
          status={createdTask.status}
          taskType={createdTask.taskType}
          onPrint={() => window.open(`/tasks/${encodeURIComponent(createdTask.taskNo)}/print`, "_blank", "noopener,noreferrer")}
        />
      )}

      <SkuBatchSelectionSection
        title="Section 1 - Chọn SKU/Batch"
        purposeLabel="MOVE"
        skus={skus}
        availableSkuSummaries={availableSkuSummaries}
        availableBatchSummaries={availableBatchSummaries}
        selectedSkuCode={skuCode}
        selectedBatchNo={batchNo}
        onSkuSelect={(nextSkuCode) => {
          setSkuCode(nextSkuCode);
          setBatchNo("");
          setSelectedPallet({});
          setAssignments({});
        }}
        onBatchSelect={(nextBatchNo) => {
          setBatchNo(nextBatchNo);
          setSelectedPallet({});
          setAssignments({});
        }}
        formatLocationLabel={(locationCode) => locationPathByCode[locationCode] ?? locationCode}
      >
        <div className="text-sm text-muted-foreground">
          Pallet đã chọn: {selectedIds.length}/{availablePallets.length} | Qty đã chọn: {totalSelectedQty}
        </div>
      </SkuBatchSelectionSection>

      <Card className="rounded-2xl">
        <CardContent className="space-y-3 pt-6">
          <PalletSelectionPanel
            title="Pallet khả dụng của batch đã chọn"
            pallets={availablePallets}
            selectedPalletIds={selectedPallet}
            onSelectPalletIds={selectPalletIds}
            onClearPalletIds={clearPalletIds}
            locationPathByCode={locationPathByCode}
            locationZoneByCode={locationZoneByCode}
            daysToExpiry={daysToExpiry}
            searchPlaceholder="Tìm Pallet ID / Current Bin"
            emptyMessage="Chọn SKU/Batch để xem pallet phù hợp"
            locationLabel="Bin"
            zoneLabel="Zone"
          />
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
