import { Home, Search, FileText, Settings } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

const menuItems = [
  { title: "Radar", tab: "radar", icon: Home },
  { title: "Matches", tab: "matches", icon: Search },
  { title: "Mine Løp", tab: "minelop", icon: FileText },
  { title: "Innstillinger for søk", tab: "settings", icon: Settings, adminOnly: true },
];

export function AppSidebar() {
  const { open } = useSidebar();
  const [searchParams] = useSearchParams();
  const { userRole } = useAuth();
  const activeTab = searchParams.get("tab") || "radar";

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems
                .filter((item) => !item.adminOnly || userRole === "admin" || userRole === "editor")
                .map((item) => {
                  const isActive = activeTab === item.tab;
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild isActive={isActive}>
                        <Link
                          to={item.tab === "radar" ? "/" : `/?tab=${item.tab}`}
                          className={cn(
                            isActive && "bg-sidebar-accent text-sidebar-accent-foreground"
                          )}
                        >
                          <item.icon className="h-4 w-4" />
                          {open && <span>{item.title}</span>}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
