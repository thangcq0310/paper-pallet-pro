import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useStore } from "@/services/store";
import { createPallets } from "@/services/palletService";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/PageHeader";
import { toast } from "sonner";
import { Printer } from "lucide-react";

export const Route = createFileRoute("/pallet/create")({ component: CreatePalletLabelPage });

function CreatePalletLabelPage() {
  const skus = useStore((s) => s.skus);
  const batches = useStore((s) => s.batches);
  const locations = useStore((s) => s.locations);
  const nav = useNavigate();

  const [form, setForm] = useState({
    inboundNo: "",
    receivingLocation: "",
    skuCode: "",
    batchNo: "",
    totalQty: 1,
    qtyPerPallet: 1,
    uom: "Carton",
    copies: 1,
    weightPerPallet: 0,
    mfgDate: "",
    expDate: "",
    note: "",
  });

  const sku = skus.find((s) => s.skuCode === form.skuCode);
  const autoWeight = sku ? sku.weightPerUnit * form.qtyPerPallet : 0;

  const availableBatches = useMemo(
    () => batches.filter((b) => b.skuCode === form.skuCode),
    [batches, form.skuCode],
  );

  const batch = availableBatches.find((b) => b.batchNo === form.batchNo);

  const availableReceivingLocations = useMemo(
    () => locations.filter((l) => l.locationType === "RECEIVING" && l.status === "Active" && l.currentPalletCount < l.capacityPallet),
    [locations]
  );

  const submit = () => {
    try {
      if (!form.receivingLocation) throw new Error("Vui lòng chọn Receiving Location");
      if (!form.skuCode) throw new Error("Vui lòng chọn SKU");
      if (!form.batchNo) throw new Error("Vui lòng chọn Batch");
      if (form.totalQty <= 0) throw new Error("Tổng số lượng phải > 0");
      if (form.qtyPerPallet <= 0) throw new Error("Số lượng/Pallet phải > 0");

      const inputs = [];
      let remaining = form.totalQty;
      
      while (remaining > 0) {
        const qty = Math.min(remaining, form.qtyPerPallet);
        const weight = form.weightPerPallet > 0 ? (form.weightPerPallet / form.qtyPerPallet) * qty : (sku ? sku.weightPerUnit * qty : 0);
        
        inputs.push({
          inboundNo: form.inboundNo || undefined,
          receivingLocation: form.receivingLocation,
          skuCode: form.skuCode,
          batchNo: form.batchNo,
          qty,
          uom: sku?.uom ?? form.uom,
          weight,
          mfgDate: form.mfgDate || batch?.mfgDate || "",
          expDate: form.expDate || batch?.expDate || "",
          note: form.note || undefined,
        });
        
        remaining -= qty;
      }

      const pallets = createPallets(inputs);

      toast.success(`Đã tạo ${pallets.length} pallet thành công`);

      if (pallets.length === 1) {
        nav({
          to: "/pallet/$palletId",
          params: { palletId: pallets[0].palletId },
          search: { copies: form.copies } as any,
        });
      } else {
        // If bulk, redirect to inventory
        nav({ to: "/inventory" });
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Tạo pallet thất bại");
    }
  };

  return (
    <div>
      <PageHeader
        title="Create Pallet Label"
        description="Tạo pallet và in nhiều bản sao nhãn giấy"
        action={
          <Button onClick={submit} disabled={!form.receivingLocation || !form.skuCode || !form.batchNo || form.totalQty <= 0}>
            <Printer className="h-4 w-4 mr-1" />
            Tạo Pallet & In nhãn
          </Button>
        }
      />

      <Card className="rounded-2xl max-w-3xl">
        <CardContent className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Label>Inbound Doc No (Tùy chọn)</Label>
              <Input
                value={form.inboundNo}
                onChange={(e) => setForm((f) => ({ ...f, inboundNo: e.target.value }))}
                placeholder="Ví dụ: PO-202605-001"
              />
            </div>
            
            <div>
              <Label>Receiving Location</Label>
              <Select
                value={form.receivingLocation}
                onValueChange={(v) => setForm((f) => ({ ...f, receivingLocation: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Chọn Location nhận" />
                </SelectTrigger>
                <SelectContent>
                  {availableReceivingLocations.map((l) => (
                    <SelectItem key={l.id} value={l.locationCode}>
                      {l.locationCode} {l.locationName ? `(${l.locationName})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>SKU</Label>
              <Select
                value={form.skuCode}
                onValueChange={(v) => setForm((f) => ({ ...f, skuCode: v, batchNo: "", mfgDate: "", expDate: "" }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Chọn SKU" />
                </SelectTrigger>
                <SelectContent>
                  {skus.map((s) => (
                    <SelectItem key={s.id} value={s.skuCode}>
                      {s.skuCode} - {s.skuName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Batch</Label>
              <Select
                value={form.batchNo}
                onValueChange={(v) => {
                  const b = availableBatches.find((x) => x.batchNo === v);
                  setForm((f) => ({ ...f, batchNo: v, mfgDate: b?.mfgDate ?? "", expDate: b?.expDate ?? "" }));
                }}
                disabled={!form.skuCode}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Chọn Batch" />
                </SelectTrigger>
                <SelectContent>
                  {availableBatches.map((b) => (
                    <SelectItem key={b.id} value={b.batchNo}>
                      {b.batchNo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Tổng số lượng</Label>
              <Input
                type="number"
                value={form.totalQty}
                onChange={(e) => setForm((f) => ({ ...f, totalQty: +e.target.value }))}
              />
            </div>

            <div>
              <Label>Số lượng / Pallet</Label>
              <Input
                type="number"
                value={form.qtyPerPallet}
                onChange={(e) => setForm((f) => ({ ...f, qtyPerPallet: +e.target.value }))}
              />
            </div>

            <div>
              <Label>UOM</Label>
              <Input value={sku?.uom ?? form.uom} disabled />
            </div>

            <div>
              <Label>
                Weight per Pallet (kg)
                {sku && <span className="text-xs text-muted-foreground ml-2">auto: {autoWeight}</span>}
              </Label>
              <Input
                type="number"
                value={form.weightPerPallet}
                onChange={(e) => setForm((f) => ({ ...f, weightPerPallet: +e.target.value }))}
                placeholder={String(autoWeight)}
              />
            </div>

            <div>
              <Label>MFG Date</Label>
              <Input
                type="date"
                value={form.mfgDate}
                onChange={(e) => setForm((f) => ({ ...f, mfgDate: e.target.value }))}
              />
            </div>

            <div>
              <Label>EXP Date</Label>
              <Input
                type="date"
                value={form.expDate}
                onChange={(e) => setForm((f) => ({ ...f, expDate: e.target.value }))}
              />
            </div>

            <div>
              <Label>Số bản in nhãn</Label>
              <Input
                type="number"
                min={1}
                max={20}
                value={form.copies}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    copies: Math.max(1, Math.min(20, +e.target.value)),
                  }))
                }
              />
              <p className="text-xs text-muted-foreground mt-1">Tối đa 20 bản</p>
            </div>
          </div>

          <div>
            <Label>Note</Label>
            <Textarea value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} />
          </div>

          <div className="flex justify-end">
            <Button onClick={submit} disabled={!form.receivingLocation || !form.skuCode || !form.batchNo || form.totalQty <= 0}>
              Tạo Pallet & In nhãn
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
