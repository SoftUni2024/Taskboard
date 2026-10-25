import assert from "node:assert/strict";
import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { supabase as owner } from "../src/services/supabase.js";
import {
  addComment,
  listComments,
  editComment,
  deleteComment,
} from "../src/services/comments.js";
const url = "https://jnehjelpwqqqeldsbeag.supabase.co",
  key = "sb_publishable_4Id5ZtV2dNGZTlrDB5tGqw_BCruvDpi";
const client = () =>
  createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
const member = client(),
  outsider = client(),
  admin = client(),
  temporary = client();
const ok = async (q) => {
  const { data, error } = await q;
  if (error) throw error;
  return data;
};
const ownerUser = (
  await ok(
    owner.auth.signInWithPassword({
      email: "steve@gmail.com",
      password: "pass123",
    }),
  )
).user;
const memberUser = (
  await ok(
    member.auth.signInWithPassword({
      email: "maria@gmail.com",
      password: "pass123",
    }),
  )
).user;
await ok(
  outsider.auth.signInWithPassword({
    email: "peter@gmail.com",
    password: "pass123",
  }),
);
await ok(
  admin.auth.signInWithPassword({
    email: process.env.ADMIN_EMAIL,
    password: process.env.ADMIN_PASSWORD,
  }),
);
const project = await ok(
  owner.rpc("create_project_with_stages", { p_title: "Comment QA temporary" }),
);
let channel, tempUser;
try {
  await ok(
    owner
      .from("project_members")
      .insert({ project_id: project, user_id: memberUser.id }),
  );
  const stages = await ok(
    owner
      .from("project_stages")
      .select("id")
      .eq("project_id", project)
      .order("position"),
  );
  const task = await ok(
    owner
      .from("tasks")
      .insert({
        project_id: project,
        stage_id: stages[0].id,
        title: "Discussion QA task",
      })
      .select()
      .single(),
  );
  const comment = await addComment(
    task.id,
    "  Owner message <b>plain text</b>  ",
  );
  assert.equal(comment.author_id, ownerUser.id);
  assert.equal(comment.body, "Owner message <b>plain text</b>");
  assert.equal((await listComments(task.id)).comments[0].author_name, "Steve");
  const reply = await ok(
    member
      .from("task_comments")
      .insert({ task_id: task.id, body: "Member reply" })
      .select()
      .single(),
  );
  assert.equal((await listComments(task.id)).comments.length, 2);
  assert.deepEqual(
    await ok(
      outsider.from("task_comments").select("id").eq("task_id", task.id),
    ),
    [],
  );
  assert.ok(
    (await outsider.rpc("list_task_comments", { p_task: task.id })).error,
  );
  assert.ok(
    (
      await outsider
        .from("task_comments")
        .insert({ task_id: task.id, body: "Forbidden" })
    ).error,
  );
  assert.deepEqual(
    await ok(
      owner
        .from("task_comments")
        .update({ body: "Forbidden edit" })
        .eq("id", reply.id)
        .select(),
    ),
    [],
  );
  assert.deepEqual(
    await ok(owner.from("task_comments").delete().eq("id", reply.id).select()),
    [],
  );
  assert.ok(
    (
      await member
        .from("task_comments")
        .update({ author_id: ownerUser.id })
        .eq("id", reply.id)
    ).error,
  );
  assert.ok(
    (
      await member
        .from("task_comments")
        .insert({ task_id: task.id, body: "Spoofed", author_id: ownerUser.id })
    ).error,
  );
  assert.ok(
    (
      await member
        .from("task_comments")
        .insert({ task_id: task.id, body: "x".repeat(4001) })
    ).error,
  );
  await editComment(comment.id, "Owner edited");
  await ok(
    admin
      .from("task_comments")
      .update({ body: "Admin moderated reply" })
      .eq("id", reply.id)
      .select()
      .single(),
  );
  await member.realtime.setAuth((await member.auth.getSession()).data.session.access_token);
  let signals = 0;
  channel = member
    .channel("comment-test-" + crypto.randomUUID())
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "project_task_changes",
        filter: `project_id=eq.${project}`,
      },
      () => signals++,
    );
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error("Realtime subscription timeout")),
      15000,
    );
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        clearTimeout(timeout);
        resolve();
      }
    });
  });
  await addComment(task.id, "Live discussion update");
  const until = Date.now() + 10000;
  while (!signals && Date.now() < until)
    await new Promise((resolve) => setTimeout(resolve, 50));
  assert.ok(signals > 0);
  await ok(
    owner
      .from("project_members")
      .delete()
      .eq("project_id", project)
      .eq("user_id", memberUser.id),
  );
  assert.deepEqual(
    await ok(member.from("task_comments").select("id").eq("task_id", task.id)),
    [],
  );
  assert.ok(
    (await member.rpc("list_task_comments", { p_task: task.id })).error,
  );
  const email = `comment-qa-${crypto.randomUUID()}@example.com`;
  tempUser = (
    await ok(
      temporary.auth.signUp({
        email,
        password: "QA!" + crypto.randomBytes(20).toString("base64url"),
        options: { data: { display_name: "Temporary author" } },
      }),
    )
  ).user;
  await ok(
    owner
      .from("project_members")
      .insert({ project_id: project, user_id: tempUser.id }),
  );
  const historical = await ok(
    temporary
      .from("task_comments")
      .insert({ task_id: task.id, body: "Keep this historical discussion" })
      .select()
      .single(),
  );
  const removed = await admin.functions.invoke("admin-users", {
    body: { action: "delete", id: tempUser.id },
  });
  if (removed.error) throw removed.error;
  tempUser = null;
  const preserved = (await listComments(task.id)).comments.find(
    (c) => c.id === historical.id,
  );
  assert.equal(preserved.author_id, null);
  assert.equal(preserved.author_name, "Deleted user");
  await deleteComment(comment.id);
  await ok(owner.from("tasks").delete().eq("id", task.id));
  assert.equal(
    (await ok(owner.from("task_comments").select("id").eq("task_id", task.id)))
      .length,
    0,
  );
  console.log(
    "PASS: persisted comments, author identity, edits/deletes, admin moderation, outsider/revoked-member denial, live signals, author deletion and task cascade.",
  );
} finally {
  if (channel) await member.removeChannel(channel);
  if (tempUser)
    await admin.functions.invoke("admin-users", {
      body: { action: "delete", id: tempUser.id },
    });
  await ok(owner.from("projects").delete().eq("id", project));
  await Promise.all(
    [owner, member, outsider, admin, temporary].map((c) =>
      c.auth.signOut({ scope: "local" }),
    ),
  );
}
