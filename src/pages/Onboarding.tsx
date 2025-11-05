import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Plus, X, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";

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

type ProfileWithSuggestions = {
  profileName: string;
  profileId?: string;
  isOwnProfile: boolean;
  suggestions: Suggestions;
};

const Onboarding = () => {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { organizationId: existingOrgId } = useAuth();

  // Redirect to dashboard if user already has an organization
  useEffect(() => {
    if (existingOrgId) {
      navigate("/");
    }
  }, [existingOrgId, navigate]);

  // Step 1: Company info
  const [companyName, setCompanyName] = useState("");
  const [domain, setDomain] = useState("");
  const [industry, setIndustry] = useState("");

  // Step 2: Partners
  const [partners, setPartners] = useState<Partner[]>([]);
  const [newPartnerName, setNewPartnerName] = useState("");
  const [newPartnerDomain, setNewPartnerDomain] = useState("");

  // Step 3 & 4: AI suggestions and editing
  const [allProfiles, setAllProfiles] = useState<ProfileWithSuggestions[]>([]);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [editingProfile, setEditingProfile] = useState<string | null>(null);
  const [joinedExistingOrg, setJoinedExistingOrg] = useState(false);
  const [existingOrgName, setExistingOrgName] = useState<string>("");

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
      let orgId = organizationId;

      // If user doesn't have an organization yet, create one via secure RPC
      if (!orgId) {
        // First check if user already has an org (from a previous incomplete onboarding)
        const { data: existingRole } = await supabase
          .from("user_roles")
          .select("organization_id, organizations(name)")
          .eq("user_id", (await supabase.auth.getUser()).data.user?.id)
          .maybeSingle();

        if (existingRole?.organization_id) {
          orgId = existingRole.organization_id;
          setOrganizationId(existingRole.organization_id);
          
          // Check if this org already has profiles set up
          const { data: existingProfiles } = await supabase
            .from("company_profiles")
            .select("id")
            .eq("organization_id", existingRole.organization_id)
            .limit(1);

          // If organization has profiles, user joined an existing org
          if (existingProfiles && existingProfiles.length > 0) {
            setJoinedExistingOrg(true);
            setExistingOrgName((existingRole as any).organizations?.name || "organisasjonen");
            
            toast({
              title: "Velkommen!",
              description: `Du er nå koblet til ${(existingRole as any).organizations?.name || "organisasjonen"}`,
            });
            
            // Navigate to dashboard after a short delay
            setTimeout(() => {
              window.location.href = "/";
            }, 2000);
            return;
          }
        } else {
          const { data: newOrgId, error: rpcError } = await supabase.rpc(
            "create_org_for_user",
            {
              org_name: companyName,
              org_domain: domain,
            }
          );

          if (rpcError) {
            console.error("Error creating organization:", rpcError);
            throw new Error(`Kunne ikke opprette organisasjon: ${rpcError.message}`);
          }

          orgId = newOrgId;
          setOrganizationId(newOrgId);
          
          // Check if we joined an existing org (viewer role)
          const { data: userRole } = await supabase
            .from("user_roles")
            .select("role, organizations(name)")
            .eq("user_id", (await supabase.auth.getUser()).data.user?.id)
            .eq("organization_id", newOrgId)
            .single();

          if (userRole?.role === "viewer") {
            setJoinedExistingOrg(true);
            setExistingOrgName((userRole as any).organizations?.name || "organisasjonen");
            
            toast({
              title: "Velkommen!",
              description: `Du er nå koblet til ${(userRole as any).organizations?.name || "organisasjonen"}`,
            });
            
            setTimeout(() => {
              window.location.href = "/";
            }, 2000);
            return;
          }
        }
      }

      // Create company profile for own company
      const { data: profile, error: profileError } = await supabase
        .from("company_profiles")
        .insert({
          organization_id: orgId,
          profile_name: companyName,
          is_own_profile: true,
        })
        .select()
        .single();

      if (profileError) {
        console.error("Error creating company profile:", profileError);
        throw new Error(`Kunne ikke opprette firmaprofil: ${profileError.message}`);
      }

      // Save partner profiles
      const partnerProfiles = [];
      for (const partner of partners) {
        const { data: partnerData, error: partnerError } = await supabase
          .from("partners")
          .insert({
            organization_id: orgId,
            partner_name: partner.name,
            partner_domain: partner.domain,
          })
          .select()
          .single();

        if (partnerError) {
          console.error(`Error creating partner ${partner.name}:`, partnerError);
          throw new Error(`Kunne ikke opprette partner ${partner.name}: ${partnerError.message}`);
        }

        const { data: partnerProfile, error: partnerProfileError } = await supabase
          .from("company_profiles")
          .insert({
            organization_id: orgId,
            profile_name: partner.name,
            is_own_profile: false,
            partner_id: partnerData.id,
          })
          .select()
          .single();

        if (partnerProfileError) {
          console.error(`Error creating profile for partner ${partner.name}:`, partnerProfileError);
          throw new Error(`Kunne ikke opprette profil for partner ${partner.name}: ${partnerProfileError.message}`);
        }
        
        partnerProfiles.push(partnerProfile);
      }

      setStep(3);
    } catch (error: any) {
      console.error("Error in onboarding step 2:", error);
      toast({
        title: "Feil",
        description: error.message || "Kunne ikke lagre selskapsinformasjon",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const generateSuggestions = async () => {
    setLoading(true);
    try {
      // Get all profiles from database
      const { data: profiles, error: profilesError } = await supabase
        .from("company_profiles")
        .select("*")
        .eq("organization_id", organizationId);

      if (profilesError) throw profilesError;

      const profilesWithSuggestions: ProfileWithSuggestions[] = [];

      // Generate suggestions for own company
      const ownProfile = profiles.find((p) => p.is_own_profile);
      if (ownProfile) {
        const { data: companyData, error: companyError } = await supabase.functions.invoke(
          "generate-profile-suggestions",
          {
            body: { companyName, domain, industry },
          }
        );

        if (companyError) throw companyError;
        profilesWithSuggestions.push({
          profileName: companyName,
          profileId: ownProfile.id,
          isOwnProfile: true,
          suggestions: companyData.suggestions,
        });
      }

      // Generate suggestions for partners
      const partnerProfiles = profiles.filter((p) => !p.is_own_profile);
      for (const profile of partnerProfiles) {
        const partner = partners.find((p) => p.name === profile.profile_name);
        if (!partner) continue;

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

        profilesWithSuggestions.push({
          profileName: partner.name,
          profileId: profile.id,
          isOwnProfile: false,
          suggestions: partnerData.suggestions,
        });
      }

      setAllProfiles(profilesWithSuggestions);
      setStep(4);

      toast({
        title: "AI-forslag generert",
        description: "Nå kan du godkjenne eller endre forslagene",
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

  const updateProfileSuggestion = (
    profileName: string,
    field: keyof Suggestions,
    value: any
  ) => {
    setAllProfiles((prev) =>
      prev.map((p) =>
        p.profileName === profileName
          ? { ...p, suggestions: { ...p.suggestions, [field]: value } }
          : p
      )
    );
  };

  const removeKeyword = (profileName: string, field: keyof Suggestions, index: number) => {
    const profile = allProfiles.find((p) => p.profileName === profileName);
    if (!profile) return;

    const updated = [...(profile.suggestions[field] as any[])];
    updated.splice(index, 1);
    updateProfileSuggestion(profileName, field, updated);
  };

  const addKeyword = (profileName: string, field: keyof Suggestions, value: any) => {
    const profile = allProfiles.find((p) => p.profileName === profileName);
    if (!profile) return;

    const updated = [...(profile.suggestions[field] as any[]), value];
    updateProfileSuggestion(profileName, field, updated);
  };

  const finalizeOnboarding = async () => {
    setLoading(true);
    try {
      // Save all keywords and CPV codes for each profile
      for (const profile of allProfiles) {
        if (!profile.profileId) continue;

        // Save minimum requirements
        for (const keyword of profile.suggestions.minimumRequirements) {
          await supabase.from("minimum_requirements").insert({
            profile_id: profile.profileId,
            keyword,
          });
        }

        // Save support keywords
        for (const kw of profile.suggestions.supportKeywords) {
          await supabase.from("support_keywords").insert({
            profile_id: profile.profileId,
            keyword: kw.keyword,
            weight: kw.weight,
          });
        }

        // Save negative keywords
        for (const kw of profile.suggestions.negativeKeywords) {
          await supabase.from("negative_keywords").insert({
            profile_id: profile.profileId,
            keyword: kw.keyword,
            weight: kw.weight,
          });
        }

        // Save CPV codes
        for (const cpv of profile.suggestions.cpvCodes) {
          await supabase.from("cpv_codes").insert({
            profile_id: profile.profileId,
            cpv_code: cpv.code,
            weight: cpv.weight,
          });
        }
      }

      // Generate partner graph combinations
      const ownProfile = allProfiles.find((p) => p.isOwnProfile);
      const partnerProfiles = allProfiles.filter((p) => !p.isOwnProfile);

      if (ownProfile?.profileId) {
        // Solo combination
        await supabase.from("partner_graph").insert({
          organization_id: organizationId,
          combination_type: "solo",
          lead_profile_id: ownProfile.profileId,
        });

        // Lead + Partner combinations
        for (const partner of partnerProfiles) {
          if (!partner.profileId) continue;

          await supabase.from("partner_graph").insert({
            organization_id: organizationId,
            combination_type: "lead_partner",
            lead_profile_id: ownProfile.profileId,
            partner_profile_id: partner.profileId,
          });

          // Partner-led combinations
          await supabase.from("partner_graph").insert({
            organization_id: organizationId,
            combination_type: "partner_led",
            lead_profile_id: partner.profileId,
            partner_profile_id: ownProfile.profileId,
          });
        }
      }

      // Trigger initial tender sync for the new organization
      console.log('Triggering initial tender sync for new organization...');
      await supabase.functions.invoke('fetch-doffin-tenders', {
        body: { organizationId }
      });

      toast({
        title: "Oppsettet er fullført!",
        description: "Henter relevante anbud... Tar deg til dashboardet.",
      });

      // Reload to ensure AuthContext picks up the new organization
      setTimeout(() => {
        window.location.href = "/";
      }, 2000);
    } catch (error) {
      console.error("Error finalizing onboarding:", error);
      toast({
        title: "Feil",
        description: "Kunne ikke fullføre oppsettet",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (joinedExistingOrg) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4 py-8">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CardTitle>Velkommen til {existingOrgName}!</CardTitle>
            <CardDescription>
              Du er nå koblet til ditt selskaps miljø
            </CardDescription>
          </CardHeader>
          <CardContent className="py-8">
            <div className="flex justify-center mb-4">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
            <p className="text-muted-foreground">
              Tar deg til dashboardet...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-8">
      <Card className="w-full max-w-4xl">
        <CardHeader>
          <CardTitle>Velkommen til SjekkAnbud</CardTitle>
          <CardDescription>
            La oss sette opp systemet for deg - Steg {step} av 4
          </CardDescription>
          {step >= 3 && (
            <div className="mt-4 p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">
                <strong>Viktig:</strong> Minimumskrav er harde dørvakter – anbud uten disse blir ikke vist. 
                Støtteord øker relevans, negativord senker den.
              </p>
            </div>
          )}
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
          )}

          {step === 4 && (
            <div className="space-y-6">
              {allProfiles.map((profile) => (
                <div key={profile.profileName} className="border rounded-lg p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-lg">{profile.profileName}</h3>
                    {profile.isOwnProfile && (
                      <Badge variant="secondary">Eget selskap</Badge>
                    )}
                  </div>

                  {/* Minimum Requirements */}
                  <div>
                    <Label className="text-sm font-medium">Minimumskrav</Label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {profile.suggestions.minimumRequirements.map((req, idx) => (
                        <Badge key={idx} variant="destructive" className="gap-1">
                          {req}
                          <X
                            className="h-3 w-3 cursor-pointer"
                            onClick={() =>
                              removeKeyword(profile.profileName, "minimumRequirements", idx)
                            }
                          />
                        </Badge>
                      ))}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const keyword = prompt("Nytt minimumskrav:");
                          if (keyword) {
                            addKeyword(profile.profileName, "minimumRequirements", keyword);
                          }
                        }}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>

                  {/* Support Keywords */}
                  <div>
                    <Label className="text-sm font-medium">Støtteord</Label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {profile.suggestions.supportKeywords.map((kw, idx) => (
                        <Badge key={idx} variant="default" className="gap-1">
                          {kw.keyword} ({kw.weight})
                          <X
                            className="h-3 w-3 cursor-pointer"
                            onClick={() =>
                              removeKeyword(profile.profileName, "supportKeywords", idx)
                            }
                          />
                        </Badge>
                      ))}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const keyword = prompt("Nytt støtteord:");
                          const weight = prompt("Vekt (1-3):");
                          if (keyword && weight) {
                            addKeyword(profile.profileName, "supportKeywords", {
                              keyword,
                              weight: parseInt(weight),
                            });
                          }
                        }}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>

                  {/* Negative Keywords */}
                  <div>
                    <Label className="text-sm font-medium">Negativord</Label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {profile.suggestions.negativeKeywords.map((kw, idx) => (
                        <Badge key={idx} variant="secondary" className="gap-1">
                          {kw.keyword} ({kw.weight})
                          <X
                            className="h-3 w-3 cursor-pointer"
                            onClick={() =>
                              removeKeyword(profile.profileName, "negativeKeywords", idx)
                            }
                          />
                        </Badge>
                      ))}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const keyword = prompt("Nytt negativord:");
                          const weight = prompt("Vekt (-1 til -3):");
                          if (keyword && weight) {
                            addKeyword(profile.profileName, "negativeKeywords", {
                              keyword,
                              weight: parseInt(weight),
                            });
                          }
                        }}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>

                  {/* CPV Codes */}
                  <div>
                    <Label className="text-sm font-medium">CPV-koder</Label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {profile.suggestions.cpvCodes.map((cpv, idx) => (
                        <Badge key={idx} variant="outline" className="gap-1">
                          {cpv.code} ({cpv.weight})
                          <X
                            className="h-3 w-3 cursor-pointer"
                            onClick={() => removeKeyword(profile.profileName, "cpvCodes", idx)}
                          />
                        </Badge>
                      ))}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const code = prompt("Ny CPV-kode:");
                          const weight = prompt("Vekt (1-3):");
                          if (code && weight) {
                            addKeyword(profile.profileName, "cpvCodes", {
                              code,
                              weight: parseInt(weight),
                            });
                          }
                        }}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}

              <div className="flex gap-2">
                <Button onClick={() => setStep(3)} variant="outline">
                  Tilbake
                </Button>
                <Button onClick={finalizeOnboarding} disabled={loading} className="flex-1">
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Lagrer...
                    </>
                  ) : (
                    <>
                      <Check className="mr-2 h-4 w-4" />
                      Godkjenn og bygg dashboard
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Onboarding;
