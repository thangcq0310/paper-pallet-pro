import { createFileRoute, Link } from "@tanstack/react-router";
import { useStore } from "@/services/store";
import { confirmLabelAttached } from "@/services/palletService";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/PageHeader";
import { PalletStatusBadge } from "@/components/StatusBadges";
import { toast } from "sonner";
import { Printer, Check } from "lucide-react";

export const Route = createFileRoute("/pallet/$palletId")({ component: PalletLabelPreview });

function PalletLabelPreview() {
  const { palletId } = Route.useParams();
  const pallet = useStore((s) => s.pallets.find((p) => p.palletId === palletId));

  if (!pallet) return (
    <div>
      <PageHeader title="Pallet Label" />
      <Card className="rounded-2xl"><CardContent className="p-6 text-muted-foreground">Pallet không tồn tại. <Link to="/pallet/create" className="text-primary underline">Tạo mới</Link></CardContent></Card>
    </div>
  );

  const confirm = () => {
    try { confirmLabelAttached(pallet.palletId); toast.success("Đã xác nhận dán nhãn"); }
    catch (e: any) { toast.error(e.message); }
  };

  return (
    <div>
      <PageHeader title="Pallet Label Preview" description={pallet.palletId}
        action={<>
          <Button variant="outline" className="no-print" onClick={() => window.print()}><Printer className="h-4 w-4 mr-1" />Print</Button>
          <Button className="no-print" onClick={confirm} disabled={pallet.labelAttached}><Check className="h-4 w-4 mr-1" />Confirm Label Attached</Button>
        </>}
      />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
        <div className="print-area">
          <Card className="rounded-2xl border-2 border-foreground">
            <CardContent className="p-8">
              <div className="text-center pb-4 border-b-2 border-foreground">
                <p className="text-xs uppercase tracking-widest">PALLET LABEL</p>
                <h2 className="text-4xl font-bold mt-1 font-mono">{pallet.palletId}</h2>
              </div>
              <div className="grid grid-cols-2 gap-y-4 gap-x-8 mt-6 text-lg">
                <div><div className="text-xs text-muted-foreground uppercase">SKU</div><div className="font-semibold">{pallet.skuCode}</div></div>
                <div><div className="text-xs text-muted-foreground uppercase">Batch</div><div className="font-semibold">{pallet.batchNo}</div></div>
                <div className="col-span-2"><div className="text-xs text-muted-foreground uppercase">Product</div><div className="font-semibold text-xl">{pallet.skuName}</div></div>
                <div><div className="text-xs text-muted-foreground uppercase">Quantity</div><div className="text-2xl font-bold">{pallet.qty} {pallet.uom}</div></div>
                <div><div className="text-xs text-muted-foreground uppercase">Weight</div><div className="text-2xl font-bold">{pallet.weight} kg</div></div>
                <div><div className="text-xs text-muted-foreground uppercase">MFG Date</div><div className="font-semibold">{pallet.mfgDate}</div></div>
                <div><div className="text-xs text-muted-foreground uppercase">EXP Date</div><div className="font-semibold">{pallet.expDate}</div></div>
                <div><div className="text-xs text-muted-foreground uppercase">Created</div><div className="font-semibold">{pallet.createdAt.slice(0, 10)}</div></div>
                <div><div className="text-xs text-muted-foreground uppercase">Location</div><div className="font-semibold">{pallet.currentLocation}</div></div>
              </div>
            </CardContent>
          </Card>
        </div>
        <Card className="rounded-2xl h-fit no-print">
          <CardContent className="p-5 space-y-3">
            <div><div className="text-xs text-muted-foreground">Status</div><PalletStatusBadge status={pallet.status} /></div>
            <div className="text-sm">
              <div className="text-xs text-muted-foreground">Label Attached</div>
              <div className="font-medium">{pallet.labelAttached ? "✓ Đã dán" : "Chưa dán"}</div>
            </div>
            <div className="text-sm">
              <div className="text-xs text-muted-foreground">Current Location</div>
              <div className="font-mono">{pallet.currentLocation}</div>
            </div>
            <div className="pt-3 border-t text-xs text-muted-foreground">
              Sau khi in nhãn và dán lên pallet thực tế, bấm <b>Confirm Label Attached</b> để pallet sẵn sàng cho putaway.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
