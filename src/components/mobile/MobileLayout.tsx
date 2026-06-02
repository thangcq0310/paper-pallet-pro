import type { ReactNode } from "react";
import { PwaInstallPrompt } from "./PwaInstallPrompt";
import { Button } from "@/components/ui/button";

export function MobileLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b bg-background/90 px-4 py-3 backdrop-blur no-print">
        <div className="mx-auto flex max-w-xl items-center justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Mini WMS</div>
            <div className="text-sm font-semibold">Mobile Scan</div>
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" className="h-8 rounded-full px-3 text-xs font-medium" onClick={() => window.location.assign("/")}>
              Desktop
            </Button>
            <Button type="button" className="h-8 rounded-full px-3 text-xs font-medium" onClick={() => window.location.assign("/mobile")}>
              Home
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-xl p-4 pb-28">{children}</main>
      <PwaInstallPrompt />
    </div>
  );
}
