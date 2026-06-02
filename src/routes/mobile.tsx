import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Package, MapPin, ListChecks } from "lucide-react";

export const Route = createFileRoute("/mobile")({
  component: MobileHome,
});

function MobileHome() {
  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div className="text-center py-4">
        <h1 className="text-2xl font-semibold">Mini WMS</h1>
        <p className="text-sm text-muted-foreground mt-1">Mobile Workflow</p>
      </div>

      {/* 3 Step Cards */}
      <div className="space-y-3">
        <Card className="rounded-xl">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-semibold">1</div>
              <div className="flex-1">
                <CardTitle className="text-base">Chọn task</CardTitle>
                <p className="text-xs text-muted-foreground mt-1">Scan Task No hoặc chọn task trong danh sách</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-semibold">2</div>
              <div className="flex-1">
                <CardTitle className="text-base">Thực hiện task</CardTitle>
                <p className="text-xs text-muted-foreground mt-1">Scan/nhập Pallet ID và Location theo hướng dẫn</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-semibold">3</div>
              <div className="flex-1">
                <CardTitle className="text-base">Xác nhận hoàn thành</CardTitle>
                <p className="text-xs text-muted-foreground mt-1">Confirm từng dòng task sau khi làm thực tế</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Action */}
      <Link
        to="/mobile/tasks"
        className="flex items-center justify-center gap-2 w-full text-base h-14 px-4 rounded-md bg-primary text-primary-foreground font-medium"
      >
        <ListChecks className="h-5 w-5" />
        Bắt đầu làm việc
        <ArrowRight className="h-5 w-5" />
      </Link>

      {/* Secondary Actions */}
      <div className="grid grid-cols-2 gap-3">
        <Link
          to="/mobile/lookup-pallet"
          className="flex items-center justify-center gap-2 w-full h-14 px-4 rounded-md border border-input bg-background font-medium"
        >
          <Package className="h-5 w-5" />
          Tra pallet
        </Link>
        <Link
          to="/mobile/lookup-location"
          className="flex items-center justify-center gap-2 w-full h-14 px-4 rounded-md border border-input bg-background font-medium"
        >
          <MapPin className="h-5 w-5" />
          Tra location
        </Link>
      </div>
    </div>
  );
}