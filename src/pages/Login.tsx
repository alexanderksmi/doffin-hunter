import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Mail, Lock } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [mode, setMode] = useState<"login" | "signup">("login");
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email) {
      toast({
        title: "E-post mangler",
        description: "Vennligst skriv inn din e-postadresse",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const redirectUrl = `${window.location.origin}/`;
      
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: redirectUrl,
        },
      });

      if (error) throw error;

      setEmailSent(true);
      toast({
        title: "E-post sendt!",
        description: "Sjekk innboksen din for innloggingslenke",
      });
    } catch (error) {
      console.error("Login error:", error);
      toast({
        title: "Feil ved innlogging",
        description: error instanceof Error ? error.message : "Prøv igjen",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      toast({
        title: "Felter mangler",
        description: "Vennligst fyll inn e-post og passord",
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
          toast({
            title: "Konto opprettet!",
            description: "Logger inn...",
          });
          // Auto-confirm er aktivert, så brukeren er nå logget inn
          navigate("/");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          // Sjekk om brukeren eksisterer men har ikke passord (registrert med magic link)
          if (error.message.includes("Invalid login credentials")) {
            toast({
              title: "Feil pålogging",
              description: "Ugyldig e-post eller passord. Hvis du tidligere brukte innloggingslenke, vennligst opprett et passord først.",
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

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl">SjekkAnbud</CardTitle>
          <CardDescription>
            {emailSent
              ? "Vi har sendt deg en innloggingslenke"
              : "Logg inn eller opprett konto"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {emailSent ? (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                <Mail className="h-8 w-8 text-primary" />
              </div>
              <p className="text-sm text-muted-foreground">
                Sjekk innboksen din på <strong>{email}</strong> og klikk på lenken for å logge inn.
              </p>
              <Button
                variant="outline"
                onClick={() => {
                  setEmailSent(false);
                  setEmail("");
                }}
                className="w-full"
              >
                Bruk en annen e-postadresse
              </Button>
            </div>
          ) : (
            <Tabs defaultValue="password" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="password">Passord</TabsTrigger>
                <TabsTrigger value="magic">Magic Link</TabsTrigger>
              </TabsList>
              
              <TabsContent value="password" className="space-y-4">
                <form onSubmit={handlePasswordAuth} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="password-email">E-postadresse</Label>
                    <Input
                      id="password-email"
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
                
                <div className="text-center">
                  <Button
                    variant="link"
                    onClick={() => setMode(mode === "login" ? "signup" : "login")}
                    disabled={loading}
                  >
                    {mode === "login" 
                      ? "Har du ikke konto? Opprett en her"
                      : "Har du allerede konto? Logg inn her"}
                  </Button>
                </div>
              </TabsContent>
              
              <TabsContent value="magic">
                <form onSubmit={handleMagicLink} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="magic-email">E-postadresse</Label>
                    <Input
                      id="magic-email"
                      type="email"
                      placeholder="din@epost.no"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={loading}
                    />
                  </div>
                  
                  <Button type="submit" disabled={loading} className="w-full">
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Sender...
                      </>
                    ) : (
                      <>
                        <Mail className="mr-2 h-4 w-4" />
                        Send meg en innloggingslenke
                      </>
                    )}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;
