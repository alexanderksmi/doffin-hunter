import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Trash2, Plus, CheckSquare, Square } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import type { Database } from "@/integrations/supabase/types";

type Owner = {
  id: string;
  name: string;
  email: string | null;
};

type Task = {
  id: string;
  title: string;
  description: string | null;
  completed: boolean;
  due_date: string | null;
  owner_id: string;
};

type StageOwnersProps = {
  savedTenderId: string;
  stage: Database["public"]["Enums"]["tender_stage"];
};

export const StageOwners = ({ savedTenderId, stage }: StageOwnersProps) => {
  const { toast } = useToast();
  const [owners, setOwners] = useState<Owner[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [newOwner, setNewOwner] = useState({ name: "", email: "" });
  const [newTask, setNewTask] = useState<{ [ownerId: string]: string }>({});
  const [expandedOwner, setExpandedOwner] = useState<string | null>(null);

  useEffect(() => {
    loadOwnersAndTasks();
  }, [savedTenderId, stage]);

  const loadOwnersAndTasks = async () => {
    try {
      const [ownersRes, tasksRes] = await Promise.all([
        supabase
          .from("tender_owners")
          .select("*")
          .eq("saved_tender_id", savedTenderId)
          .eq("stage", stage)
          .order("created_at", { ascending: true }),
        supabase
          .from("tender_tasks")
          .select("*")
          .eq("saved_tender_id", savedTenderId)
          .eq("stage", stage)
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

  const handleAddOwner = async () => {
    if (!newOwner.name.trim()) {
      toast({
        title: "Feil",
        description: "Navn er påkrevd",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase.from("tender_owners").insert({
        saved_tender_id: savedTenderId,
        stage,
        name: newOwner.name,
        email: newOwner.email || null,
      });

      if (error) throw error;

      setNewOwner({ name: "", email: "" });
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
      const { error } = await supabase.from("tender_owners").delete().eq("id", id);
      if (error) throw error;
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
      const { error } = await supabase.from("tender_tasks").insert({
        saved_tender_id: savedTenderId,
        owner_id: ownerId,
        stage,
        title,
      });

      if (error) throw error;

      setNewTask({ ...newTask, [ownerId]: "" });
      loadOwnersAndTasks();
    } catch (error) {
      console.error("Error adding task:", error);
      toast({
        title: "Feil",
        description: "Kunne ikke legge til oppgave",
        variant: "destructive",
      });
    }
  };

  const handleToggleTask = async (task: Task) => {
    try {
      const { error } = await supabase
        .from("tender_tasks")
        .update({ completed: !task.completed })
        .eq("id", task.id);

      if (error) throw error;
      loadOwnersAndTasks();
    } catch (error) {
      console.error("Error toggling task:", error);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      const { error } = await supabase
        .from("tender_tasks")
        .delete()
        .eq("id", taskId);

      if (error) throw error;
      loadOwnersAndTasks();
    } catch (error) {
      console.error("Error deleting task:", error);
    }
  };

  const getOwnerTasks = (ownerId: string) => tasks.filter((t) => t.owner_id === ownerId);

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-base font-semibold">Anbudseiere</Label>
        <p className="text-sm text-muted-foreground">
          Personer med ansvar og deres oppgaver
        </p>
      </div>

      <div className="space-y-3">
        {owners.map((owner) => {
          const ownerTasks = getOwnerTasks(owner.id);
          const isExpanded = expandedOwner === owner.id;

          return (
            <Card key={owner.id} className="p-4">
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="font-medium">{owner.name}</p>
                    {owner.email && (
                      <p className="text-sm text-muted-foreground">{owner.email}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {ownerTasks.length} oppgaver
                      {ownerTasks.length > 0 &&
                        ` (${ownerTasks.filter((t) => t.completed).length} fullført)`}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setExpandedOwner(isExpanded ? null : owner.id)
                      }
                    >
                      {isExpanded ? "Skjul" : "Vis oppgaver"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteOwner(owner.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="space-y-2 pt-3 border-t">
                    {ownerTasks.map((task) => (
                      <div
                        key={task.id}
                        className="flex items-start gap-2 p-2 rounded hover:bg-muted/50"
                      >
                        <Checkbox
                          checked={task.completed}
                          onCheckedChange={() => handleToggleTask(task)}
                          className="mt-1"
                        />
                        <div className="flex-1">
                          <p
                            className={`text-sm ${
                              task.completed
                                ? "line-through text-muted-foreground"
                                : ""
                            }`}
                          >
                            {task.title}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteTask(task.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}

                    <div className="flex gap-2 pt-2">
                      <Input
                        placeholder="Ny oppgave..."
                        value={newTask[owner.id] || ""}
                        onChange={(e) =>
                          setNewTask({ ...newTask, [owner.id]: e.target.value })
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
                  </div>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      <Card className="p-4 bg-muted/50">
        <div className="space-y-3">
          <Label className="text-sm font-medium">Legg til anbudseier</Label>
          <div className="flex gap-2">
            <Input
              placeholder="Navn *"
              value={newOwner.name}
              onChange={(e) => setNewOwner({ ...newOwner, name: e.target.value })}
              className="flex-1"
            />
            <Input
              type="email"
              placeholder="E-post"
              value={newOwner.email}
              onChange={(e) => setNewOwner({ ...newOwner, email: e.target.value })}
              className="flex-1"
            />
          </div>
          <Button onClick={handleAddOwner} size="sm" className="w-full">
            <Plus className="h-4 w-4 mr-2" />
            Legg til
          </Button>
        </div>
      </Card>
    </div>
  );
};
