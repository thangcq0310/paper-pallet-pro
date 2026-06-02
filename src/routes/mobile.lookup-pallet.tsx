import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ScanInput } from "@/components/mobile/ScanInput";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useStore } from "@/services/store";
import { loadMobileScanSettings } from "@/services/mobileScanSettings";
import { appendScanEvent } from "@/services/scanService";
import { lookupPalletByParsed } from "@/services/mobileWorkflowService";
import { formatLocationPath } from "@/utils/location";
import { PalletStatusBadge } from "@/components/StatusBadges";
import { Package, ArrowLeft } from "lucide-react";
import { expectParsedScanType, parseScannedCode } from "@/utils/scan";

export const Route = createFileRoute("/mobile/lookup-pallet")({ component: MobileLookupPalletPage });

function MobileLookupPalletPage() {
  const locations = useStore((s) => s.locations);
  const [result, setResult] = useState<ReturnType<typeof lookupPalletByParsed> | null>(null);
  const [message, setMessage] = useState("");
  const settings = loadMobileScanSettings();

  const handleScan = (rawValue: string) => {
    try {
      const parsed = parseScannedCode(rawValue);
      expectParsedScanType(parsed, "PALLET", "Hãy scan Pallet ID hợp lệ");
      const next = lookupPalletByParsed(parsed);
      setResult(next);
      const isWarning = next.openTasks.length > 0;
      setMessage(isWarning ? `Pallet có ${next.openTasks.length} task mở` : "Tìm thấy pallet");
      appendScanEvent({
        scanType: "LOOKUP_PALLET",
        scannedValue: rawValue,
        parsedType: next.parsed.parsedType,
        parsedCode: next.parsed.parsedCode,
        taskNo: next.openTasks[0]?.taskNo ?? null,
        palletId: next.pallet.palletId,
        locationCode: next.pallet.currentLocation,
        result: isWarning ? "WARNING" : "SUCCESS",
        message: isWarning ? `Pallet có ${next.openTasks.length} task mở` : `Đã lookup pallet ${next.pallet.palletId}`,
        scannedBy: settings.operatorName,
      });
    } catch (error: any) {
      const errorMessage = error?.message ?? String(error);
      setResult(null);
      setMessage(errorMessage);
      appendScanEvent({
        scanType: "LOOKUP_PALLET",
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

  const locationPath = result?.pallet.currentLocation
    ? formatLocationPath(locations.find((l) => l.locationCode === result.pallet.currentLocation) ?? null)
    : "—";

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
          <h1 className="text-2xl font-semibold">Pallet</h1>
        </div>
      </div>

      <ScanInput
        label="Scan Pallet ID"
        placeholder="PLT:..."
        hint="Cho phép quét QR hoặc nhập tay pallet ID."
        onScan={(_, rawValue) => handleScan(rawValue)}
      />

      {message && (
        <div className="rounded-2xl border p-3 text-sm">
          {message}
        </div>
      )}

      {result && (
        <Card className="rounded-[1.75rem]">
          <CardContent className="space-y-4 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Pallet ID</div>
                <div className="font-mono text-2xl font-semibold">{result.pallet.palletId}</div>
              </div>
              <Package className="h-8 w-8 text-primary" />
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-2xl bg-muted/40 p-3">
                <div className="text-[11px] uppercase text-muted-foreground">SKU</div>
                <div className="mt-1 font-medium">{result.pallet.skuCode}</div>
              </div>
              <div className="rounded-2xl bg-muted/40 p-3">
                <div className="text-[11px] uppercase text-muted-foreground">Batch</div>
                <div className="mt-1 font-mono font-medium">{result.pallet.batchNo}</div>
              </div>
              <div className="rounded-2xl bg-muted/40 p-3">
                <div className="text-[11px] uppercase text-muted-foreground">Qty</div>
                <div className="mt-1 font-medium">{result.pallet.qty} {result.pallet.uom}</div>
              </div>
              <div className="rounded-2xl bg-muted/40 p-3">
                <div className="text-[11px] uppercase text-muted-foreground">Status</div>
                <div className="mt-1"><PalletStatusBadge status={result.pallet.status} /></div>
              </div>
              <div className="col-span-2 rounded-2xl bg-muted/40 p-3">
                <div className="text-[11px] uppercase text-muted-foreground">Current Location</div>
                <div className="mt-1 font-mono font-medium">{result.pallet.currentLocation ?? "—"}</div>
                <div className="text-xs text-muted-foreground">{locationPath}</div>
              </div>
            </div>

            <div className="rounded-2xl border p-3">
              <div className="text-[11px] uppercase text-muted-foreground">Open Task</div>
              {result.openTasks.length === 0 ? (
                <div className="mt-1 text-sm text-muted-foreground">Không có task mở.</div>
              ) : (
                <div className="mt-2 flex flex-wrap gap-2">
                  {result.openTasks.slice(0, 3).map((task) => (
                    <Button key={task.id} asChild variant="outline" className="rounded-full">
                      <Link to={`/tasks/${task.taskNo}`}>{task.taskNo}</Link>
                    </Button>
                  ))}
                  {result.openTasks.length > 3 && <Badge variant="secondary">+{result.openTasks.length - 3}</Badge>}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
