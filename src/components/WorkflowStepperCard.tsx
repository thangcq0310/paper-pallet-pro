import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function WorkflowStepperCard(props: {
  steps: string[];
  activeStepIndex: number;
}) {
  const { steps, activeStepIndex } = props;

  return (
    <Card className="rounded-2xl">
      <CardContent className="p-4">
        <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
          {steps.map((label, idx) => {
            const done = activeStepIndex > idx;
            const active = activeStepIndex === idx;
            return (
              <div
                key={label}
                className={cn(
                  "flex items-center gap-3 rounded-xl border px-3 py-2",
                  active ? "border-primary bg-primary/5" : done ? "border-emerald-500/40 bg-emerald-500/5" : "opacity-75",
                )}
              >
                <div
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold",
                    active ? "bg-primary text-primary-foreground" : done ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground",
                  )}
                >
                  {idx + 1}
                </div>
                <div>
                  <div className="text-sm font-medium">{label}</div>
                  <div className="text-xs text-muted-foreground">
                    {active ? "Đang làm" : done ? "Đã xong" : "Chưa tới"}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
