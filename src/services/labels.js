import { supabase } from "./supabase.js";
async function result(query) {
  const { data, error } = await query;
  if (error) throw new Error(error.code === "23505" ? "A label with this name already exists." : error.message);
  return data;
}
export const projectLabels = project => result(supabase.from("project_labels").select("*").eq("project_id",project).order("name").order("id"));
export const taskLabelIds = task => result(supabase.from("task_labels").select("label_id").eq("task_id",task));
export const setTaskLabel = (project,task,label,enabled) => result(enabled
  ? supabase.from("task_labels").insert({project_id:project,task_id:task,label_id:label})
  : supabase.from("task_labels").delete().eq("task_id",task).eq("label_id",label).select().single());
export async function saveLabel(project,id,name,color) {
  name = String(name || "").trim();
  if(!name || name.length > 40) throw new Error("Enter a label name of 1–40 characters.");
  if(!/^#[0-9a-f]{6}$/i.test(color)) throw new Error("Choose a valid label color.");
  return result(id
    ? supabase.from("project_labels").update({name,color}).eq("id",id).eq("project_id",project).select().single()
    : supabase.from("project_labels").insert({project_id:project,name,color}).select().single());
}
export const deleteLabel = id => result(supabase.from("project_labels").delete().eq("id",id).select().single());
export function labelsFromTask(task) {
  return (task.task_labels || []).map(link => link.project_labels).filter(Boolean).sort((a,b)=>a.name.localeCompare(b.name));
}
export function labelChip(label) {
  const chip = document.createElement("span");
  chip.className = "task-label-chip";
  chip.textContent = label.name;
  const color = /^#[0-9a-f]{6}$/i.test(label.color) ? label.color : "#78935f";
  chip.style.borderColor = color;
  chip.style.backgroundColor = color + "18";
  return chip;
}
export async function labeledTaskPage(project,label,page=1) {
  const {data,error,count} = await supabase.from("tasks")
    .select("*,task_labels!inner(label_id),project_stages(name)",{count:"exact"})
    .eq("project_id",project).eq("task_labels.label_id",label)
    .order("title").order("id").range((page-1)*20,page*20-1);
  // Deletions can empty the last page between refreshes; let the page reset.
  if(error?.code === "PGRST103") return {tasks:[],count:0};
  if(error) throw new Error(error.message);
  return {tasks:data,count:count || 0};
}
