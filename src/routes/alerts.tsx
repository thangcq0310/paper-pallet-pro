import { createFileRoute } from "@tanstack/react-router";
import { useStore } from "@/services/store";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/PageHeader";
import { AlertTriangle, Clock, MapPin, Ban } from "lucide-react";

export const Route = createFileRoute("/alerts")({ component: AlertsPage });

function AlertsPage() {
  const pallets=useStore((s)=>s.pallets);
  const locations=useStore((s)=>s.locations);
  const tasks=useStore((s)=>s.tasks);
  const oneDay = 86400000;
  const sixtyDays = oneDay * 60;
  const now = Date.now();

  const waitingLabel = pallets.filter((p) => p.status === "Label Created" && now - new Date(p.createdAt).getTime() > oneDay);
  const waitingPutaway = pallets.filter((p) => p.status === "Labeled");
  const fullLocs = locations.filter((l) => l.capacityPallet < 9999 && l.currentPalletCount >= l.capacityPallet);
  const blockedLocs = locations.filter((l) => l.status === "Blocked");
  const nearExpiry = pallets.filter((p) => p.status !== "Shipped" && new Date(p.expDate).getTime() - now < sixtyDays);
  const overdueTasks = tasks.filter((t) => (t.status === "Open" || t.status === "In Progress") && now - new Date(t.createdAt).getTime() > oneDay);

  const sections = [
    { title: "Pallet chờ dán nhãn > 1 ngày", icon: Clock, color: "text-warning", items: waitingLabel.map((p) => `${p.palletId} — ${p.skuCode}`) },
    { title: "Pallet đã dán nhãn nhưng chưa Putaway", icon: AlertTriangle, color: "text-info", items: waitingPutaway.map((p) => `${p.palletId} — ${p.skuCode}`) },
    { title: "Location đầy", icon: MapPin, color: "text-destructive", items: fullLocs.map((l) => `${l.locationCode} (${l.currentPalletCount}/${l.capacityPallet})`) },
    { title: "Location bị block", icon: Ban, color: "text-destructive", items: blockedLocs.map((l) => l.locationCode) },
    { title: "Pallet gần hết hạn (< 60 ngày)", icon: Clock, color: "text-warning", items: nearExpiry.map((p) => `${p.palletId} — EXP ${p.expDate}`) },
    { title: "Task overdue > 1 ngày", icon: AlertTriangle, color: "text-destructive", items: overdueTasks.map((t) => `${t.taskNo} — ${t.taskType}`) },
  ];

  return (
    <div>
      <PageHeader title="Alerts" description="Cảnh báo vận hành kho" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {sections.map((s) => (
          <Card key={s.title} className="rounded-2xl">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <s.icon className={`h-5 w-5 ${s.color}`} />
                <h3 className="font-semibold">{s.title}</h3>
                <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-secondary">{s.items.length}</span>
              </div>
              {s.items.length === 0 ? (
                <p className="text-xs text-muted-foreground">Không có cảnh báo</p>
              ) : (
                <ul className="space-y-1 text-sm">{s.items.slice(0, 10).map((it, i) => <li key={i} className="font-mono text-xs">{it}</li>)}</ul>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
