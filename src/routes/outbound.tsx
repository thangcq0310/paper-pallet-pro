import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
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
import { PageHeader } from "@/components/PageHeader";
import { CreatedTaskBanner } from "@/components/CreatedTaskBanner";
import { SkuBatchSelectionSection } from "@/components/SkuBatchSelectionSection";
import { PalletSelectionPanel } from "@/components/PalletSelectionPanel";
import { TaskListCard } from "@/components/TaskListCard";
import { WorkflowStepperCard } from "@/components/WorkflowStepperCard";
import { formatLocationPath } from "@/utils/location";
import { toast } from "sonner";

export const Route = createFileRoute("/outbound")({ component: OutboundPage });

function OutboundPage() {
  const router = useRouter();
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
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [lastOutboundNo, setLastOutboundNo] = useState("");
  const [lastTaskNo, setLastTaskNo] = useState("");
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

      <WorkflowStepperCard
        steps={["Nhập outbound info", "Chọn SKU/Batch", "Chọn/Auto select pallet", "Tạo/In PICK task"]}
        activeStepIndex={stepIndex}
      />

      {createdTask && (
          <CreatedTaskBanner
            label="PICK task vừa tạo"
            taskNo={createdTask.taskNo}
            status={createdTask.status}
            taskType={createdTask.taskType}
          onPrint={() => router.navigate({ to: "/tasks/$taskNo/print", params: { taskNo: createdTask.taskNo } })}
          />
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
          <SkuBatchSelectionSection
            title="Chọn SKU/Batch"
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
          >
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
              <div className="text-sm text-muted-foreground">
                Pallet đã chọn: {selectedPallets.length}/{availablePallets.length}
              </div>
            </div>
            <div className="space-y-3 rounded-xl border bg-muted/20 p-4 text-sm">
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
                <div className="rounded-xl border bg-background p-3 text-sm">
                  Auto select summary: SelectedQty <span className="font-mono">{autoSelectResult.selectedQty}</span> | OverQty <span className="font-mono">{autoSelectResult.overQty}</span> | UnderQty <span className="font-mono">{autoSelectResult.underQty}</span>
                </div>
              )}
            </div>
          </SkuBatchSelectionSection>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <Button onClick={doCreatePickTask} disabled={!canCreate}>Tạo PICK Task ({selectedPallets.length})</Button>
        <TaskListCard
          title="Tạo PICK Task"
          tasks={pickTasks}
          lineMap={lineMap}
          currentTaskNo={lastTaskNo}
          emptyMessage="Chưa có PICK task theo outbound hiện tại"
          onPrintTask={(taskNo) => router.navigate({ to: "/tasks/$taskNo/print", params: { taskNo } })}
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
