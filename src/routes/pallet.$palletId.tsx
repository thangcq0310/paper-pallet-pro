import { createFileRoute, Link, useLocation } from '@tanstack/react-router';
import { useStore } from '@/services/store';
import { cancelPallet } from '@/services/palletService';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/PageHeader';
import { PalletStatusBadge } from '@/components/StatusBadges';
import { toast } from 'sonner';
import { Printer, XCircle } from 'lucide-react';

export const Route = createFileRoute('/pallet/$palletId')({ component: PalletLabelPreview });

function PalletLabelPreview() {
  const { palletId } = Route.useParams();
  const location = useLocation();
  const copies = parseInt(new URLSearchParams(location.search).get("copies") ?? "1", 10) || 1;
  const pallets = useStore((s) => s.pallets);
  const pallet = pallets.find((p) => p.palletId === palletId);

  if (!pallet) return (
    <div>
      <PageHeader title='Pallet Label' />
      <Card className='rounded-2xl'><CardContent className='p-6 text-muted-foreground'>Pallet khong ton tai. <Link to='/pallet/create' className='text-primary underline'>Tao moi</Link></CardContent></Card>
    </div>
  );

  const cancel = () => {
    if (confirm('Bạn có chắc muốn hủy pallet này? Thao tác này không thể hoàn tác.')) {
      try { 
        cancelPallet(pallet.palletId); 
        toast.success('Đã hủy pallet'); 
      }
      catch (e: any) { toast.error(e?.message ?? "Hủy thất bại"); }
    }
  };

  const LabelCard = ({ copyIdx }: { copyIdx?: number }) => (
    <Card className='rounded-2xl border-2 border-foreground print-label'>
      <CardContent className='p-8'>
        <div className='text-center pb-4 border-b-2 border-foreground'>
          <p className='text-xs uppercase tracking-widest'>PALLET LABEL {copyIdx !== undefined ? '(#' + (copyIdx + 1) + ')' : ''}</p>
          <h2 className='text-4xl font-bold mt-1 font-mono'>{pallet.palletId}</h2>
        </div>
        <div className='grid grid-cols-2 gap-y-4 gap-x-8 mt-6 text-lg'>
          <div className='col-span-2'><div className='text-xs text-muted-foreground uppercase'>Plant/Warehouse</div><div className='font-semibold'>Paper Pallet Pro Warehouse</div></div>
          <div><div className='text-xs text-muted-foreground uppercase'>Material / SKU</div><div className='font-semibold'>{pallet.skuCode}</div></div>
          <div><div className='text-xs text-muted-foreground uppercase'>Batch</div><div className='font-semibold'>{pallet.batchNo}</div></div>
          <div className='col-span-2'><div className='text-xs text-muted-foreground uppercase'>Material Description</div><div className='font-semibold text-xl'>{pallet.skuName}</div></div>
          <div><div className='text-xs text-muted-foreground uppercase'>Quantity</div><div className='text-2xl font-bold'>{pallet.qty} {pallet.uom}</div></div>
          <div><div className='text-xs text-muted-foreground uppercase'>Gross Weight</div><div className='text-2xl font-bold'>{pallet.weight} kg</div></div>
          <div><div className='text-xs text-muted-foreground uppercase'>MFG Date</div><div className='font-semibold'>{pallet.mfgDate}</div></div>
          <div><div className='text-xs text-muted-foreground uppercase'>EXP Date</div><div className='font-semibold'>{pallet.expDate}</div></div>
          <div><div className='text-xs text-muted-foreground uppercase'>Current Location</div><div className='font-semibold'>{pallet.currentLocation || "N/A"}</div></div>
          <div><div className='text-xs text-muted-foreground uppercase'>Created At / By</div><div className='font-semibold'>{pallet.createdAt.slice(0, 10)} / demo</div></div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div>
      <PageHeader title='Pallet Label Preview' description={pallet.palletId + (copies > 1 ? ' (x' + copies + ')' : '')}
        action={<>
          {pallet.status === "Pending Putaway" && (
            <Button variant='destructive' className='no-print' onClick={cancel}>
              <XCircle className='h-4 w-4 mr-1' />Cancel
            </Button>
          )}
          <Button variant='outline' className='no-print' onClick={() => window.print()}><Printer className='h-4 w-4 mr-1' />Print</Button>
        </>}
      />
      <div className='grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 print-area'>
        <div className='flex flex-col gap-6'>
          {Array.from({ length: copies }, (_, i) => <LabelCard key={i} copyIdx={copies > 1 ? i : undefined} />)}
        </div>
        <Card className='rounded-2xl h-fit no-print'>
          <CardContent className='p-5 space-y-3'>
            <div><div className='text-xs text-muted-foreground'>Status</div><PalletStatusBadge status={pallet.status} /></div>
            <div><div className='text-xs text-muted-foreground'>So ban in</div><div className='font-medium'>{copies}</div></div>
            {pallet.inboundNo && (
              <div className='text-sm'>
                <div className='text-xs text-muted-foreground'>Inbound Doc No</div>
                <div className='font-medium'>{pallet.inboundNo}</div>
              </div>
            )}
            <div className='text-sm'>
              <div className='text-xs text-muted-foreground'>Current Location</div>
              <div className='font-mono'>{pallet.currentLocation || "N/A"}</div>
            </div>
            {pallet.status === "Pending Putaway" && (
              <div className='pt-3 border-t text-xs text-muted-foreground'>
                Pallet đã sẵn sàng cho putaway.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
