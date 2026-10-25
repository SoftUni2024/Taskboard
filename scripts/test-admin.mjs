import assert from "node:assert/strict";
import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { supabase as admin } from "../src/services/supabase.js";
import { mutateBoard } from "../src/services/board-store.js";
import { deleteAdminStage } from "../src/services/admin.js";
const url = "https://jnehjelpwqqqeldsbeag.supabase.co",
  key = "sb_publishable_4Id5ZtV2dNGZTlrDB5tGqw_BCruvDpi";
const user = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const ok = async (q) => {
  const { data, error } = await q;
  if (error) throw error;
  return data;
};
const creds = {
  email: process.env.ADMIN_EMAIL,
  password: process.env.ADMIN_PASSWORD,
};
assert.ok(creds.password, "Load .env.admin");
const account = (await ok(admin.auth.signInWithPassword(creds))).user;
assert.equal(await ok(admin.rpc("is_admin")), true);
const email = `admin-qa-${crypto.randomUUID()}@example.com`,
  password = "QA!" + crypto.randomBytes(18).toString("base64url");
const target = (
  await ok(
    user.auth.signUp({
      email,
      password,
      options: { data: { display_name: "Temporary QA user" } },
    }),
  )
).user;
async function invoke(body) {
  const { data, error } = await admin.functions.invoke("admin-users", { body });
  if (error) {
    let detail = error.message;
    try {
      detail = (await error.context.json()).error || detail;
    } catch {}
    throw new Error(detail);
  }
  if (data.error) throw new Error(data.error);
  return data;
}
let project;
try {
  await ok(user.auth.updateUser({ data: { is_admin: true, role: "admin" } }));
  assert.equal(await ok(user.rpc("is_admin")), false);
  assert.ok((await user.rpc("admin_list_users")).error);
  assert.ok(
    (await user.rpc("admin_set_role", { p_user: target.id, p_admin: true }))
      .error,
  );
  const blocked = await user.functions.invoke("admin-users", {
    body: { action: "delete", id: account.id },
  });
  assert.ok(blocked.error);
  project = await ok(
    user.rpc("create_project_with_stages", {
      p_title: "Admin CRUD QA temporary",
    }),
  );
  const stages = await ok(
    user
      .from("project_stages")
      .select("*")
      .eq("project_id", project)
      .order("position"),
  );
  const task = await ok(
    user
      .from("tasks")
      .insert({
        project_id: project,
        stage_id: stages[0].id,
        title: "Admin QA task",
      })
      .select()
      .single(),
  );
  await mutateBoard("editProject", {
    project,
    title: "Admin edited another owner project",
    description: "Verified admin mutation",
  });
  await ok(
    admin.rpc("admin_save_stage", {
      p_stage: stages[0].id,
      p_name: "Done",
      p_position: 4,
    }),
  );
  assert.equal(
    (await ok(admin.from("tasks").select("done").eq("id", task.id).single()))
      .done,
    true,
  );
  const boardStages = await ok(
    admin
      .from("project_stages")
      .select("*")
      .eq("project_id", project)
      .order("position")
      .order("id"),
  );
  await mutateBoard("editTask", {
    project,
    id: task.id,
    title: "Admin edited task",
    description: "<b>Verified</b>",
    stage: boardStages.findIndex((s) => s.id === stages[0].id),
  });
  const path = `${target.id}/${project}/${task.id}/${crypto.randomUUID()}--cleanup.txt`;
  await ok(
    user.storage
      .from("task-attachments")
      .upload(path, "Admin cleanup QA", { contentType: "text/plain" }),
  );
  await mutateBoard("deleteTask", { project, id: task.id });
  assert.ok(
    (await admin.storage.from("task-attachments").download(path)).error,
  );
  await ok(
    admin
      .from("project_stages")
      .delete()
      .eq("id", stages[0].id)
      .select()
      .single(),
  );
  const stageTask = await ok(
    user
      .from("tasks")
      .insert({
        project_id: project,
        stage_id: stages[1].id,
        title: "Stage cleanup test",
      })
      .select()
      .single(),
  );
  const stageFile = `${target.id}/${project}/${stageTask.id}/${crypto.randomUUID()}--stage.txt`;
  await ok(
    user.storage
      .from("task-attachments")
      .upload(stageFile, "Stage file cleanup", { contentType: "text/plain" }),
  );
  await deleteAdminStage(project, stages[1].id);
  assert.ok(
    (await admin.storage.from("task-attachments").download(stageFile)).error,
  );
  assert.deepEqual(
    await ok(admin.from("tasks").select("id").eq("id", stageTask.id)),
    [],
  );
  await mutateBoard("deleteProject", { project });
  project = null;
  const users = await ok(admin.rpc("admin_list_users", { p_search: email }));
  assert.equal(users.length, 1);
  assert.ok(!("encrypted_password" in users[0]));
  await invoke({
    action: "update",
    id: target.id,
    name: "Edited QA user",
    email,
    is_admin: false,
  });
  assert.equal(
    (await ok(admin.rpc("admin_list_users", { p_search: email })))[0].name,
    "Edited QA user",
  );
  await invoke({
    action: "update",
    id: target.id,
    name: "Edited QA user",
    email,
    is_admin: true,
  });
  assert.equal(await ok(user.rpc("is_admin")), true);
  await assert.rejects(() => invoke({ action: "delete", id: target.id }));
  await invoke({
    action: "update",
    id: target.id,
    name: "Edited QA user",
    email,
    is_admin: false,
  });
  assert.equal(await ok(user.rpc("is_admin")), false);
  await assert.rejects(() => invoke({ action: "delete", id: account.id }));
  project = await ok(
    user.rpc("create_project_with_stages", {
      p_title: "Admin user deletion QA",
    }),
  );
  const s = await ok(
    user.from("project_stages").select("id").eq("project_id", project).limit(1),
  );
  const t = await ok(
    user
      .from("tasks")
      .insert({
        project_id: project,
        stage_id: s[0].id,
        title: "Cascade cleanup task",
      })
      .select()
      .single(),
  );
  const file = `${target.id}/${project}/${t.id}/${crypto.randomUUID()}--delete.txt`;
  await ok(
    user.storage
      .from("task-attachments")
      .upload(file, "Delete user file", { contentType: "text/plain" }),
  );
  await invoke({ action: "delete", id: target.id });
  assert.deepEqual(
    await ok(admin.from("projects").select("id").eq("id", project)),
    [],
  );
  assert.ok(
    (await admin.storage.from("task-attachments").download(file)).error,
  );
  assert.equal(
    (await ok(admin.rpc("admin_list_users", { p_search: email }))).length,
    0,
  );
  project = null;
  console.log(
    "PASS: admin account, cross-owner project/stage/task CRUD, file cleanup, protected Auth user edits/deletion, role changes, self/admin deletion guards, and ordinary-user privilege denial.",
  );
} finally {
  if (project) await mutateBoard("deleteProject", { project }).catch(() => {});
  const left = await ok(admin.rpc("admin_list_users", { p_search: email }));
  if (left.length) {
    await ok(
      admin.rpc("admin_set_role", { p_user: target.id, p_admin: false }),
    );
    await invoke({ action: "delete", id: target.id });
  }
  await Promise.all([
    admin.auth.signOut({ scope: "local" }),
    user.auth.signOut({ scope: "local" }),
  ]);
}
