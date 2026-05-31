import { Fragment, useMemo, useState } from "react";
import type { Pallet } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export function PalletSelectionPanel(props: {
  title: string;
  pallets: Pallet[];
  selectedPalletIds: Record<string, boolean>;
  onSelectPalletIds: (palletIds: string[]) => void;
  onClearPalletIds: (palletIds: string[]) => void;
  locationPathByCode: Record<string, string>;
  locationZoneByCode: Record<string, string>;
  daysToExpiry: (expDate?: string) => number | null;
  fefoRankByPalletId?: Record<string, number>;
  searchPlaceholder: string;
  emptyMessage: string;
  locationLabel?: string;
  zoneLabel?: string;
}) {
  const {
    title,
    pallets,
    selectedPalletIds,
    onSelectPalletIds,
    onClearPalletIds,
    locationPathByCode,
    locationZoneByCode,
    daysToExpiry,
    fefoRankByPalletId,
    searchPlaceholder,
    emptyMessage,
    locationLabel = "Bin",
    zoneLabel = "Zone",
  } = props;

  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"table" | "card">("table");
  const [groupMode, setGroupMode] = useState<"location" | "zone">("location");

  const filteredPallets = useMemo(() => {
    if (!search.trim()) return pallets;
    const q = search.toLowerCase();
    return pallets.filter((p) => p.palletId.toLowerCase().includes(q) || (p.currentLocation ?? "").toLowerCase().includes(q));
  }, [pallets, search]);

  const groupedVisiblePallets = useMemo(() => {
    const map = new Map<string, { key: string; label: string; pallets: Pallet[] }>();
    for (const pallet of filteredPallets) {
      const currentLocation = pallet.currentLocation ?? "";
      const key = groupMode === "location"
        ? (currentLocation || `Chưa có ${locationLabel.toLowerCase()}`)
        : (locationZoneByCode[currentLocation] ?? `Chưa có ${zoneLabel.toLowerCase()}`);
      const label = groupMode === "location"
        ? (locationPathByCode[currentLocation] ?? key)
        : key;
      const row = map.get(key);
      if (row) row.pallets.push(pallet);
      else map.set(key, { key, label, pallets: [pallet] });
    }
    return Array.from(map.values()).sort((a, b) => a.key.localeCompare(b.key));
  }, [filteredPallets, groupMode, locationLabel, locationPathByCode, locationZoneByCode, zoneLabel]);

  const selectVisible = () => onSelectPalletIds(filteredPallets.map((p) => p.palletId));
  const clearVisible = () => onClearPalletIds(filteredPallets.map((p) => p.palletId));
  const toggleSelection = (palletId: string, checked: boolean) => {
    if (checked) onSelectPalletIds([palletId]);
    else onClearPalletIds([palletId]);
  };
  const selectGroup = (groupKey: string) => {
    const ids = filteredPallets
      .filter((p) => (groupMode === "location" ? (p.currentLocation ?? `Chưa có ${locationLabel.toLowerCase()}`) === groupKey : (locationZoneByCode[p.currentLocation ?? ""] ?? `Chưa có ${zoneLabel.toLowerCase()}`) === groupKey))
      .map((p) => p.palletId);
    onSelectPalletIds(ids);
  };
  const clearGroup = (groupKey: string) => {
    const ids = filteredPallets
      .filter((p) => (groupMode === "location" ? (p.currentLocation ?? `Chưa có ${locationLabel.toLowerCase()}`) === groupKey : (locationZoneByCode[p.currentLocation ?? ""] ?? `Chưa có ${zoneLabel.toLowerCase()}`) === groupKey))
      .map((p) => p.palletId);
    onClearPalletIds(ids);
  };

  return (
    <div className="space-y-3">
      <div className="text-sm font-medium">{title}</div>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder={searchPlaceholder}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
          disabled={!pallets.length}
        />
        <Button variant="outline" disabled={!filteredPallets.length} onClick={selectVisible}>
          Chọn tất cả đang hiển thị
        </Button>
        <Button variant="outline" disabled={!Object.values(selectedPalletIds).some(Boolean)} onClick={clearVisible}>
          Xóa chọn
        </Button>
        <div className="ml-auto flex items-center gap-2">
          <Button variant={viewMode === "table" ? "default" : "outline"} onClick={() => setViewMode("table")}>Dạng bảng</Button>
          <Button variant={viewMode === "card" ? "default" : "outline"} onClick={() => setViewMode("card")}>Dạng thẻ</Button>
          <Select value={groupMode} onValueChange={(v) => setGroupMode(v as "location" | "zone")}>
            <SelectTrigger className="w-48"><SelectValue placeholder="Nhóm theo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="location">Nhóm theo {locationLabel}</SelectItem>
              <SelectItem value="zone">Nhóm theo {zoneLabel}</SelectItem>
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
                <TableHead>Current {locationLabel}</TableHead>
                <TableHead>{zoneLabel}</TableHead>
                {fefoRankByPalletId && <TableHead>FEFO Rank</TableHead>}
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groupedVisiblePallets.map((group) => (
                <Fragment key={group.key}>
                  <TableRow className="bg-muted/40">
                    <TableCell colSpan={fefoRankByPalletId ? 12 : 11}>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{groupMode === "location" ? `${locationLabel}:` : `${zoneLabel}:`} {group.label}</span>
                        <Badge variant="outline">{group.pallets.length} pallets</Badge>
                        <Button size="sm" variant="outline" onClick={() => selectGroup(group.key)}>
                          Chọn tất cả trong {groupMode === "location" ? locationLabel.toLowerCase() : zoneLabel.toLowerCase()} này
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => clearGroup(group.key)}>
                          Bỏ chọn {groupMode === "location" ? locationLabel.toLowerCase() : zoneLabel.toLowerCase()} này
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                  {group.pallets.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={!!selectedPalletIds[p.palletId]}
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
                      {fefoRankByPalletId && (
                        <TableCell className="text-xs font-mono">{fefoRankByPalletId[p.palletId] ?? "-"}</TableCell>
                      )}
                      <TableCell>{p.status}</TableCell>
                    </TableRow>
                  ))}
                </Fragment>
              ))}
              {filteredPallets.length === 0 && (
                <TableRow><TableCell colSpan={fefoRankByPalletId ? 12 : 11} className="py-6 text-center text-muted-foreground">{emptyMessage}</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="space-y-4">
          {groupedVisiblePallets.map((group) => (
            <div key={group.key} className="space-y-3">
              <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-muted/30 px-3 py-2">
                <span className="font-medium">{groupMode === "location" ? `${locationLabel}:` : `${zoneLabel}:`} {group.label}</span>
                <Badge variant="outline">{group.pallets.length} pallets</Badge>
                <Button size="sm" variant="outline" onClick={() => selectGroup(group.key)}>
                  Chọn tất cả trong {groupMode === "location" ? locationLabel.toLowerCase() : zoneLabel.toLowerCase()} này
                </Button>
                <Button size="sm" variant="outline" onClick={() => clearGroup(group.key)}>
                  Bỏ chọn {groupMode === "location" ? locationLabel.toLowerCase() : zoneLabel.toLowerCase()} này
                </Button>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {group.pallets.map((p) => {
                  const checked = !!selectedPalletIds[p.palletId];
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
                          {fefoRankByPalletId && <Badge variant="outline">{fefoRankByPalletId[p.palletId] ?? "-"}</Badge>}
                        </div>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                        <div className="rounded-lg bg-muted/40 p-2">
                          <div className="text-muted-foreground">Qty/UOM</div>
                          <div className="font-medium">{p.qty} {p.uom}</div>
                        </div>
                        <div className="rounded-lg bg-muted/40 p-2">
                          <div className="text-muted-foreground">Current {locationLabel}</div>
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
            <div className="rounded-xl border border-dashed p-6 text-center text-muted-foreground">{emptyMessage}</div>
          )}
        </div>
      )}
    </div>
  );
}
