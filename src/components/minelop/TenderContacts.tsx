import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Trash2, Plus } from "lucide-react";

type Contact = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: string | null;
};

type TenderContactsProps = {
  savedTenderId: string;
  readOnly?: boolean;
};

export const TenderContacts = ({ savedTenderId, readOnly = false }: TenderContactsProps) => {
  const { toast } = useToast();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [newContact, setNewContact] = useState({
    name: "",
    email: "",
    phone: "",
    role: "",
  });

  useEffect(() => {
    loadContacts();
  }, [savedTenderId]);

  const loadContacts = async () => {
    try {
      const { data, error } = await supabase
        .from("tender_contacts")
        .select("*")
        .eq("saved_tender_id", savedTenderId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      setContacts(data || []);
    } catch (error) {
      console.error("Error loading contacts:", error);
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

  const handleAddContact = async () => {
    if (!newContact.name.trim()) {
      toast({
        title: "Feil",
        description: "Navn er påkrevd",
        variant: "destructive",
      });
      return;
    }

    try {
      const contactData = {
        saved_tender_id: savedTenderId,
        name: newContact.name,
        email: newContact.email || null,
        phone: newContact.phone || null,
        role: newContact.role || null,
      };

      const { error } = await supabase.from("tender_contacts").insert(contactData);
      if (error) throw error;

      // Sync to linked tender
      const linkedTenderId = await getLinkedTenderId(savedTenderId);
      if (linkedTenderId) {
        await supabase.from("tender_contacts").insert({
          ...contactData,
          saved_tender_id: linkedTenderId,
        });
      }

      setNewContact({ name: "", email: "", phone: "", role: "" });
      loadContacts();
      toast({ title: "Kontaktperson lagt til" });
    } catch (error) {
      console.error("Error adding contact:", error);
      toast({
        title: "Feil",
        description: "Kunne ikke legge til kontaktperson",
        variant: "destructive",
      });
    }
  };

  const handleDeleteContact = async (id: string) => {
    try {
      // Get contact details before deleting
      const { data: contact } = await supabase
        .from("tender_contacts")
        .select("name, email, phone")
        .eq("id", id)
        .single();

      const { error } = await supabase
        .from("tender_contacts")
        .delete()
        .eq("id", id);

      if (error) throw error;

      // Sync deletion to linked tender
      if (contact) {
        const linkedTenderId = await getLinkedTenderId(savedTenderId);
        if (linkedTenderId) {
          // Delete matching contact in linked tender
          await supabase
            .from("tender_contacts")
            .delete()
            .eq("saved_tender_id", linkedTenderId)
            .eq("name", contact.name)
            .eq("email", contact.email)
            .eq("phone", contact.phone);
        }
      }

      loadContacts();
      toast({ title: "Kontaktperson slettet" });
    } catch (error) {
      console.error("Error deleting contact:", error);
      toast({
        title: "Feil",
        description: "Kunne ikke slette kontaktperson",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-base font-semibold">Kontaktpersoner</Label>
        <p className="text-sm text-muted-foreground">
          Eksterne kontaktpersoner for dette anbudet
        </p>
      </div>

      <div className="space-y-3">
        {contacts.map((contact) => (
          <Card key={contact.id} className="p-3">
            <div className="flex items-start justify-between">
              <div className="space-y-1 flex-1">
                <p className="font-medium">{contact.name}</p>
                {contact.role && (
                  <p className="text-sm text-muted-foreground">{contact.role}</p>
                )}
                <div className="flex gap-4 text-sm">
                  {contact.email && (
                    <span className="text-muted-foreground">{contact.email}</span>
                  )}
                  {contact.phone && (
                    <span className="text-muted-foreground">{contact.phone}</span>
                  )}
                </div>
              </div>
              {!readOnly && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDeleteContact(contact.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </Card>
        ))}
      </div>

      {!readOnly && (
        <Card className="p-4">
          <div className="space-y-3">
            <Label>Legg til kontaktperson</Label>
            <div className="space-y-2">
              <Input
                placeholder="Navn *"
                value={newContact.name}
                onChange={(e) =>
                  setNewContact((prev) => ({ ...prev, name: e.target.value }))
                }
              />
              <Input
                placeholder="Rolle"
                value={newContact.role}
                onChange={(e) =>
                  setNewContact((prev) => ({ ...prev, role: e.target.value }))
                }
              />
              <Input
                type="email"
                placeholder="E-post"
                value={newContact.email}
                onChange={(e) =>
                  setNewContact((prev) => ({ ...prev, email: e.target.value }))
                }
              />
              <Input
                type="tel"
                placeholder="Telefon"
                value={newContact.phone}
                onChange={(e) =>
                  setNewContact((prev) => ({ ...prev, phone: e.target.value }))
                }
              />
            </div>
            <Button onClick={handleAddContact} className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              Legg til
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
};
