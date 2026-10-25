import { createHash } from "node:crypto";
import { supabase } from "../src/services/supabase.js";
export function scaleId(key) {
  const h = createHash("sha256")
    .update("taskboard-scale-v1:" + key)
    .digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-8${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
async function ok(query) {
  const { data, error } = await query;
  if (error) throw error;
  return data;
}
const user = await ok(
  supabase.auth.signInWithPassword({
    email: process.env.ADMIN_EMAIL,
    password: process.env.ADMIN_PASSWORD,
  }),
);
if (!(await ok(supabase.rpc("is_admin"))))
  throw new Error("Admin credentials required.");
try {
  const directory = await ok(
    supabase.rpc("admin_list_users", { p_search: "steve@gmail.com" }),
  );
  const owner = directory.find((u) => u.email === "steve@gmail.com");
  if (!owner) throw new Error("Seed Steve first.");
  const originalIds = [
    "5c470b5c-b01f-87d1-a03d-59de5c9b9b84",
    "88d22f6d-cec5-8062-94f6-763fd4773eb3",
    "024fa10b-500a-8d29-bf8a-9a2a3bc5b190",
    "e2d43fc3-59b2-809d-b5ea-1ca44f5b6c93",
  ];
  const projects = Array.from({ length: 104 }, (_, i) => ({
    id: scaleId("project:" + i),
    owner_id: owner.id,
    title: `Scale Sample Project ${String(i + 1).padStart(3, "0")}`,
    description:
      "Sample project for testing project pagination and incremental task loading.",
  }));
  await ok(
    supabase
      .from("projects")
      .upsert(projects, { onConflict: "id", ignoreDuplicates: true }),
  );
  const stages = projects.flatMap((project) =>
    ["Not Started", "In Progress", "Done"].map((name, position) => ({
      id: scaleId(`stage:${project.id}:${position}`),
      project_id: project.id,
      name,
      position,
    })),
  );
  await ok(
    supabase
      .from("project_stages")
      .upsert(stages, { onConflict: "id", ignoreDuplicates: true }),
  );
  const rows = projects.flatMap((project) =>
    Array.from({ length: 120 }, (_, i) => {
      const stage = i < 90 ? 0 : i < 110 ? 1 : 2;
      return {
        id: scaleId(`task:${project.id}:${i}`),
        project_id: project.id,
        stage_id: scaleId(`stage:${project.id}:${stage}`),
        title: `Sample task ${String(i + 1).padStart(3, "0")} · ${project.title}`,
        description: `<p>Sample task ${i + 1} for checking loading, editing, ordering, and real-time changes.</p>`,
        position: stage === 0 ? i : stage === 1 ? i - 90 : i - 110,
        done: stage === 2,
      };
    }),
  );
  for (let offset = 0; offset < rows.length; offset += 400) {
    await ok(
      supabase
        .from("tasks")
        .upsert(rows.slice(offset, offset + 400), {
          onConflict: "id",
          ignoreDuplicates: true,
        }),
    );
    console.log(
      `Sample tasks: ${Math.min(offset + 400, rows.length)} / ${rows.length}`,
    );
  }
  for (const project of originalIds) {
    const tasks = await ok(
      supabase.from("tasks").select("id").eq("project_id", project),
    );
    if (tasks.length >= 120) continue;
    const stages = await ok(
      supabase
        .from("project_stages")
        .select("*")
        .eq("project_id", project)
        .order("position")
        .order("id"),
    );
    if (!stages.length) continue;
    const ids = new Set(tasks.map((t) => t.id)),
      extra = [];
    for (let i = 0; extra.length < 120 - tasks.length; i++) {
      const id = scaleId(`original:${project}:${i}`);
      if (ids.has(id)) continue;
      const stage = stages[i % stages.length];
      extra.push({
        id,
        project_id: project,
        stage_id: stage.id,
        title: `Scale sample task ${String(i + 1).padStart(3, "0")}`,
        description: "<p>Sample task for pagination and scrolling checks.</p>",
        position: 1000 + i,
        done: stage.name === "Done",
      });
    }
    await ok(
      supabase
        .from("tasks")
        .upsert(extra, { onConflict: "id", ignoreDuplicates: true }),
    );
  }
  console.log(
    "Complete: 104 scale projects with 120 tasks each; original sample boards have at least 120 tasks. Stable IDs make reruns safe.",
  );
} finally {
  await supabase.auth.signOut({ scope: "local" });
}
