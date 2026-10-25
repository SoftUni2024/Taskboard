import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
const url = "https://jnehjelpwqqqeldsbeag.supabase.co",
  key = "sb_publishable_4Id5ZtV2dNGZTlrDB5tGqw_BCruvDpi";
const client = () =>
  createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
const a = client(),
  b = client(),
  c = client();
async function ok(query) {
  const { data, error } = await query;
  if (error) throw error;
  return data;
}
const owner = (
  await ok(
    a.auth.signInWithPassword({
      email: "steve@gmail.com",
      password: "pass123",
    }),
  )
).user;
const member = (
  await ok(
    b.auth.signInWithPassword({
      email: "maria@gmail.com",
      password: "pass123",
    }),
  )
).user;
const outsider = (
  await ok(
    c.auth.signInWithPassword({
      email: "peter@gmail.com",
      password: "pass123",
    }),
  )
).user;
const id = await ok(
  a.rpc("create_project_with_stages", {
    p_title: "Membership RLS QA temporary",
  }),
);
let paths = [];
try {
  assert.deepEqual(await ok(b.from("projects").select("id").eq("id", id)), []);
  assert.ok(
    (
      await b
        .from("project_members")
        .insert({ project_id: id, user_id: member.id })
    ).error,
  );
  assert.ok((await b.rpc("list_project_users", { p_project: id })).error);
  const directory = await ok(
    a.rpc("list_project_users", { p_project: id, p_search: "maria" }),
  );
  assert.ok(directory.some((u) => u.id === member.id));
  assert.ok(!directory.some((u) => "encrypted_password" in u));
  await ok(
    a.from("project_members").insert({ project_id: id, user_id: member.id }),
  );
  assert.equal(
    (
      await ok(
        b.from("projects").select("id,project_stages(count)").eq("id", id),
      )
    )[0].project_stages[0].count,
    3,
  );
  const stages = await ok(
    b.from("project_stages").select("*").eq("project_id", id).order("position"),
  );
  const task = await ok(
    b
      .from("tasks")
      .insert({
        project_id: id,
        stage_id: stages[0].id,
        title: "Member-created task",
      })
      .select()
      .single(),
  );
  await ok(
    b
      .from("tasks")
      .update({ title: "Member edited task" })
      .eq("id", task.id)
      .select()
      .single(),
  );
  await ok(
    b.rpc("move_project_task", {
      p_task_id: task.id,
      p_stage_id: stages[2].id,
    }),
  );
  assert.equal(
    (await ok(a.from("tasks").select("done").eq("id", task.id).single())).done,
    true,
  );
  const extra = await ok(
    b
      .from("project_stages")
      .insert({ project_id: id, name: "Review", position: 3 })
      .select()
      .single(),
  );
  await ok(b.from("project_stages").delete().eq("id", extra.id));
  assert.equal(
    (await ok(b.rpc("list_project_people", { p_project: id }))).length,
    2,
  );
  assert.ok((await b.rpc("list_project_users", { p_project: id })).error);
  assert.ok(
    (
      await b
        .from("project_members")
        .insert({ project_id: id, user_id: outsider.id })
    ).error,
  );
  assert.deepEqual(
    await ok(
      b
        .from("project_members")
        .delete()
        .eq("project_id", id)
        .eq("user_id", member.id)
        .select(),
    ),
    [],
  );
  assert.deepEqual(
    await ok(
      b.from("projects").update({ title: "Forbidden" }).eq("id", id).select(),
    ),
    [],
  );
  assert.deepEqual(
    await ok(b.from("projects").delete().eq("id", id).select()),
    [],
  );
  assert.deepEqual(
    await ok(c.from("tasks").select("id").eq("project_id", id)),
    [],
  );
  const folder = `${owner.id}/${id}/${task.id}`;
  for (const db of [a, b]) {
    const path = `${folder}/${crypto.randomUUID()}--shared.txt`;
    await ok(
      db.storage
        .from("task-attachments")
        .upload(path, "Shared attachment", { contentType: "text/plain" }),
    );
    paths.push(path);
  }
  for (const path of paths) {
    await ok(b.storage.from("task-attachments").download(path));
    assert.ok((await c.storage.from("task-attachments").download(path)).error);
  }
  await ok(
    a
      .from("project_members")
      .delete()
      .eq("project_id", id)
      .eq("user_id", member.id),
  );
  assert.deepEqual(await ok(b.from("projects").select("id").eq("id", id)), []);
  assert.deepEqual(
    await ok(b.from("tasks").select("id").eq("project_id", id)),
    [],
  );
  assert.deepEqual(
    await ok(b.from("project_stages").select("id").eq("project_id", id)),
    [],
  );
  assert.ok(
    (
      await b.rpc("move_project_task", {
        p_task_id: task.id,
        p_stage_id: stages[0].id,
      })
    ).error,
  );
  assert.ok(
    (await b.storage.from("task-attachments").download(paths[0])).error,
  );
  assert.ok(
    (
      await b.storage
        .from("task-attachments")
        .upload(`${folder}/${crypto.randomUUID()}--denied.txt`, "Denied", {
          contentType: "text/plain",
        })
    ).error,
  );
  console.log(
    "PASS: owner-only assignments; searchable directory; member project/stage/task CRUD and moves; shared files; outsider denial; immediate membership revocation with unchanged JWT.",
  );
} finally {
  if (paths.length) await ok(a.storage.from("task-attachments").remove(paths));
  await ok(a.from("projects").delete().eq("id", id));
  await Promise.all([
    a.auth.signOut({ scope: "local" }),
    b.auth.signOut({ scope: "local" }),
    c.auth.signOut({ scope: "local" }),
  ]);
}
