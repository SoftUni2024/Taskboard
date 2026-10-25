import test from "node:test";
import assert from "node:assert/strict";
import { matchRoute, safeReturn } from "../src/routes.js";
test("requested routes resolve, including project IDs and trailing slashes", () => {
  for (const path of [
    "/",
    "/login",
    "/dashboard",
    "/projects",
    "/project/add",
    "/project/board-123/edit",
    "/account",
    "/projects/board-123/tasks",
    "/project/board-123/tasks",
    "/projects/board-123/users",
    "/admin",
    "/admin/projects",
    "/admin/projects/board-123",
    "/admin/users",
    "/dashboard/",
  ])
    assert.ok(matchRoute(path), path);
  assert.equal(matchRoute("/projects/board-123/tasks").params.id, "board-123");
  assert.equal(matchRoute("/dashboard").protected, true);
  assert.equal(matchRoute("/projects").protected, true);
  assert.equal(matchRoute("/project/add").protected, true);
  assert.equal(matchRoute("/project/board-123/edit").protected, true);
  assert.equal(matchRoute("/project/board-123/edit").params.id, "board-123");
  assert.equal(matchRoute("/project/%invalid/edit"), null);
  assert.equal(matchRoute("/projects/board-123/tasks").protected, true);
  assert.equal(matchRoute("/project/board-123/tasks").protected, true);
  assert.equal(matchRoute("/projects/board-123/users").protected, true);
  assert.equal(matchRoute("/admin").protected, true);
  assert.equal(matchRoute("/admin/users").protected, true);
  assert.equal(matchRoute("/admin/projects/board-123").params.id, "board-123");
  assert.equal(matchRoute("/projects/board-123/users").params.id, "board-123");
  assert.equal(matchRoute("/project/board-123/tasks").params.id, "board-123");
  assert.equal(matchRoute("/project/%invalid/tasks"), null);
  assert.equal(matchRoute("/missing"), null);
  assert.equal(matchRoute("/projects/123"), null);
  assert.equal(matchRoute("/projects/%invalid/tasks"), null);
});
test("login return paths reject external origins and unknown routes", () => {
  const origin = "https://example.test";
  assert.equal(safeReturn("/projects/p1/tasks", origin), "/projects/p1/tasks");
  assert.equal(
    safeReturn("/dashboard?from=login", origin),
    "/dashboard?from=login",
  );
  for (const value of [
    "https://attacker.test/dashboard",
    "//attacker.test/dashboard",
    "javascript:alert(1)",
    "/unknown",
    "/login",
  ])
    assert.equal(safeReturn(value, origin), "/dashboard");
});
