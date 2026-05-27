import { Badge } from "@/components/ui/badge";
import type { PalletStatus, TaskStatus, LocationStatus } from "@/types";

const palletColor: Record<PalletStatus, string> = {
  "Label Created": "bg-muted text-foreground",
  "Labeled": "bg-info/15 text-info",
  "In Stock": "bg-success/15 text-success",
  "Staged": "bg-warning/20 text-warning-foreground",
  "Loaded": "bg-primary/15 text-primary",
  "Shipped": "bg-destructive/15 text-destructive",
};
export function PalletStatusBadge({ status }: { status: PalletStatus }) {
  return <Badge variant="outline" className={`${palletColor[status]} border-0 font-medium`}>{status}</Badge>;
}

const taskColor: Record<TaskStatus, string> = {
  "Open": "bg-info/15 text-info",
  "In Progress": "bg-warning/20 text-warning-foreground",
  "Confirmed": "bg-success/15 text-success",
  "Cancelled": "bg-muted text-muted-foreground",
};
export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  return <Badge variant="outline" className={`${taskColor[status]} border-0 font-medium`}>{status}</Badge>;
}

export function LocationStatusBadge({ status, full }: { status: LocationStatus; full?: boolean }) {
  if (full) return <Badge className="bg-destructive/15 text-destructive border-0">Full</Badge>;
  return status === "Active"
    ? <Badge className="bg-success/15 text-success border-0">Active</Badge>
    : <Badge className="bg-destructive/15 text-destructive border-0">Blocked</Badge>;
}
