import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function CreatedTaskBanner(props: {
  label: string;
  taskNo: string;
  status: string;
  taskType: string;
  onPrint: () => void;
}) {
  const { label, taskNo, status, taskType, onPrint } = props;

  return (
    <Card className="rounded-2xl border-primary/40 bg-primary/5">
      <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <div className="text-xs uppercase text-muted-foreground">{label}</div>
          <div className="font-mono text-sm font-semibold">{taskNo}</div>
          <div className="text-sm text-muted-foreground">{status} • {taskType}</div>
        </div>
        <Button variant="outline" onClick={onPrint}>
          Print
        </Button>
      </CardContent>
    </Card>
  );
}
