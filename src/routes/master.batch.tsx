import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useStore } from "@/services/store";
import { addBatch } from "@/services/masterService";
import { importBatchesFromCsv, type BulkImportError } from "@/services/masterImportService";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/PageHeader";
import { toast } from "sonner";
import { FileDown, FileUp, Plus } from "lucide-react";
import { downloadTextFile, toCsv } from "@/utils/csv";

export const Route = createFileRoute("/master/batch")({ component: BatchPage });

function BatchPage() {
  const batches = useStore((s) => s.batches);
  const skus = useStore((s) => s.skus);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [skuFilter, setSkuFilter] = useState("all");
  const [form, setForm] = useState({ batchNo: "", skuCode: "", mfgDate: "", expDate: "" });
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [importErrors, setImportErrors] = useState<BulkImportError[]>([]);
  const [errorsOpen, setErrorsOpen] = useState(false);

  const filtered = batches.filter((b) =>
    (skuFilter === "all" || b.skuCode === skuFilter) &&
    b.batchNo.toLowerCase().includes(search.toLowerCase()),
  );

  const submit = () => {
    try {
      addBatch(form);
      toast.success("Đã thêm Batch");
      setOpen(false);
      setForm({ batchNo: "", skuCode: "", mfgDate: "", expDate: "" });
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div>
      <PageHeader title="Batch Master" description="Quản lý lô sản xuất"
        action={
          <>
            <Button
              variant="outline"
              onClick={() => {
                const csv = toCsv([
                  ["batchNo", "skuCode", "mfgDate", "expDate"],
                  ["LOT260527-A", "MANGO-20KG", "2026-05-27", "2028-05-27"],
                ]);
                downloadTextFile("batch_template.csv", csv, "text/csv;charset=utf-8");
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
                  const res = importBatchesFromCsv(text);
                  toast.success(`Import Batch: +${res.created} tạo mới, ${res.updated} cập nhật, ${res.skipped} lỗi`);
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
              <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" />Thêm Batch</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Thêm Batch</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div><Label>Batch No</Label><Input value={form.batchNo} onChange={(e) => setForm({ ...form, batchNo: e.target.value })} /></div>
                  <div><Label>SKU</Label>
                    <Select value={form.skuCode} onValueChange={(v) => setForm({ ...form, skuCode: v })}>
                      <SelectTrigger><SelectValue placeholder="Chọn SKU" /></SelectTrigger>
                      <SelectContent>{skus.map((s) => <SelectItem key={s.id} value={s.skuCode}>{s.skuCode} — {s.skuName}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>MFG Date</Label><Input type="date" value={form.mfgDate} onChange={(e) => setForm({ ...form, mfgDate: e.target.value })} /></div>
                    <div><Label>EXP Date</Label><Input type="date" value={form.expDate} onChange={(e) => setForm({ ...form, expDate: e.target.value })} /></div>
                  </div>
                </div>
                <DialogFooter><Button onClick={submit}>Lưu</Button></DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={errorsOpen} onOpenChange={setErrorsOpen}>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Lỗi import Batch</DialogTitle>
                </DialogHeader>
                <div className="flex justify-end">
                  <Button
                    variant="outline"
                    onClick={() => {
                      const csv = toCsv([["row", "message"], ...importErrors.map((x) => [x.row, x.message])]);
                      downloadTextFile("batch_import_errors.csv", csv, "text/csv;charset=utf-8");
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
            <Input placeholder="Tìm Batch No..." className="max-w-sm" value={search} onChange={(e) => setSearch(e.target.value)} />
            <Select value={skuFilter} onValueChange={setSkuFilter}>
              <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All SKU</SelectItem>
                {skus.map((s) => <SelectItem key={s.id} value={s.skuCode}>{s.skuCode}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Table>
            <TableHeader><TableRow><TableHead>Batch No</TableHead><TableHead>SKU</TableHead><TableHead>MFG Date</TableHead><TableHead>EXP Date</TableHead></TableRow></TableHeader>
            <TableBody>
              {filtered.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="font-mono">{b.batchNo}</TableCell>
                  <TableCell>{b.skuCode}</TableCell>
                  <TableCell>{b.mfgDate}</TableCell>
                  <TableCell>{b.expDate}</TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">Không có dữ liệu</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
