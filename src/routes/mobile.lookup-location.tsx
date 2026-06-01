import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ScanInput } from "@/components/mobile/ScanInput";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { loadMobileScanSettings } from "@/services/mobileScanSettings";
import { appendScanEvent } from "@/services/scanService";
import { lookupLocationByScan } from "@/services/mobileWorkflowService";
import { formatLocationPath } from "@/utils/location";
import { MapPin, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/mobile/lookup-location")({ component: MobileLookupLocationPage });

function MobileLookupLocationPage() {
  const [result, setResult] = useState<ReturnType<typeof lookupLocationByScan> | null>(null);
  const settings = loadMobileScanSettings();

  const handleScan = (rawValue: string) => {
    try {
      const next = lookupLocationByScan(rawValue);
      setResult(next);
      appendScanEvent({
        scanType: "LOOKUP_LOCATION",
        scannedValue: rawValue,
        parsedType: next.parsed.parsedType,
        parsedCode: next.parsed.parsedCode,
        taskNo: null,
        palletId: null,
        locationCode: next.location.locationCode,
        result: "SUCCESS",
        message: `Đã lookup location ${next.location.locationCode}`,
        scannedBy: settings.operatorName,
      });
    } catch (error: any) {
      const errorMessage = error?.message ?? String(error);
      setResult(null);
      appendScanEvent({
        scanType: "LOOKUP_LOCATION",
        scannedValue: rawValue,
        parsedType: "UNKNOWN",
        parsedCode: null,
        taskNo: null,
        palletId: null,
        locationCode: null,
        result: "ERROR",
        message: errorMessage,
        scannedBy: settings.operatorName,
      });
    }
  };

  return (
    <div className="space-y-4 pb-6">
      <div className="flex items-center gap-2">
        <Button asChild variant="outline" size="icon" className="h-11 w-11 rounded-2xl">
          <Link to="/mobile">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Lookup</div>
          <h1 className="text-2xl font-semibold">Location</h1>
        </div>
      </div>

      <ScanInput
        label="Scan Location Code"
        placeholder="LOC:..."
        hint="Quét QR location hoặc nhập tay location code."
        onScan={(rawValue) => handleScan(rawValue)}
      />

      {result && (
        <Card className="rounded-[1.75rem]">
          <CardContent className="space-y-4 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Location</div>
                <div className="font-mono text-2xl font-semibold">{result.location.locationCode}</div>
                <div className="text-xs text-muted-foreground">{formatLocationPath(result.location)}</div>
              </div>
              <MapPin className="h-8 w-8 text-primary" />
            </div>

            <div className="grid grid-cols-3 gap-2 text-sm">
              <div className="rounded-2xl bg-muted/40 p-3">
                <div className="text-[11px] uppercase text-muted-foreground">Capacity</div>
                <div className="mt-1 font-semibold">{result.location.capacityPallet}</div>
              </div>
              <div className="rounded-2xl bg-muted/40 p-3">
                <div className="text-[11px] uppercase text-muted-foreground">Current</div>
                <div className="mt-1 font-semibold">{result.location.currentPalletCount}</div>
              </div>
              <div className="rounded-2xl bg-muted/40 p-3">
                <div className="text-[11px] uppercase text-muted-foreground">Available</div>
                <div className="mt-1 font-semibold">{result.availableCapacity}</div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Badge variant={result.location.status === "Active" ? "default" : "destructive"}>{result.location.status}</Badge>
              <Badge variant="secondary">{result.location.locationType}</Badge>
            </div>

            <div>
              <div className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Pallets in location</div>
              {result.pallets.length === 0 ? (
                <div className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
                  Chưa có pallet trong location này.
                </div>
              ) : (
                <div className="space-y-2">
                  {result.pallets.map((pallet) => (
                    <div key={pallet.id} className="rounded-2xl border p-3 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-mono font-semibold">{pallet.palletId}</div>
                        <Badge variant="outline">{pallet.status}</Badge>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {pallet.skuCode} / {pallet.batchNo} / {pallet.qty} {pallet.uom}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
