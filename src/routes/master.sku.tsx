import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useStore } from "@/services/store";
import { addSKU } from "@/services/masterService";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/PageHeader";
import { toast } from "sonner";
import { Plus, Search } from "lucide-react";

export const Route = createFileRoute("/master/sku")({ component: SKUPage });

function SKUPage() {
  const skus = useStore((s) => s.skus);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<string>("all");
  const [form, setForm] = useState({ skuCode: "", skuName: "", uom: "Carton", weightPerUnit: 0, storageType: "Dry" });

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
