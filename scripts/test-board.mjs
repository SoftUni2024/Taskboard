import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import assert from "node:assert/strict";
const sqlite = new DatabaseSync(":memory:");
sqlite.exec("PRAGMA foreign_keys=ON");
for (const file of readdirSync("drizzle")
  .filter((n) => n.endsWith(".sql"))
  .sort())
  sqlite.exec(
    readFileSync("drizzle/" + file, "utf8").replaceAll(
      "--> statement-breakpoint",
      "",
    ),
  );
function statement(sql, values = []) {
  const prepared = sqlite.prepare(sql);
  return {
    bind(...args) {
      return statement(sql, args);
    },
    async run() {
      return prepared.run(...values);
    },
    async first() {
      return prepared.get(...values) || null;
    },
    async all() {
      return { results: prepared.all(...values) };
    },
  };
}
globalThis.boardTest = {
  env: {
    DB: {
      prepare: statement,
      async batch(items) {
        sqlite.exec("BEGIN");
        try {
          const result = [];
          for (const item of items) result.push(await item.run());
          sqlite.exec("COMMIT");
          return result;
        } catch (e) {
          sqlite.exec("ROLLBACK");
          throw e;
        }
      },
    },
  },
  user: null,
};
const api = await import("../server/board.js");
function as(id) {
  globalThis.boardTest.user = id
    ? { userId: id, email: id + "@example.com", displayName: id }
    : null;
}
function authHeaders() {
  const u = globalThis.boardTest.user;
  return u
    ? {
        "oai-authenticated-user-id": u.userId,
        "oai-authenticated-user-email": u.email,
        "oai-authenticated-user-full-name": u.displayName,
      }
    : {};
}
async function get(project) {
  const r = await api.GET(
    new Request(
      "https://test.local/api/board" + (project ? "?project=" + project : ""),
      { headers: authHeaders() },
    ),
    globalThis.boardTest.env,
  );
  return { status: r.status, ...(await r.json()) };
}
async function post(action, values = {}) {
  const r = await api.POST(
    new Request("https://test.local/api/board", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "https://test.local",
        ...authHeaders(),
      },
      body: JSON.stringify({ action, ...values }),
    }),
    globalThis.boardTest.env,
  );
  return { status: r.status, ...(await r.json()) };
}
assert.equal(
  (await post("createProject", { title: "No session" })).status,
  401,
);
as("owner");
const { id: project } = await post("createProject", {
  title: "Test board",
  description: "Persistence test",
  color: "#8b9b73",
});
assert.ok(project);
assert.equal((await get()).projects.length, 1);
await post("createTask", {
  project,
  title: "First",
  description:
    "<b>Rich</b> &amp; safe<script>alert(1)</script><img src=x onerror=alert(1)>",
  stage: 0,
});
await post("createTask", { project, title: "Second", stage: 0 });
let board = await get(project);
const first = board.tasks[0].id,
  second = board.tasks[1].id;
assert.ok(board.tasks[0].description.includes("<b>Rich</b>"));
assert.ok(!board.tasks[0].description.includes("<script>"));
assert.ok(!board.tasks[0].description.includes("<img"));
await post("editTask", {
  project,
  id: first,
  title: "Updated",
  description: board.tasks[0].description,
  stage: 0,
});
assert.equal(
  (await get(project)).tasks[0].description,
  board.tasks[0].description,
  "Sanitization should be stable across edits",
);
await post("moveTask", { project, id: second, stage: 0, before: first });
assert.deepEqual(
  (await get(project)).tasks.map((t) => t.id),
  [second, first],
);
await post("moveTask", { project, id: first, stage: 2 });
assert.equal((await get(project)).tasks.find((t) => t.id === first).stage, 2);
assert.equal(
  (await post("moveTask", { project, id: first, stage: 99 })).status,
  400,
);
as("stranger");
assert.equal((await get(project)).status, 400);
assert.equal((await post("deleteTask", { project, id: first })).status, 400);
assert.equal((await get()).projects.length, 0);
as("owner");
await post("addMember", { project, email: "member@example.com" });
as("member");
assert.equal((await get()).projects.length, 1);
assert.equal((await get(project)).status, 200);
assert.equal(
  (
    await post("editTask", {
      project,
      id: first,
      title: "Member edit",
      description: "<i>Allowed</i>",
      stage: 1,
    })
  ).status,
  200,
);
assert.equal((await post("deleteProject", { project })).status, 400);
assert.equal(
  (await post("addMember", { project, email: "other@example.com" })).status,
  400,
);
as("owner");
await post("removeMember", { project, email: "member@example.com" });
as("member");
assert.equal((await get(project)).status, 400);
as("owner");
assert.equal((await post("deleteTask", { project, id: second })).status, 200);
assert.equal((await get(project)).tasks.length, 1);
assert.equal(
  (
    await post("editProject", {
      project,
      title: "Renamed",
      description: "Edited",
      color: "#8d86bb",
    })
  ).status,
  200,
);
assert.equal((await get(project)).project.title, "Renamed");
assert.equal((await post("profile", { name: "Owner name" })).status, 200);
assert.equal((await get()).user.name, "Owner name");
assert.equal((await post("deleteProject", { project })).status, 200);
assert.equal((await get()).projects.length, 0);
assert.equal(sqlite.prepare("SELECT COUNT(*) n FROM tasks").get().n, 0);
console.log(
  "PASS: registration, profiles, project/task CRUD, persistent ordering, stage moves, rich text safety, membership, access denial, revocation, and cascading deletion.",
);
sqlite.close();
delete globalThis.boardTest;
