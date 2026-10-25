import { supabase } from "./supabase.js";
async function result(query) {
  const { data, error } = await query;
  if (error)
    throw new Error(
      error.code === "23505" ? "This user is already assigned." : error.message,
    );
  return data;
}
export const projectPeople = (project) =>
  result(supabase.rpc("list_project_people", { p_project: project }));
export const searchProjectUsers = (project, search = "", offset = 0) =>
  result(
    supabase.rpc("list_project_users", {
      p_project: project,
      p_search: search,
      p_offset: offset,
    }),
  );
export const addProjectUser = (project, user) =>
  result(
    supabase
      .from("project_members")
      .insert({ project_id: project, user_id: user })
      .select()
      .single(),
  );
export const removeProjectUser = (project, user) =>
  result(
    supabase
      .from("project_members")
      .delete()
      .eq("project_id", project)
      .eq("user_id", user)
      .select()
      .single(),
  );
export const getProject = (project) =>
  result(
    supabase
      .from("projects")
      .select("id,title,owner_id")
      .eq("id", project)
      .single(),
  );
