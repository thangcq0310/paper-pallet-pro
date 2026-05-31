import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, Package, Tags, MapPin, Tag,
  Boxes, Move, ArrowUpFromLine, ListChecks, History, Bell,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader,
} from "@/components/ui/sidebar";

const groups = [
  {
    label: "Tổng quan",
    items: [{ title: "Dashboard", url: "/", icon: LayoutDashboard }],
  },
  {
    label: "Master Data",
    items: [
      { title: "SKU", url: "/master/sku", icon: Package },
      { title: "Batch", url: "/master/batch", icon: Tags },
      { title: "Location", url: "/master/location", icon: MapPin },
    ],
  },
  {
    label: "Inbound",
    items: [
      { title: "Create Pallet Label", url: "/pallet/create", icon: Tag },
    ],
  },
  {
    label: "Tồn kho & Vận hành",
    items: [
      { title: "Inventory", url: "/inventory", icon: Boxes },
      { title: "Move Location", url: "/move", icon: Move },
      { title: "Outbound", url: "/outbound", icon: ArrowUpFromLine },
      { title: "Tasks", url: "/tasks", icon: ListChecks },
    ],
  },
  {
    label: "Theo dõi",
    items: [
      { title: "Movement History", url: "/movements", icon: History },
      { title: "Alerts", url: "/alerts", icon: Bell },
    ],
  },
];

export function AppSidebar() {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="px-4 py-4">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-xl bg-primary text-primary-foreground grid place-items-center font-bold">W</div>
          <div className="flex flex-col">
            <span className="font-semibold leading-tight">Mini WMS</span>
            <span className="text-xs text-muted-foreground">Manual Warehouse</span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        {groups.map((g) => (
          <SidebarGroup key={g.label}>
            <SidebarGroupLabel>{g.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {g.items.map((item) => {
                  const active = item.url === "/" ? pathname === "/" : pathname.startsWith(item.url);
                  return (
                    <SidebarMenuItem key={item.url}>
                      <SidebarMenuButton asChild isActive={active}>
                        <Link to={item.url} className="flex items-center gap-2">
                          <item.icon className="h-4 w-4" />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
    </Sidebar>
  );
}
