import { supabase } from "./supabase.js";
import { auth, appUser } from "./auth.js";
import { sanitizeRichText } from "./rich-text.js";
import { isAdmin } from "./authorization.js";
import {
  removeTaskAttachments,
  removeProjectAttachments,
} from "./attachments.js";

async function result(query) {
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data;
}
const palette = ["#8b9b73", "#8d86bb", "#d49a71", "#7ca5af", "#c78091"];
function projectView(project) {
  const index =
    [...project.id].reduce((sum, char) => sum + char.charCodeAt(0), 0) %
    palette.length;
  return { ...project, owner: project.owner_id, color: palette[index] };
}
async function projectStages(project) {
  return result(
    supabase
      .from("project_stages")
      .select("*")
      .eq("project_id", project)
      .order("position")
      .order("id"),
  );
}
function validStage(stages, index) {
  const stage = stages[Number(index)];
  if (!Number.isInteger(Number(index)) || !stage)
    throw new Error("Choose a valid project stage.");
  return stage;
}
async function lastPosition(project, stage) {
  const rows = await result(
    supabase
      .from("tasks")
      .select("position")
      .eq("project_id", project)
      .eq("stage_id", stage)
      .order("position", { ascending: false })
      .limit(1),
  );
  return (rows[0]?.position ?? -1) + 1;
}
export async function loadBoard(project, signal) {
  const user = await auth.currentUser();
  if (!user) return { user: null, projects: [] };
  if (project) {
    let projectQuery = supabase
      .from("projects")
      .select("*")
      .eq("id", project)
      .single();
    if (signal) projectQuery = projectQuery.abortSignal(signal);
    const [record, stages, tasks] = await Promise.all([
      result(projectQuery),
      projectStages(project),
      result(
        supabase
          .from("tasks")
          .select("*")
          .eq("project_id", project)
          .order("position")
          .order("id"),
      ),
    ]);
    return {
      user,
      project: projectView(record),
      stages,
      members: [],
      owner: user,
      tasks: tasks.map((task) => ({
        ...task,
        project: task.project_id,
        stage: stages.findIndex((stage) => stage.id === task.stage_id),
        stage_name: stages.find((stage) => stage.id === task.stage_id)?.name,
        description: sanitizeRichText(task.description),
      })),
    };
  }
  const projects = await result(
    supabase
      .from("projects")
      .select("*, project_stages(count), tasks(count), done_tasks:tasks(count)")
      .eq("done_tasks.done", true)
      .order("title"),
  );
  return {
    user,
    projects: projects.map(
      ({ tasks, done_tasks, project_stages, ...project }) => ({
        ...projectView(project),
        stage_count: project_stages[0]?.count ?? 0,
        total: tasks[0]?.count ?? 0,
        done: done_tasks[0]?.count ?? 0,
      }),
    ),
  };
}

export async function mutateBoard(action, values) {
  const user = await auth.currentUser();
  if (!user) throw new Error("Sign in to continue.");
  const { project, id } = values;
  if (action === "profile") {
    const name = String(values.name || "").trim();
    if (!name || name.length > 80)
      throw new Error("Enter a display name of 1–80 characters.");
    const data = await result(
      supabase.auth.updateUser({ data: { display_name: name } }),
    );
    return { user: appUser(data.user) };
  }
  if (action === "createProject") {
    return {
      id: await result(
        supabase.rpc("create_project_with_stages", {
          p_title: values.title,
          p_description: values.description || "",
        }),
      ),
    };
  }
  if (!project) throw new Error("Project is required.");
  if (action === "editProject" || action === "deleteProject") {
    const record = await result(
      supabase.from("projects").select("owner_id").eq("id", project).single(),
    );
    if (record.owner_id !== user.id && !(await isAdmin()))
      throw new Error(
        "Only the project owner can edit or delete this project.",
      );
  }
  if (action === "editProject") {
    await result(
      supabase
        .from("projects")
        .update({
          title: values.title.trim(),
          description: values.description || "",
        })
        .eq("id", project)
        .select("id")
        .single(),
    );
  } else if (action === "deleteProject") {
    await removeProjectAttachments(project);
    await result(
      supabase
        .from("projects")
        .delete()
        .eq("id", project)
        .select("id")
        .single(),
    );
  } else if (action === "moveTask") {
    const target = validStage(await projectStages(project), values.stage);
    await result(
      supabase.rpc("move_project_task", {
        p_task_id: id,
        p_stage_id: target.id,
        p_before_id: values.before || null,
      }),
    );
  } else if (action === "createTask" || action === "editTask") {
    const target = validStage(await projectStages(project), values.stage);
    const row = {
      title: values.title.trim(),
      description: sanitizeRichText(values.description),
      stage_id: target.id,
      done: target.name === "Done",
    };
    // Preserve assignment for callers that only edit other task details.
    if (Object.hasOwn(values, "assignee_id")) row.assignee_id = values.assignee_id || null;
    if (action === "createTask") {
      await result(
        supabase.from("tasks").insert({
          ...row,
          project_id: project,
          position: await lastPosition(project, target.id),
        }),
      );
    } else {
      // The RPC handles cross-column movement transactionally with the same RLS.
      const current = await result(
        supabase
          .from("tasks")
          .select("stage_id")
          .eq("id", id)
          .eq("project_id", project)
          .single(),
      );
      if (current.stage_id !== target.id)
        await result(
          supabase.rpc("move_project_task", {
            p_task_id: id,
            p_stage_id: target.id,
            p_before_id: null,
          }),
        );
      await result(
        supabase
          .from("tasks")
          .update(row)
          .eq("id", id)
          .eq("project_id", project)
          .select("id")
          .single(),
      );
    }
  } else if (action === "deleteTask") {
    await removeTaskAttachments(project, id);
    await result(
      supabase
        .from("tasks")
        .delete()
        .eq("id", id)
        .eq("project_id", project)
        .select("id")
        .single(),
    );
  } else throw new Error("Unsupported operation.");
  return { ok: true };
}
