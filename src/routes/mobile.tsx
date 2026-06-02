import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/mobile")({
  component: MobileLayout,
});

function MobileLayout() {
  return <Outlet />;
}
