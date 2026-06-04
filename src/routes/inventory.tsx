import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useStore } from "@/services/store";
import { cancelTask } from "@/services/taskService";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { formatLocationPath } from "@/utils/location";
import { TaskListCard } from "@/components/TaskListCard";
import { toast } from "sonner";

export const Route = createFileRoute("/inventory")({ component: InventoryPage });

function InventoryPage() {
  const router = useRouter();
  const pallets = useStore((s) => s.pallets);
  const skus = useStore((s) => s.skus);
  const locations = useStore((s) => s.locations);
  const tasks = useStore((s) => s.tasks);
  const taskLines = useStore((s) => s.taskLines);
  const [search, setSearch] = useState("");
  const [skuFilter, setSkuFilter] = useState("all");
  const [locFilter, setLocFilter] = useState("all");
  const [includeShipped, setIncludeShipped] = useState(false);
  const [includeCancelled, setIncludeCancelled] = useState(false);
  const locationPathByCode = Object.fromEntries(locations.map((l) => [l.locationCode, formatLocationPath(l)]));

  const filteredPallets = pallets.filter((p) =>
    (includeShipped || p.status !== "Shipped") &&
    (includeCancelled || p.status !== "Cancelled") &&
    (skuFilter === "all" || p.skuCode === skuFilter) &&
    (locFilter === "all" || p.currentLocation === locFilter || (p.status === "Shipped" && p.lastLocation === locFilter)) &&
    (search.trim() === "" ||
      p.palletId.toLowerCase().includes(search.toLowerCase()) ||
      p.skuCode.toLowerCase().includes(search.toLowerCase()) ||
      p.skuName.toLowerCase().includes(search.toLowerCase()) ||
      p.batchNo.toLowerCase().includes(search.toLowerCase())),
  );

  const grouped = Object.values(
    filteredPallets.reduce<Record<string, {
      skuCode: string;
      skuName: string;
      batchNo: string;
      pallets: typeof filteredPallets;
      uom: string;
      totalQty: number;
      totalWeight: number;
      expDate: string;
      statuses: Set<string>;
    }>>((acc, p) => {
      const key = `${p.skuCode}__${p.batchNo}`;
      const current = acc[key];
      const nextExp = current?.expDate
        ? (p.expDate && p.expDate < current.expDate ? p.expDate : current.expDate)
        : p.expDate;
      if (!current) {
        acc[key] = {
          skuCode: p.skuCode,
          skuName: p.skuName,
          batchNo: p.batchNo,
          pallets: [p],
          uom: p.uom,
          totalQty: p.qty,
          totalWeight: p.weight,
          expDate: p.expDate,
          statuses: new Set([p.status]),
        };
      } else {
        current.pallets.push(p);
        current.totalQty += p.qty;
        current.totalWeight += p.weight;
        current.expDate = nextExp;
        current.statuses.add(p.status);
      }
      return acc;
    }, {}),
  )
    .sort((a, b) => {
      if (a.skuCode !== b.skuCode) return a.skuCode.localeCompare(b.skuCode);
      return a.batchNo.localeCompare(b.batchNo);
    });

  const totals = grouped.reduce(
    (acc, g) => ({ pallets: acc.pallets + g.pallets.length, qty: acc.qty + g.totalQty, weight: acc.weight + g.totalWeight }),
    { pallets: 0, qty: 0, weight: 0 },
  );

  const openTasks = useMemo(
    () => tasks.filter((t) => t.status === "Open" || t.status === "Printed" || t.status === "Partially Confirmed"),
    [tasks],
  );

  const taskLineMap = useMemo(() => {
    const map = new Map<string, typeof taskLines>();
    for (const line of taskLines) {
      const arr = map.get(line.taskId) ?? [];
      arr.push(line);
      map.set(line.taskId, arr);
    }
    return map;
  }, [taskLines]);

  const openPrintTask = (taskNo: string) => {
    router.navigate({ to: "/tasks/$taskNo/print", params: { taskNo } });
  };

  return (
    <div>
      <PageHeader title="Inventory" description={`Tổng: ${totals.pallets} pallet · ${totals.qty.toLocaleString()} qty · ${totals.weight.toLocaleString()} kg`} />

      <Card className="rounded-2xl">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-2 mb-4 items-center">
            <Input placeholder="Search Pallet / SKU / Batch..." className="max-w-xs" value={search} onChange={(e) => setSearch(e.target.value)} />
            <Select value={skuFilter} onValueChange={setSkuFilter}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">All SKU</SelectItem>{skus.map((s) => <SelectItem key={s.id} value={s.skuCode}>{s.skuCode}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={locFilter} onValueChange={setLocFilter}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Bins</SelectItem>
                {locations.map((l) => (
                  <SelectItem key={l.id} value={l.locationCode}>
                    {l.locationCode} · {locationPathByCode[l.locationCode]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Switch id="include-shipped" checked={includeShipped} onCheckedChange={setIncludeShipped} />
                <Label htmlFor="include-shipped">Include Shipped</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch id="include-cancelled" checked={includeCancelled} onCheckedChange={setIncludeCancelled} />
                <Label htmlFor="include-cancelled">Include Cancelled</Label>
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Batch</TableHead>
                <TableHead className="text-right">Pallets</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead>UOM</TableHead>
                <TableHead className="text-right">Weight</TableHead>
                <TableHead>Bins</TableHead>
                <TableHead>EXP (earliest)</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {grouped.map((g) => {
                  const uniqueLocations = Array.from(new Set(g.pallets.map((p) => p.currentLocation || p.lastLocation || "N/A"))).sort();
                  return (
                    <TableRow key={`${g.skuCode}__${g.batchNo}`}>
                      <TableCell>
                        <div className="font-medium">{g.skuCode}</div>
                        <div className="text-xs text-muted-foreground">{g.skuName}</div>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{g.batchNo}</TableCell>
                      <TableCell className="text-right">{g.pallets.length}</TableCell>
                      <TableCell className="text-right">{g.totalQty}</TableCell>
                      <TableCell>{g.uom}</TableCell>
                      <TableCell className="text-right">{g.totalWeight}</TableCell>
                      <TableCell className="text-xs">
                        <div className="flex flex-wrap gap-1">
                          {uniqueLocations.slice(0, 3).map((loc) => (
                            <span key={loc} className="font-mono px-2 py-1 rounded-md bg-secondary">{locationPathByCode[loc] ?? loc}</span>
                          ))}
                          {uniqueLocations.length > 3 && <span className="text-muted-foreground">+{uniqueLocations.length - 3}</span>}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs">{g.expDate || "-"}</TableCell>
                    </TableRow>
                  );
                })}
                {grouped.length === 0 && <TableRow><TableCell colSpan={8} className="text-center py-6 text-muted-foreground">Không có pallet</TableCell></TableRow>}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <TaskListCard
        title="Open Tasks"
        tasks={openTasks}
        lineMap={taskLineMap}
        emptyMessage="Không có open task"
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
    </div>
  );
}
