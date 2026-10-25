import { supabase } from "./supabase.js";
import { commentBody } from "./comment-rules.js";
async function result(query) {
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data;
}
export async function listComments(task, limit = 30) {
  const comments = [];
  let page = [];
  for (let offset = 0; offset < limit; offset += 30) {
    page = await result(
      supabase.rpc("list_task_comments", { p_task: task, p_offset: offset }),
    );
    comments.push(...page);
    if (page.length < 30) break;
  }
  return { comments, hasMore: page.length === 30 };
}
export const addComment = (task, body) =>
  result(
    supabase
      .from("task_comments")
      .insert({ task_id: task, body: commentBody(body) })
      .select()
      .single(),
  );
export const editComment = (id, body) =>
  result(
    supabase
      .from("task_comments")
      .update({ body: commentBody(body) })
      .eq("id", id)
      .select()
      .single(),
  );
export const deleteComment = (id) =>
  result(
    supabase.from("task_comments").delete().eq("id", id).select().single(),
  );
