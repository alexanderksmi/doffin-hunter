import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, X, Pencil, Save } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

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

export const MatchesTab = () => {
  const { userRole, organizationId } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<string | null>(null);
  const [minimumReqs, setMinimumReqs] = useState<Keyword[]>([]);
  const [supportKeywords, setSupportKeywords] = useState<Keyword[]>([]);
  const [negativeKeywords, setNegativeKeywords] = useState<Keyword[]>([]);
  const [cpvCodes, setCpvCodes] = useState<Keyword[]>([]);
  const [editMode, setEditMode] = useState(false);
  const [newKeyword, setNewKeyword] = useState("");
  const [newWeight, setNewWeight] = useState(1);

  const isAdmin = userRole === "admin";

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
    try {
      const { data, error } = await supabase
        .from("company_profiles")
        .select("*")
        .eq("organization_id", organizationId)
        .order("is_own_profile", { ascending: false });

      if (error) throw error;
      setProfiles(data || []);
      if (data && data.length > 0) {
        setSelectedProfile(data[0].id);
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
    setLoading(true);
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
    } finally {
      setLoading(false);
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
      
      // Trigger re-evaluation of tenders with new keyword
      toast({ title: "Re-evaluerer anbud...", description: "Dette tar noen sekunder" });
      supabase.functions.invoke('evaluate-tenders', {
        body: { organizationId }
      }).then(() => {
        toast({ title: "Anbud re-evaluert", description: "Oppdaterte resultater er klare" });
      });
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
      
      // Trigger re-evaluation of tenders after keyword deletion
      toast({ title: "Re-evaluerer anbud...", description: "Dette tar noen sekunder" });
      supabase.functions.invoke('evaluate-tenders', {
        body: { organizationId }
      }).then(() => {
        toast({ title: "Anbud re-evaluert", description: "Oppdaterte resultater er klare" });
      });
    } catch (error) {
      console.error("Error deleting keyword:", error);
      toast({
        title: "Feil",
        description: "Kunne ikke slette nøkkelord",
        variant: "destructive",
      });
    }
  };

  if (!isAdmin) {
    return (
      <Alert>
        <AlertDescription>
          Du må være administrator for å se Match-portalen.
        </AlertDescription>
      </Alert>
    );
  }

  if (loading && profiles.length === 0) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const selectedProfileData = profiles.find((p) => p.id === selectedProfile);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Match-portal</h2>
          <p className="text-muted-foreground">Administrer profiler og nøkkelord</p>
        </div>
        <Button
          variant={editMode ? "default" : "outline"}
          onClick={() => setEditMode(!editMode)}
        >
          {editMode ? (
            <>
              <Save className="mr-2 h-4 w-4" />
              Avslutt redigering
            </>
          ) : (
            <>
              <Pencil className="mr-2 h-4 w-4" />
              Rediger
            </>
          )}
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-[250px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Profiler</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {profiles.map((profile) => (
              <Button
                key={profile.id}
                variant={selectedProfile === profile.id ? "default" : "ghost"}
                className="w-full justify-start"
                onClick={() => setSelectedProfile(profile.id)}
              >
                {profile.profile_name}
                {profile.is_own_profile && (
                  <Badge variant="secondary" className="ml-2">
                    Egen
                  </Badge>
                )}
              </Button>
            ))}
          </CardContent>
        </Card>

        <div className="space-y-6">
          {selectedProfileData && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>{selectedProfileData.profile_name}</CardTitle>
                  <CardDescription>
                    {selectedProfileData.is_own_profile ? "Din bedriftsprofil" : "Partnerprofil"}
                  </CardDescription>
                </CardHeader>
              </Card>

              <Tabs defaultValue="minimum">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="minimum">Minimumskrav</TabsTrigger>
                  <TabsTrigger value="support">Støtteord</TabsTrigger>
                  <TabsTrigger value="negative">Negativord</TabsTrigger>
                  <TabsTrigger value="cpv">CPV-koder</TabsTrigger>
                </TabsList>

                <TabsContent value="minimum" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Minimumskrav</CardTitle>
                      <CardDescription>
                        Anbud må inneholde alle minimumskravene for å vises
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {editMode && (
                        <div className="flex gap-2">
                          <Input
                            placeholder="Nytt minimumskrav"
                            value={newKeyword}
                            onChange={(e) => setNewKeyword(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && addKeyword("minimum")}
                          />
                          <Button onClick={() => addKeyword("minimum")}>
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                      <div className="flex flex-wrap gap-2">
                        {minimumReqs.map((req) => (
                          <Badge key={req.id} variant="secondary" className="text-sm">
                            {req.keyword}
                            {editMode && (
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
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="support" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Støtteord</CardTitle>
                      <CardDescription>Øker relevansscoren for anbud</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {editMode && (
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
                            className="w-24"
                          />
                          <Button onClick={() => addKeyword("support")}>
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                      <div className="flex flex-wrap gap-2">
                        {supportKeywords.map((kw) => (
                          <Badge key={kw.id} variant="default" className="text-sm">
                            {kw.keyword} ({kw.weight})
                            {editMode && (
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
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="negative" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Negativord</CardTitle>
                      <CardDescription>Senker relevansscoren for anbud</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {editMode && (
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
                            className="w-24"
                          />
                          <Button onClick={() => addKeyword("negative")}>
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                      <div className="flex flex-wrap gap-2">
                        {negativeKeywords.map((kw) => (
                          <Badge key={kw.id} variant="destructive" className="text-sm">
                            {kw.keyword} ({kw.weight})
                            {editMode && (
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
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="cpv" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>CPV-koder</CardTitle>
                      <CardDescription>Common Procurement Vocabulary koder</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {editMode && (
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
                            className="w-24"
                          />
                          <Button onClick={() => addKeyword("cpv")}>
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                      <div className="flex flex-wrap gap-2">
                        {cpvCodes.map((cpv) => (
                          <Badge key={cpv.id} variant="outline" className="text-sm">
                            {cpv.cpv_code || cpv.keyword} ({cpv.weight})
                            {editMode && (
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
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
