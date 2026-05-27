import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useStore } from "@/services/store";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/PageHeader";
import { PalletStatusBadge } from "@/components/StatusBadges";

export const Route = createFileRoute("/inventory")({ component: InventoryPage });

function InventoryPage() {
  const pallets=useStore((s)=>s.pallets);
  const skus=useStore((s)=>s.skus);
  const locations=useStore((s)=>s.locations);
  const [search, setSearch] = useState("");
  const [skuFilter, setSkuFilter] = useState("all");
  const [locFilter, setLocFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const filtered = pallets.filter((p) =>
    (skuFilter === "all" || p.skuCode === skuFilter) &&
    (locFilter === "all" || p.currentLocation === locFilter) &&
    (statusFilter === "all" || p.status === statusFilter) &&
    (p.palletId.toLowerCase().includes(search.toLowerCase()) || p.batchNo.toLowerCase().includes(search.toLowerCase())),
  );

  const totals = filtered.reduce((acc, p) => ({ qty: acc.qty + p.qty, weight: acc.weight + p.weight }), { qty: 0, weight: 0 });

  return (
    <div>
      <PageHeader title="Inventory" description={`Tổng: ${filtered.length} pallet · ${totals.qty.toLocaleString()} qty · ${totals.weight.toLocaleString()} kg`} />

      <Card className="rounded-2xl">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-2 mb-4">
            <Input placeholder="Search Pallet/Batch..." className="max-w-xs" value={search} onChange={(e) => setSearch(e.target.value)} />
            <Select value={skuFilter} onValueChange={setSkuFilter}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">All SKU</SelectItem>{skus.map((s) => <SelectItem key={s.id} value={s.skuCode}>{s.skuCode}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={locFilter} onValueChange={setLocFilter}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">All Locations</SelectItem>{locations.map((l) => <SelectItem key={l.id} value={l.locationCode}>{l.locationCode}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                {["Label Created", "Labeled", "In Stock", "Staged", "Loaded", "Shipped"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Pallet ID</TableHead><TableHead>SKU</TableHead><TableHead>Name</TableHead>
                <TableHead>Batch</TableHead><TableHead className="text-right">Qty</TableHead><TableHead>UOM</TableHead>
                <TableHead className="text-right">Weight</TableHead><TableHead>Location</TableHead>
                <TableHead>Status</TableHead><TableHead>EXP</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {filtered.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell><Link to="/pallet/$palletId" params={{ palletId: p.palletId }} className="font-mono text-xs text-primary hover:underline">{p.palletId}</Link></TableCell>
                    <TableCell>{p.skuCode}</TableCell>
                    <TableCell className="text-xs">{p.skuName}</TableCell>
                    <TableCell className="font-mono text-xs">{p.batchNo}</TableCell>
                    <TableCell className="text-right">{p.qty}</TableCell>
                    <TableCell>{p.uom}</TableCell>
                    <TableCell className="text-right">{p.weight}</TableCell>
                    <TableCell className="font-mono text-xs">{p.currentLocation}</TableCell>
                    <TableCell><PalletStatusBadge status={p.status} /></TableCell>
                    <TableCell className="text-xs">{p.expDate}</TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && <TableRow><TableCell colSpan={10} className="text-center py-6 text-muted-foreground">Không có pallet</TableCell></TableRow>}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
