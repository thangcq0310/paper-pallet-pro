import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { useStore } from "@/services/store";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/PageHeader";
import { PalletStatusBadge } from "@/components/StatusBadges";
import { Printer } from "lucide-react";
import { formatLocationPath } from "@/utils/location";
import { QrCode } from "@/components/qr/QrCode";

export const Route = createFileRoute("/pallet/print-batch")({
  component: PrintBatchPage,
});

function PrintBatchPage() {
  const allPallets = useStore((s) => s.pallets);
  const locations = useStore((s) => s.locations);
  const location = typeof window !== "undefined" ? window.location : null;
  const params = new URLSearchParams(location?.search ?? "");
  const idsParam = params.get("ids") ?? "";
  const ids = idsParam ? idsParam.split(",").map((s) => s.trim()).filter(Boolean) : [];
  const autoPrintedRef = useRef(false);

  const pallets = ids
    .map((id) => allPallets.find((p) => p.palletId === id))
    .filter(Boolean) as (typeof allPallets)[number][];

  useEffect(() => {
    if (!pallets.length || autoPrintedRef.current) return;
    autoPrintedRef.current = true;
    // Wait for QR codes to load (async)
    const t = window.setTimeout(() => {
      window.print();
    }, 800);
    return () => window.clearTimeout(t);
  }, [pallets.length]);

  if (pallets.length === 0) {
    return (
      <div>
        <PageHeader title="Print Batch Labels" />
        <Card className="rounded-2xl">
          <CardContent className="p-6 text-muted-foreground">
            Không tìm thấy pallet nào.{" "}
            <Link to="/pallet/create" className="text-primary underline">
              Tạo pallet mới
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const LabelCard = ({ pallet }: { pallet: (typeof pallets)[number] }) => (
    <Card className="rounded-2xl border-2 border-foreground print-label break-inside-avoid">
      <CardContent className="p-5">
        {/***** Header: palletId *****/}
        <div className="text-center mb-3">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Pallet Label</p>
          <h2 className="text-2xl font-black font-mono tracking-tight">{pallet.palletId}</h2>
        </div>

        {/***** QR: centered, large *****/}
        <div className="flex justify-center mb-3">
          <QrCode value={`PLT:${pallet.palletId}`} className="w-96 h-96" />
        </div>

        {/***** Info grid *****/}
        <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-sm border-t-2 border-foreground pt-3">
          <div className="col-span-2">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Material / SKU</div>
            <div className="font-bold text-base">{pallet.skuCode} — {pallet.skuName}</div>
          </div>
          <div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Batch</div>
            <div className="font-bold font-mono">{pallet.batchNo}</div>
          </div>
          <div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Bin</div>
            <div className="font-bold">{pallet.currentLocation ?? "—"}</div>
          </div>
          <div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Quantity</div>
            <div className="font-bold text-lg">{pallet.qty} {pallet.uom}</div>
          </div>
          <div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Weight</div>
            <div className="font-bold text-lg">{pallet.weight} kg</div>
          </div>
          <div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wide">MFG Date</div>
            <div className="font-bold">{pallet.mfgDate || "—"}</div>
          </div>
          <div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wide">EXP Date</div>
            <div className="font-bold">{pallet.expDate || "—"}</div>
          </div>
          {pallet.referenceDocumentNo && (
            <div className="col-span-2">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Ref Doc No</div>
              <div className="font-bold">{pallet.referenceDocumentNo}</div>
            </div>
          )}
          <div className="col-span-2 flex justify-between items-center pt-2 border-t">
            <PalletStatusBadge status={pallet.status} />
            <div className="text-[10px] text-muted-foreground">{pallet.createdAt?.slice(0, 16).replace("T", " ")}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div>
      <PageHeader
        title="Print Batch Labels"
        description={`${pallets.length} pallet vừa được tạo`}
        action={
          <div className="flex gap-2 no-print">
            <Button variant="outline" onClick={() => window.history.back()}>
              ← Quay lại
            </Button>
            <Button onClick={() => window.print()}>
              <Printer className="h-4 w-4 mr-1" />
              Print All ({pallets.length})
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 print-area">
        {pallets.map((p) => (
          <LabelCard key={p.id} pallet={p} />
        ))}
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-area { grid-template-columns: repeat(2, 1fr); gap: 12px; }
          body { padding: 0; margin: 0; }
          .print-label { page-break-inside: avoid; }
        }
      `}</style>
    </div>
  );
}
