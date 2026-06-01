import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useStore } from "@/services/store";
import { loadMobileScanSettings, saveMobileScanSettings, type MobileScanSettings } from "@/services/mobileScanSettings";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Smartphone, ScanLine, Search, ArrowDownToLine, ArrowUpFromLine, Package, History, ListChecks } from "lucide-react";

export const Route = createFileRoute("/mobile")({ component: MobileHomePage });

function MobileHomePage() {
  const scanEvents = useStore((s) => s.scanEvents);
  const tasks = useStore((s) => s.tasks);
  const [settings, setSettings] = useState<MobileScanSettings>(() => loadMobileScanSettings());

  useEffect(() => {
    saveMobileScanSettings(settings);
  }, [settings]);

  const recentEvents = useMemo(() => scanEvents.slice(0, 8), [scanEvents]);
  const openTasks = useMemo(
    () => tasks.filter((t) => t.status === "Open" || t.status === "Printed" || t.status === "Partially Confirmed"),
    [tasks],
  );

  return (
    <div className="space-y-4 pb-6">
      <div className="rounded-[2rem] bg-gradient-to-br from-slate-950 via-slate-900 to-slate-700 p-5 text-white shadow-xl">
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-white/60">
          <Smartphone className="h-4 w-4" />
          Mobile WMS
        </div>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Scan nhanh</h1>
        <p className="mt-2 max-w-sm text-sm text-white/70">
          Camera QR/barcode hoặc nhập tay, phù hợp điện thoại ngoài kho.
        </p>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button asChild className="h-12 rounded-2xl bg-white text-slate-950 hover:bg-white/90">
            <Link to="/mobile/scan-putaway">
              <ArrowDownToLine className="mr-2 h-4 w-4" />
              Putaway
            </Link>
          </Button>
          <Button asChild className="h-12 rounded-2xl bg-white/10 text-white hover:bg-white/15">
            <Link to="/mobile/scan-move">
              <ArrowUpFromLine className="mr-2 h-4 w-4" />
              Move
            </Link>
          </Button>
          <Button asChild className="h-12 rounded-2xl bg-white/10 text-white hover:bg-white/15">
            <Link to="/mobile/scan-pick">
              <Package className="mr-2 h-4 w-4" />
              Pick
            </Link>
          </Button>
          <Button asChild className="h-12 rounded-2xl bg-white/10 text-white hover:bg-white/15">
            <Link to="/mobile/lookup-pallet">
              <Search className="mr-2 h-4 w-4" />
              Lookup
            </Link>
          </Button>
        </div>

        <Button asChild className="mt-2 h-12 w-full rounded-2xl bg-white/10 text-white hover:bg-white/15">
          <Link to="/mobile/tasks">
            <ListChecks className="mr-2 h-4 w-4" />
            Task list
          </Link>
        </Button>
      </div>

      <Card className="rounded-[1.75rem]">
        <CardContent className="space-y-4 p-4">
          <div className="flex items-center gap-2">
            <ScanLine className="h-4 w-4 text-primary" />
            <div className="text-sm font-semibold">Cài đặt scan</div>
          </div>

          <div className="space-y-3">
            <div>
              <div className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">Người scan</div>
              <Input
                value={settings.operatorName}
                onChange={(e) => setSettings((prev) => ({ ...prev, operatorName: e.target.value }))}
                className="h-11 rounded-2xl"
                placeholder="demo"
              />
            </div>

            <label className="flex items-center justify-between gap-4 rounded-2xl border p-4">
              <div>
                <div className="text-sm font-medium">Cho phép confirm task Open</div>
                <div className="text-xs text-muted-foreground">Bật khi muốn scan mà task chưa in.</div>
              </div>
              <Switch
                checked={settings.allowOpenTaskConfirm}
                onCheckedChange={(checked) => setSettings((prev) => ({ ...prev, allowOpenTaskConfirm: checked }))}
              />
            </label>

            <label className="flex items-center justify-between gap-4 rounded-2xl border p-4">
              <div>
                <div className="text-sm font-medium">Admin override actual bin</div>
                <div className="text-xs text-muted-foreground">Dùng khi actual location khác target bin.</div>
              </div>
              <Switch
                checked={settings.allowActualLocationOverride}
                onCheckedChange={(checked) => setSettings((prev) => ({ ...prev, allowActualLocationOverride: checked }))}
              />
            </label>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Card className="rounded-[1.5rem]">
          <CardContent className="p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Open task</div>
            <div className="mt-1 text-2xl font-semibold">{openTasks.length}</div>
          </CardContent>
        </Card>
        <Card className="rounded-[1.5rem]">
          <CardContent className="p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Scan logs</div>
            <div className="mt-1 text-2xl font-semibold">{scanEvents.length}</div>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-[1.75rem]">
        <CardContent className="space-y-3 p-4">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-primary" />
            <div className="text-sm font-semibold">Scan gần đây</div>
          </div>

          {recentEvents.length === 0 && (
            <div className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
              Chưa có scan log.
            </div>
          )}

          <div className="space-y-2">
            {recentEvents.map((event) => (
              <div key={event.id} className="rounded-2xl border p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-mono text-xs">{event.scanType}</div>
                  <Badge
                    variant={event.result === "SUCCESS" ? "default" : event.result === "WARNING" ? "secondary" : "destructive"}
                  >
                    {event.result}
                  </Badge>
                </div>
                <div className="mt-1 font-mono text-xs text-muted-foreground">{event.scannedValue}</div>
                <div className="mt-1 text-xs text-muted-foreground">{event.message}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-2">
        <Button asChild variant="outline" className="h-12 rounded-2xl">
          <Link to="/mobile/lookup-pallet">Lookup Pallet</Link>
        </Button>
        <Button asChild variant="outline" className="h-12 rounded-2xl">
          <Link to="/mobile/lookup-location">Lookup Location</Link>
        </Button>
      </div>
    </div>
  );
}
