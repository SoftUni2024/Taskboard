import { supabase } from "./supabase.js";
export async function taskAssignees(project) {
  const { data, error } = await supabase.rpc("task_assignees", { p_project: project });
  if (error) throw new Error(error.message);
  return data;
}
export function assigneeName(task, people) {
  return people.find(person => person.id === task.assignee_id)?.name || "Unassigned";
}
