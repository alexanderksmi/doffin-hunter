import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ProfileMenu } from "@/components/ProfileMenu";
import { RadarTab } from "@/components/radar/RadarTab";
import { MatchesTab } from "@/components/matches/MatchesTab";
import { MineLopTab } from "@/components/minelop/MineLopTab";
import { SearchSettingsDialog } from "@/components/matches/SearchSettingsDialog";
import { useAuth } from "@/contexts/AuthContext";
import { Settings } from "lucide-react";

const Dashboard = () => {
  const { userRole } = useAuth();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const isAdmin = userRole === "admin";

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-foreground">Anbudsmonitor</h1>
          <div className="flex items-center gap-4">
            {isAdmin && (
              <Button onClick={() => setSettingsOpen(true)} variant="outline">
                <Settings className="mr-2 h-4 w-4" />
                Innstillinger for søk
              </Button>
            )}
            <ProfileMenu />
          </div>
        </div>
      </header>

      <SearchSettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />

      <main className="container mx-auto px-4 py-8">
        <Tabs defaultValue="radar" className="w-full">
          <TabsList>
            <TabsTrigger value="radar">Radar</TabsTrigger>
            <TabsTrigger value="matches">Matches</TabsTrigger>
            <TabsTrigger value="mine-lop">Mine Løp</TabsTrigger>
          </TabsList>
          
          <TabsContent value="radar" className="mt-4">
            <RadarTab />
          </TabsContent>
          
          <TabsContent value="matches" className="mt-4">
            <MatchesTab />
          </TabsContent>
          
          <TabsContent value="mine-lop" className="mt-4">
            <MineLopTab />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Dashboard;
