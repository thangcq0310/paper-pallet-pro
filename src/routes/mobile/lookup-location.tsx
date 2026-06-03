import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useStore } from "@/services/store";
import { Card, CardContent } from "@/components/ui/card";
import { SimpleScanInput, normalizeScanCode } from "@/components/mobile/SimpleScanInput";
import { formatLocationPath } from "@/utils/location";
import { ArrowLeft, MapPin, Package, Boxes } from "lucide-react";

export const Route = createFileRoute("/mobile/lookup-location")({
  component: LookupLocation,
});

function LookupLocation() {
  const locations = useStore((s) => s.locations);
  const pallets = useStore((s) => s.pallets);

  const [locationCodeInput, setLocationCodeInput] = useState<string | null>(null);

  const location = useMemo(() => {
    if (!locationCodeInput) return null;
    return locations.find((l) => l.locationCode?.toUpperCase() === locationCodeInput.toUpperCase());
  }, [locations, locationCodeInput]);

  const palletsInLocation = useMemo(() => {
    if (!location) return [];
    return pallets.filter((p) => p.currentLocation?.toUpperCase() === location.locationCode?.toUpperCase());
  }, [pallets, location]);

  const handleScan = (value: string) => {
    const normalized = normalizeScanCode(value);
    setLocationCodeInput(normalized.code);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <Link to="/mobile" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Quay lại
      </Link>

      <div className="text-center">
        <h1 className="text-xl font-semibold">Tra Location</h1>
        <p className="text-xs text-muted-foreground">Nhập hoặc scan Location Code</p>
      </div>

      {/* Scan Input */}
      <Card className="rounded-xl">
        <CardContent className="p-4 space-y-3">
          <SimpleScanInput
            placeholder="Nhập Location Code (VD: A-01-01)"
            onScan={handleScan}
          />
        </CardContent>
      </Card>

      {/* Location Info */}
      {location ? (
        <Card className="rounded-xl">
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <span className="font-mono text-lg font-semibold">{location.locationCode}</span>
              <span className="text-xs px-2 py-1 rounded-md bg-muted">{location.locationType}</span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex items-center gap-2">
                <Boxes className="h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="text-xs text-muted-foreground">Capacity</div>
                  <div className="font-mono">{location.capacityPallet ?? 0}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="text-xs text-muted-foreground">Current</div>
                  <div className="font-mono">{location.currentPalletCount ?? 0}</div>
                </div>
              </div>
            </div>

            <div className="text-sm">
              <span className="text-muted-foreground">Available: </span>
              <span className="font-semibold">
                {(location.capacityPallet ?? 0) - (location.currentPalletCount ?? 0)}
              </span>
            </div>

            <div className="text-xs text-muted-foreground">
              {formatLocationPath(location)}
            </div>
          </CardContent>
        </Card>
      ) : locationCodeInput ? (
        <Card className="rounded-xl">
          <CardContent className="p-6 text-center text-muted-foreground">
            Không tìm thấy location: {locationCodeInput}
          </CardContent>
        </Card>
      ) : null}

      {/* Pallets in Location */}
      {location && palletsInLocation.length > 0 && (
        <Card className="rounded-xl">
          <CardContent className="p-4 space-y-2">
            <h3 className="text-sm font-medium">Pallets trong location ({palletsInLocation.length})</h3>
            {palletsInLocation.map((p) => (
              <div key={p.id} className="flex items-center justify-between text-sm p-2 rounded-lg bg-muted/50">
                <div>
                  <span className="font-mono text-xs">{p.palletId}</span>
                  <span className="text-xs text-muted-foreground ml-2">{p.skuCode}</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {p.qty} {p.uom ?? "U"}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
