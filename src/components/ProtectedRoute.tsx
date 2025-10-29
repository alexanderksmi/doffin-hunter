import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";

type ProtectedRouteProps = {
  children: React.ReactNode;
  requireOrg?: boolean;
};

export const ProtectedRoute = ({ children, requireOrg = true }: ProtectedRouteProps) => {
  const { user, organizationId, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        navigate("/login");
      } else if (requireOrg && !organizationId) {
        navigate("/onboarding");
      }
    }
  }, [user, organizationId, loading, navigate, requireOrg]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if (requireOrg && !organizationId) {
    return null;
  }

  return <>{children}</>;
};
