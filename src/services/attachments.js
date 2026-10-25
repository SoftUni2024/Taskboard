import { supabase } from "./supabase.js";
import {
  validateFile,
  safeFilename,
  attachmentName,
} from "./attachment-rules.js";
const bucket = supabase.storage.from("task-attachments");
async function value(query) {
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data;
}
async function prefix(project, task) {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error) throw error;
  if (!user) throw new Error("Sign in to continue.");
  const record = await value(
    supabase.from("projects").select("owner_id").eq("id", project).single(),
  );
  return `${record.owner_id}/${project}/${task}`;
}
export async function listAttachments(project, task) {
  const folder = await prefix(project, task),
    all = [];
  for (let offset = 0; ; offset += 100) {
    const page = await value(
      bucket.list(folder, {
        limit: 100,
        offset,
        sortBy: { column: "name", order: "asc" },
      }),
    );
    all.push(
      ...page
        .filter((item) => item.id)
        .map((item) => ({
          ...item,
          path: `${folder}/${item.name}`,
          filename: attachmentName(item.name),
        })),
    );
    if (page.length < 100) return all;
  }
}
export async function uploadAttachment(project, task, file) {
  const contentType = validateFile(file);
  const folder = await prefix(project, task);
  return value(
    bucket.upload(
      `${folder}/${crypto.randomUUID()}--${safeFilename(file.name)}`,
      file,
      { contentType, upsert: false },
    ),
  );
}
export async function downloadAttachment(file) {
  return value(bucket.download(file.path));
}
export async function removeAttachment(file) {
  return value(bucket.remove([file.path]));
}
export async function removeTaskAttachments(project, task) {
  const files = await listAttachments(project, task);
  for (let i = 0; i < files.length; i += 100)
    await value(
      bucket.remove(files.slice(i, i + 100).map((file) => file.path)),
    );
}
export async function removeProjectAttachments(project) {
  for (let offset = 0; ; offset += 100) {
    const tasks = await value(
      supabase
        .from("tasks")
        .select("id")
        .eq("project_id", project)
        .order("id")
        .range(offset, offset + 99),
    );
    for (const task of tasks) await removeTaskAttachments(project, task.id);
    if (tasks.length < 100) return;
  }
}
