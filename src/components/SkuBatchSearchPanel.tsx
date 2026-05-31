import { useMemo, useState } from "react";
import type { SKU } from "@/types";
import type { AvailableBatchSummary, AvailableSkuSummary } from "@/services/taskQueryService";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

export function SkuBatchSearchPanel(props: {
  purposeLabel: "MOVE" | "PICK";
  skus: SKU[];
  availableSkuSummaries: AvailableSkuSummary[];
  availableBatchSummaries: AvailableBatchSummary[];
  selectedSkuCode: string;
  selectedBatchNo: string;
  onSkuSelect: (skuCode: string) => void;
  onBatchSelect: (batchNo: string) => void;
  formatLocationLabel?: (locationCode: string) => string;
}) {
  const {
    purposeLabel,
    skus,
    availableSkuSummaries,
    availableBatchSummaries,
    selectedSkuCode,
    selectedBatchNo,
    onSkuSelect,
    onBatchSelect,
    formatLocationLabel,
  } = props;

  const [skuQuery, setSkuQuery] = useState("");
  const [batchQuery, setBatchQuery] = useState("");
  const [showOnlyAvailableSku, setShowOnlyAvailableSku] = useState(true);

  const skuSummaryByCode = useMemo(
    () => new Map(availableSkuSummaries.map((s) => [s.skuCode, s])),
    [availableSkuSummaries],
  );
  const availableOrder = useMemo(
    () => new Map(availableSkuSummaries.map((s, idx) => [s.skuCode, idx])),
    [availableSkuSummaries],
  );

  const skuOptions = useMemo(() => {
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
  }, [availableOrder, showOnlyAvailableSku, skuSummaryByCode, skus]);

  const filteredSkuOptions = useMemo(() => {
    const q = skuQuery.trim().toLowerCase();
    const base = skuOptions.filter(({ sku }) => {
      if (!q) return true;
      return sku.skuCode.toLowerCase().includes(q) || sku.skuName.toLowerCase().includes(q);
    });
    return q ? base : base.slice(0, 12);
  }, [skuOptions, skuQuery]);

  const filteredBatchSummaries = useMemo(() => {
    const q = batchQuery.trim().toLowerCase();
    const base = availableBatchSummaries.filter((b) => {
      if (!q) return true;
      return b.batchNo.toLowerCase().includes(q);
    });
    return q ? base : base.slice(0, 12);
  }, [availableBatchSummaries, batchQuery]);

  const selectedSku = skus.find((s) => s.skuCode === selectedSkuCode) ?? null;
  const selectedSkuSummary = skuSummaryByCode.get(selectedSkuCode) ?? null;
  const selectedBatchSummary = availableBatchSummaries.find((b) => b.batchNo === selectedBatchNo) ?? null;

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <div>
        <div className="flex items-center justify-between gap-3">
          <Label>Tìm SKU</Label>
          <div className="flex items-center gap-2">
            <Switch checked={showOnlyAvailableSku} onCheckedChange={setShowOnlyAvailableSku} />
            <span className="text-sm text-muted-foreground">Chỉ hiện SKU có pallet khả dụng</span>
          </div>
        </div>
        <Input
          placeholder="Nhập SKU code hoặc tên để tìm"
          value={skuQuery}
          onChange={(e) => setSkuQuery(e.target.value)}
        />
        <div className="rounded-xl border p-3">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-sm font-medium">Kết quả SKU</div>
            <div className="text-xs text-muted-foreground">{filteredSkuOptions.length} kết quả</div>
          </div>
          <div className="max-h-72 space-y-2 overflow-auto pr-1">
            {filteredSkuOptions.length === 0 && (
              <div className="py-6 text-center text-sm text-muted-foreground">
                {showOnlyAvailableSku ? "Không có SKU khả dụng khớp từ khóa." : "Không có SKU nào khớp từ khóa."}
              </div>
            )}
            {filteredSkuOptions.map(({ sku, summary }) => (
              <button
                key={sku.skuCode}
                type="button"
                onClick={() => {
                  setSkuQuery(sku.skuCode);
                  setBatchQuery("");
                  onSkuSelect(sku.skuCode);
                }}
                className={cn(
                  "flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left transition",
                  selectedSkuCode === sku.skuCode ? "border-primary bg-primary/5" : "hover:border-primary/60",
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
        {selectedSku && (
          <div className="mt-2 text-xs text-muted-foreground">
            Đang chọn: <span className="font-mono">{selectedSku.skuCode}</span> - {selectedSku.skuName}
            {selectedSkuSummary ? (
              <> | Khả dụng: {selectedSkuSummary.palletCount} pallets, {selectedSkuSummary.totalQty} {selectedSkuSummary.uom}</>
            ) : (
              <> | SKU này hiện không có pallet khả dụng để {purposeLabel}.</>
            )}
          </div>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between gap-3">
          <Label>Search Batch theo SKU đã chọn</Label>
          {selectedBatchSummary && (
            <Badge variant="outline">Selected: {selectedBatchSummary.batchNo}</Badge>
          )}
        </div>
        <Input
          placeholder={selectedSkuCode ? "Nhập batchNo để tìm" : "Chọn SKU trước"}
          value={batchQuery}
          onChange={(e) => setBatchQuery(e.target.value)}
          disabled={!selectedSkuCode}
        />
        <div className="rounded-xl border p-3">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-sm font-medium">Batch khả dụng của SKU đã chọn</div>
            <div className="text-xs text-muted-foreground">{filteredBatchSummaries.length} kết quả</div>
          </div>
          <div className="max-h-72 space-y-2 overflow-auto pr-1">
            {!selectedSkuCode && (
              <div className="py-6 text-center text-sm text-muted-foreground">Chọn SKU trước để tìm batch</div>
            )}
            {selectedSkuCode && availableBatchSummaries.length === 0 && (
              <div className="py-6 text-center text-sm text-muted-foreground">
                SKU này hiện không có pallet khả dụng để {purposeLabel}.
              </div>
            )}
            {selectedSkuCode && filteredBatchSummaries.length === 0 && availableBatchSummaries.length > 0 && (
              <div className="py-6 text-center text-sm text-muted-foreground">Không có batch nào khớp từ khóa.</div>
            )}
            {filteredBatchSummaries.map((b) => {
              const dte = b.nearestExpDate ? Math.ceil((new Date(b.nearestExpDate).getTime() - Date.now()) / (24 * 60 * 60 * 1000)) : null;
              return (
                <button
                  key={b.batchNo}
                  type="button"
                  className={cn(
                    "w-full rounded-xl border p-3 text-left transition",
                    selectedBatchNo === b.batchNo ? "border-primary bg-primary/5" : "hover:border-primary/60",
                    b.isFefoFirst ? "ring-2 ring-amber-400" : "",
                  )}
                  onClick={() => {
                    setBatchQuery(b.batchNo);
                    onBatchSelect(b.batchNo);
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-mono text-xs">{b.batchNo}</div>
                    <div className="flex gap-1">
                      {b.isFefoFirst && <Badge className="bg-amber-500 text-white hover:bg-amber-500">FEFO</Badge>}
                      {dte != null && dte <= 60 && <Badge variant="destructive">Near Expiry</Badge>}
                    </div>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    <Badge variant="outline">{b.palletCount} pallets</Badge>
                    <Badge variant="outline">{b.totalQty} {b.uom || ""}</Badge>
                    <Badge variant="outline">EXP {b.nearestExpDate || "—"}</Badge>
                    <Badge variant="outline">{b.locationCount} locations</Badge>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {b.locations.slice(0, 2).map((code) => formatLocationLabel ? formatLocationLabel(code) : code).join(", ")}
                    {b.locations.length > 2 ? ` +${b.locations.length - 2}` : ""}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Days to expiry: {dte ?? "—"}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
