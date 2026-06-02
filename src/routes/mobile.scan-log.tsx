import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useStore } from "@/services/store";
import { exportScanEvents } from "@/services/scanAuditService";
import { formatLocationPath } from "@/utils/location";
import type { ParsedScanType, ScanResult } from "@/types";
import { ArrowLeft, History, Filter, Search } from "lucide-react";

export const Route = createFileRoute("/mobile/scan-log")({ component: MobileScanLogPage });

const RESULT_OPTIONS: Array<"all" | ScanResult> = ["all", "SUCCESS", "WARNING", "ERROR"];
const TYPE_OPTIONS: Array<"all" | ParsedScanType> = ["all", "PALLET", "LOCATION", "TASK", "UNKNOWN"];

function MobileScanLogPage() {
  const scanEvents = useStore((s) => s.scanEvents);
  const tasks = useStore((s) => s.tasks);
  const pallets = useStore((s) => s.pallets);
  const locations = useStore((s) => s.locations);
  const [query, setQuery] = useState("");
  const [resultFilter, setResultFilter] = useState<"all" | ScanResult>("all");
  const [typeFilter, setTypeFilter] = useState<"all" | ParsedScanType>("all");

  const filtered = useMemo(() => {
    const q = query.trim().toUpperCase();
    return scanEvents.filter((event) => {
      const matchesQuery =
        !q ||
        event.scannedValue.toUpperCase().includes(q) ||
        event.scanType.toUpperCase().includes(q) ||
        event.message.toUpperCase().includes(q) ||
        (event.taskNo ?? "").toUpperCase().includes(q) ||
        (event.palletId ?? "").toUpperCase().includes(q) ||
        (event.locationCode ?? "").toUpperCase().includes(q);
      const matchesResult = resultFilter === "all" || event.result === resultFilter;
      const matchesType = typeFilter === "all" || event.parsedType === typeFilter;
      return matchesQuery && matchesResult && matchesType;
    });
  }, [scanEvents, query, resultFilter, typeFilter]);

  const counters = useMemo(() => ({
    total: scanEvents.length,
    success: scanEvents.filter((event) => event.result === "SUCCESS").length,
    warning: scanEvents.filter((event) => event.result === "WARNING").length,
    error: scanEvents.filter((event) => event.result === "ERROR").length,
  }), [scanEvents]);

  const handleExport = (format: "csv" | "json") => {
    const { fileName, mimeType, content } = exportScanEvents(format);
    const blob = new Blob([content], { type: mimeType });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4 pb-6">
      <div className="flex items-center gap-2">
        <Button asChild variant="outline" size="icon" className="h-11 w-11 rounded-2xl">
          <a href="/mobile">
            <ArrowLeft className="h-4 w-4" />
          </a>
        </Button>
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Mobile</div>
          <h1 className="text-2xl font-semibold">Scan log</h1>
        </div>
      </div>

      <Card className="rounded-[1.75rem]">
        <CardContent className="space-y-3 p-4">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-primary" />
            <div className="text-sm font-semibold">Trace scan</div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="h-10 rounded-full" onClick={() => handleExport("csv")}>
              Export CSV
            </Button>
            <Button variant="outline" className="h-10 rounded-full" onClick={() => handleExport("json")}>
              Export JSON
            </Button>
          </div>

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-11 rounded-2xl pl-9"
              placeholder="Tìm theo pallet, task, location, message..."
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
              <Filter className="h-3.5 w-3.5" />
              Result
            </div>
            <div className="flex flex-wrap gap-2">
              {RESULT_OPTIONS.map((option) => (
                <Button
                  key={option}
                  variant={resultFilter === option ? "default" : "outline"}
                  className="h-10 rounded-full"
                  onClick={() => setResultFilter(option)}
                >
                  {option}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
              <Filter className="h-3.5 w-3.5" />
              Type
            </div>
            <div className="flex flex-wrap gap-2">
              {TYPE_OPTIONS.map((option) => (
                <Button
                  key={option}
                  variant={typeFilter === option ? "default" : "outline"}
                  className="h-10 rounded-full"
                  onClick={() => setTypeFilter(option)}
                >
                  {option}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Card className="rounded-[1.5rem]">
          <CardContent className="p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Total</div>
            <div className="mt-1 text-2xl font-semibold">{counters.total}</div>
          </CardContent>
        </Card>
        <Card className="rounded-[1.5rem]">
          <CardContent className="p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Success</div>
            <div className="mt-1 text-2xl font-semibold">{counters.success}</div>
          </CardContent>
        </Card>
        <Card className="rounded-[1.5rem]">
          <CardContent className="p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Warning</div>
            <div className="mt-1 text-2xl font-semibold">{counters.warning}</div>
          </CardContent>
        </Card>
        <Card className="rounded-[1.5rem]">
          <CardContent className="p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Error</div>
            <div className="mt-1 text-2xl font-semibold">{counters.error}</div>
          </CardContent>
        </Card>
      </div>

      {filtered.length === 0 ? (
        <Card className="rounded-[1.75rem]">
          <CardContent className="p-4 text-sm text-muted-foreground">
            Không có scan log phù hợp bộ lọc.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((event) => {
            const task = event.taskNo ? tasks.find((item) => item.taskNo === event.taskNo) : null;
            const pallet = event.palletId ? pallets.find((item) => item.palletId === event.palletId) : null;
            const location = event.locationCode ? locations.find((item) => item.locationCode === event.locationCode) : null;
            return (
              <Card key={event.id} className="rounded-[1.5rem]">
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">{event.scanType}</div>
                      <div className="mt-1 font-mono text-sm font-semibold">{event.scannedValue}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {new Date(event.scannedAt).toLocaleString()}
                      </div>
                    </div>
                    <Badge
                      variant={event.result === "SUCCESS" ? "default" : event.result === "WARNING" ? "secondary" : "destructive"}
                    >
                      {event.result}
                    </Badge>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">{event.parsedType}</Badge>
                    {event.parsedCode && <Badge variant="secondary">{event.parsedCode}</Badge>}
                    {event.scannedBy && <Badge variant="outline">By {event.scannedBy}</Badge>}
                  </div>

                  <div className="text-sm">{event.message}</div>

                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="rounded-2xl bg-muted/40 p-3">
                      <div className="uppercase text-muted-foreground">Task</div>
                      <div className="mt-1 font-mono">{event.taskNo ?? "—"}</div>
                    </div>
                    <div className="rounded-2xl bg-muted/40 p-3">
                      <div className="uppercase text-muted-foreground">Pallet</div>
                      <div className="mt-1 font-mono">{event.palletId ?? "—"}</div>
                    </div>
                    <div className="rounded-2xl bg-muted/40 p-3">
                      <div className="uppercase text-muted-foreground">Location</div>
                      <div className="mt-1 font-mono">{event.locationCode ?? "—"}</div>
                    </div>
                  </div>

                  {location && (
                    <div className="text-xs text-muted-foreground">{formatLocationPath(location)}</div>
                  )}

                  <div className="flex flex-wrap gap-2">
                    {task && (
                      <Button asChild variant="outline" className="h-9 rounded-full">
                        <a href="/mobile/tasks">{task.taskNo}</a>
                      </Button>
                    )}
                    {pallet && (
                      <Button asChild variant="outline" className="h-9 rounded-full">
                        <a href="/mobile/lookup-pallet">{pallet.palletId}</a>
                      </Button>
                    )}
                    {location && (
                      <Button asChild variant="outline" className="h-9 rounded-full">
                        <a href="/mobile/lookup-location">{location.locationCode}</a>
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
