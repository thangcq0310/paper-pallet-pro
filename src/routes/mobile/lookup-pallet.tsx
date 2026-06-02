import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useStore } from "@/services/store";
import { Card, CardContent } from "@/components/ui/card";
import { SimpleScanInput, normalizeScanCode } from "@/components/mobile/SimpleScanInput";
import { PalletStatusBadge } from "@/components/StatusBadges";
import { formatLocationPath } from "@/utils/location";
import { toast } from "sonner";
import { ArrowLeft, Package, MapPin, Hash, Box } from "lucide-react";

export const Route = createFileRoute("/mobile/lookup-pallet")({
  component: LookupPallet,
});

function LookupPallet() {
  const pallets = useStore((s) => s.pallets);
  const locations = useStore((s) => s.locations);
  const tasks = useStore((s) => s.tasks);
  const taskLines = useStore((s) => s.taskLines);

  const [palletIdInput, setPalletIdInput] = useState<string | null>(null);

  const locationPathByCode = useMemo(
    () => Object.fromEntries(locations.map((l) => [l.locationCode, formatLocationPath(l)])),
    [locations],
  );

  const pallet = useMemo(() => {
    if (!palletIdInput) return null;
    return pallets.find((p) => p.palletId?.toUpperCase() === palletIdInput.toUpperCase());
  }, [pallets, palletIdInput]);

  const openTasksForPallet = useMemo(() => {
    if (!pallet) return [];
    const palletTaskIds = new Set(
      taskLines
        .filter((l) => l.palletId?.toUpperCase() === pallet.palletId?.toUpperCase())
        .map((l) => l.taskId)
    );
    return tasks.filter((t) =>
      palletTaskIds.has(t.id) &&
      ["Open", "Printed", "Partially Confirmed"].includes(t.status)
    );
  }, [pallet, tasks, taskLines]);

  const handleScan = (value: string) => {
    const normalized = normalizeScanCode(value);
    setPalletIdInput(normalized.code);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <Link to="/mobile" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Quay lại
      </Link>

      <div className="text-center">
        <h1 className="text-xl font-semibold">Tra Pallet</h1>
        <p className="text-xs text-muted-foreground">Nhập hoặc scan Pallet ID</p>
      </div>

      {/* Scan Input */}
      <Card className="rounded-xl">
        <CardContent className="p-4 space-y-3">
          <SimpleScanInput
            placeholder="Nhập Pallet ID (VD: PLT-001)"
            onScan={handleScan}
          />
        </CardContent>
      </Card>

      {/* Pallet Info */}
      {pallet ? (
        <Card className="rounded-xl">
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <span className="font-mono text-lg font-semibold">{pallet.palletId}</span>
              <PalletStatusBadge status={pallet.status} />
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex items-center gap-2">
                <Hash className="h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="text-xs text-muted-foreground">SKU</div>
                  <div className="font-mono">{pallet.skuCode ?? "—"}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Box className="h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="text-xs text-muted-foreground">Batch</div>
                  <div className="font-mono">{pallet.batchNo ?? "—"}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="text-xs text-muted-foreground">Qty</div>
                  <div className="font-mono">{pallet.qty ?? 0}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="text-xs text-muted-foreground">Location</div>
                  <div className="font-mono">{pallet.currentLocation ?? "—"}</div>
                  <div className="text-xs text-muted-foreground">
                    {locationPathByCode[pallet.currentLocation ?? ""] ?? ""}
                  </div>
                </div>
              </div>
            </div>

            {pallet.expDate && (
              <div className="text-sm">
                <span className="text-muted-foreground">Exp: </span>
                <span>{pallet.expDate}</span>
              </div>
            )}
          </CardContent>
        </Card>
      ) : palletIdInput ? (
        <Card className="rounded-xl">
          <CardContent className="p-6 text-center text-muted-foreground">
            Không tìm thấy pallet: {palletIdInput}
          </CardContent>
        </Card>
      ) : null}

      {/* Open Tasks */}
      {pallet && openTasksForPallet.length > 0 && (
        <Card className="rounded-xl">
          <CardContent className="p-4 space-y-2">
            <h3 className="text-sm font-medium">Open Task liên quan</h3>
            {openTasksForPallet.map((t) => (
              <div key={t.id} className="flex items-center justify-between text-sm">
                <span className="font-mono text-xs">{t.taskNo}</span>
                <span className="text-xs text-muted-foreground">{t.taskType}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}