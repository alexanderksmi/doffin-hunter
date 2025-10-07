import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { TendersTable } from "@/components/TendersTable";
import { useToast } from "@/hooks/use-toast";

const Dashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const isAuthenticated = sessionStorage.getItem("authenticated");
    if (!isAuthenticated) {
      navigate("/auth");
    }
  }, [navigate]);

  const handleManualFetch = async () => {
    try {
      toast({
        title: "Henter anbud...",
        description: "Dette kan ta noen sekunder",
      });

      const { error } = await supabase.functions.invoke('fetch-doffin-tenders');
      
      if (error) throw error;

      toast({
        title: "Suksess",
        description: "Anbud hentet",
      });
      
      window.location.reload();
    } catch (error: any) {
      toast({
        title: "Feil",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleClearDatabase = async () => {
    if (!confirm("Er du sikker på at du vil slette alle anbud fra databasen?")) {
      return;
    }

    try {
      toast({
        title: "Sletter anbud...",
        description: "Vennligst vent",
      });

      const { error } = await supabase
        .from('tenders')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

      if (error) throw error;

      toast({
        title: "Suksess",
        description: "All data slettet. Hent nye anbud nå.",
      });
      
      window.location.reload();
    } catch (error: any) {
      toast({
        title: "Feil",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem("authenticated");
    navigate("/auth");
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-foreground">Anbudsmonitor</h1>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate("/keywords")}>
              Administrer Nøkkelord
            </Button>
            <Button variant="destructive" onClick={handleClearDatabase}>
              Tøm Database
            </Button>
            <Button variant="outline" onClick={handleManualFetch}>
              Hent Nå
            </Button>
            <Button variant="outline" onClick={handleLogout}>
              Logg ut
            </Button>
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
