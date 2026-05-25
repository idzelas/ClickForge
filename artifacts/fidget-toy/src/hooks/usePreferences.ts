import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";

export function useGetPreferences() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["user-preferences", user?.id],
    queryFn: async () => {
      if (!user) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("user_preferences")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return {
        sidebarMode: (data?.sidebar_mode === "advanced" ? "advanced" : "simple") as
          | "simple"
          | "advanced",
      };
    },
    enabled: !!user,
  });
}

export function useUpdatePreferences() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (prefs: { sidebarMode: "simple" | "advanced" }) => {
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase.from("user_preferences").upsert(
        {
          user_id: user.id,
          sidebar_mode: prefs.sidebarMode,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );
      if (error) throw error;
      return prefs;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-preferences"] });
    },
  });
}
