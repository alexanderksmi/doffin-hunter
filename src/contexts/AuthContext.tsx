import { createContext, useContext, useEffect, useState } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

type UserRole = "admin" | "editor" | "viewer";

type AuthContextType = {
  user: User | null;
  session: Session | null;
  organizationId: string | null;
  userRole: UserRole | null;
  loading: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchUserOrganization = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("user_roles")
        .select("organization_id, role")
        .eq("user_id", userId)
        .maybeSingle();

      if (error) {
        console.error("Error fetching user organization:", error);
        return null;
      }

      // data will be null if user has no organization yet (new user)
      return data;
    } catch (error) {
      console.error("Error in fetchUserOrganization:", error);
      return null;
    }
  };

  useEffect(() => {
    let mounted = true;

    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;
        
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          const orgData = await fetchUserOrganization(session.user.id);
          if (!mounted) return;
          
          if (orgData) {
            setOrganizationId(orgData.organization_id);
            setUserRole(orgData.role as UserRole);
          } else {
            setOrganizationId(null);
            setUserRole(null);
          }
        } else {
          setOrganizationId(null);
          setUserRole(null);
        }
        setLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!mounted) return;
      
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        const orgData = await fetchUserOrganization(session.user.id);
        if (!mounted) return;
        
        if (orgData) {
          setOrganizationId(orgData.organization_id);
          setUserRole(orgData.role as UserRole);
        } else {
          setOrganizationId(null);
          setUserRole(null);
        }
      } else {
        setOrganizationId(null);
        setUserRole(null);
      }
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setOrganizationId(null);
    setUserRole(null);
    navigate("/login");
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        organizationId,
        userRole,
        loading,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
