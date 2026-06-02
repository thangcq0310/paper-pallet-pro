import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { History, ListChecks, MapPin, PackageSearch, ScanLine, Search } from "lucide-react";

export const Route = createFileRoute("/mobile")({ component: MobileHomePage });

function MobileHomePage() {
  return (
    <div className="space-y-4 pb-6">
      <Card className="rounded-[2rem] border-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-700 text-white shadow-xl">
        <CardContent className="space-y-4 p-5">
          <div className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-white/60">
            <ScanLine className="h-4 w-4" />
            Mobile WMS
          </div>

          <div>
            <div className="text-sm text-white/70">Bắt đầu làm việc</div>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight">3 bước, không rối</h1>
            <p className="mt-2 max-w-sm text-sm text-white/70">
              Chọn task, thực hiện theo hướng dẫn, rồi xác nhận hoàn thành từng dòng.
            </p>
          </div>

          <Button asChild className="h-14 w-full rounded-2xl bg-white text-slate-950 hover:bg-white/90">
            <a href="/mobile/tasks">
              <ListChecks className="mr-2 h-4 w-4" />
              Bắt đầu làm việc
            </a>
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-3">
        <Card className="rounded-[1.75rem]">
          <CardContent className="flex items-start gap-3 p-4">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
              <ListChecks className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold">1. Chọn task</div>
              <div className="mt-1 text-sm text-muted-foreground">Scan Task No hoặc chọn task trong danh sách.</div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[1.75rem]">
          <CardContent className="flex items-start gap-3 p-4">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
              <PackageSearch className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold">2. Thực hiện task</div>
              <div className="mt-1 text-sm text-muted-foreground">Scan Pallet ID và Location theo hướng dẫn của task.</div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[1.75rem]">
          <CardContent className="flex items-start gap-3 p-4">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
              <ScanLine className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold">3. Xác nhận hoàn thành</div>
              <div className="mt-1 text-sm text-muted-foreground">Confirm từng dòng task sau khi làm thực tế.</div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-[1.75rem]">
        <CardContent className="space-y-3 p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Phụ trợ</div>
          <div className="grid grid-cols-2 gap-2">
            <Button asChild variant="outline" className="h-11 rounded-2xl">
              <a href="/mobile/lookup-pallet">
                <Search className="mr-2 h-4 w-4" />
                Lookup Pallet
              </a>
            </Button>
            <Button asChild variant="outline" className="h-11 rounded-2xl">
              <a href="/mobile/lookup-location">
                <MapPin className="mr-2 h-4 w-4" />
                Lookup Location
              </a>
            </Button>
            <Button asChild variant="outline" className="col-span-2 h-11 rounded-2xl">
              <a href="/mobile/scan-log">
                <History className="mr-2 h-4 w-4" />
                Scan log
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
