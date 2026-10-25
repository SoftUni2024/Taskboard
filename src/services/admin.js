import { supabase } from "./supabase.js";
import { auth } from "./auth.js";
import { isAdmin } from "./authorization.js";
import { removeTaskAttachments } from "./attachments.js";
export async function requireAdmin() {
  const user = await auth.currentUser();
  if (!user) {
    const { navigate } = await import("../router.js");
    await navigate("/login", { replace: true });
    return null;
  }
  if (!(await isAdmin())) throw new Error("Administrator access required.");
  return user;
}
export async function result(query) {
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data;
}
export const listAdminUsers = (search = "", offset = 0) =>
  result(
    supabase.rpc("admin_list_users", { p_search: search, p_offset: offset }),
  );
export async function updateAdminUser(values) {
  const { data, error } = await supabase.functions.invoke("admin-users", {
    body: { action: "update", ...values },
  });
  if (error) {
    let message = error.message;
    try {
      message = (await error.context.json()).error || message;
    } catch {}
    throw new Error(message);
  }
  if (data.error) throw new Error(data.error);
  return data;
}
export async function deleteAdminUser(id) {
  const { data, error } = await supabase.functions.invoke("admin-users", {
    body: { action: "delete", id },
  });
  if (error) {
    let message = error.message;
    try {
      message = (await error.context.json()).error || message;
    } catch {}
    throw new Error(message);
  }
  if (data.error) throw new Error(data.error);
  return data;
}
export async function deleteAdminStage(project, stage) {
  if (!(await isAdmin())) throw new Error("Administrator access required.");
  for (let offset = 0; ; offset += 100) {
    const tasks = await result(
      supabase
        .from("tasks")
        .select("id")
        .eq("project_id", project)
        .eq("stage_id", stage)
        .order("id")
        .range(offset, offset + 99),
    );
    for (const task of tasks) await removeTaskAttachments(project, task.id);
    if (tasks.length < 100) break;
  }
  await result(
    supabase
      .from("project_stages")
      .delete()
      .eq("id", stage)
      .eq("project_id", project)
      .select()
      .single(),
  );
}
export const saveAdminStage = (stage, name, position) =>
  result(
    supabase.rpc("admin_save_stage", {
      p_stage: stage,
      p_name: name,
      p_position: position,
    }),
  );
