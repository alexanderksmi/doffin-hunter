import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { normalizeDomain } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";

type CreateTenderDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
};

type CompanyProfile = {
  id: string;
  profile_name: string;
  is_own_profile: boolean;
};

const stages = [
  { key: "kvalifisering", label: "Kvalifisering" },
  { key: "analyse_planlegging", label: "Analyse / Planlegging" },
  { key: "svarer_anbud", label: "Svarer anbud" },
  { key: "kvalitetssikring", label: "Kvalitetssikring" },
  { key: "godkjenning", label: "Godkjenning" },
  { key: "laring", label: "Læring" },
];

export const CreateTenderDialog = ({ open, onOpenChange, onSuccess }: CreateTenderDialogProps) => {
  const { organizationId, user } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [profiles, setProfiles] = useState<CompanyProfile[]>([]);
  const [loadingProfiles, setLoadingProfiles] = useState(false);

  const [formData, setFormData] = useState({
    title: "",
    client: "",
    doffinUrl: "",
    deadline: "",
    combinationType: "solo",
    partnerId: "",
    currentStage: "kvalifisering",
    relevanceScore: "",
    timeCriticality: "",
    comments: "",
  });

  useEffect(() => {
    if (open && organizationId) {
      loadProfiles();
    }
  }, [open, organizationId]);

  const loadProfiles = async () => {
    setLoadingProfiles(true);
    try {
      const { data, error } = await supabase
        .from("company_profiles")
        .select("id, profile_name, is_own_profile")
        .eq("organization_id", organizationId)
        .order("is_own_profile", { ascending: false })
        .order("profile_name");

      if (error) throw error;
      setProfiles(data || []);
    } catch (error) {
      console.error("Error loading profiles:", error);
    } finally {
      setLoadingProfiles(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.title.trim()) {
      toast({
        title: "Mangler tittel",
        description: "Du må fylle inn en tittel",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      // Create tender
      const { data: tenderData, error: tenderError } = await supabase
        .from("tenders")
        .insert({
          title: formData.title,
          client: formData.client || null,
          doffin_url: formData.doffinUrl || null,
          deadline: formData.deadline || null,
          doffin_id: `manual-${Date.now()}`,
          org_id: organizationId,
        })
        .select()
        .single();

      if (tenderError) throw tenderError;

      // Determine lead and partner profiles
      let leadProfileId = null;
      let partnerProfileId = null;
      const combinationType = formData.combinationType;

      if ((combinationType === "lead_partner" || combinationType === "partner_led") && formData.partnerId) {
        const ownProfile = profiles.find((p) => p.is_own_profile);
        leadProfileId = ownProfile?.id || null;
        partnerProfileId = formData.partnerId;
      }

      // Create evaluation
      const { data: evalData, error: evalError } = await supabase
        .from("tender_evaluations")
        .insert({
          tender_id: tenderData.id,
          organization_id: organizationId,
          lead_profile_id: leadProfileId,
          partner_profile_id: partnerProfileId,
          combination_type: combinationType,
          all_minimum_requirements_met: true,
          total_score: 0,
          is_manual: true,
        })
        .select()
        .single();

      if (evalError) throw evalError;

      // Create saved tender
      const { data: savedTenderData, error: savedError } = await supabase
        .from("saved_tenders")
        .insert({
          tender_id: tenderData.id,
          evaluation_id: evalData.id,
          organization_id: organizationId!,
          saved_by: user!.id,
          combination_type: combinationType,
          lead_profile_id: leadProfileId,
          partner_profile_id: partnerProfileId,
          status: "pagar",
          current_stage: formData.currentStage as any,
          relevance_score: formData.relevanceScore ? parseInt(formData.relevanceScore) : null,
          time_criticality: formData.timeCriticality || null,
          comments: formData.comments || null,
          cached_title: formData.title,
          cached_client: formData.client || null,
          cached_deadline: formData.deadline || null,
          cached_doffin_url: formData.doffinUrl || null,
        })
        .select()
        .single();

      if (savedError) throw savedError;

      // If partner selected, create sharing invitation
      if (partnerProfileId) {
        try {
          // Get partner domain via company_profiles -> partners
          const { data: partnerProfile } = await supabase
            .from("company_profiles")
            .select("partner_id, partners(partner_domain)")
            .eq("id", partnerProfileId)
            .single();

          console.log("Partner profile data:", partnerProfile);

          if (partnerProfile?.partners?.partner_domain) {
            const rawDomain = partnerProfile.partners.partner_domain;
            const partnerDomain = normalizeDomain(rawDomain);
            console.log("Looking for organization with domain:", partnerDomain, "(normalized from:", rawDomain, ")");

            // Find partner organization by domain (normalized comparison on both sides)
            const { data: allOrgs } = await supabase
              .from("organizations")
              .select("id, domain");
            
            console.log("All organizations:", allOrgs);
            
            // Manual normalized matching
            const partnerOrg = allOrgs?.find(org => 
              normalizeDomain(org.domain) === partnerDomain
            );

            console.log("Found partner org:", partnerOrg);

            if (partnerOrg) {
              // Create shared tender link
              const { error: linkError } = await supabase.from("shared_tender_links").insert({
                source_organization_id: organizationId!,
                source_saved_tender_id: savedTenderData.id,
                target_organization_id: partnerOrg.id,
                status: "pending",
                invited_at: new Date().toISOString(),
              });

              if (linkError) {
                console.error("Error creating shared_tender_link:", linkError);
              } else {
                console.log("✅ Created invitation for partner organization:", partnerOrg.id);
                
                // Mark source tender as shared
                await supabase
                  .from("saved_tenders")
                  .update({ is_shared: true })
                  .eq("id", savedTenderData.id);
              }
            } else {
              console.warn("❌ Partner organization not found for normalized domain:", partnerDomain);
            }
          } else {
            console.warn("No partner domain found in profile");
          }
        } catch (error) {
          console.error("Error creating partner invitation:", error);
          // Don't fail the whole operation if sharing fails
        }
      }

      toast({
        title: "Anbud opprettet",
        description: "Anbudet er lagt til i Mine Løp",
      });

      onSuccess();
      onOpenChange(false);
      resetForm();
    } catch (error) {
      console.error("Error creating tender:", error);
      toast({
        title: "Feil",
        description: "Kunne ikke opprette anbud",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setFormData({
      title: "",
      client: "",
      doffinUrl: "",
      deadline: "",
      combinationType: "solo",
      partnerId: "",
      currentStage: "kvalifisering",
      relevanceScore: "",
      timeCriticality: "",
      comments: "",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Opprett anbud manuelt</DialogTitle>
          <DialogDescription>
            Fyll inn informasjon om anbudet. Kun tittel er påkrevd.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="title">Tittel *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Tittel på anbudet"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="client">Oppdragsgiver</Label>
            <Input
              id="client"
              value={formData.client}
              onChange={(e) => setFormData({ ...formData, client: e.target.value })}
              placeholder="Navn på oppdragsgiver"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="doffinUrl">Doffin-lenke</Label>
            <Input
              id="doffinUrl"
              value={formData.doffinUrl}
              onChange={(e) => setFormData({ ...formData, doffinUrl: e.target.value })}
              placeholder="https://doffin.no/..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="deadline">Frist</Label>
            <Input
              id="deadline"
              type="date"
              value={formData.deadline}
              onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="combinationType">Samarbeidstype</Label>
            <Select
              value={formData.combinationType}
              onValueChange={(value) =>
                setFormData({ ...formData, combinationType: value, partnerId: "" })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
            <SelectContent>
              <SelectItem value="solo">Solo</SelectItem>
              <SelectItem value="lead_partner">Med partner (vi leder)</SelectItem>
              <SelectItem value="partner_led">Med partner (partner leder)</SelectItem>
            </SelectContent>
            </Select>
          </div>

          {(formData.combinationType === "lead_partner" || formData.combinationType === "partner_led") && (
            <div className="space-y-2">
              <Label htmlFor="partnerId">Partner</Label>
              <Select
                value={formData.partnerId}
                onValueChange={(value) => setFormData({ ...formData, partnerId: value })}
                disabled={loadingProfiles}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Velg partner" />
                </SelectTrigger>
                <SelectContent>
                  {profiles
                    .filter((p) => !p.is_own_profile)
                    .map((profile) => (
                      <SelectItem key={profile.id} value={profile.id}>
                        {profile.profile_name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="currentStage">Fase</Label>
            <Select
              value={formData.currentStage}
              onValueChange={(value) => setFormData({ ...formData, currentStage: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {stages.map((stage) => (
                  <SelectItem key={stage.key} value={stage.key}>
                    {stage.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="relevanceScore">Relevans (0-100)</Label>
            <Input
              id="relevanceScore"
              type="number"
              min="0"
              max="100"
              value={formData.relevanceScore}
              onChange={(e) => setFormData({ ...formData, relevanceScore: e.target.value })}
              placeholder="Relevans score"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="timeCriticality">Tidskritisk</Label>
            <Select
              value={formData.timeCriticality}
              onValueChange={(value) => setFormData({ ...formData, timeCriticality: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Velg tidskritikalitet" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="lav">Lav</SelectItem>
                <SelectItem value="middels">Middels</SelectItem>
                <SelectItem value="høy">Høy</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="comments">Kommentarer</Label>
            <Textarea
              id="comments"
              value={formData.comments}
              onChange={(e) => setFormData({ ...formData, comments: e.target.value })}
              placeholder="Legg til kommentarer"
              rows={4}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Avbryt
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Opprett
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
