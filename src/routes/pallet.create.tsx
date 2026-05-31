import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useStore } from "@/services/store";
import { createPallets } from "@/services/palletService";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/PageHeader";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { AlertCircle, Layers, Pencil, Plus, Trash2, Zap } from "lucide-react";

export const Route = createFileRoute("/pallet/create")({ component: CreatePalletLabelPage });

interface PreviewRow {
  rowId: string;
  qty: number;
  weight: number;
  type: "Full" | "Partial" | "Manual";
}

function CreatePalletLabelPage() {
  const skus = useStore((s) => s.skus);
  const batches = useStore((s) => s.batches);
  const locations = useStore((s) => s.locations);
  const nav = useNavigate();

  const [form, setForm] = useState({
    referenceDocumentNo: "",
    receivingLocation: "",
    skuCode: "",
    batchNo: "",
    totalQty: 0,
    qtyPerPallet: 0,
    mfgDate: "",
    expDate: "",
    note: "",
  });

  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [editQty, setEditQty] = useState(0);
  const [editWeight, setEditWeight] = useState(0);
  const [manualQty, setManualQty] = useState(0);
  const [generating, setGenerating] = useState(false);

  const sku = skus.find((s) => s.skuCode === form.skuCode);
  const batch = batches.find((b) => b.batchNo === form.batchNo && b.skuCode === form.skuCode);

  const availableBatches = useMemo(
    () => batches.filter((b) => b.skuCode === form.skuCode),
    [batches, form.skuCode],
  );

  const availableReceivingLocations = useMemo(
    () => locations.filter((l) => l.locationType === "RECEIVING" && l.status === "Active" && l.currentPalletCount < l.capacityPallet),
    [locations],
  );

  const calcWeight = (qty: number) => sku ? sku.weightPerUnit * qty : 0;

  // Calculate preview from totalQty / qtyPerPallet
  const buildPreview = () => {
    if (!form.skuCode || !form.batchNo) {
      toast.error("Vui lòng chọn SKU và Batch trước");
      return;
    }
    if (form.totalQty <= 0 || form.qtyPerPallet <= 0) {
      toast.error("Tổng số lượng và Số lượng/Pallet phải > 0");
      return;
    }

    const rows: PreviewRow[] = [];
    let remaining = form.totalQty;
    const fullCount = Math.floor(remaining / form.qtyPerPallet);

    for (let i = 0; i < fullCount; i++) {
      rows.push({
        rowId: `auto-full-${i}`,
        qty: form.qtyPerPallet,
        weight: calcWeight(form.qtyPerPallet),
        type: "Full",
      });
    }
    remaining -= fullCount * form.qtyPerPallet;
    if (remaining > 0) {
      rows.push({
        rowId: `auto-partial`,
        qty: remaining,
        weight: calcWeight(remaining),
        type: "Partial",
      });
    }

    setPreview(rows);
    toast.success(`Đã tạo preview ${rows.length} pallet`);
  };

  const addManualRow = () => {
    if (manualQty <= 0) {
      toast.error("Qty phải > 0");
      return;
    }
    setPreview((prev) => [
      ...prev,
      {
        rowId: `manual-${Date.now()}`,
        qty: manualQty,
        weight: calcWeight(manualQty),
        type: "Manual",
      },
    ]);
    setManualQty(0);
  };

  const removeRow = (rowId: string) => setPreview((prev) => prev.filter((r) => r.rowId !== rowId));

  const startEdit = (row: PreviewRow) => {
    setEditingRowId(row.rowId);
    setEditQty(row.qty);
    setEditWeight(row.weight);
  };

  const saveEdit = () => {
    if (editQty <= 0) { toast.error("Qty phải > 0"); return; }
    setPreview((prev) => prev.map((r) =>
      r.rowId === editingRowId ? { ...r, qty: editQty, weight: editWeight || calcWeight(editQty) } : r
    ));
    setEditingRowId(null);
  };

  const totalPreviewQty = preview.reduce((s, r) => s + r.qty, 0);
  const totalPreviewWeight = preview.reduce((s, r) => s + r.weight, 0);
  const overLimit = form.totalQty > 0 && totalPreviewQty > form.totalQty;

  const generatePallets = () => {
    try {
      if (!form.receivingLocation) throw new Error("Vui lòng chọn Receiving Location");
      if (!form.skuCode) throw new Error("Vui lòng chọn SKU");
      if (!form.batchNo) throw new Error("Vui lòng chọn Batch");
      if (preview.length === 0) throw new Error("Preview chưa có dòng nào. Hãy tính toán hoặc thêm thủ công.");
      if (overLimit) throw new Error(`Tổng Preview Qty (${totalPreviewQty}) vượt quá Total Qty (${form.totalQty})`);

      setGenerating(true);

      const inputs = preview.map((row) => ({
        referenceDocumentNo: form.referenceDocumentNo || undefined,
        receivingLocation: form.receivingLocation,
        skuCode: form.skuCode,
        batchNo: form.batchNo,
        qty: row.qty,
        uom: sku?.uom ?? "Unit",
        weight: row.weight,
        mfgDate: form.mfgDate || batch?.mfgDate || "",
        expDate: form.expDate || batch?.expDate || "",
        note: form.note || undefined,
      }));

      const pallets = createPallets(inputs);
      toast.success(`Đã tạo ${pallets.length} pallet thành công`);

      const ids = pallets.map((p) => p.palletId).join(",");
      nav({ to: "/pallet/print-batch", search: { ids } as any });
    } catch (e: any) {
      toast.error(e?.message ?? "Tạo pallet thất bại");
    } finally {
      setGenerating(false);
    }
  };

  const canGenerate = preview.length > 0 && !overLimit && !!form.receivingLocation && !!form.skuCode && !!form.batchNo;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Create Pallet"
        description="Tạo Pallet ID theo chứng từ nhập hoặc thủ công"
        action={
          <Button onClick={generatePallets} disabled={!canGenerate || generating}>
            <Layers className="h-4 w-4 mr-1" />
            {generating ? "Đang tạo..." : `Generate ${preview.length} Pallet ID`}
          </Button>
        }
      />

      {/* Step 1: Info */}
      <Card className="rounded-2xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Bước 1 — Thông tin chung</CardTitle>
        </CardHeader>
        <CardContent className="p-5 pt-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-3">
              <Label>Ref Doc No (Tùy chọn)</Label>
              <Input
                value={form.referenceDocumentNo}
                onChange={(e) => setForm((f) => ({ ...f, referenceDocumentNo: e.target.value }))}
                placeholder="Ví dụ: PO-202605-001"
              />
            </div>

            <div>
              <Label>Receiving Location <span className="text-destructive">*</span></Label>
              <Select
                value={form.receivingLocation}
                onValueChange={(v) => setForm((f) => ({ ...f, receivingLocation: v }))}
              >
                <SelectTrigger><SelectValue placeholder="Chọn Location nhận" /></SelectTrigger>
                <SelectContent>
                  {availableReceivingLocations.map((l) => (
                    <SelectItem key={l.id} value={l.locationCode}>
                      {l.locationCode} ({l.currentPalletCount}/{l.capacityPallet})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>SKU <span className="text-destructive">*</span></Label>
              <Select
                value={form.skuCode}
                onValueChange={(v) => setForm((f) => ({ ...f, skuCode: v, batchNo: "", mfgDate: "", expDate: "" }))}
              >
                <SelectTrigger><SelectValue placeholder="Chọn SKU" /></SelectTrigger>
                <SelectContent>
                  {skus.map((s) => (
                    <SelectItem key={s.id} value={s.skuCode}>{s.skuCode} - {s.skuName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Batch <span className="text-destructive">*</span></Label>
              <Select
                value={form.batchNo}
                onValueChange={(v) => {
                  const b = availableBatches.find((x) => x.batchNo === v);
                  setForm((f) => ({ ...f, batchNo: v, mfgDate: b?.mfgDate ?? "", expDate: b?.expDate ?? "" }));
                }}
                disabled={!form.skuCode}
              >
                <SelectTrigger><SelectValue placeholder="Chọn Batch" /></SelectTrigger>
                <SelectContent>
                  {availableBatches.map((b) => (
                    <SelectItem key={b.id} value={b.batchNo}>{b.batchNo}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>MFG Date</Label>
              <Input type="date" value={form.mfgDate} onChange={(e) => setForm((f) => ({ ...f, mfgDate: e.target.value }))} />
            </div>
            <div>
              <Label>EXP Date</Label>
              <Input type="date" value={form.expDate} onChange={(e) => setForm((f) => ({ ...f, expDate: e.target.value }))} />
            </div>

            <div className="lg:col-span-3">
              <Label>Note</Label>
              <Textarea value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} rows={2} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Step 2: Build Preview */}
      <Card className="rounded-2xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Bước 2 — Tạo Preview Pallet List</CardTitle>
        </CardHeader>
        <CardContent className="p-5 pt-0 space-y-4">
          {/* Auto-calculate section */}
          <div className="flex flex-wrap gap-3 items-end p-4 rounded-xl bg-muted/50 border">
            <div>
              <Label className="text-sm">Tổng số lượng (Total Qty)</Label>
              <Input
                type="number"
                className="w-36"
                min={0}
                value={form.totalQty || ""}
                onChange={(e) => setForm((f) => ({ ...f, totalQty: +e.target.value }))}
                placeholder="100"
              />
            </div>
            <div>
              <Label className="text-sm">Qty / Pallet</Label>
              <Input
                type="number"
                className="w-36"
                min={1}
                value={form.qtyPerPallet || ""}
                onChange={(e) => setForm((f) => ({ ...f, qtyPerPallet: +e.target.value }))}
                placeholder="30"
              />
            </div>
            <Button variant="secondary" onClick={buildPreview} disabled={form.totalQty <= 0 || form.qtyPerPallet <= 0}>
              <Zap className="h-4 w-4 mr-1" />
              Tính toán Preview
            </Button>
            {form.totalQty > 0 && form.qtyPerPallet > 0 && (
              <span className="text-sm text-muted-foreground self-end">
                → {Math.floor(form.totalQty / form.qtyPerPallet)} full + {form.totalQty % form.qtyPerPallet > 0 ? "1 partial" : "0 partial"}
              </span>
            )}
          </div>

          {/* Manual add section */}
          <div className="flex gap-3 items-end">
            <div>
              <Label className="text-sm">Thêm thủ công (Qty)</Label>
              <Input
                type="number"
                className="w-32"
                min={1}
                value={manualQty || ""}
                onChange={(e) => setManualQty(+e.target.value)}
                placeholder="Qty"
              />
            </div>
            <Button variant="outline" onClick={addManualRow} disabled={manualQty <= 0}>
              <Plus className="h-4 w-4 mr-1" />
              Add Row
            </Button>
          </div>

          {/* Over-limit warning */}
          {overLimit && (
            <div className="flex items-center gap-2 text-sm text-destructive p-3 rounded-lg bg-destructive/10">
              <AlertCircle className="h-4 w-4 shrink-0" />
              Preview Qty ({totalPreviewQty}) vượt quá Total Qty ({form.totalQty}). Vui lòng xóa bớt hoặc sửa.
            </div>
          )}

          {/* Preview table */}
          {preview.length > 0 ? (
            <div className="overflow-x-auto border rounded-xl">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">STT</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Weight (kg)</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.map((row, idx) => (
                    <TableRow key={row.rowId}>
                      <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                      <TableCell className="text-right font-mono">
                        {editingRowId === row.rowId ? (
                          <Input
                            type="number"
                            className="w-24 text-right inline-block"
                            value={editQty}
                            onChange={(e) => setEditQty(+e.target.value)}
                            min={1}
                          />
                        ) : row.qty}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {editingRowId === row.rowId ? (
                          <Input
                            type="number"
                            className="w-24 text-right inline-block"
                            value={editWeight}
                            onChange={(e) => setEditWeight(+e.target.value)}
                            min={0}
                          />
                        ) : row.weight.toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={row.type === "Full" ? "default" : row.type === "Partial" ? "secondary" : "outline"}>
                          {row.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {editingRowId === row.rowId ? (
                          <div className="flex gap-1 justify-end">
                            <Button size="sm" variant="default" onClick={saveEdit}>Save</Button>
                            <Button size="sm" variant="ghost" onClick={() => setEditingRowId(null)}>Cancel</Button>
                          </div>
                        ) : (
                          <div className="flex gap-1 justify-end">
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(row)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => removeRow(row.rowId)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className={`flex justify-between items-center px-4 py-3 border-t text-sm font-medium ${overLimit ? "text-destructive bg-destructive/5" : "text-foreground bg-muted/30"}`}>
                <span>Total Preview</span>
                <span className="font-mono">{totalPreviewQty} {sku?.uom ?? ""} · {totalPreviewWeight.toFixed(2)} kg · {preview.length} pallet</span>
              </div>
            </div>
          ) : (
            <div className="text-center py-10 text-muted-foreground border-2 border-dashed rounded-xl">
              Chưa có dòng nào. Dùng "Tính toán Preview" hoặc "Add Row" để thêm pallet.
            </div>
          )}

          {/* Generate button */}
          <div className="flex justify-end pt-2">
            <Button
              size="lg"
              onClick={generatePallets}
              disabled={!canGenerate || generating}
              className="gap-2"
            >
              <Layers className="h-4 w-4" />
              {generating ? "Đang tạo..." : `Generate ${preview.length} Pallet ID${preview.length !== 1 ? "s" : ""}`}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
