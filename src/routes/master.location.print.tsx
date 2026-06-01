import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef } from "react";
import { useStore } from "@/services/store";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/PageHeader";
import { formatLocationPath } from "@/utils/location";
import { QrCode } from "@/components/qr/QrCode";
import { Printer } from "lucide-react";

export const Route = createFileRoute("/master/location/print")({
  component: LocationPrintPage,
});

function LocationPrintPage() {
  const locations = useStore((s) => s.locations);
  const search = typeof window !== "undefined" ? window.location.search : "";
  const params = new URLSearchParams(search);
  const codeParam = params.get("code") ?? "";
  const codesParam = params.get("codes") ?? "";
  const codes = useMemo(() => {
    const raw = codesParam || codeParam;
    return raw
      ? raw.split(",").map((s) => s.trim()).filter(Boolean)
      : [];
  }, [codeParam, codesParam]);
  const autoPrintedRef = useRef(false);

  const selectedLocations = codes
    .map((code) => locations.find((l) => l.locationCode === code))
    .filter((location): location is (typeof locations)[number] => Boolean(location));

  useEffect(() => {
    if (!selectedLocations.length || autoPrintedRef.current) return;
    autoPrintedRef.current = true;
    const t = window.setTimeout(() => {
      window.print();
    }, 120);
    return () => window.clearTimeout(t);
  }, [selectedLocations.length]);

  if (selectedLocations.length === 0) {
    return (
      <div>
        <PageHeader title="Print Location Labels" />
        <Card className="rounded-2xl">
          <CardContent className="p-6 text-muted-foreground">
            Không tìm thấy location nào.{" "}
            <Link to="/master/location" className="text-primary underline">
              Quay lại Bin Master
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Print Location Labels"
        description={`${selectedLocations.length} location`}
        action={
          <div className="flex gap-2 no-print">
            <Button variant="outline" onClick={() => window.history.back()}>
              ← Quay lại
            </Button>
            <Button onClick={() => window.print()}>
              <Printer className="mr-1 h-4 w-4" />
              Print All ({selectedLocations.length})
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 print-area">
        {selectedLocations.map((location) => (
          <Card key={location.id} className="rounded-2xl border-2 border-foreground print-label break-inside-avoid">
            <CardContent className="p-6">
              <div className="flex items-start justify-between gap-4 border-b-2 border-foreground pb-4">
                <div>
                  <div className="text-xs uppercase tracking-widest text-muted-foreground">Location Label</div>
                  <div className="mt-1 font-mono text-3xl font-bold">{location.locationCode}</div>
                  <div className="text-sm font-semibold">{location.locationName ?? "—"}</div>
                  <div className="text-[11px] text-muted-foreground">{formatLocationPath(location)}</div>
                </div>
                <QrCode value={`LOC:${location.locationCode}`} className="h-28 w-28 shrink-0" />
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-xs uppercase text-muted-foreground">Type</div>
                  <div className="font-medium">{location.locationType}</div>
                </div>
                <div>
                  <div className="text-xs uppercase text-muted-foreground">Status</div>
                  <div className="font-medium">{location.status}</div>
                </div>
                <div>
                  <div className="text-xs uppercase text-muted-foreground">Capacity</div>
                  <div className="font-medium">{location.capacityPallet}</div>
                </div>
                <div>
                  <div className="text-xs uppercase text-muted-foreground">Current</div>
                  <div className="font-medium">{location.currentPalletCount}</div>
                </div>
              </div>
            </CardContent>
          </Card>
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
