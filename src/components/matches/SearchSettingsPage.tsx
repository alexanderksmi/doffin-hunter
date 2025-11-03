import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, X } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
  const { organizationId } = useAuth();
  const { toast } = useToast();
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

  const renderKeywordSection = () => {
    if (!selectedProfile) return null;

    return (
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
              onKeyDown={(e) => e.key === "Enter" && addKeyword("minimum")}
            />
            <Button onClick={() => addKeyword("minimum")} size="icon">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {minimumReqs.map((req) => (
              <Badge key={req.id} variant="secondary">
                {req.keyword}
                <button
                  onClick={() => deleteKeyword(req.id, "minimum")}
                  className="ml-2 hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
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
            />
            <Input
              type="number"
              placeholder="Vekt"
              value={newWeight}
              onChange={(e) => setNewWeight(Number(e.target.value))}
              className="w-20"
            />
            <Button onClick={() => addKeyword("support")} size="icon">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {supportKeywords.map((kw) => (
              <Badge key={kw.id} variant="default">
                {kw.keyword} ({kw.weight})
                <button
                  onClick={() => deleteKeyword(kw.id, "support")}
                  className="ml-2 hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
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
            />
            <Input
              type="number"
              placeholder="Vekt"
              value={newWeight}
              onChange={(e) => setNewWeight(Number(e.target.value))}
              className="w-20"
            />
            <Button onClick={() => addKeyword("negative")} size="icon">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {negativeKeywords.map((kw) => (
              <Badge key={kw.id} variant="destructive">
                {kw.keyword} ({kw.weight})
                <button
                  onClick={() => deleteKeyword(kw.id, "negative")}
                  className="ml-2 hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
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
            />
            <Input
              type="number"
              placeholder="Vekt"
              value={newWeight}
              onChange={(e) => setNewWeight(Number(e.target.value))}
              className="w-20"
            />
            <Button onClick={() => addKeyword("cpv")} size="icon">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {cpvCodes.map((cpv) => (
              <Badge key={cpv.id} variant="outline">
                {cpv.cpv_code || cpv.keyword} ({cpv.weight})
                <button
                  onClick={() => deleteKeyword(cpv.id, "cpv")}
                  className="ml-2 hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        </TabsContent>
      </Tabs>
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
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

        <Card>
          <CardHeader>
            <CardTitle>Partnere</CardTitle>
            <CardDescription>Partnerenes nøkkelord og innstillinger</CardDescription>
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
              <p className="text-sm text-muted-foreground">Ingen partnere funnet</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
