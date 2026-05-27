import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useStore } from "@/services/store";
import { addBatch } from "@/services/masterService";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/PageHeader";
import { toast } from "sonner";
import { Plus } from "lucide-react";

export const Route = createFileRoute("/master/batch")({ component: BatchPage });

function BatchPage() {
  const batches = useStore((s) => s.batches);
  const skus = useStore((s) => s.skus);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [skuFilter, setSkuFilter] = useState("all");
  const [form, setForm] = useState({ batchNo: "", skuCode: "", mfgDate: "", expDate: "" });

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
