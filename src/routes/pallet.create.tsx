import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState, useMemo } from 'react';
import { useStore } from '@/services/store';
import { createPalletLabel } from '@/services/palletService';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { PageHeader } from '@/components/PageHeader';
import { toast } from 'sonner';
import { Printer } from 'lucide-react';

export const Route = createFileRoute('/pallet/create')({ component: CreatePalletLabelPage });

function CreatePalletLabelPage() {
  const skus = useStore((s) => s.skus);
  const batches = useStore((s) => s.batches);
  const nav = useNavigate();
  const [form, setForm] = useState({ skuCode: '', batchNo: '', qty: 1, uom: 'Carton', copies: 1, weight: 0, mfgDate: '', expDate: '', note: '' });

  const sku = skus.find((s) => s.skuCode === form.skuCode);
  const availableBatches = useMemo(() => batches.filter((b) => b.skuCode === form.skuCode), [batches, form.skuCode]);
  const batch = batches.find((b) => b.batchNo === form.batchNo && b.skuCode === form.skuCode);

  const autoWeight = sku ? sku.weightPerUnit * form.qty : 0;

  const submit = () => {
    try {
      const final = {
        ...form,
        uom: sku?.uom ?? form.uom,
        weight: form.weight > 0 ? form.weight : autoWeight,
        mfgDate: form.mfgDate || batch?.mfgDate || '',
        expDate: form.expDate || batch?.expDate || '',
      };
      const p = createPalletLabel(final);
      toast.success(`Da tao nhan ${p.palletId}`);
      nav({ to: '/pallet/$palletId', params: { palletId: p.palletId }, to: '/pallet/$palletId?copies=' + form.copies, params: { palletId: p.palletId } });
    } catch (e) { toast.error(e.message); }
  };

  return (
    <div>
      <PageHeader title='Create Pallet Label' description='Tao pallet va in nhieu ban sao nhan giay' 
        action={<Button onClick={submit} disabled={!form.skuCode || !form.batchNo || form.qty <= 0}><Printer className='h-4 w-4 mr-1' />Tao Pallet & In nhan</Button>}
      />
      <Card className='rounded-2xl max-w-3xl'>
        <CardContent className='p-6 space-y-4'>
          <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
            <div><Label>SKU</Label>
              <Select value={form.skuCode} onValueChange={(v) => setForm({ ...form, skuCode: v, batchNo: '' })}>
                <SelectTrigger><SelectValue placeholder='Chon SKU' /></SelectTrigger>
                <SelectContent>{skus.map((s) => <SelectItem key={s.id} value={s.skuCode}>{s.skuCode} - {s.skuName}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Batch</Label>
              <Select value={form.batchNo} onValueChange={(v) => {
                const b = batches.find((x) => x.batchNo === v);
                setForm({ ...form, batchNo: v, mfgDate: b?.mfgDate ?? '', expDate: b?.expDate ?? '' });
              }} disabled={!form.skuCode}>
                <SelectTrigger><SelectValue placeholder='Chon Batch' /></SelectTrigger>
                <SelectContent>{availableBatches.map((b) => <SelectItem key={b.id} value={b.batchNo}>{b.batchNo}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Quantity</Label><Input type='number' value={form.qty} onChange={(e) => setForm({ ...form, qty: +e.target.value })} /></div>
            <div><Label>UOM</Label><Input value={sku?.uom ?? form.uom} disabled /></div>
            <div><Label>Weight (kg) {sku && <span className='text-xs text-muted-foreground'>auto: {autoWeight}</span>}</Label><Input type='number' value={form.weight} onChange={(e) => setForm({ ...form, weight: +e.target.value })} placeholder={String(autoWeight)} /></div>
            <div><Label>MFG Date</Label><Input type='date' value={form.mfgDate} onChange={(e) => setForm({ ...form, mfgDate: e.target.value })} /></div>
            <div><Label>EXP Date</Label><Input type='date' value={form.expDate} onChange={(e) => setForm({ ...form, expDate: e.target.value })} /></div>
            <div><Label>So ban in nhan</Label><Input type='number' min={1} max={20} value={form.copies} onChange={(e) => setForm({ ...form, copies: Math.max(1, Math.min(20, +e.target.value)) })} /><p className='text-xs text-muted-foreground mt-1'>Toi da 20 ban</p></div>
          </div>
          <div><Label>Note</Label><Textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></div>
          <div className='flex justify-end'><Button onClick={submit} disabled={!form.skuCode || !form.batchNo || form.qty <= 0}>Tao Pallet & In nhan</Button></div>
        </CardContent>
      </Card>
    </div>
  );
}