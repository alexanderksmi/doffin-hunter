import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Trash2, Plus, CheckSquare, Square } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Owner = {
  id: string;
  name: string;
  email: string | null;
  role: string | null;
};

type Task = {
  id: string;
  title: string;
  description: string | null;
  completed: boolean;
  due_date: string | null;
  owner_id: string;
};

type Member = {
  user_id: string;
  email: string;
  role: string;
};

type TenderOwnersProps = {
  savedTenderId: string;
  readOnly?: boolean;
};

export const TenderOwners = ({ savedTenderId, readOnly = false }: TenderOwnersProps) => {
  const { toast } = useToast();
  const { organizationId } = useAuth();
  const [owners, setOwners] = useState<Owner[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMember, setSelectedMember] = useState<string>("");
  const [ownerRole, setOwnerRole] = useState<string>("");
  const [newTask, setNewTask] = useState<{ [ownerId: string]: string }>({});
  const [expandedOwner, setExpandedOwner] = useState<string | null>(null);

  useEffect(() => {
    loadOwnersAndTasks();
    loadOrganizationMembers();
  }, [savedTenderId]);

  const loadOrganizationMembers = async () => {
    if (!organizationId) return;
    
    try {
      const { data, error } = await supabase.functions.invoke(
        "get-organization-members",
        {
          body: { organizationId },
        }
      );

      if (error) throw error;
      setMembers(data.members || []);
    } catch (error) {
      console.error("Error loading members:", error);
    }
  };

  const loadOwnersAndTasks = async () => {
    try {
      const [ownersRes, tasksRes] = await Promise.all([
        supabase
          .from("tender_owners")
          .select("*")
          .eq("saved_tender_id", savedTenderId)
          .order("created_at", { ascending: true }),
        supabase
          .from("tender_tasks")
          .select("*")
          .eq("saved_tender_id", savedTenderId)
          .order("created_at", { ascending: true }),
      ]);

      if (ownersRes.error) throw ownersRes.error;
      if (tasksRes.error) throw tasksRes.error;

      setOwners(ownersRes.data || []);
      setTasks(tasksRes.data || []);
    } catch (error) {
      console.error("Error loading owners and tasks:", error);
    } finally {
      setLoading(false);
    }
  };

  const getLinkedTenderId = async (savedTenderId: string): Promise<string | null> => {
    const { data, error } = await supabase
      .from("shared_tender_links")
      .select("source_saved_tender_id, target_saved_tender_id")
      .or(`source_saved_tender_id.eq.${savedTenderId},target_saved_tender_id.eq.${savedTenderId}`)
      .eq("status", "accepted")
      .maybeSingle();

    if (error || !data) return null;
    
    return data.source_saved_tender_id === savedTenderId
      ? data.target_saved_tender_id
      : data.source_saved_tender_id;
  };

  const handleAddOwner = async () => {
    if (!selectedMember) {
      toast({
        title: "Feil",
        description: "Velg et medlem",
        variant: "destructive",
      });
      return;
    }

    const member = members.find(m => m.email === selectedMember);
    if (!member) return;

    try {
      const ownerData = {
        saved_tender_id: savedTenderId,
        name: member.email,
        email: member.email,
        role: ownerRole || null,
      };

      const { error } = await supabase.from("tender_owners").insert(ownerData);
      if (error) throw error;

      // Sync to linked tender
      const linkedTenderId = await getLinkedTenderId(savedTenderId);
      if (linkedTenderId) {
        await supabase.from("tender_owners").insert({
          ...ownerData,
          saved_tender_id: linkedTenderId,
        });
      }

      setSelectedMember("");
      setOwnerRole("");
      loadOwnersAndTasks();
      toast({ title: "Anbudseier lagt til" });
    } catch (error) {
      console.error("Error adding owner:", error);
      toast({
        title: "Feil",
        description: "Kunne ikke legge til anbudseier",
        variant: "destructive",
      });
    }
  };

  const handleDeleteOwner = async (id: string) => {
    try {
      // Get owner email before deleting
      const { data: owner } = await supabase
        .from("tender_owners")
        .select("email")
        .eq("id", id)
        .single();

      const { error } = await supabase.from("tender_owners").delete().eq("id", id);
      if (error) throw error;

      // Sync deletion to linked tender
      if (owner?.email) {
        const linkedTenderId = await getLinkedTenderId(savedTenderId);
        if (linkedTenderId) {
          await supabase
            .from("tender_owners")
            .delete()
            .eq("saved_tender_id", linkedTenderId)
            .eq("email", owner.email);
        }
      }

      loadOwnersAndTasks();
      toast({ title: "Anbudseier slettet" });
    } catch (error) {
      console.error("Error deleting owner:", error);
      toast({
        title: "Feil",
        description: "Kunne ikke slette anbudseier",
        variant: "destructive",
      });
    }
  };

  const handleAddTask = async (ownerId: string) => {
    const title = newTask[ownerId]?.trim();
    if (!title) return;

    try {
      // Get owner email to find corresponding owner in linked tender
      const { data: owner } = await supabase
        .from("tender_owners")
        .select("email")
        .eq("id", ownerId)
        .single();

      const { error } = await supabase.from("tender_tasks").insert({
        saved_tender_id: savedTenderId,
        owner_id: ownerId,
        title,
      });

      if (error) throw error;

      // Sync to linked tender
      if (owner?.email) {
        const linkedTenderId = await getLinkedTenderId(savedTenderId);
        if (linkedTenderId) {
          // Find corresponding owner in linked tender
          const { data: linkedOwner } = await supabase
            .from("tender_owners")
            .select("id")
            .eq("saved_tender_id", linkedTenderId)
            .eq("email", owner.email)
            .maybeSingle();

          if (linkedOwner) {
            await supabase.from("tender_tasks").insert({
              saved_tender_id: linkedTenderId,
              owner_id: linkedOwner.id,
              title,
            });
          }
        }
      }

      setNewTask((prev) => ({ ...prev, [ownerId]: "" }));
      loadOwnersAndTasks();
      toast({ title: "Oppgave lagt til" });
    } catch (error) {
      console.error("Error adding task:", error);
      toast({
        title: "Feil",
        description: "Kunne ikke legge til oppgave",
        variant: "destructive",
      });
    }
  };

  const handleToggleTask = async (taskId: string, completed: boolean) => {
    try {
      // Get task details before updating
      const { data: task } = await supabase
        .from("tender_tasks")
        .select("title, owner_id, tender_owners(email)")
        .eq("id", taskId)
        .single();

      const { error } = await supabase
        .from("tender_tasks")
        .update({ completed: !completed })
        .eq("id", taskId);

      if (error) throw error;

      // Sync to linked tender
      if (task?.tender_owners?.email) {
        const linkedTenderId = await getLinkedTenderId(savedTenderId);
        if (linkedTenderId) {
          // Find corresponding owner in linked tender
          const { data: linkedOwner } = await supabase
            .from("tender_owners")
            .select("id")
            .eq("saved_tender_id", linkedTenderId)
            .eq("email", task.tender_owners.email)
            .maybeSingle();

          if (linkedOwner) {
            // Find and update the corresponding task
            await supabase
              .from("tender_tasks")
              .update({ completed: !completed })
              .eq("saved_tender_id", linkedTenderId)
              .eq("owner_id", linkedOwner.id)
              .eq("title", task.title);
          }
        }
      }

      loadOwnersAndTasks();
    } catch (error) {
      console.error("Error toggling task:", error);
      toast({
        title: "Feil",
        description: "Kunne ikke oppdatere oppgave",
        variant: "destructive",
      });
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      // Get task details before deleting
      const { data: task } = await supabase
        .from("tender_tasks")
        .select("title, owner_id, tender_owners(email)")
        .eq("id", taskId)
        .single();

      const { error } = await supabase.from("tender_tasks").delete().eq("id", taskId);
      if (error) throw error;

      // Sync deletion to linked tender
      if (task?.tender_owners?.email) {
        const linkedTenderId = await getLinkedTenderId(savedTenderId);
        if (linkedTenderId) {
          // Find corresponding owner in linked tender
          const { data: linkedOwner } = await supabase
            .from("tender_owners")
            .select("id")
            .eq("saved_tender_id", linkedTenderId)
            .eq("email", task.tender_owners.email)
            .maybeSingle();

          if (linkedOwner) {
            // Delete the corresponding task
            await supabase
              .from("tender_tasks")
              .delete()
              .eq("saved_tender_id", linkedTenderId)
              .eq("owner_id", linkedOwner.id)
              .eq("title", task.title);
          }
        }
      }

      loadOwnersAndTasks();
      toast({ title: "Oppgave slettet" });
    } catch (error) {
      console.error("Error deleting task:", error);
      toast({
        title: "Feil",
        description: "Kunne ikke slette oppgave",
        variant: "destructive",
      });
    }
  };

  const getOwnerTasks = (ownerId: string) => {
    return tasks.filter((t) => t.owner_id === ownerId);
  };

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-base font-semibold">Anbudseiere</Label>
        <p className="text-sm text-muted-foreground">
          Medlemmer som er ansvarlige for dette anbudet
        </p>
      </div>

      <div className="space-y-3">
        {owners.map((owner) => {
          const ownerTasks = getOwnerTasks(owner.id);
          const completedCount = ownerTasks.filter((t) => t.completed).length;
          const isExpanded = expandedOwner === owner.id;

          return (
            <Card key={owner.id} className="p-3">
              <div className="flex items-start justify-between gap-2">
                <button
                  onClick={() =>
                    setExpandedOwner(isExpanded ? null : owner.id)
                  }
                  className="flex-1 text-left"
                  disabled={readOnly}
                >
                  <div className="space-y-1">
                    <p className="font-medium">{owner.name}</p>
                    {owner.role && (
                      <p className="text-sm text-muted-foreground">{owner.role}</p>
                    )}
                    {owner.email && (
                      <p className="text-sm text-muted-foreground">{owner.email}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {completedCount}/{ownerTasks.length} oppgaver fullført
                    </p>
                  </div>
                </button>
                {!readOnly && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteOwner(owner.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>

              {isExpanded && (
                <div className="mt-4 space-y-3 border-t pt-3">
                  <div className="space-y-2">
                    {ownerTasks.map((task) => (
                      <div
                        key={task.id}
                        className="flex items-center gap-2 group"
                      >
                        <button
                          onClick={() =>
                            handleToggleTask(task.id, task.completed || false)
                          }
                          disabled={readOnly}
                          className="flex-shrink-0"
                        >
                          {task.completed ? (
                            <CheckSquare className="h-4 w-4 text-primary" />
                          ) : (
                            <Square className="h-4 w-4" />
                          )}
                        </button>
                        <span
                          className={
                            task.completed
                              ? "line-through text-muted-foreground flex-1"
                              : "flex-1"
                          }
                        >
                          {task.title}
                        </span>
                        {!readOnly && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteTask(task.id)}
                            className="opacity-0 group-hover:opacity-100"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>

                  {!readOnly && (
                    <div className="flex gap-2">
                      <Input
                        placeholder="Ny oppgave..."
                        value={newTask[owner.id] || ""}
                        onChange={(e) =>
                          setNewTask((prev) => ({
                            ...prev,
                            [owner.id]: e.target.value,
                          }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            handleAddTask(owner.id);
                          }
                        }}
                      />
                      <Button
                        size="sm"
                        onClick={() => handleAddTask(owner.id)}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {!readOnly && (
        <Card className="p-4">
          <div className="space-y-3">
            <Label>Legg til anbudseier</Label>
            <div className="space-y-2">
              <Select value={selectedMember} onValueChange={setSelectedMember}>
                <SelectTrigger>
                  <SelectValue placeholder="Velg medlem" />
                </SelectTrigger>
                <SelectContent>
                  {members.map((member) => (
                    <SelectItem key={member.user_id} value={member.email}>
                      {member.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                placeholder="Rolle (valgfritt)"
                value={ownerRole}
                onChange={(e) => setOwnerRole(e.target.value)}
              />
            </div>
            <Button onClick={handleAddOwner} className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              Legg til
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
};
