import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useStore } from "@/services/store";
import { addLocation, toggleLocationBlock } from "@/services/masterService";
import { resetDemoData } from "@/services/demoResetService";
import { importLocationsFromCsv, type BulkImportError } from "@/services/masterImportService";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/PageHeader";
import { LocationStatusBadge } from "@/components/StatusBadges";
import { formatLocationPath } from "@/utils/location";
import { toast } from "sonner";
import { FileDown, FileUp, Plus, Printer, RotateCcw } from "lucide-react";
import { downloadTextFile, toCsv } from "@/utils/csv";

export const Route = createFileRoute("/master/location")({ component: LocationPage });

function LocationPage() {
  const locations = useStore((s) => s.locations);
  const [open, setOpen] = useState(false);
  const [zoneFilter, setZoneFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [importErrors, setImportErrors] = useState<BulkImportError[]>([]);
  const [errorsOpen, setErrorsOpen] = useState(false);
  const [form, setForm] = useState({
    locationCode: "",
    locationName: "",
    zone: "",
    aisle: "",
    tier: "",
    locationType: "STORAGE" as "RECEIVING" | "STORAGE" | "STAGING" | "DOCK",
    capacityPallet: 2,
    status: "Active" as "Active" | "Blocked",
  });

  const zones = Array.from(new Set(locations.map((l) => l.zone)));
  const filtered = locations.filter((l) =>
    (zoneFilter === "all" || l.zone === zoneFilter) &&
    (statusFilter === "all" || l.status === statusFilter),
  );

  const submit = () => {
    try {
      addLocation({
        ...form,
        locationName: form.locationName.trim() || undefined,
        block: form.aisle.trim() || "-",
        aisle: form.aisle.trim() || undefined,
        tier: form.tier.trim() || undefined,
      });
      toast.success("Đã thêm bin");
      setOpen(false);
      setForm({ locationCode: "", locationName: "", zone: "", aisle: "", tier: "", locationType: "STORAGE", capacityPallet: 2, status: "Active" });
    }
    catch (e: any) { toast.error(e.message); }
  };

  return (
    <div>
      <PageHeader title="Bin Master" description="Bin / Slot trong kho"
        action={
          <>
            <Button
              variant="destructive"
              onClick={() => {
                if (confirm("Reset toàn bộ demo data về trạng thái ban đầu? Thao tác này sẽ xóa dữ liệu đang lưu trên máy hiện tại.")) {
                  resetDemoData();
                }
              }}
            >
              <RotateCcw className="h-4 w-4 mr-1" />
              Reset demo data
            </Button>

            <Button
              variant="outline"
              onClick={() => {
                const csv = toCsv([
                  ["binCode", "binName", "zone", "aisle", "tier", "block", "binType", "capacityPallet", "status"],
                  ["FZ-A-01-01", "Frozen Zone A - Aisle 01 - Tier 01", "FZ-A", "01", "01", "01", "STORAGE", 10, "Active"],
                ]);
                downloadTextFile("bin_template.csv", csv, "text/csv;charset=utf-8");
              }}
            >
              <FileDown className="h-4 w-4 mr-1" />
              Tải mẫu Bin CSV
            </Button>

            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                try {
                  const text = await file.text();
                  const res = importLocationsFromCsv(text);
                  toast.success(`Import Bin: +${res.created} tạo mới, ${res.updated} cập nhật, ${res.skipped} lỗi`);
                  if (res.errors.length > 0) {
                    setImportErrors(res.errors);
                    setErrorsOpen(true);
                  }
                } catch (err: any) {
                  toast.error(err?.message ?? String(err));
                }
              }}
            />
            <Button variant="outline" onClick={() => fileRef.current?.click()}>
              <FileUp className="h-4 w-4 mr-1" />
              Upload CSV
            </Button>

            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" />Thêm Bin</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Thêm Bin</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div><Label>Bin Code</Label><Input value={form.locationCode} onChange={(e) => setForm({ ...form, locationCode: e.target.value })} /></div>
                  <div><Label>Bin Name (optional)</Label><Input value={form.locationName} onChange={(e) => setForm({ ...form, locationName: e.target.value })} /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Zone</Label><Input value={form.zone} onChange={(e) => setForm({ ...form, zone: e.target.value })} /></div>
                    <div><Label>Dãy (Aisle)</Label><Input value={form.aisle} onChange={(e) => setForm({ ...form, aisle: e.target.value })} /></div>
                    <div><Label>Tầng (optional)</Label><Input value={form.tier} onChange={(e) => setForm({ ...form, tier: e.target.value })} /></div>
                  </div>
                  <div>
                    <Label>Bin Type</Label>
                    <Select value={form.locationType} onValueChange={(v) => setForm({ ...form, locationType: v as any })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(["STORAGE", "RECEIVING", "STAGING", "DOCK"] as const).map((t) => (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label>Capacity (pallet)</Label><Input type="number" value={form.capacityPallet} onChange={(e) => setForm({ ...form, capacityPallet: +e.target.value })} /></div>
                </div>
                <DialogFooter><Button onClick={submit}>Lưu</Button></DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={errorsOpen} onOpenChange={setErrorsOpen}>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Lỗi import Bin</DialogTitle>
                </DialogHeader>
                <div className="flex justify-end">
                  <Button
                    variant="outline"
                    onClick={() => {
                      const csv = toCsv([["row", "message"], ...importErrors.map((x) => [x.row, x.message])]);
                      downloadTextFile("bin_import_errors.csv", csv, "text/csv;charset=utf-8");
                    }}
                  >
                    <FileDown className="h-4 w-4 mr-1" />
                    Tải lỗi CSV
                  </Button>
                </div>
                <div className="max-h-[50vh] overflow-auto border rounded-xl">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-20">Row</TableHead>
                        <TableHead>Message</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {importErrors.map((e) => (
                        <TableRow key={`${e.row}-${e.message}`}>
                          <TableCell className="font-mono text-xs">{e.row}</TableCell>
                          <TableCell className="text-sm">{e.message}</TableCell>
                        </TableRow>
                      ))}
                      {importErrors.length === 0 && (
                        <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground py-6">Không có lỗi</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </DialogContent>
            </Dialog>
          </>
        }
      />

      <Card className="rounded-2xl">
        <CardContent className="p-4">
          <div className="flex gap-2 mb-4">
            <Select value={zoneFilter} onValueChange={setZoneFilter}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">All Zones</SelectItem>{zones.map((z) => <SelectItem key={z} value={z}>{z}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="Active">Active</SelectItem>
                <SelectItem value="Blocked">Blocked</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Table>
            <TableHeader><TableRow>
              <TableHead>Bin</TableHead><TableHead>Zone</TableHead>
              <TableHead>Dãy</TableHead><TableHead>Tầng</TableHead>
              <TableHead className="text-right">Capacity</TableHead><TableHead className="text-right">Current</TableHead>
              <TableHead>Status</TableHead><TableHead></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {filtered.map((l) => {
                const full = l.capacityPallet < 9999 && l.currentPalletCount >= l.capacityPallet;
                return (
                  <TableRow key={l.id}>
                    <TableCell className="font-mono">
                      <div>{l.locationCode}</div>
                      <div className="text-[11px] text-muted-foreground">{formatLocationPath(l)}</div>
                    </TableCell>
                    <TableCell>{l.zone}</TableCell>
                    <TableCell>{l.aisle ?? l.block ?? "—"}</TableCell>
                    <TableCell>{l.tier ?? "—"}</TableCell>
                    <TableCell className="text-right">{l.capacityPallet < 9999 ? l.capacityPallet : "∞"}</TableCell>
                    <TableCell className="text-right">{l.currentPalletCount}</TableCell>
                    <TableCell><LocationStatusBadge status={l.status} full={full} /></TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => window.open(`/master/location/print?code=${encodeURIComponent(l.locationCode)}`, "_blank", "noopener,noreferrer")}
                        >
                          <Printer className="mr-1 h-3.5 w-3.5" />
                          Print
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => toggleLocationBlock(l.id)}>{l.status === "Active" ? "Block" : "Unblock"}</Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
