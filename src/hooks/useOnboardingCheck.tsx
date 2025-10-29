import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

export const useOnboardingCheck = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);

  useEffect(() => {
    const checkOnboarding = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          // User not authenticated, redirect to auth
          navigate("/auth");
          return;
        }

        // Check if user has an organization
        const { data: userRole } = await supabase
          .from("user_roles")
          .select("organization_id")
          .eq("user_id", user.id)
          .single();

        if (!userRole) {
          // No organization found, redirect to onboarding
          navigate("/onboarding");
          setHasCompletedOnboarding(false);
        } else {
          setHasCompletedOnboarding(true);
        }
      } catch (error) {
        console.error("Error checking onboarding status:", error);
        // On error, assume onboarding is needed
        navigate("/onboarding");
      } finally {
        setLoading(false);
      }
    };

    checkOnboarding();
  }, [navigate]);

  return { loading, hasCompletedOnboarding };
};
