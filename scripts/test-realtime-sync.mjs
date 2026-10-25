import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { watchProjectTasks } from "../src/services/task-sync.js";
const client = () =>
  createClient(
    "https://jnehjelpwqqqeldsbeag.supabase.co",
    "sb_publishable_4Id5ZtV2dNGZTlrDB5tGqw_BCruvDpi",
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
const a = client(),
  b = client(),
  c = client();
async function ok(q) {
  const { data, error } = await q;
  if (error) throw error;
  return data;
}
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function until(check) {
  const end = Date.now() + 15000;
  while (!check()) {
    if (Date.now() > end) throw new Error("Realtime event did not arrive");
    await wait(50);
  }
}
await ok(
  a.auth.signInWithPassword({ email: "steve@gmail.com", password: "pass123" }),
);
const user = (
  await ok(
    b.auth.signInWithPassword({
      email: "maria@gmail.com",
      password: "pass123",
    }),
  )
).user;
await ok(
  c.auth.signInWithPassword({ email: "peter@gmail.com", password: "pass123" }),
);
const project = await ok(
  a.rpc("create_project_with_stages", {
    p_title: "Realtime sync QA temporary",
  }),
);
let stop,
  outsider,
  errors = [],
  snapshots = [],
  subscribed = false,
  outsiderSubscribed = false,
  leaks = 0;
try {
  await ok(
    a.from("project_members").insert({ project_id: project, user_id: user.id }),
  );
  const stages = await ok(
    a
      .from("project_stages")
      .select("id")
      .eq("project_id", project)
      .order("position"),
  );
  const events = new EventTarget(),
    doc = new EventTarget();
  doc.hidden = false;
  stop = watchProjectTasks(b, project, {
    events,
    doc,
    onStatus: (status) => {
      if (status === "SUBSCRIBED") subscribed = true;
    },
    onError: (error) => errors.push(error),
    refresh: async () => {
      snapshots.push(
        await ok(
          b.from("tasks").select("id,title,done").eq("project_id", project),
        ),
      );
    },
  });
  outsider = c
    .channel("outsider-" + crypto.randomUUID())
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "project_task_changes",
        filter: `project_id=eq.${project}`,
      },
      () => leaks++,
    )
    .subscribe((status) => {
      if (status === "SUBSCRIBED") outsiderSubscribed = true;
    });
  await until(() => subscribed && outsiderSubscribed && snapshots.length > 0);
  const task = await ok(
    a
      .from("tasks")
      .insert({
        project_id: project,
        stage_id: stages[0].id,
        title: "Live added task",
      })
      .select()
      .single(),
  );
  await until(() =>
    snapshots.at(-1).some((t) => t.title === "Live added task"),
  );
  await ok(
    a.from("tasks").update({ title: "Live edited task" }).eq("id", task.id),
  );
  await until(() =>
    snapshots.at(-1).some((t) => t.title === "Live edited task"),
  );
  await ok(
    a.rpc("move_project_task", {
      p_task_id: task.id,
      p_stage_id: stages[2].id,
    }),
  );
  await until(() => snapshots.at(-1).some((t) => t.done));
  const count = snapshots.length;
  await ok(a.from("tasks").delete().eq("id", task.id));
  await until(() => snapshots.length > count && snapshots.at(-1).length === 0);
  assert.equal(errors.length, 0);
  assert.equal(leaks, 0);
  console.log(
    "PASS: member board receives real INSERT, UPDATE, move and DELETE refreshes; outsider receives no signals.",
  );
} finally {
  stop?.();
  if (outsider) await c.removeChannel(outsider);
  await ok(a.from("projects").delete().eq("id", project));
  await Promise.all([
    a.auth.signOut({ scope: "local" }),
    b.auth.signOut({ scope: "local" }),
    c.auth.signOut({ scope: "local" }),
  ]);
}
