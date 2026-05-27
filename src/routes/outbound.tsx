import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useStore } from "@/services/store";
import { suggestPalletsForOutbound, pickToStaging, loadPallet, shipPallet } from "@/services/palletService";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/PageHeader";
import { PalletStatusBadge } from "@/components/StatusBadges";
import { toast } from "sonner";

export const Route = createFileRoute("/outbound")({ component: OutboundPage });

function OutboundPage() {
  const skus=useStore((s)=>s.skus);
  const pallets=useStore((s)=>s.pallets);
  const [skuCode, setSkuCode] = useState("");
  const [destination, setDestination] = useState("");
  const [requiredQty, setRequiredQty] = useState(0);

  const result = skuCode && requiredQty > 0 ? suggestPalletsForOutbound(skuCode, requiredQty) : null;

  const stagedOrLoaded = pallets.filter((p) => p.status === "Staged" || p.status === "Loaded");

  const handlePick = (palletId: string) => {
    try { pickToStaging(palletId); toast.success("Đã pick to staging"); } catch (e: any) { toast.error(e.message); }
  };
  const handleLoad = (palletId: string) => {
    try { loadPallet(palletId); toast.success("Đã load"); } catch (e: any) { toast.error(e.message); }
  };
  const handleShip = (palletId: string) => {
    try { shipPallet(palletId); toast.success("Đã xuất kho"); } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div>
      <PageHeader title="Outbound" description="Xuất kho thủ công theo FEFO/FIFO" />

      <Card className="rounded-2xl mb-6">
        <CardContent className="p-6 space-y-4">
          <h3 className="font-semibold">Outbound Request</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div><Label>Destination</Label><Input value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="Khách hàng / xe" /></div>
            <div><Label>SKU</Label>
              <Select value={skuCode} onValueChange={setSkuCode}>
                <SelectTrigger><SelectValue placeholder="Chọn SKU" /></SelectTrigger>
                <SelectContent>{skus.map((s) => <SelectItem key={s.id} value={s.skuCode}>{s.skuCode}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Required Qty</Label><Input type="number" value={requiredQty} onChange={(e) => setRequiredQty(+e.target.value)} /></div>
          </div>

          {result && (
            <div>
              <p className="text-sm text-muted-foreground mb-2">Gợi ý (FEFO → FIFO) — đã chọn {result.fulfilled}/{requiredQty}</p>
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Pallet</TableHead><TableHead>Batch</TableHead><TableHead className="text-right">Qty</TableHead>
                  <TableHead>EXP</TableHead><TableHead>Location</TableHead><TableHead></TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {result.suggested.map((p) => {
                    const inSelected = result.selected.includes(p);
                    return (
                      <TableRow key={p.id} className={inSelected ? "bg-success/5" : ""}>
                        <TableCell className="font-mono text-xs">{p.palletId}</TableCell>
                        <TableCell className="font-mono text-xs">{p.batchNo}</TableCell>
                        <TableCell className="text-right">{p.qty}</TableCell>
                        <TableCell className="text-xs">{p.expDate}</TableCell>
                        <TableCell className="font-mono text-xs">{p.currentLocation}</TableCell>
                        <TableCell className="text-right"><Button size="sm" onClick={() => handlePick(p.palletId)}>Pick → Staging</Button></TableCell>
                      </TableRow>
                    );
                  })}
                  {result.suggested.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-4 text-muted-foreground">Không có pallet phù hợp</TableCell></TableRow>}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardContent className="p-6">
          <h3 className="font-semibold mb-4">Pallet đang Staged / Loaded</h3>
          <Table>
            <TableHeader><TableRow>
              <TableHead>Pallet</TableHead><TableHead>SKU</TableHead><TableHead>Qty</TableHead>
              <TableHead>Location</TableHead><TableHead>Status</TableHead><TableHead></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {stagedOrLoaded.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-mono text-xs">{p.palletId}</TableCell>
                  <TableCell>{p.skuCode}</TableCell>
                  <TableCell>{p.qty}</TableCell>
                  <TableCell className="font-mono text-xs">{p.currentLocation}</TableCell>
                  <TableCell><PalletStatusBadge status={p.status} /></TableCell>
                  <TableCell className="text-right space-x-2">
                    {p.status === "Staged" && <Button size="sm" onClick={() => handleLoad(p.palletId)}>Confirm Load</Button>}
                    {p.status === "Loaded" && <Button size="sm" variant="default" onClick={() => handleShip(p.palletId)}>Confirm Out</Button>}
                  </TableCell>
                </TableRow>
              ))}
              {stagedOrLoaded.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">Không có pallet ở staging/dock</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
