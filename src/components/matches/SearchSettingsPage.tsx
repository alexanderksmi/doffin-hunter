import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, X, Info } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { Database } from "@/integrations/supabase/types";
import { OrganizationMembers } from "@/components/settings/OrganizationMembers";

type Profile = {
  id: string;
  profile_name: string;
  is_own_profile: boolean;
  partner_id: string | null;
};

type Keyword = {
  id: string;
  keyword?: string;
  cpv_code?: string;
  weight?: number;
  profile_id: string;
};

export const SearchSettingsPage = () => {
  const { organizationId, userRole } = useAuth();
  const { toast } = useToast();
  const canEdit = userRole === "admin";
  const isReadOnly = userRole === "editor";
  const [loading, setLoading] = useState(true);
  const [ownProfile, setOwnProfile] = useState<Profile | null>(null);
  const [partnerProfiles, setPartnerProfiles] = useState<Profile[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<string | null>(null);
  
  const [minimumReqs, setMinimumReqs] = useState<Keyword[]>([]);
  const [supportKeywords, setSupportKeywords] = useState<Keyword[]>([]);
  const [negativeKeywords, setNegativeKeywords] = useState<Keyword[]>([]);
  const [cpvCodes, setCpvCodes] = useState<Keyword[]>([]);
  
  const [newKeyword, setNewKeyword] = useState("");
  const [newWeight, setNewWeight] = useState(1);
  
  const [addPartnerOpen, setAddPartnerOpen] = useState(false);
  const [newPartnerName, setNewPartnerName] = useState("");
  const [newPartnerDomain, setNewPartnerDomain] = useState("");
  const [addingPartner, setAddingPartner] = useState(false);

  useEffect(() => {
    if (organizationId) {
      loadProfiles();
    }
  }, [organizationId]);

  useEffect(() => {
    if (selectedProfile) {
      loadProfileKeywords(selectedProfile);
    }
  }, [selectedProfile]);

  const loadProfiles = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("company_profiles")
        .select("*")
        .eq("organization_id", organizationId);

      if (error) throw error;

      const own = data?.find((p) => p.is_own_profile);
      const partners = data?.filter((p) => !p.is_own_profile) || [];

      setOwnProfile(own || null);
      setPartnerProfiles(partners);

      if (own) {
        setSelectedProfile(own.id);
      } else if (partners.length > 0) {
        setSelectedProfile(partners[0].id);
      }
    } catch (error) {
      console.error("Error loading profiles:", error);
      toast({
        title: "Feil",
        description: "Kunne ikke laste profiler",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadProfileKeywords = async (profileId: string) => {
    try {
      const [minReqs, support, negative, cpv] = await Promise.all([
        supabase.from("minimum_requirements").select("*").eq("profile_id", profileId),
        supabase.from("support_keywords").select("*").eq("profile_id", profileId),
        supabase.from("negative_keywords").select("*").eq("profile_id", profileId),
        supabase.from("cpv_codes").select("*").eq("profile_id", profileId),
      ]);

      setMinimumReqs(minReqs.data || []);
      setSupportKeywords(support.data || []);
      setNegativeKeywords(negative.data || []);
      setCpvCodes(cpv.data || []);
    } catch (error) {
      console.error("Error loading keywords:", error);
      toast({
        title: "Feil",
        description: "Kunne ikke laste nøkkelord",
        variant: "destructive",
      });
    }
  };

  const addKeyword = async (type: "minimum" | "support" | "negative" | "cpv") => {
    if (!newKeyword.trim() || !selectedProfile) return;

    try {
      switch (type) {
        case "minimum":
          await supabase.from("minimum_requirements").insert({
            profile_id: selectedProfile,
            keyword: newKeyword.trim(),
          });
          break;
        case "support":
          await supabase.from("support_keywords").insert({
            profile_id: selectedProfile,
            keyword: newKeyword.trim(),
            weight: newWeight,
          });
          break;
        case "negative":
          await supabase.from("negative_keywords").insert({
            profile_id: selectedProfile,
            keyword: newKeyword.trim(),
            weight: newWeight,
          });
          break;
        case "cpv":
          await supabase.from("cpv_codes").insert({
            profile_id: selectedProfile,
            cpv_code: newKeyword.trim(),
            weight: newWeight,
          });
          break;
      }

      toast({ title: "Nøkkelord lagt til" });
      setNewKeyword("");
      setNewWeight(1);
      loadProfileKeywords(selectedProfile);
    } catch (error) {
      console.error("Error adding keyword:", error);
      toast({
        title: "Feil",
        description: "Kunne ikke legge til nøkkelord",
        variant: "destructive",
      });
    }
  };

  const deleteKeyword = async (id: string, type: "minimum" | "support" | "negative" | "cpv") => {
    try {
      switch (type) {
        case "minimum":
          await supabase.from("minimum_requirements").delete().eq("id", id);
          break;
        case "support":
          await supabase.from("support_keywords").delete().eq("id", id);
          break;
        case "negative":
          await supabase.from("negative_keywords").delete().eq("id", id);
          break;
        case "cpv":
          await supabase.from("cpv_codes").delete().eq("id", id);
          break;
      }

      toast({ title: "Nøkkelord slettet" });
      loadProfileKeywords(selectedProfile!);
    } catch (error) {
      console.error("Error deleting keyword:", error);
      toast({
        title: "Feil",
        description: "Kunne ikke slette nøkkelord",
        variant: "destructive",
      });
    }
  };

  const addPartner = async () => {
    if (!newPartnerName.trim() || !newPartnerDomain.trim() || !organizationId || !ownProfile) {
      toast({
        title: "Manglende informasjon",
        description: "Fyll ut alle feltene",
        variant: "destructive",
      });
      return;
    }

    setAddingPartner(true);
    try {
      // 1. Create partner
      const { data: partner, error: partnerError } = await supabase
        .from("partners")
        .insert({
          organization_id: organizationId,
          partner_name: newPartnerName.trim(),
          partner_domain: newPartnerDomain.trim(),
        })
        .select()
        .single();

      if (partnerError) throw partnerError;

      // 2. Create company profile for partner
      const { data: profile, error: profileError } = await supabase
        .from("company_profiles")
        .insert({
          organization_id: organizationId,
          profile_name: newPartnerName.trim(),
          is_own_profile: false,
          partner_id: partner.id,
        })
        .select()
        .single();

      if (profileError) throw profileError;

      // 3. Create partner_graph combinations
      const graphEntries: Database["public"]["Tables"]["partner_graph"]["Insert"][] = [
        {
          organization_id: organizationId,
          combination_type: "lead_partner" as const,
          lead_profile_id: ownProfile.id,
          partner_profile_id: profile.id,
        },
        {
          organization_id: organizationId,
          combination_type: "partner_led" as const,
          lead_profile_id: profile.id,
          partner_profile_id: ownProfile.id,
        },
      ];

      const { error: graphError } = await supabase
        .from("partner_graph")
        .insert(graphEntries);

      if (graphError) throw graphError;

      toast({
        title: "Partner lagt til",
        description: `${newPartnerName} har blitt lagt til som partner`,
      });

      // Reset form and close dialog
      setNewPartnerName("");
      setNewPartnerDomain("");
      setAddPartnerOpen(false);

      // Reload profiles to show new partner
      loadProfiles();
    } catch (error) {
      console.error("Error adding partner:", error);
      toast({
        title: "Feil",
        description: "Kunne ikke legge til partner",
        variant: "destructive",
      });
    } finally {
      setAddingPartner(false);
    }
  };

  const renderKeywordSection = () => {
    if (!selectedProfile) return null;

    return (
      <TooltipProvider>
        <Tabs defaultValue="minimum" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="minimum">Minimumskrav</TabsTrigger>
            <TabsTrigger value="support">Støtteord</TabsTrigger>
            <TabsTrigger value="negative">Negativord</TabsTrigger>
            <TabsTrigger value="cpv">CPV-koder</TabsTrigger>
          </TabsList>

          <TabsContent value="minimum" className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Nytt minimumskrav"
                value={newKeyword}
                onChange={(e) => setNewKeyword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && canEdit && addKeyword("minimum")}
                disabled={!canEdit}
              />
              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    <Button 
                      onClick={() => addKeyword("minimum")} 
                      size="icon"
                      disabled={!canEdit}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </TooltipTrigger>
                {!canEdit && (
                  <TooltipContent>
                    <p>Spør administrator om tilgang til å endre</p>
                  </TooltipContent>
                )}
              </Tooltip>
            </div>
            <div className="flex flex-wrap gap-2">
              {minimumReqs.map((req) => (
                <Badge key={req.id} variant="secondary">
                  {req.keyword}
                  {canEdit && (
                    <button
                      onClick={() => deleteKeyword(req.id, "minimum")}
                      className="ml-2 hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </Badge>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="support" className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Nytt støtteord"
                value={newKeyword}
                onChange={(e) => setNewKeyword(e.target.value)}
                disabled={!canEdit}
              />
              <Input
                type="number"
                placeholder="Vekt"
                value={newWeight}
                onChange={(e) => setNewWeight(Number(e.target.value))}
                className="w-20"
                disabled={!canEdit}
              />
              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    <Button 
                      onClick={() => addKeyword("support")} 
                      size="icon"
                      disabled={!canEdit}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </TooltipTrigger>
                {!canEdit && (
                  <TooltipContent>
                    <p>Spør administrator om tilgang til å endre</p>
                  </TooltipContent>
                )}
              </Tooltip>
            </div>
            <div className="flex flex-wrap gap-2">
              {supportKeywords.map((kw) => (
                <Badge key={kw.id} variant="default">
                  {kw.keyword} ({kw.weight})
                  {canEdit && (
                    <button
                      onClick={() => deleteKeyword(kw.id, "support")}
                      className="ml-2 hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </Badge>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="negative" className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Nytt negativord"
                value={newKeyword}
                onChange={(e) => setNewKeyword(e.target.value)}
                disabled={!canEdit}
              />
              <Input
                type="number"
                placeholder="Vekt"
                value={newWeight}
                onChange={(e) => setNewWeight(Number(e.target.value))}
                className="w-20"
                disabled={!canEdit}
              />
              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    <Button 
                      onClick={() => addKeyword("negative")} 
                      size="icon"
                      disabled={!canEdit}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </TooltipTrigger>
                {!canEdit && (
                  <TooltipContent>
                    <p>Spør administrator om tilgang til å endre</p>
                  </TooltipContent>
                )}
              </Tooltip>
            </div>
            <div className="flex flex-wrap gap-2">
              {negativeKeywords.map((kw) => (
                <Badge key={kw.id} variant="destructive">
                  {kw.keyword} ({kw.weight})
                  {canEdit && (
                    <button
                      onClick={() => deleteKeyword(kw.id, "negative")}
                      className="ml-2 hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </Badge>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="cpv" className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Ny CPV-kode"
                value={newKeyword}
                onChange={(e) => setNewKeyword(e.target.value)}
                disabled={!canEdit}
              />
              <Input
                type="number"
                placeholder="Vekt"
                value={newWeight}
                onChange={(e) => setNewWeight(Number(e.target.value))}
                className="w-20"
                disabled={!canEdit}
              />
              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    <Button 
                      onClick={() => addKeyword("cpv")} 
                      size="icon"
                      disabled={!canEdit}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </TooltipTrigger>
                {!canEdit && (
                  <TooltipContent>
                    <p>Spør administrator om tilgang til å endre</p>
                  </TooltipContent>
                )}
              </Tooltip>
            </div>
            <div className="flex flex-wrap gap-2">
              {cpvCodes.map((cpv) => (
                <Badge key={cpv.id} variant="outline">
                  {cpv.cpv_code || cpv.keyword} ({cpv.weight})
                  {canEdit && (
                    <button
                      onClick={() => deleteKeyword(cpv.id, "cpv")}
                      className="ml-2 hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </Badge>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </TooltipProvider>
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Innstillinger for søk</h2>
        <p className="text-muted-foreground mt-1">
          Administrer nøkkelord og innstillinger for søk
        </p>
      </div>

      {isReadOnly && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Kun visning</AlertTitle>
          <AlertDescription>
            Du har ikke tilgang til å endre søkeinnstillinger. Kontakt en administrator for å gjøre endringer.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Eget selskap</CardTitle>
            <CardDescription>Dine nøkkelord og innstillinger</CardDescription>
          </CardHeader>
          <CardContent>
            {ownProfile ? (
              <Button
                variant={selectedProfile === ownProfile.id ? "default" : "outline"}
                className="w-full mb-4"
                onClick={() => setSelectedProfile(ownProfile.id)}
              >
                {ownProfile.profile_name}
              </Button>
            ) : (
              <p className="text-sm text-muted-foreground">Ingen egen profil funnet</p>
            )}
            
            {selectedProfile === ownProfile?.id && (
              <div className="space-y-4">
                {renderKeywordSection()}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Partnere</CardTitle>
                <CardDescription>Partnerenes nøkkelord og innstillinger</CardDescription>
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    <Button 
                      onClick={() => setAddPartnerOpen(true)} 
                      size="sm"
                      disabled={!canEdit}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Legg til partner
                    </Button>
                  </div>
                </TooltipTrigger>
                {!canEdit && (
                  <TooltipContent>
                    <p>Spør administrator om tilgang til å endre</p>
                  </TooltipContent>
                )}
              </Tooltip>
            </div>
          </CardHeader>
          <CardContent>
            {partnerProfiles.length > 0 ? (
              <>
                <div className="space-y-2 mb-4">
                  {partnerProfiles.map((partner) => (
                    <Button
                      key={partner.id}
                      variant={selectedProfile === partner.id ? "default" : "outline"}
                      className="w-full"
                      onClick={() => setSelectedProfile(partner.id)}
                    >
                      {partner.profile_name}
                    </Button>
                  ))}
                </div>

                {selectedProfile && partnerProfiles.find((p) => p.id === selectedProfile) && (
                  <div className="space-y-4">
                    {renderKeywordSection()}
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-8">
                <p className="text-sm text-muted-foreground mb-4">Ingen partnere lagt til ennå</p>
                <Button onClick={() => setAddPartnerOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Legg til din første partner
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-6">
        <OrganizationMembers />
      </div>

      <Dialog open={addPartnerOpen} onOpenChange={setAddPartnerOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Legg til ny partner</DialogTitle>
            <DialogDescription>
              Legg til en partner for å evaluere anbudskombinasjoner
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="partner-name">Partnernavn</Label>
              <Input
                id="partner-name"
                placeholder="F.eks. Partnerbedrift AS"
                value={newPartnerName}
                onChange={(e) => setNewPartnerName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="partner-domain">Domene</Label>
              <Input
                id="partner-domain"
                placeholder="F.eks. partnerbedrift.no"
                value={newPartnerDomain}
                onChange={(e) => setNewPartnerDomain(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddPartnerOpen(false)}>
              Avbryt
            </Button>
            <Button onClick={addPartner} disabled={addingPartner}>
              {addingPartner ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Legger til...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Legg til
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
