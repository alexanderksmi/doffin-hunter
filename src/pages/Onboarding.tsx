import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Plus, X } from "lucide-react";

type Partner = {
  name: string;
  domain: string;
};

type Suggestions = {
  minimumRequirements: string[];
  supportKeywords: { keyword: string; weight: number }[];
  negativeKeywords: { keyword: string; weight: number }[];
  cpvCodes: { code: string; weight: number }[];
};

const Onboarding = () => {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  // Step 1: Company info
  const [companyName, setCompanyName] = useState("");
  const [domain, setDomain] = useState("");
  const [industry, setIndustry] = useState("");

  // Step 2: Partners
  const [partners, setPartners] = useState<Partner[]>([]);
  const [newPartnerName, setNewPartnerName] = useState("");
  const [newPartnerDomain, setNewPartnerDomain] = useState("");

  // Step 3: AI suggestions
  const [companySuggestions, setCompanySuggestions] = useState<Suggestions | null>(null);
  const [partnerSuggestions, setPartnerSuggestions] = useState<Record<string, Suggestions>>({});

  const addPartner = () => {
    if (newPartnerName && newPartnerDomain) {
      setPartners([...partners, { name: newPartnerName, domain: newPartnerDomain }]);
      setNewPartnerName("");
      setNewPartnerDomain("");
    }
  };

  const removePartner = (index: number) => {
    setPartners(partners.filter((_, i) => i !== index));
  };

  const handleStep1Next = () => {
    if (!companyName || !domain || !industry) {
      toast({
        title: "Manglende informasjon",
        description: "Vennligst fyll ut alle feltene",
        variant: "destructive",
      });
      return;
    }
    setStep(2);
  };

  const handleStep2Next = async () => {
    setLoading(true);
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Create organization
      const { data: org, error: orgError } = await supabase
        .from("organizations")
        .insert({ name: companyName, domain })
        .select()
        .single();

      if (orgError) throw orgError;

      // Create user role
      const { error: roleError } = await supabase
        .from("user_roles")
        .insert({
          user_id: user.id,
          organization_id: org.id,
          role: "admin",
        });

      if (roleError) throw roleError;

      // Create company profile
      const { data: profile, error: profileError } = await supabase
        .from("company_profiles")
        .insert({
          organization_id: org.id,
          profile_name: companyName,
          is_own_profile: true,
        })
        .select()
        .single();

      if (profileError) throw profileError;

      // Save partners
      for (const partner of partners) {
        const { data: partnerData, error: partnerError } = await supabase
          .from("partners")
          .insert({
            organization_id: org.id,
            partner_name: partner.name,
            partner_domain: partner.domain,
          })
          .select()
          .single();

        if (partnerError) throw partnerError;

        await supabase
          .from("company_profiles")
          .insert({
            organization_id: org.id,
            profile_name: partner.name,
            is_own_profile: false,
            partner_id: partnerData.id,
          });
      }

      setStep(3);
    } catch (error) {
      console.error("Error saving company info:", error);
      toast({
        title: "Feil",
        description: "Kunne ikke lagre selskapsinformasjon",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const generateSuggestions = async () => {
    setLoading(true);
    try {
      // Generate suggestions for own company
      const { data: companyData, error: companyError } = await supabase.functions.invoke(
        "generate-profile-suggestions",
        {
          body: { companyName, domain, industry },
        }
      );

      if (companyError) throw companyError;
      setCompanySuggestions(companyData.suggestions);

      // Generate suggestions for partners
      const partnerSuggestionsTemp: Record<string, Suggestions> = {};
      for (const partner of partners) {
        const { data: partnerData, error: partnerError } = await supabase.functions.invoke(
          "generate-profile-suggestions",
          {
            body: {
              companyName: partner.name,
              domain: partner.domain,
              industry,
            },
          }
        );

        if (partnerError) {
          console.error(`Error generating suggestions for ${partner.name}:`, partnerError);
          continue;
        }

        partnerSuggestionsTemp[partner.name] = partnerData.suggestions;
      }

      setPartnerSuggestions(partnerSuggestionsTemp);

      toast({
        title: "AI-forslag generert",
        description: "Forslagene er klare for gjennomgang",
      });
    } catch (error) {
      console.error("Error generating suggestions:", error);
      toast({
        title: "Feil",
        description: "Kunne ikke generere AI-forslag",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const formatSuggestions = (suggestions: Suggestions) => {
    let text = "";
    
    if (suggestions.minimumRequirements?.length > 0) {
      text += `Minimumskrav: ${suggestions.minimumRequirements.join(", ")}\n\n`;
    }
    
    if (suggestions.supportKeywords?.length > 0) {
      text += `Støtteord: ${suggestions.supportKeywords.map(k => `${k.keyword} (vekt: ${k.weight})`).join(", ")}\n\n`;
    }
    
    if (suggestions.negativeKeywords?.length > 0) {
      text += `Negativord: ${suggestions.negativeKeywords.map(k => `${k.keyword} (vekt: ${k.weight})`).join(", ")}\n\n`;
    }
    
    if (suggestions.cpvCodes?.length > 0) {
      text += `CPV-koder: ${suggestions.cpvCodes.map(c => `${c.code} (vekt: ${c.weight})`).join(", ")}`;
    }
    
    return text;
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-8">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Velkommen til SjekkAnbud</CardTitle>
          <CardDescription>
            La oss sette opp systemet for deg - Steg {step} av 3
          </CardDescription>
        </CardHeader>
        <CardContent>
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="companyName">Firmanavn</Label>
                <Input
                  id="companyName"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Skriv inn firmanavn"
                />
              </div>
              <div>
                <Label htmlFor="domain">Domenenavn</Label>
                <Input
                  id="domain"
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  placeholder="eksempel.no"
                />
              </div>
              <div>
                <Label htmlFor="industry">Bransje</Label>
                <Select value={industry} onValueChange={setIndustry}>
                  <SelectTrigger>
                    <SelectValue placeholder="Velg bransje" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="offentlig-it">Offentlig IT</SelectItem>
                    <SelectItem value="bygg">Bygg</SelectItem>
                    <SelectItem value="energi">Energi</SelectItem>
                    <SelectItem value="helse">Helse</SelectItem>
                    <SelectItem value="annet">Annet</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleStep1Next} className="w-full">
                Neste
              </Button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Legg til partnere (valgfritt)</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Partner navn"
                    value={newPartnerName}
                    onChange={(e) => setNewPartnerName(e.target.value)}
                  />
                  <Input
                    placeholder="partner.no"
                    value={newPartnerDomain}
                    onChange={(e) => setNewPartnerDomain(e.target.value)}
                  />
                  <Button onClick={addPartner} size="icon" variant="outline">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {partners.length > 0 && (
                <div className="space-y-2">
                  <Label>Dine partnere:</Label>
                  {partners.map((partner, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-2 border rounded"
                    >
                      <span>
                        {partner.name} ({partner.domain})
                      </span>
                      <Button
                        onClick={() => removePartner(index)}
                        size="icon"
                        variant="ghost"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-2">
                <Button onClick={() => setStep(1)} variant="outline">
                  Tilbake
                </Button>
                <Button onClick={handleStep2Next} disabled={loading} className="flex-1">
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Lagrer...
                    </>
                  ) : (
                    "Fortsett til AI-forslag"
                  )}
                </Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              {!companySuggestions ? (
                <div className="text-center py-8">
                  <p className="mb-4 text-muted-foreground">
                    Klikk under for å generere AI-forslag basert på din bedriftsprofil
                  </p>
                  <Button onClick={generateSuggestions} disabled={loading}>
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Genererer forslag...
                      </>
                    ) : (
                      "Generer AI-forslag"
                    )}
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-4 border rounded-lg bg-card">
                    <h3 className="font-semibold mb-2">{companyName}</h3>
                    <pre className="whitespace-pre-wrap text-sm text-muted-foreground">
                      {formatSuggestions(companySuggestions)}
                    </pre>
                  </div>

                  {Object.entries(partnerSuggestions).map(([name, suggestions]) => (
                    <div key={name} className="p-4 border rounded-lg bg-card">
                      <h3 className="font-semibold mb-2">{name}</h3>
                      <pre className="whitespace-pre-wrap text-sm text-muted-foreground">
                        {formatSuggestions(suggestions)}
                      </pre>
                    </div>
                  ))}

                  <Button onClick={() => navigate("/")} className="w-full">
                    Fullfør oppsett
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Onboarding;
