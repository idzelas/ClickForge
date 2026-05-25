import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import type { Database } from "../lib/database.types";

type SvgDesignRow = Database["public"]["Tables"]["svg_designs"]["Row"];

export interface SvgDesign {
  id: number;
  userId: string;
  name: string;
  svgData: string;
  createdAt: string;
  updatedAt: string;
}

function rowToDesign(row: SvgDesignRow): SvgDesign {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    svgData: row.svg_data,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function useListSvgDesigns() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["svg-designs", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("svg_designs")
        .select("*")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map(rowToDesign);
    },
    enabled: !!user,
  });
}

export function getListSvgDesignsQueryKey(userId?: string) {
  return ["svg-designs", userId];
}

export function useCreateSvgDesign() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: { name: string; svgData: string }) => {
      if (!user) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("svg_designs")
        .insert({
          user_id: user.id,
          name: input.name.trim(),
          svg_data: input.svgData.trim(),
        })
        .select()
        .single();
      if (error) throw error;
      return rowToDesign(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["svg-designs"] });
    },
  });
}

export function useDeleteSvgDesign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase
        .from("svg_designs")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["svg-designs"] });
    },
  });
}
