import { Link, Outlet, useLocation } from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";
import { Home, Monitor } from "lucide-react";

export function MobileLayout() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Mobile Header */}
      <header className="h-12 border-b bg-card/80 backdrop-blur sticky top-0 z-20 flex items-center px-3 gap-2">
        <Link to="/mobile" className="flex items-center gap-1.5 text-sm font-medium">
          <span className="text-base">📦</span>
          <span>Mini WMS Mobile</span>
        </Link>
        <div className="flex-1" />
        <Link
          to="/mobile"
          className="p-2 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground"
          title="Home"
        >
          <Home className="h-5 w-5" />
        </Link>
        <Link
          to="/"
          className="p-2 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground"
          title="Desktop"
        >
          <Monitor className="h-5 w-5" />
        </Link>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-4 max-w-lg mx-auto w-full">
        <Outlet />
      </main>

      <Toaster richColors position="top-center" />
    </div>
  );
}