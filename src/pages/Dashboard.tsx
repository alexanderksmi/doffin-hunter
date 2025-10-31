import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ProfileMenu } from "@/components/ProfileMenu";
import { RadarTab } from "@/components/radar/RadarTab";
import { MatchesTab } from "@/components/matches/MatchesTab";

const Dashboard = () => {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-foreground">Anbudsmonitor</h1>
          <div className="flex items-center gap-4">
            <ProfileMenu />
          </div>
        </div>
      </header>

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
            <div className="text-center py-8 text-muted-foreground">
              Mine Løp-tab kommer snart
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Dashboard;
