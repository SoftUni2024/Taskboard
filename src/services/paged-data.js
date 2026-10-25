import { supabase } from "./supabase.js";
import { sanitizeRichText } from "./rich-text.js";
export const PROJECT_PAGE_SIZE = 20;
export const TASK_BATCH_SIZE = 20;
export function normalizePage(value) {
  const page = Number(value);
  return Number.isSafeInteger(page) &&
    page > 0 &&
    Number.isSafeInteger(page * PROJECT_PAGE_SIZE)
    ? page
    : 1;
}
export async function loadProjectPage(page = 1, search = "") {
  page = normalizePage(page);
  let query = supabase
    .from("projects")
    .select("*,project_stages(count),tasks(count),done_tasks:tasks(count)", {
      count: "exact",
    })
    .eq("done_tasks.done", true)
    .order("title")
    .order("id");
  if (search.trim()) {
    const pattern = JSON.stringify("%" + search.trim() + "%");
    query = query.or(`title.ilike.${pattern},description.ilike.${pattern}`);
  }
  const { data, error, count } = await query.range(
    (page - 1) * PROJECT_PAGE_SIZE,
    page * PROJECT_PAGE_SIZE - 1,
  );
  if (error?.code === "PGRST103") {
    let query = supabase
      .from("projects")
      .select("id", { count: "exact", head: true });
    if (search.trim()) {
      const pattern = JSON.stringify("%" + search.trim() + "%");
      query = query.or(`title.ilike.${pattern},description.ilike.${pattern}`);
    }
    const result = await query;
    if (result.error) throw new Error(result.error.message);
    return { count: result.count, projects: [] };
  }
  if (error) throw new Error(error.message);
  return {
    count,
    projects: data.map(({ project_stages, tasks, done_tasks, ...project }) => ({
      ...project,
      owner: project.owner_id,
      stage_count: project_stages[0]?.count || 0,
      total: tasks[0]?.count || 0,
      done: done_tasks[0]?.count || 0,
    })),
  };
}
export async function loadPagedBoard(project, user, limits = {}, search = "") {
  const [
    { data: record, error: projectError },
    { data: stages, error: stageError },
  ] = await Promise.all([
    supabase.from("projects").select("*").eq("id", project).single(),
    supabase
      .from("project_stages")
      .select("*")
      .eq("project_id", project)
      .order("position")
      .order("id"),
  ]);
  if (projectError || stageError)
    throw new Error((projectError || stageError).message);
  const pages = await Promise.all(
    stages.map(async (stage, index) => {
      const limit = limits[stage.id] || TASK_BATCH_SIZE;
      let rows = [],
        count = 0;
      for (let offset = 0; offset < limit; offset += 500) {
        let q = supabase
          .from("tasks")
          .select("*", { count: "exact" })
          .eq("project_id", project)
          .eq("stage_id", stage.id)
          .order("position")
          .order("id");
        if (search.trim()) q = q.ilike("title", "%" + search.trim() + "%");
        const response = await q.range(
          offset,
          Math.min(offset + 499, limit - 1),
        );
        if (response.error) throw new Error(response.error.message);
        count = response.count || 0;
        rows.push(...response.data);
        if (response.data.length < Math.min(500, limit - offset)) break;
      }
      return {
        count,
        tasks: rows.map((task) => ({
          ...task,
          project: task.project_id,
          stage: index,
          stage_name: stage.name,
          description: sanitizeRichText(task.description),
        })),
      };
    }),
  );
  return {
    user,
    project: { ...record, owner: record.owner_id },
    stages,
    counts: pages.map((p) => p.count),
    total: pages.reduce((sum, p) => sum + p.count, 0),
    tasks: pages.flatMap((p) => p.tasks),
  };
}
export async function nextUnloadedTask(project, stage, loadedCount) {
  const { data, error } = await supabase
    .from("tasks")
    .select("id")
    .eq("project_id", project)
    .eq("stage_id", stage)
    .order("position")
    .order("id")
    .range(loadedCount, loadedCount);
  if (error) throw new Error(error.message);
  return data[0]?.id || null;
}
