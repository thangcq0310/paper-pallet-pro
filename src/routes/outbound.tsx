import { createFileRoute } from "@tanstack/react-router";
import { Fragment, useMemo, useRef, useState } from "react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/PageHeader";
import { TaskStatusBadge } from "@/components/StatusBadges";
import { SkuBatchSearchPanel } from "@/components/SkuBatchSearchPanel";
import { cn } from "@/lib/utils";
import { formatLocationPath } from "@/utils/location";
import { toast } from "sonner";

export const Route = createFileRoute("/outbound")({ component: OutboundPage });

function OutboundPage() {
  const skus = useStore((s) => s.skus);
  const tasks = useStore((s) => s.tasks);
  const taskLines = useStore((s) => s.taskLines);
  const locations = useStore((s) => s.locations);
  const palletListRef = useRef<HTMLDivElement | null>(null);

  const [outboundNo, setOutboundNo] = useState("");
  const [destination, setDestination] = useState("");
  const [skuCode, setSkuCode] = useState("");
  const [batchNo, setBatchNo] = useState("");
  const [requiredQty, setRequiredQty] = useState(0);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [lastOutboundNo, setLastOutboundNo] = useState("");
  const [lastTaskNo, setLastTaskNo] = useState("");
  const [viewMode, setViewMode] = useState<"table" | "card">("table");
  const [groupMode, setGroupMode] = useState<"location" | "zone">("location");
  const [autoSelectResult, setAutoSelectResult] = useState<{
    selectedQty: number;
    overQty: number;
    underQty: number;
  } | null>(null);

  const availableSkuSummaries = useMemo(() => getAvailableSkuSummary({ purpose: "PICK" }), [tasks, taskLines, locations]);
  const availableBatchSummaries = useMemo(() => {
    if (!skuCode) return [];
    return getAvailableBatchSummaryBySku({ skuCode, purpose: "PICK" });
  }, [skuCode, tasks, taskLines, locations]);

  const availablePallets = useMemo(() => {
    if (!skuCode || !batchNo) return [];
    return listAvailablePalletsBySkuBatch({ skuCode, batchNo, purpose: "PICK" });
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

  const selectedPallets = useMemo(
    () => availablePallets.filter((p) => selected[p.palletId]),
    [availablePallets, selected],
  );

  const availableQty = useMemo(
    () => availablePallets.reduce((sum, p) => sum + p.qty, 0),
    [availablePallets],
  );

  const selectedQty = useMemo(
    () => selectedPallets.reduce((sum, p) => sum + p.qty, 0),
    [selectedPallets],
  );
  const remainingQty = Math.max(0, requiredQty - selectedQty);
  const isUnder = requiredQty > 0 && selectedQty < requiredQty;
  const isOver = requiredQty > 0 && selectedQty > requiredQty;
  const recommendedSelection = useMemo(() => {
    if (!skuCode || !batchNo || requiredQty <= 0) return null;
    try {
      return autoSelectPalletsByQty({ skuCode, batchNo, requiredQty, purpose: "PICK" });
    } catch {
      return null;
    }
  }, [skuCode, batchNo, requiredQty, tasks, taskLines, locations]);
  const selectedBatchSummary = useMemo(
    () => availableBatchSummaries.find((b) => b.batchNo === batchNo) ?? null,
    [availableBatchSummaries, batchNo],
  );

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
  const createdTask = useMemo(
    () => (lastTaskNo ? tasks.find((t) => t.taskNo === lastTaskNo) ?? null : null),
    [lastTaskNo, tasks],
  );
  const stepIndex = !outboundNo.trim() || !destination.trim()
    ? 0
    : !skuCode
      ? 1
      : !batchNo
        ? 2
        : selectedPallets.length === 0
          ? 3
          : 4;

  const toggleSelection = (palletId: string, checked: boolean) => {
    setSelected((prev) => ({ ...prev, [palletId]: checked }));
  };

  const selectVisible = () => {
    setSelected((prev) => {
      const next = { ...prev };
      for (const pallet of filteredPallets) next[pallet.palletId] = true;
      return next;
    });
  };

  const clearVisibleSelection = () => {
    setSelected((prev) => {
      const next = { ...prev };
      for (const pallet of filteredPallets) delete next[pallet.palletId];
      return next;
    });
  };

  const selectGroup = (groupKey: string) => {
    const ids = filteredPallets
      .filter((p) => (groupMode === "location" ? (p.currentLocation ?? "Chưa có bin") === groupKey : (locationZoneByCode[p.currentLocation ?? ""] ?? "Chưa có zone") === groupKey))
      .map((p) => p.palletId);
    setSelected((prev) => {
      const next = { ...prev };
      for (const id of ids) next[id] = true;
      return next;
    });
  };

  const clearGroup = (groupKey: string) => {
    setSelected((prev) => {
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

  const doAutoSelect = () => {
    try {
      if (!skuCode || !batchNo || requiredQty <= 0) throw new Error("Thiếu thông tin để auto select");
      const result = autoSelectPalletsByQty({ skuCode, batchNo, requiredQty, purpose: "PICK" });
      setSelected(Object.fromEntries(result.palletIds.map((id) => [id, true])));
      setAutoSelectResult({ selectedQty: result.selectedQty, overQty: result.overQty, underQty: result.underQty });
      window.setTimeout(() => {
        palletListRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 80);
      toast.success("Đã auto select pallet theo FEFO");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const fefoRankByPalletId = useMemo(
    () => Object.fromEntries(availablePallets.map((p, idx) => [p.palletId, idx + 1])),
    [availablePallets],
  );
  const groupedVisiblePallets = useMemo(() => {
    const map = new Map<string, { key: string; label: string; pallets: typeof filteredPallets }>();
    for (const pallet of filteredPallets) {
      const currentLocation = pallet.currentLocation ?? "";
      const key = groupMode === "location"
        ? (currentLocation || "Chưa có bin")
        : (locationZoneByCode[currentLocation] ?? "Chưa có zone");
      const row = map.get(key);
      if (row) row.pallets.push(pallet);
      else map.set(key, {
        key,
        label: groupMode === "location" ? (locationPathByCode[currentLocation] ?? key) : key,
        pallets: [pallet],
      });
    }
    return Array.from(map.values()).sort((a, b) => a.key.localeCompare(b.key));
  }, [filteredPallets, groupMode, locationPathByCode, locationZoneByCode]);

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
      setLastTaskNo(created.task.taskNo);
      setLastOutboundNo(doc.outboundNo);
      setOutboundNo(doc.outboundNo);
      setSelected({});
      setAutoSelectResult(null);
      toast.success(`Đã tạo PICK task ${created.task.taskNo} (${created.lines.length} lines)`);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Outbound / PICK" description="Tìm SKU/Batch → chọn pallet → tạo 1 PICK task nhiều lines" />

      <Card className="rounded-2xl">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
            {[
              "Nhập outbound info",
              "Chọn SKU/Batch",
              "Chọn/Auto select pallet",
              "Tạo/In PICK task",
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
              <div className="text-xs uppercase text-muted-foreground">PICK task vừa tạo</div>
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
        <CardHeader className="pb-2"><CardTitle className="text-base">Thông tin outbound</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Outbound No</Label>
            <Input value={outboundNo} onChange={(e) => setOutboundNo(e.target.value)} placeholder="Để trống để auto" />
          </div>
          <div>
            <Label>Destination</Label>
            <Input value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="External / Truck / Container" />
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <Label>Qty yêu cầu</Label>
              <div className="mt-2 flex flex-col gap-2">
                <Input
                  type="number"
                  value={requiredQty}
                  onChange={(e) => {
                    setRequiredQty(+e.target.value);
                    setAutoSelectResult(null);
                  }}
                />
                <Button variant="outline" onClick={doAutoSelect} disabled={!skuCode || !batchNo || requiredQty <= 0}>
                  Tự chọn theo FEFO / Qty yêu cầu
                </Button>
              </div>
            </div>
          </div>
          <SkuBatchSearchPanel
            purposeLabel="PICK"
            skus={skus}
            availableSkuSummaries={availableSkuSummaries}
            availableBatchSummaries={availableBatchSummaries}
            selectedSkuCode={skuCode}
            selectedBatchNo={batchNo}
            onSkuSelect={(nextSkuCode) => {
              setSkuCode(nextSkuCode);
              setBatchNo("");
              setSelected({});
              setAutoSelectResult(null);
            }}
            onBatchSelect={(nextBatchNo) => {
              setBatchNo(nextBatchNo);
              setSelected({});
              setAutoSelectResult(null);
            }}
            formatLocationLabel={(locationCode) => locationPathByCode[locationCode] ?? locationCode}
          />
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader className="pb-2"><CardTitle className="text-base">Pallet khả dụng của batch đã chọn</CardTitle></CardHeader>
        <CardContent className="space-y-3" ref={palletListRef}>
          <div className="flex flex-wrap gap-2 items-center">
            <Input
              placeholder="Tìm Pallet ID / Current Bin"
              className="max-w-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              disabled={!skuCode || !batchNo}
            />
            <Button
              variant="outline"
              disabled={!filteredPallets.length}
              onClick={selectVisible}
            >
              Chọn tất cả đang hiển thị
            </Button>
            <Button variant="outline" disabled={!Object.values(selected).some(Boolean)} onClick={clearVisibleSelection}>Xóa chọn</Button>
            <div className="text-sm text-muted-foreground">Pallet đã chọn: {selectedPallets.length}/{availablePallets.length}</div>
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
                    <TableHead>FEFO Rank</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groupedVisiblePallets.map((group) => (
                    <Fragment key={group.key}>
                      <TableRow className="bg-muted/40">
                        <TableCell colSpan={12}>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium">{groupMode === "location" ? "Bin" : "Zone"}: {group.label}</span>
                            <Badge variant="outline">{group.pallets.length} pallets</Badge>
                            <Button size="sm" variant="outline" onClick={() => selectGroup(group.key)}>
                              Chọn tất cả trong {groupMode === "location" ? "location" : "zone"} này
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => clearGroup(group.key)}>
                              Bỏ chọn {groupMode === "location" ? "location" : "zone"} này
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                      {group.pallets.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell>
                            <input
                              type="checkbox"
                              checked={!!selected[p.palletId]}
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
                          <TableCell className="text-xs">
                            <div className="font-mono">{p.currentLocation ?? "—"}</div>
                            <div className="text-[11px] text-muted-foreground">
                              {locationPathByCode[p.currentLocation ?? ""] ?? "—"}
                            </div>
                          </TableCell>
                          <TableCell className="text-xs">{locationZoneByCode[p.currentLocation ?? ""] ?? "—"}</TableCell>
                          <TableCell className="text-xs font-mono">{fefoRankByPalletId[p.palletId] ?? "-"}</TableCell>
                          <TableCell>{p.status}</TableCell>
                        </TableRow>
                      ))}
                    </Fragment>
                  ))}
                  {filteredPallets.length === 0 && (
                    <TableRow><TableCell colSpan={12} className="py-6 text-center text-muted-foreground">Chọn SKU/Batch để hiển thị pallet phù hợp</TableCell></TableRow>
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
                    <Button size="sm" variant="outline" onClick={() => selectGroup(group.key)}>
                      Chọn tất cả trong {groupMode === "location" ? "bin" : "zone"} này
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => clearGroup(group.key)}>
                      Bỏ chọn {groupMode === "location" ? "bin" : "zone"} này
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {group.pallets.map((p) => {
                      const checked = !!selected[p.palletId];
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
                            <div className="flex flex-col items-end gap-1">
                              <Badge variant="outline">{p.status}</Badge>
                              <Badge variant="outline">{fefoRankByPalletId[p.palletId] ?? "-"}</Badge>
                            </div>
                          </div>
                          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                            <div className="rounded-lg bg-muted/40 p-2">
                              <div className="text-muted-foreground">Qty/UOM</div>
                              <div className="font-medium">{p.qty} {p.uom}</div>
                            </div>
                            <div className="rounded-lg bg-muted/40 p-2">
                              <div className="text-muted-foreground">Current Bin</div>
                              <div className="font-mono">{p.currentLocation ?? "—"}</div>
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
                <div className="rounded-xl border border-dashed p-6 text-center text-muted-foreground">Chọn SKU/Batch để hiển thị pallet phù hợp</div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader className="pb-2"><CardTitle className="text-base">Tóm tắt chọn hàng</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <div>
              <div className="text-xs uppercase text-muted-foreground">Available Qty của batch</div>
              <div className="font-mono text-lg">{selectedBatchSummary?.totalQty ?? 0}</div>
            </div>
            <div>
              <div className="text-xs uppercase text-muted-foreground">Qty yêu cầu</div>
              <div className="font-mono text-lg">{requiredQty || "—"}</div>
            </div>
            <div>
              <div className="text-xs uppercase text-muted-foreground">Recommended Pallet Count</div>
              <div className="font-mono text-lg">{recommendedSelection?.palletIds.length ?? 0}</div>
            </div>
            <div>
              <div className="text-xs uppercase text-muted-foreground">Expected Over / Under</div>
              <div className="font-mono text-lg">
                +{recommendedSelection?.overQty ?? 0} / -{recommendedSelection?.underQty ?? 0}
              </div>
            </div>
          </div>
          <div>Qty đã chọn: <span className="font-mono">{selectedQty}</span></div>
          <div>Qty còn thiếu: <span className="font-mono">{remainingQty}</span></div>
          {isUnder && <div className="text-warning">Cảnh báo: Chọn thiếu so với Qty yêu cầu.</div>}
          {isOver && <div className="text-destructive">Cảnh báo: Chọn vượt Qty yêu cầu (được phép nếu xuất nguyên pallet).</div>}
          {autoSelectResult && (
            <div className="rounded-xl border bg-muted/30 p-3 text-sm">
              Auto select summary: SelectedQty <span className="font-mono">{autoSelectResult.selectedQty}</span> | OverQty <span className="font-mono">{autoSelectResult.overQty}</span> | UnderQty <span className="font-mono">{autoSelectResult.underQty}</span>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader className="pb-2"><CardTitle className="text-base">Tạo PICK Task</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Button onClick={doCreatePickTask} disabled={!canCreate}>Tạo PICK Task ({selectedPallets.length})</Button>

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
