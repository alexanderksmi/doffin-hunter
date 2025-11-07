import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Lock, Mail } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [emailSent, setEmailSent] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user, organizationId, loading: authLoading } = useAuth();

  // Redirect if already logged in with organization
  useEffect(() => {
    if (!authLoading && user && organizationId) {
      navigate("/");
    }
  }, [user, organizationId, authLoading, navigate]);

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
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
        title: "Passordene matcher ikke",
        description: "Passord og bekreft passord må være like",
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

        if (error) {
          // Handle duplicate email registration
          if (error.message.includes("already") || 
              error.message.includes("User already registered") ||
              error.status === 422) {
            toast({
              title: "E-posten er allerede registrert",
              description: "Denne e-postadressen er allerede i bruk. Vennligst logg inn i stedet.",
              variant: "destructive",
            });
            setMode("login");
            setPassword("");
            setConfirmPassword("");
            return;
          }
          throw error;
        }

        if (data.user) {
          setEmailSent(true);
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

  if (emailSent) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-3xl">Bekreft e-posten din</CardTitle>
            <CardDescription>
              Vi har sendt en bekreftelseslenke til din e-post
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                <Mail className="h-8 w-8 text-primary" />
              </div>
              <p className="text-sm text-muted-foreground">
                Vi har sendt en bekreftelseslenke til <strong>{email}</strong>. 
                Vennligst sjekk innboksen din og klikk på lenken for å aktivere kontoen din.
              </p>
              <p className="text-xs text-muted-foreground">
                Husk å sjekke spam-mappen hvis du ikke finner e-posten.
              </p>
              <Button
                variant="outline"
                onClick={() => {
                  setEmailSent(false);
                  setEmail("");
                  setPassword("");
                  setConfirmPassword("");
                  setMode("login");
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
            {mode === "signup" ? "Opprett ny konto" : "Logg inn på din konto"}
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
                required
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
                required
              />
            </div>
            
            {mode === "signup" && (
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Bekreft passord</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  placeholder="Skriv inn passord på nytt"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={loading}
                  required
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
                setPassword("");
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
