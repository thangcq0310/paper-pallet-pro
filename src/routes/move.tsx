import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useStore } from "@/services/store";
import { cancelTask, createMoveTaskWithLines } from "@/services/taskService";
import { getAvailableBatchSummaryBySku, listAvailablePalletsBySkuBatch } from "@/services/taskQueryService";
import { autoAllocatePalletsToBins, getMultiTargetBinCapacityByTaskType } from "@/services/taskAllocationService";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/PageHeader";
import { TaskStatusBadge } from "@/components/StatusBadges";
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

  const [selectedPallet, setSelectedPallet] = useState<Record<string, boolean>>({});
  const [targetBins, setTargetBins] = useState<string[]>([]);
  const [binPicker, setBinPicker] = useState("");
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [lastTaskNo, setLastTaskNo] = useState("");

  const availableBatchSummaries = useMemo(() => {
    if (!skuCode) return [];
    return getAvailableBatchSummaryBySku({ skuCode, purpose: "MOVE" });
  }, [skuCode, tasks, taskLines, locations]);

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
      toast.success(`Đã tạo MOVE task ${created.task.taskNo} (${created.lines.length} lines)`);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Move Location" description="Chọn SKU/Batch → chọn pallet → allocate target bin → tạo 1 MOVE task nhiều lines" />

      <Card className="rounded-2xl">
        <CardHeader className="pb-2"><CardTitle className="text-base">Section 1 - Chọn SKU/Batch</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>SKU</Label>
            <Select
              value={skuCode}
              onValueChange={(v) => {
                setSkuCode(v);
                setBatchNo("");
                setSelectedPallet({});
                setAssignments({});
              }}
            >
              <SelectTrigger><SelectValue placeholder="Chọn SKU" /></SelectTrigger>
              <SelectContent>
                {skus.map((s) => <SelectItem key={s.id} value={s.skuCode}>{s.skuCode} - {s.skuName}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Available Batches for Selected SKU</Label>
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
                  className={`text-left rounded-lg border p-3 min-w-56 ${batchNo === b.batchNo ? "border-primary bg-primary/5" : ""}`}
                  onClick={() => {
                    setBatchNo(b.batchNo);
                    setSelectedPallet({});
                    setAssignments({});
                  }}
                >
                  <div className="font-mono text-xs">{b.batchNo}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {b.palletCount} pallets • {b.totalQty} {b.uom || ""}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    EXP: {b.nearestExpDate || "—"} • {b.locationCount} locations
                  </div>
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader className="pb-2"><CardTitle className="text-base">Section 2 - Available Pallets for Selected Batch</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              placeholder="Search Pallet ID / Location"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-sm"
              disabled={!skuCode || !batchNo}
            />
            <Button
              variant="outline"
              disabled={!filteredPallets.length}
              onClick={() => {
                setSelectedPallet(Object.fromEntries(filteredPallets.map((p) => [p.palletId, true])));
              }}
            >
              Select All Visible
            </Button>
            <Button variant="outline" disabled={!Object.values(selectedPallet).some(Boolean)} onClick={() => setSelectedPallet({})}>Clear Selection</Button>
            <div className="text-sm text-muted-foreground">
              Total pallet: {selectedIds.length}/{availablePallets.length} | Selected qty: {totalSelectedQty}
            </div>
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
                  <TableHead>EXP Date</TableHead>
                  <TableHead>Days to Expiry</TableHead>
                  <TableHead>Current Location</TableHead>
                  <TableHead>Location Zone</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPallets.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={!!selectedPallet[p.palletId]}
                        onChange={(e) => {
                          setSelectedPallet((prev) => ({ ...prev, [p.palletId]: e.target.checked }));
                        }}
                      />
                    </TableCell>
                    <TableCell className="font-mono text-xs">{p.palletId}</TableCell>
                    <TableCell>{p.skuCode}</TableCell>
                    <TableCell className="font-mono text-xs">{p.batchNo}</TableCell>
                    <TableCell className="text-right font-mono">{p.qty}</TableCell>
                    <TableCell>{p.uom}</TableCell>
                    <TableCell className="text-xs">{p.expDate || "—"}</TableCell>
                    <TableCell className="text-xs">{daysToExpiry(p.expDate) ?? "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{p.currentLocation}</TableCell>
                    <TableCell className="text-xs">{locationZoneByCode[p.currentLocation ?? ""] ?? "—"}</TableCell>
                    <TableCell>{p.status}</TableCell>
                  </TableRow>
                ))}
                {filteredPallets.length === 0 && (
                  <TableRow><TableCell colSpan={11} className="py-6 text-center text-muted-foreground">Chọn SKU/Batch để xem pallet phù hợp</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader className="pb-2"><CardTitle className="text-base">Section 3 - Target Bin Allocation</CardTitle></CardHeader>
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
                  <TableHead>Current Location</TableHead>
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
                      <TableCell className="font-mono text-xs">{pallet.currentLocation}</TableCell>
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
        <CardHeader className="pb-2"><CardTitle className="text-base">Section 4 - Create MOVE Task</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={doCreateMoveTask} disabled={!canCreateTask}>Create MOVE Task ({selectedIds.length})</Button>
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
