import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import type { Database } from "../lib/database.types";

type ProjectRow = Database["public"]["Tables"]["projects"]["Row"];
type ProjectInsert = Database["public"]["Tables"]["projects"]["Insert"];

export interface Project {
  id: number;
  userId: string;
  name: string;
  svgData: string;
  extrudeDepth: number;
  keycapSize: number;
  pegRadius: number;
  settings: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

function rowToProject(row: ProjectRow): Project {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    svgData: row.svg_data,
    extrudeDepth: row.extrude_depth,
    keycapSize: row.keycap_size,
    pegRadius: row.peg_radius,
    settings: row.settings,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function useListProjects() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["projects", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .order("updated_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []).map(rowToProject);
    },
    enabled: !!user,
  });
}

export function useGetProject(id: number | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["projects", id],
    queryFn: async () => {
      if (!id) throw new Error("No project id");
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw error;
      return rowToProject(data);
    },
    enabled: !!user && !!id,
  });
}

export function useProjectStats() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["projects", "stats", user?.id],
    queryFn: async () => {
      const { data, error, count } = await supabase
        .from("projects")
        .select("*", { count: "exact" })
        .order("updated_at", { ascending: false })
        .limit(1);
      if (error) throw error;
      const mostRecentProject = data?.[0] ? rowToProject(data[0]) : null;
      return {
        totalProjects: count ?? 0,
        totalExports: 0, // export_count tracking can be added later
        mostRecentProject,
      };
    },
    enabled: !!user,
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: {
      name: string;
      svgData: string;
      extrudeDepth?: number;
      keycapSize?: number;
      pegRadius?: number;
      settings?: Record<string, unknown> | null;
    }) => {
      if (!user) throw new Error("Not authenticated");
      const row: ProjectInsert = {
        user_id: user.id,
        name: input.name,
        svg_data: input.svgData,
        extrude_depth: input.extrudeDepth ?? 4,
        keycap_size: input.keycapSize ?? 14,
        peg_radius: input.pegRadius ?? 3.5,
        settings: input.settings ?? null,
      };
      const { data, error } = await supabase
        .from("projects")
        .insert(row)
        .select()
        .single();
      if (error) throw error;
      return rowToProject(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}

export function useUpdateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: {
      id: number;
      name?: string;
      svgData?: string;
      extrudeDepth?: number;
      keycapSize?: number;
      pegRadius?: number;
      settings?: Record<string, unknown> | null;
    }) => {
      const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (updates.name !== undefined) row.name = updates.name;
      if (updates.svgData !== undefined) row.svg_data = updates.svgData;
      if (updates.extrudeDepth !== undefined) row.extrude_depth = updates.extrudeDepth;
      if (updates.keycapSize !== undefined) row.keycap_size = updates.keycapSize;
      if (updates.pegRadius !== undefined) row.peg_radius = updates.pegRadius;
      if (updates.settings !== undefined) row.settings = updates.settings;

      const { data, error } = await supabase
        .from("projects")
        .update(row)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return rowToProject(data);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["projects", variables.id] });
    },
  });
}

export function useDeleteProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase
        .from("projects")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}
