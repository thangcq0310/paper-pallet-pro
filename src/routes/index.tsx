import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useStore } from "@/services/store";
import { PageHeader } from "@/components/PageHeader";
import { PalletStatusBadge } from "@/components/StatusBadges";
import { Boxes, Package, Scale, MapPin, ArrowDownToLine, ArrowUpFromLine, ListChecks, AlertTriangle } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatLocationPath } from "@/utils/location";

export const Route = createFileRoute("/")({ component: Dashboard });

function Stat({ label, value, hint, icon: Icon, accent }: { label: string; value: string | number; hint?: string; icon: any; accent?: string }) {
  return (
    <Card className="rounded-2xl">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
            <p className="text-2xl font-semibold mt-2">{value}</p>
            {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
          </div>
          <div className={`h-10 w-10 rounded-xl grid place-items-center ${accent ?? "bg-primary/10 text-primary"}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Dashboard() {
  const pallets=useStore((s)=>s.pallets);
  const locations=useStore((s)=>s.locations);
  const movements=useStore((s)=>s.movements);
  const tasks=useStore((s)=>s.tasks);
  const today = new Date().toISOString().slice(0, 10);

  const totalPallets = pallets.length;
  const totalQty = pallets.reduce((a, p) => a + p.qty, 0);
  const totalWeight = pallets.reduce((a, p) => a + p.weight, 0);

  const userLocations = locations.filter((l) => l.locationType === "STORAGE");
  const empty = userLocations.filter((l) => l.currentPalletCount === 0).length;
  const full = userLocations.filter((l) => l.currentPalletCount >= l.capacityPallet && l.capacityPallet < 9999).length;
  const totalCap = userLocations.reduce((a, l) => a + (l.capacityPallet < 9999 ? l.capacityPallet : 0), 0);
  const used = userLocations.reduce((a, l) => a + (l.capacityPallet < 9999 ? l.currentPalletCount : 0), 0);
  const occupancy = totalCap > 0 ? Math.round((used / totalCap) * 100) : 0;

  const inReceiving = pallets.filter((p) => p.currentLocation && locations.find(l => l.locationCode === p.currentLocation)?.locationType === "RECEIVING").length;
  const inStock = pallets.filter((p) => p.status === "In Stock").length;
  const inStaging = pallets.filter((p) => p.status === "Staged").length;
  const shippedToday = movements.filter((m) => m.movementType === "OUT" && m.timestamp.startsWith(today)).length;
  const inboundToday = movements.filter((m) => m.movementType === "IN" && m.timestamp.startsWith(today)).length;
  const outboundToday = movements.filter((m) => m.movementType === "OUT" && m.timestamp.startsWith(today)).length;
  const openTasks = tasks.filter((t) => t.status === "Open" || t.status === "Printed" || t.status === "Partially Confirmed").length;

  const recentMovements = movements.slice(0, 6);
  const waitingPutaway = pallets.filter((p) => p.status === "Pending Putaway" && locations.find(l => l.locationCode === p.currentLocation)?.locationType === "RECEIVING");
  const nearExpiry = pallets.filter((p) => {
    const days = (new Date(p.expDate).getTime() - Date.now()) / 86400000;
    return days < 60 && p.status !== "Shipped";
  });

  return (
    <div>
      <PageHeader title="Dashboard" description="Tổng quan vận hành kho thủ công" />

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        <Stat label="Total Pallets" value={totalPallets} icon={Boxes} />
        <Stat label="Total Quantity" value={totalQty.toLocaleString()} icon={Package} />
        <Stat label="Total Weight (kg)" value={totalWeight.toLocaleString()} icon={Scale} />
        <Stat label="Occupancy" value={`${occupancy}%`} hint={`${used}/${totalCap} pallet slots`} icon={MapPin} accent="bg-info/10 text-info" />
        <Stat label="Empty Locations" value={empty} icon={MapPin} accent="bg-success/15 text-success" />
        <Stat label="Full Locations" value={full} icon={MapPin} accent="bg-destructive/15 text-destructive" />
        <Stat label="Open Tasks" value={openTasks} icon={ListChecks} accent="bg-warning/20 text-warning-foreground" />
        <Stat label="Inbound Today" value={inboundToday} icon={ArrowDownToLine} accent="bg-success/15 text-success" />
        <Stat label="Outbound Today" value={outboundToday} icon={ArrowUpFromLine} accent="bg-info/10 text-info" />
        <Stat label="In Receiving" value={inReceiving} icon={ArrowDownToLine} />
        <Stat label="In Stock" value={inStock} icon={Boxes} accent="bg-success/15 text-success" />
        <Stat label="In Staging" value={inStaging} icon={ArrowUpFromLine} accent="bg-warning/20 text-warning-foreground" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-6">
        <Card className="rounded-2xl lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Recent Movements</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Pallet</TableHead>
                  <TableHead>From → To</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentMovements.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell><span className="text-xs font-medium px-2 py-1 rounded-md bg-secondary">{m.movementType}</span></TableCell>
                    <TableCell className="font-mono text-xs">{m.palletId}</TableCell>
                    <TableCell className="text-xs">
                      {formatLocationPath(locations.find((l) => l.locationCode === m.fromLocation) ?? null)} → {formatLocationPath(locations.find((l) => l.locationCode === m.toLocation) ?? null)}
                    </TableCell>
                    <TableCell className="text-right">{m.qty}</TableCell>
                  </TableRow>
                ))}
                {recentMovements.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">Chưa có movement</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="rounded-2xl">
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-warning" />Waiting Putaway</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {waitingPutaway.length === 0 && <p className="text-xs text-muted-foreground">Không có pallet chờ putaway</p>}
              {waitingPutaway.slice(0, 5).map((p) => (
                <div key={p.id} className="flex items-center justify-between text-sm">
                  <Link to="/pallet/create" className="font-mono text-xs hover:underline">{p.palletId}</Link>
                  <div className="text-right">
                    <div className="text-[11px] text-muted-foreground">{formatLocationPath(locations.find((l) => l.locationCode === p.currentLocation) ?? null)}</div>
                    <PalletStatusBadge status={p.status} />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card className="rounded-2xl">
            <CardHeader><CardTitle className="text-base">Shipped Today</CardTitle></CardHeader>
            <CardContent><p className="text-3xl font-semibold">{shippedToday}</p></CardContent>
          </Card>
          <Card className="rounded-2xl">
            <CardHeader><CardTitle className="text-base">Near Expiry (&lt; 60d)</CardTitle></CardHeader>
            <CardContent>
              {nearExpiry.length === 0 && <p className="text-xs text-muted-foreground">Không có pallet sắp hết hạn</p>}
              {nearExpiry.slice(0, 5).map((p) => (
                <div key={p.id} className="text-xs flex justify-between"><span className="font-mono">{p.palletId}</span><span>{p.expDate}</span></div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
