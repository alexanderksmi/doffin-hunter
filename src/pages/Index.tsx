import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center space-y-6 max-w-2xl px-4">
        <h1 className="text-5xl font-bold text-foreground">Tender Monitor</h1>
        <p className="text-xl text-muted-foreground">
          Automated tender tracking from Doffin with intelligent keyword-based scoring
        </p>
        <div className="flex gap-4 justify-center pt-4">
          <Button size="lg" onClick={() => navigate("/auth")}>
            Get Started
          </Button>
          <Button size="lg" variant="outline" onClick={() => navigate("/dashboard")}>
            Dashboard
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Index;
