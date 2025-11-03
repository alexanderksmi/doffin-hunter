import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { ProfileMenu } from "@/components/ProfileMenu";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { RadarTab } from "@/components/radar/RadarTab";
import { MatchesTab } from "@/components/matches/MatchesTab";
import { MineLopTab } from "@/components/minelop/MineLopTab";
import { SearchSettingsPage } from "@/components/matches/SearchSettingsPage";

const Dashboard = () => {
  const { userRole, organizationId } = useAuth();
  const [searchParams] = useSearchParams();
  const [organizationName, setOrganizationName] = useState<string>("");
  const isAdmin = userRole === "admin";

  const activeTab = searchParams.get("tab") || "radar";

  useEffect(() => {
    const fetchOrganization = async () => {
      if (!organizationId) return;
      
      const { data } = await supabase
        .from("organizations")
        .select("name")
        .eq("id", organizationId)
        .single();
      
      if (data) {
        setOrganizationName(data.name);
      }
    };

    fetchOrganization();
  }, [organizationId]);

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        
        <div className="flex-1 flex flex-col">
          <header className="h-16 border-b bg-card flex items-center justify-between px-6">
            <div className="flex items-center gap-4">
              <SidebarTrigger />
              <h1 className="text-xl font-bold text-foreground">
                Anbudsmonitor{organizationName && ` - ${organizationName}`}
              </h1>
            </div>
            <ProfileMenu />
          </header>

          <main className="flex-1 p-8">
            {activeTab === "radar" && <RadarTab />}
            {activeTab === "matches" && <MatchesTab />}
            {activeTab === "minelop" && <MineLopTab />}
            {activeTab === "settings" && isAdmin && <SearchSettingsPage />}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default Dashboard;
