import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { LogOut, User, Building2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export const ProfileMenu = () => {
  const { user, organizationId, userRole, signOut } = useAuth();
  const [organizationName, setOrganizationName] = useState<string | null>(null);

  useEffect(() => {
    const fetchOrganization = async () => {
      if (!organizationId) return;

      const { data, error } = await supabase
        .from("organizations")
        .select("name")
        .eq("id", organizationId)
        .single();

      if (error) {
        console.error("Error fetching organization:", error);
        return;
      }

      setOrganizationName(data.name);
    };

    fetchOrganization();
  }, [organizationId]);

  if (!user) return null;

  const getInitials = (email: string) => {
    return email.substring(0, 2).toUpperCase();
  };

  const getRoleBadgeVariant = (role: string | null) => {
    switch (role) {
      case "admin":
        return "destructive";
      case "editor":
        return "default";
      case "viewer":
        return "secondary";
      default:
        return "outline";
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-10 w-10 rounded-full">
          <Avatar className="h-10 w-10">
            <AvatarFallback className="bg-primary text-primary-foreground">
              {getInitials(user.email || "?")}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64" align="end">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-2">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4" />
              <p className="text-sm font-medium leading-none">{user.email}</p>
            </div>
            {organizationName && (
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                <p className="text-xs text-muted-foreground">{organizationName}</p>
              </div>
            )}
            {userRole && (
              <Badge variant={getRoleBadgeVariant(userRole)} className="w-fit">
                {userRole.charAt(0).toUpperCase() + userRole.slice(1)}
              </Badge>
            )}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={signOut} className="cursor-pointer">
          <LogOut className="mr-2 h-4 w-4" />
          <span>Logg ut</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
