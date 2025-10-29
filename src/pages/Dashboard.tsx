import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { TendersTable } from "@/components/TendersTable";
import { useToast } from "@/hooks/use-toast";
import { useKeywords } from "@/contexts/KeywordsContext";
import { useAuth } from "@/contexts/AuthContext";
import { ProfileMenu } from "@/components/ProfileMenu";

const Dashboard = () => {
  const { toast } = useToast();
  const { keywords } = useKeywords();
  const { organizationId } = useAuth();

  // Hjelpefunksjon for å hente anbud fra API
  const fetchTendersFromAPI = async () => {
    const { error } = await supabase.functions.invoke('fetch-doffin-tenders', {
      body: { keywords }
    });
    if (error) throw error;
  };

  // Auto-fetch ved første lasting (bakgrunn, ingen toast)
  useEffect(() => {
    const autoFetch = async () => {
      try {
        await fetchTendersFromAPI();
      } catch (error) {
        console.error('Auto-fetch error:', error);
        // Ikke vis feilmelding til bruker ved auto-fetch
      }
    };
    
    autoFetch();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleManualFetch = async () => {
    try {
      toast({
        title: "Henter anbud...",
        description: "Dette kan ta noen sekunder",
      });

      await fetchTendersFromAPI();

      toast({
        title: "Suksess",
        description: "Nye anbud blir lagt til automatisk",
      });
    } catch (error: any) {
      toast({
        title: "Feil",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleLogout = async () => {
    // Logout is now handled by ProfileMenu
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-foreground">Anbudsmonitor</h1>
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => window.location.href = "/keywords"}>
              Administrer Nøkkelord
            </Button>
            <Button variant="outline" onClick={handleManualFetch}>
              Hent Nå
            </Button>
            <ProfileMenu />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <TendersTable />
      </main>
    </div>
  );
};

export default Dashboard;
