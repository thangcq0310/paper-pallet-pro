import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useStore } from "@/services/store";
import { addLocation, toggleLocationBlock } from "@/services/masterService";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/PageHeader";
import { LocationStatusBadge } from "@/components/StatusBadges";
import { toast } from "sonner";
import { Plus } from "lucide-react";

export const Route = createFileRoute("/master/location")({ component: LocationPage });

function LocationPage() {
  const locations = useStore((s) => s.locations);
  const [open, setOpen] = useState(false);
  const [zoneFilter, setZoneFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [form, setForm] = useState({ locationCode: "", zone: "", block: "", capacityPallet: 2, status: "Active" as "Active" | "Blocked" });

  const zones = Array.from(new Set(locations.map((l) => l.zone)));
  const filtered = locations.filter((l) =>
    (zoneFilter === "all" || l.zone === zoneFilter) &&
    (statusFilter === "all" || l.status === statusFilter),
  );

  const submit = () => {
    try { addLocation(form); toast.success("Đã thêm location"); setOpen(false); setForm({ locationCode: "", zone: "", block: "", capacityPallet: 2, status: "Active" }); }
    catch (e: any) { toast.error(e.message); }
  };

  return (
    <div>
      <PageHeader title="Location Master" description="Bin / Slot trong kho"
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" />Thêm Location</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Thêm Location</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Location Code</Label><Input value={form.locationCode} onChange={(e) => setForm({ ...form, locationCode: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Zone</Label><Input value={form.zone} onChange={(e) => setForm({ ...form, zone: e.target.value })} /></div>
                  <div><Label>Block</Label><Input value={form.block} onChange={(e) => setForm({ ...form, block: e.target.value })} /></div>
                </div>
                <div><Label>Capacity (pallet)</Label><Input type="number" value={form.capacityPallet} onChange={(e) => setForm({ ...form, capacityPallet: +e.target.value })} /></div>
              </div>
              <DialogFooter><Button onClick={submit}>Lưu</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <Card className="rounded-2xl">
        <CardContent className="p-4">
          <div className="flex gap-2 mb-4">
            <Select value={zoneFilter} onValueChange={setZoneFilter}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">All Zones</SelectItem>{zones.map((z) => <SelectItem key={z} value={z}>{z}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="Active">Active</SelectItem>
                <SelectItem value="Blocked">Blocked</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Table>
            <TableHeader><TableRow>
              <TableHead>Location</TableHead><TableHead>Zone</TableHead><TableHead>Block</TableHead>
              <TableHead className="text-right">Capacity</TableHead><TableHead className="text-right">Current</TableHead>
              <TableHead>Status</TableHead><TableHead></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {filtered.map((l) => {
                const full = l.capacityPallet < 9999 && l.currentPalletCount >= l.capacityPallet;
                return (
                  <TableRow key={l.id}>
                    <TableCell className="font-mono">{l.locationCode}</TableCell>
                    <TableCell>{l.zone}</TableCell>
                    <TableCell>{l.block}</TableCell>
                    <TableCell className="text-right">{l.capacityPallet < 9999 ? l.capacityPallet : "∞"}</TableCell>
                    <TableCell className="text-right">{l.currentPalletCount}</TableCell>
                    <TableCell><LocationStatusBadge status={l.status} full={full} /></TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" onClick={() => toggleLocationBlock(l.id)}>{l.status === "Active" ? "Block" : "Unblock"}</Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
