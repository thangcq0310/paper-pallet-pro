import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useStore } from "@/services/store";
import { addSKU } from "@/services/masterService";
import { importSkusFromCsv, type BulkImportError } from "@/services/masterImportService";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/PageHeader";
import { toast } from "sonner";
import { FileDown, FileUp, Plus, Search } from "lucide-react";
import { downloadTextFile, toCsv } from "@/utils/csv";

export const Route = createFileRoute("/master/sku")({ component: SKUPage });

function SKUPage() {
  const skus = useStore((s) => s.skus);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<string>("all");
  const [form, setForm] = useState({ skuCode: "", skuName: "", uom: "Carton", weightPerUnit: 0, storageType: "Dry" });
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [importErrors, setImportErrors] = useState<BulkImportError[]>([]);
  const [errorsOpen, setErrorsOpen] = useState(false);

  const filtered = skus.filter((s) =>
    (filter === "all" || s.storageType === filter) &&
    (s.skuCode.toLowerCase().includes(search.toLowerCase()) || s.skuName.toLowerCase().includes(search.toLowerCase())),
  );

  const submit = () => {
    try {
      addSKU(form);
      toast.success("Đã thêm SKU");
      setOpen(false);
      setForm({ skuCode: "", skuName: "", uom: "Carton", weightPerUnit: 0, storageType: "Dry" });
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div>
      <PageHeader title="SKU Master" description="Danh mục mã hàng"
        action={
          <>
            <Button
              variant="outline"
              onClick={() => {
                const csv = toCsv([
                  ["skuCode", "skuName", "uom", "weightPerUnit", "storageType"],
                  ["MANGO-20KG", "Puree xoài 20kg", "Carton", 20, "Frozen"],
                ]);
                downloadTextFile("sku_template.csv", csv, "text/csv;charset=utf-8");
              }}
            >
              <FileDown className="h-4 w-4 mr-1" />
              Tải mẫu CSV
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
                  const res = importSkusFromCsv(text);
                  toast.success(`Import SKU: +${res.created} tạo mới, ${res.updated} cập nhật, ${res.skipped} lỗi`);
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
              <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" />Thêm SKU</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Thêm SKU mới</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div><Label>SKU Code</Label><Input value={form.skuCode} onChange={(e) => setForm({ ...form, skuCode: e.target.value })} /></div>
                  <div><Label>SKU Name</Label><Input value={form.skuName} onChange={(e) => setForm({ ...form, skuName: e.target.value })} /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>UOM</Label><Input value={form.uom} onChange={(e) => setForm({ ...form, uom: e.target.value })} /></div>
                    <div><Label>Weight/Unit</Label><Input type="number" value={form.weightPerUnit} onChange={(e) => setForm({ ...form, weightPerUnit: +e.target.value })} /></div>
                  </div>
                  <div><Label>Storage Type</Label>
                    <Select value={form.storageType} onValueChange={(v) => setForm({ ...form, storageType: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Dry">Dry</SelectItem>
                        <SelectItem value="Frozen">Frozen</SelectItem>
                        <SelectItem value="Chilled">Chilled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter><Button onClick={submit}>Lưu</Button></DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={errorsOpen} onOpenChange={setErrorsOpen}>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Lỗi import SKU</DialogTitle>
                </DialogHeader>
                <div className="flex justify-end">
                  <Button
                    variant="outline"
                    onClick={() => {
                      const csv = toCsv([["row", "message"], ...importErrors.map((x) => [x.row, x.message])]);
                      downloadTextFile("sku_import_errors.csv", csv, "text/csv;charset=utf-8");
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
            <div className="relative flex-1 max-w-sm">
              <Search className="h-4 w-4 absolute left-3 top-2.5 text-muted-foreground" />
              <Input placeholder="Tìm SKU..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Storage</SelectItem>
                <SelectItem value="Dry">Dry</SelectItem>
                <SelectItem value="Frozen">Frozen</SelectItem>
                <SelectItem value="Chilled">Chilled</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU Code</TableHead><TableHead>SKU Name</TableHead><TableHead>UOM</TableHead>
                <TableHead className="text-right">Weight/Unit</TableHead><TableHead>Storage</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-mono">{s.skuCode}</TableCell>
                  <TableCell>{s.skuName}</TableCell>
                  <TableCell>{s.uom}</TableCell>
                  <TableCell className="text-right">{s.weightPerUnit}</TableCell>
                  <TableCell>{s.storageType}</TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Không có dữ liệu</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
