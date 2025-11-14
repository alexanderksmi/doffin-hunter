import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";

type Member = {
  id: string;
  user_id: string;
  role: "admin" | "editor" | "viewer";
  email?: string;
};

export const OrganizationMembers = () => {
  const { organizationId, userRole, user } = useAuth();
  const { toast } = useToast();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  const isAdmin = userRole === "admin";
  const adminCount = members.filter(m => m.role === "admin").length;

  useEffect(() => {
    if (organizationId) {
      loadMembers();
    }
  }, [organizationId]);

  const loadMembers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('get-organization-members', {
        body: { organizationId }
      });

      if (error) throw error;

      setMembers(data.members);
    } catch (error) {
      console.error("Error loading members:", error);
      toast({
        title: "Feil",
        description: "Kunne ikke laste medlemmer",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const updateMemberRole = async (memberId: string, userId: string, newRole: "admin" | "editor" | "viewer") => {
    setUpdating(memberId);
    try {
      const { error } = await supabase
        .from("user_roles")
        .update({ role: newRole })
        .eq("id", memberId);

      if (error) throw error;

      toast({
        title: "Rolle oppdatert",
        description: `Brukerens rolle ble endret til ${newRole}`,
      });

      loadMembers();
    } catch (error) {
      console.error("Error updating role:", error);
      toast({
        title: "Feil",
        description: "Kunne ikke oppdatere rolle",
        variant: "destructive",
      });
    } finally {
      setUpdating(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Selskapsmiljø</CardTitle>
        <CardDescription>
          Alle brukere med samme e-postdomene blir automatisk lagt til her
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {members.map((member) => {
            const isCurrentUser = member.user_id === user?.id;
            const isCurrentUserLastAdmin = 
              isAdmin && 
              member.role === "admin" && 
              adminCount === 1 && 
              isCurrentUser;

            return (
              <div
                key={member.id}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div className="flex-1">
                  <p className="font-medium">{member.email}</p>
                  <p className="text-sm text-muted-foreground">
                    {member.role === "admin" && "Administrator"}
                    {member.role === "editor" && "Redigerer"}
                    {member.role === "viewer" && "Seer"}
                  </p>
                </div>

                {isAdmin ? (
                  <Select
                    value={member.role}
                    onValueChange={(value: "admin" | "editor" | "viewer") =>
                      updateMemberRole(member.id, member.user_id, value)
                    }
                    disabled={updating === member.id}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="editor">Editor</SelectItem>
                      <SelectItem value="viewer">Viewer</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <Badge variant={member.role === "admin" ? "default" : "secondary"}>
                    {member.role}
                  </Badge>
                )}
              </div>
            );
          })}
        </div>

        {!isAdmin && (
          <p className="text-sm text-muted-foreground mt-4">
            Kun administratorer kan endre roller
          </p>
        )}
      </CardContent>
    </Card>
  );
};
