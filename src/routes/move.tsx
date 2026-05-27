import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useStore } from "@/services/store";
import { movePallet } from "@/services/palletService";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/PageHeader";
import { toast } from "sonner";

export const Route = createFileRoute("/move")({ component: MovePage });

function MovePage() {
  const pallets=useStore((s)=>s.pallets);
  const locations=useStore((s)=>s.locations);
  const [palletId, setPalletId] = useState("");
  const [toLocation, setToLocation] = useState("");
  const [note, setNote] = useState("");

  const movable = pallets.filter((p) => p.status === "In Stock");
  const pallet = pallets.find((p) => p.palletId === palletId);
  const targets = locations.filter((l) => l.status === "Active" && l.locationCode !== pallet?.currentLocation && !["RECEIVING", "SHIPPED", "STAGING-01", "DOCK-01"].includes(l.locationCode) && l.currentPalletCount < l.capacityPallet);

  const submit = () => {
    try { movePallet(palletId, toLocation, note); toast.success("Đã move pallet"); setPalletId(""); setToLocation(""); setNote(""); }
    catch (e: any) { toast.error(e.message); }
  };

  return (
    <div>
      <PageHeader title="Move Location" description="Chuyển pallet giữa các bin" />
      <Card className="rounded-2xl max-w-2xl">
        <CardContent className="p-6 space-y-4">
          <div>
            <Label>Pallet (In Stock)</Label>
            <Select value={palletId} onValueChange={setPalletId}>
              <SelectTrigger><SelectValue placeholder="Chọn pallet" /></SelectTrigger>
              <SelectContent>{movable.map((p) => <SelectItem key={p.id} value={p.palletId}>{p.palletId} — {p.skuCode} @ {p.currentLocation}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {pallet && (
            <div className="rounded-xl bg-muted/50 p-4 grid grid-cols-2 gap-2 text-sm">
              <div><span className="text-muted-foreground text-xs">SKU</span><div>{pallet.skuCode}</div></div>
              <div><span className="text-muted-foreground text-xs">Batch</span><div>{pallet.batchNo}</div></div>
              <div><span className="text-muted-foreground text-xs">Qty</span><div>{pallet.qty} {pallet.uom}</div></div>
              <div><span className="text-muted-foreground text-xs">Current</span><div className="font-mono">{pallet.currentLocation}</div></div>
            </div>
          )}
          <div>
            <Label>To Location</Label>
            <Select value={toLocation} onValueChange={setToLocation} disabled={!pallet}>
              <SelectTrigger><SelectValue placeholder="Chọn location đích" /></SelectTrigger>
              <SelectContent>{targets.map((l) => <SelectItem key={l.id} value={l.locationCode}>{l.locationCode} ({l.currentPalletCount}/{l.capacityPallet})</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Note</Label><Textarea value={note} onChange={(e) => setNote(e.target.value)} /></div>
          <Button onClick={submit} disabled={!palletId || !toLocation}>Confirm Move</Button>
        </CardContent>
      </Card>
    </div>
  );
}
