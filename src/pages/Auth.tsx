import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

const Auth = () => {
  const [password, setPassword] = useState("");
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password === "documaster") {
      sessionStorage.setItem("authenticated", "true");
      navigate("/");
    } else {
      toast({
        title: "Feil passord",
        description: "Prøv igjen",
        variant: "destructive",
      });
      setPassword("");
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="bg-card border rounded-lg p-8 shadow-lg">
          <h1 className="text-3xl font-bold text-foreground mb-2 text-center">
            Anbudsmonitor
          </h1>
          <p className="text-muted-foreground mb-8 text-center">
            Skriv inn passord for å få tilgang
          </p>
          
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <Input
                type="password"
                placeholder="Passord"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full"
                autoFocus
              />
            </div>
            
            <Button type="submit" className="w-full">
              Logg inn
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Auth;
