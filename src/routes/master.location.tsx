import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "@/services/store";
import { addLocation, addPlant, addSloc, deleteLocation, deletePlant, deleteSloc, toggleLocationBlock } from "@/services/masterService";
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
import { FileDown, FileUp, Plus, Printer, RotateCcw, Trash2 } from "lucide-react";
import { downloadTextFile, toCsv } from "@/utils/csv";

export const Route = createFileRoute("/master/location")({ component: LocationPage });

function LocationPage() {
  const locations = useStore((s) => s.locations);
  const plants = useStore((s) => s.plants);
  const slocs = useStore((s) => s.slocs);
  const [open, setOpen] = useState(false);
  const [plantOpen, setPlantOpen] = useState(false);
  const [slocOpen, setSlocOpen] = useState(false);
  const [zoneFilter, setZoneFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [importErrors, setImportErrors] = useState<BulkImportError[]>([]);
  const [errorsOpen, setErrorsOpen] = useState(false);
  const [form, setForm] = useState({
    locationCode: "",
    locationName: "",
    plantCode: "",
    slocCode: "",
    zone: "",
    aisle: "",
    tier: "",
    locationType: "STORAGE" as "RECEIVING" | "STORAGE" | "STAGING" | "DOCK",
    capacityPallet: 2,
    status: "Active" as "Active" | "Blocked",
  });
  const [plantForm, setPlantForm] = useState({
    plantCode: "",
    plantName: "",
    status: "Active" as "Active" | "Blocked",
  });
  const [slocForm, setSlocForm] = useState({
    plantCode: "",
    slocCode: "",
    slocName: "",
    status: "Active" as "Active" | "Blocked",
  });

  const zones = Array.from(new Set(locations.map((l) => l.zone)));
  const slocsByPlant = useMemo(
    () => slocs.filter((s) => s.plantCode === form.plantCode),
    [form.plantCode, slocs],
  );
  const deleteWithConfirm = (label: string, message: string, action: () => void) => {
    if (!confirm(message)) return;
    try {
      action();
      toast.success(`Đã xoá ${label}`);
    } catch (e: any) {
      toast.error(e.message);
    }
  };
  const filtered = locations.filter((l) =>
    (zoneFilter === "all" || l.zone === zoneFilter) &&
    (statusFilter === "all" || l.status === statusFilter),
  );

  useEffect(() => {
    if (!open) return;
    setForm((prev) => {
      const nextPlant = prev.plantCode || plants[0]?.plantCode || "";
      const eligibleSlocs = slocs.filter((s) => s.plantCode === nextPlant);
      const nextSloc = prev.slocCode && eligibleSlocs.some((s) => s.slocCode === prev.slocCode)
        ? prev.slocCode
        : eligibleSlocs[0]?.slocCode || "";
      return {
        ...prev,
        plantCode: nextPlant,
        slocCode: nextSloc,
      };
    });
  }, [open, plants, slocs]);

  useEffect(() => {
    if (!plantOpen) return;
    setPlantForm((prev) => ({
      ...prev,
      plantCode: prev.plantCode || plants[0]?.plantCode || "",
    }));
  }, [plantOpen, plants]);

  useEffect(() => {
    if (!slocOpen) return;
    setSlocForm((prev) => ({
      ...prev,
      plantCode: prev.plantCode || plants[0]?.plantCode || "",
    }));
  }, [plants, slocOpen]);

  const submit = () => {
    try {
      addLocation({
        ...form,
        locationName: form.locationName.trim() || undefined,
        plantCode: form.plantCode,
        slocCode: form.slocCode,
        block: form.aisle.trim() || "-",
        aisle: form.aisle.trim() || undefined,
        tier: form.tier.trim() || undefined,
      });
      toast.success("Đã thêm bin");
      setOpen(false);
      setForm({ locationCode: "", locationName: "", plantCode: "", slocCode: "", zone: "", aisle: "", tier: "", locationType: "STORAGE", capacityPallet: 2, status: "Active" });
    }
    catch (e: any) { toast.error(e.message); }
  };

  const submitPlant = () => {
    try {
      addPlant({
        plantCode: plantForm.plantCode,
        plantName: plantForm.plantName.trim() || undefined,
        status: plantForm.status,
      });
      toast.success("Đã thêm Plant");
      setPlantOpen(false);
      setPlantForm({ plantCode: "", plantName: "", status: "Active" });
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const submitSloc = () => {
    try {
      addSloc({
        plantCode: slocForm.plantCode,
        slocCode: slocForm.slocCode,
        slocName: slocForm.slocName.trim() || undefined,
        status: slocForm.status,
      });
      toast.success("Đã thêm Sloc");
      setSlocOpen(false);
      setSlocForm({ plantCode: "", slocCode: "", slocName: "", status: "Active" });
    } catch (e: any) {
      toast.error(e.message);
    }
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
                  ["binCode", "binName", "plantCode", "slocCode", "zone", "aisle", "tier", "block", "binType", "capacityPallet", "status"],
                  ["FZ-A-01-01", "Frozen Zone A - Aisle 01 - Tier 01", "PLANT-HCM", "HCM-COLD", "FZ-A", "01", "01", "01", "STORAGE", 10, "Active"],
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
                    <div>
                      <Label>Plant</Label>
                      <Select
                        value={form.plantCode}
                        onValueChange={(v) => {
                          const nextSloc = slocs.filter((s) => s.plantCode === v)[0]?.slocCode ?? "";
                          setForm({ ...form, plantCode: v, slocCode: nextSloc });
                        }}
                      >
                        <SelectTrigger><SelectValue placeholder="Chọn Plant" /></SelectTrigger>
                        <SelectContent>
                          {plants.map((p) => <SelectItem key={p.id} value={p.plantCode}>{p.plantCode} — {p.plantName ?? p.plantCode}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Sloc</Label>
                      <Select value={form.slocCode} onValueChange={(v) => setForm({ ...form, slocCode: v })}>
                        <SelectTrigger><SelectValue placeholder="Chọn Sloc" /></SelectTrigger>
                        <SelectContent>
                          {slocsByPlant.map((s) => <SelectItem key={s.id} value={s.slocCode}>{s.slocCode} — {s.slocName ?? s.slocCode}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
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

      <div className="grid gap-4 lg:grid-cols-2 mb-4">
        <Card className="rounded-2xl">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold">Plant Master</div>
                <div className="text-xs text-muted-foreground">{plants.length} plant</div>
              </div>
              <Dialog open={plantOpen} onOpenChange={setPlantOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline">Thêm Plant</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Thêm Plant</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-3">
                    <div><Label>Plant Code</Label><Input value={plantForm.plantCode} onChange={(e) => setPlantForm({ ...plantForm, plantCode: e.target.value })} /></div>
                    <div><Label>Plant Name</Label><Input value={plantForm.plantName} onChange={(e) => setPlantForm({ ...plantForm, plantName: e.target.value })} /></div>
                    <div>
                      <Label>Status</Label>
                      <Select value={plantForm.status} onValueChange={(v) => setPlantForm({ ...plantForm, status: v as any })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Active">Active</SelectItem>
                          <SelectItem value="Blocked">Blocked</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter><Button onClick={submitPlant}>Lưu</Button></DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
                  <div className="space-y-2 max-h-48 overflow-auto">
              {plants.map((p) => (
                <div key={p.id} className="rounded-xl border p-3 flex items-start justify-between gap-3">
                  <div>
                    <div className="font-mono text-sm">{p.plantCode}</div>
                    <div className="text-xs text-muted-foreground">{p.plantName ?? "—"}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-xs text-muted-foreground">{p.status}</div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 px-2 text-destructive hover:text-destructive"
                      onClick={() => deleteWithConfirm(
                        `Plant ${p.plantCode}`,
                        `Xoá Plant ${p.plantCode}? Chỉ xoá được khi chưa được Sloc/Bin sử dụng.`,
                        () => deletePlant(p.id),
                      )}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
              {plants.length === 0 && <div className="text-sm text-muted-foreground">Chưa có Plant</div>}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold">Sloc Master</div>
                <div className="text-xs text-muted-foreground">{slocs.length} sloc</div>
              </div>
              <Dialog open={slocOpen} onOpenChange={setSlocOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline">Thêm Sloc</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Thêm Sloc</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-3">
                    <div>
                      <Label>Plant</Label>
                      <Select value={slocForm.plantCode} onValueChange={(v) => setSlocForm({ ...slocForm, plantCode: v })}>
                        <SelectTrigger><SelectValue placeholder="Chọn Plant" /></SelectTrigger>
                        <SelectContent>
                          {plants.map((p) => <SelectItem key={p.id} value={p.plantCode}>{p.plantCode} — {p.plantName ?? p.plantCode}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div><Label>Sloc Code</Label><Input value={slocForm.slocCode} onChange={(e) => setSlocForm({ ...slocForm, slocCode: e.target.value })} /></div>
                    <div><Label>Sloc Name</Label><Input value={slocForm.slocName} onChange={(e) => setSlocForm({ ...slocForm, slocName: e.target.value })} /></div>
                    <div>
                      <Label>Status</Label>
                      <Select value={slocForm.status} onValueChange={(v) => setSlocForm({ ...slocForm, status: v as any })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Active">Active</SelectItem>
                          <SelectItem value="Blocked">Blocked</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter><Button onClick={submitSloc}>Lưu</Button></DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
            <div className="space-y-2 max-h-48 overflow-auto">
              {slocs.map((s) => (
                <div key={s.id} className="rounded-xl border p-3 flex items-start justify-between gap-3">
                  <div>
                    <div className="font-mono text-sm">{s.slocCode}</div>
                    <div className="text-xs text-muted-foreground">{s.slocName ?? "—"}</div>
                    <div className="text-[11px] text-muted-foreground">{s.plantCode}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-xs text-muted-foreground">{s.status}</div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 px-2 text-destructive hover:text-destructive"
                      onClick={() => deleteWithConfirm(
                        `Sloc ${s.slocCode}`,
                        `Xoá Sloc ${s.slocCode}? Chỉ xoá được khi chưa có Bin dùng Sloc này.`,
                        () => deleteSloc(s.id),
                      )}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
              {slocs.length === 0 && <div className="text-sm text-muted-foreground">Chưa có Sloc</div>}
            </div>
          </CardContent>
        </Card>
      </div>

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
              <TableHead>Bin</TableHead><TableHead>Plant</TableHead><TableHead>Sloc</TableHead><TableHead>Zone</TableHead>
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
                    <TableCell className="font-mono text-xs">{l.plantCode}</TableCell>
                    <TableCell className="font-mono text-xs">{l.slocCode}</TableCell>
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
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-destructive hover:text-destructive"
                          onClick={() => deleteWithConfirm(
                            `Bin ${l.locationCode}`,
                            `Xoá Bin ${l.locationCode}? Chỉ xoá được khi Bin không còn pallet và không được task sử dụng.`,
                            () => deleteLocation(l.id),
                          )}
                        >
                          <Trash2 className="mr-1 h-3.5 w-3.5" />
                          Delete
                        </Button>
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
