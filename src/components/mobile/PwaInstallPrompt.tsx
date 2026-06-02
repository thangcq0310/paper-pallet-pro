import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Download, X } from "lucide-react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform?: string }>;
};

const DISMISS_KEY = "paper-pallet-pro-pwa-install-dismissed-v1";

function isStandaloneMode() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function PwaInstallPrompt({ className }: { className?: string }) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [standalone, setStandalone] = useState(false);

  useEffect(() => {
    setStandalone(isStandaloneMode());
    if (typeof window === "undefined") return;
    setDismissed(window.localStorage.getItem(DISMISS_KEY) === "1");

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setDismissed(true);
      window.localStorage.setItem(DISMISS_KEY, "1");
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt as EventListener);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt as EventListener);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const visible = useMemo(() => !standalone && !dismissed, [dismissed, standalone]);

  if (!visible) return null;

  const close = () => {
    setDismissed(true);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(DISMISS_KEY, "1");
    }
  };

  const install = async () => {
    if (!deferredPrompt) {
      close();
      return;
    }
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === "accepted") {
      close();
      setDeferredPrompt(null);
      return;
    }
    close();
  };

  return (
    <div className={cn("fixed inset-x-0 bottom-4 z-30 px-4", className)}>
      <Card className="mx-auto w-full max-w-xl rounded-[1.5rem] border border-border/60 bg-background/95 shadow-2xl backdrop-blur">
        <CardContent className="space-y-3 p-4">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-primary/10 text-primary">
              <Download className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold">Cài app Paper Pallet Pro</div>
              <div className="text-xs text-muted-foreground">
                Thêm vào màn hình chính để mở như app và dùng nhanh hơn khi scan kho.
              </div>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={close}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="rounded-2xl bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
            {deferredPrompt ? (
              <span>Chrome/Android: bấm Cài ngay để thêm app vào màn hình chính.</span>
            ) : (
              <span>
                Nếu trình duyệt chưa hiện nút cài, dùng menu Share/Chrome menu và chọn Add to Home Screen.
              </span>
            )}
          </div>

          <div className="flex gap-2">
            <Button className="h-11 flex-1 rounded-2xl" onClick={install}>
              {deferredPrompt ? "Cài ngay" : "Đóng"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
