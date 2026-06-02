import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { PwaInstallPrompt } from "./PwaInstallPrompt";

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
            <Link to="/" className="rounded-full border px-3 py-2 text-xs font-medium">
              Desktop
            </Link>
            <Link to="/mobile" className="rounded-full bg-primary px-3 py-2 text-xs font-medium text-primary-foreground">
              Home
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-xl p-4 pb-28">{children}</main>
      <PwaInstallPrompt />
    </div>
  );
}
