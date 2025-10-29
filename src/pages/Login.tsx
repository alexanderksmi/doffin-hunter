import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Lock, Mail } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [showConfirmation, setShowConfirmation] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const validateEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      toast({
        title: "Felter mangler",
        description: "Vennligst fyll inn e-post og passord",
        variant: "destructive",
      });
      return;
    }

    if (!validateEmail(email)) {
      toast({
        title: "Ugyldig e-post",
        description: "Vennligst skriv inn en gyldig e-postadresse",
        variant: "destructive",
      });
      return;
    }

    if (password.length < 6) {
      toast({
        title: "Passord for kort",
        description: "Passord må være minst 6 tegn",
        variant: "destructive",
      });
      return;
    }

    if (mode === "signup" && password !== confirmPassword) {
      toast({
        title: "Passordene stemmer ikke",
        description: "Pass på at begge passordfeltene er like",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      if (mode === "signup") {
        const redirectUrl = `${window.location.origin}/`;
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: redirectUrl,
          },
        });

        if (error) throw error;

        if (data.user) {
          setShowConfirmation(true);
          toast({
            title: "Konto opprettet!",
            description: "Sjekk e-posten din for å bekrefte kontoen",
          });
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          if (error.message.includes("Invalid login credentials")) {
            toast({
              title: "Feil pålogging",
              description: "Ugyldig e-post eller passord",
              variant: "destructive",
            });
          } else if (error.message.includes("Email not confirmed")) {
            toast({
              title: "E-post ikke bekreftet",
              description: "Vennligst bekreft e-posten din før du logger inn",
              variant: "destructive",
            });
          } else {
            throw error;
          }
          return;
        }

        toast({
          title: "Innlogget!",
          description: "Velkommen tilbake",
        });
        navigate("/");
      }
    } catch (error) {
      console.error("Auth error:", error);
      toast({
        title: mode === "signup" ? "Feil ved registrering" : "Feil ved innlogging",
        description: error instanceof Error ? error.message : "Prøv igjen",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (showConfirmation) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-3xl">Bekreft e-posten din</CardTitle>
            <CardDescription>
              Vi har sendt deg en bekreftelsesmail
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                <Mail className="h-8 w-8 text-primary" />
              </div>
              <p className="text-sm text-muted-foreground">
                Sjekk innboksen din på <strong>{email}</strong> og klikk på lenken for å bekrefte kontoen din.
              </p>
              <p className="text-xs text-muted-foreground">
                Etter at du har bekreftet e-posten din, kan du logge inn med brukernavn og passord.
              </p>
              <Button
                variant="outline"
                onClick={() => {
                  setShowConfirmation(false);
                  setMode("login");
                  setEmail("");
                  setPassword("");
                  setConfirmPassword("");
                }}
                className="w-full"
              >
                Tilbake til innlogging
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl">SjekkAnbud</CardTitle>
          <CardDescription>
            {mode === "login" ? "Logg inn på din konto" : "Opprett en ny konto"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAuth} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-postadresse</Label>
              <Input
                id="email"
                type="email"
                placeholder="din@epost.no"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                autoFocus
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password">Passord</Label>
              <Input
                id="password"
                type="password"
                placeholder="Minst 6 tegn"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
              />
            </div>
            
            {mode === "signup" && (
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Bekreft passord</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  placeholder="Gjenta passord"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={loading}
                />
              </div>
            )}
            
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {mode === "signup" ? "Oppretter konto..." : "Logger inn..."}
                </>
              ) : (
                <>
                  <Lock className="mr-2 h-4 w-4" />
                  {mode === "signup" ? "Opprett konto" : "Logg inn"}
                </>
              )}
            </Button>
          </form>
          
          <div className="text-center mt-4">
            <Button
              variant="link"
              onClick={() => {
                setMode(mode === "login" ? "signup" : "login");
                setConfirmPassword("");
              }}
              disabled={loading}
            >
              {mode === "login" 
                ? "Har du ikke konto? Opprett en her"
                : "Har du allerede konto? Logg inn her"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;
