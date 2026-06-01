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
    const t = window.setTimeout(() => {
      window.print();
    }, 120);
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
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-4 pb-3 border-b-2 border-foreground">
          <div className="flex-1">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Pallet Label</p>
            <h2 className="text-3xl font-bold mt-1 font-mono">{pallet.palletId}</h2>
            <div className="mt-1 text-xs font-mono text-muted-foreground">{`PLT:${pallet.palletId}`}</div>
          </div>
          <QrCode value={`PLT:${pallet.palletId}`} className="h-28 w-28 shrink-0" />
        </div>
        <div className="grid grid-cols-2 gap-y-3 gap-x-6 mt-4 text-sm">
          <div className="col-span-2">
            <div className="text-xs text-muted-foreground uppercase">Material / SKU</div>
            <div className="font-semibold">{pallet.skuCode} — {pallet.skuName}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground uppercase">Batch</div>
            <div className="font-semibold font-mono">{pallet.batchNo}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground uppercase">Bin</div>
            <div className="font-semibold">{pallet.currentLocation ?? "—"}</div>
            <div className="text-[11px] text-muted-foreground">{formatLocationPath(locations.find((l) => l.locationCode === pallet.currentLocation) ?? null)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground uppercase">Quantity</div>
            <div className="text-xl font-bold">{pallet.qty} {pallet.uom}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground uppercase">Weight</div>
            <div className="text-xl font-bold">{pallet.weight} kg</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground uppercase">MFG Date</div>
            <div className="font-semibold">{pallet.mfgDate || "—"}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground uppercase">EXP Date</div>
            <div className="font-semibold">{pallet.expDate || "—"}</div>
          </div>
          {pallet.referenceDocumentNo && (
            <div className="col-span-2">
              <div className="text-xs text-muted-foreground uppercase">Ref Doc No</div>
              <div className="font-semibold">{pallet.referenceDocumentNo}</div>
            </div>
          )}
          <div className="col-span-2 pt-2 border-t flex justify-between items-center">
            <PalletStatusBadge status={pallet.status} />
            <div className="text-xs text-muted-foreground">{pallet.createdAt?.slice(0, 16).replace("T", " ")}</div>
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
