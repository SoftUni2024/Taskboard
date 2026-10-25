import assert from "node:assert/strict";
import { supabase } from "../src/services/supabase.js";
import {
  loadProjectPage,
  loadPagedBoard,
  nextUnloadedTask,
} from "../src/services/paged-data.js";
const { data, error } = await supabase.auth.signInWithPassword({
  email: process.env.ADMIN_EMAIL,
  password: process.env.ADMIN_PASSWORD,
});
if (error) throw error;
try {
  const first = await loadProjectPage(1),
    second = await loadProjectPage(2);
  assert.ok(first.count >= 104);
  assert.equal(first.projects.length, 20);
  assert.equal(second.projects.length, 20);
  assert.ok(
    second.projects.every((p) => !first.projects.some((x) => x.id === p.id)),
  );
  const search = await loadProjectPage(1, "Scale Sample Project 104");
  assert.equal(search.count, 1);
  const quoted = await loadProjectPage(1, '"comma, (test)');
  assert.equal(quoted.count, 0);
  const sample = (await loadProjectPage(1, "Scale Sample Project 001"))
    .projects[0];
  const board = await loadPagedBoard(sample.id, data.user);
  assert.deepEqual(board.counts, [90, 20, 10]);
  assert.equal(board.tasks.length, 50);
  assert.equal(board.total, 120);
  const more = await loadPagedBoard(sample.id, data.user, {
    [board.stages[0].id]: 40,
  });
  assert.equal(more.tasks.length, 70);
  assert.equal(new Set(more.tasks.map((t) => t.id)).size, 70);
  assert.equal(
    await nextUnloadedTask(sample.id, board.stages[0].id, 20),
    more.tasks.filter((t) => t.stage === 0)[20].id,
  );
  const found = await loadPagedBoard(
    sample.id,
    data.user,
    {},
    "Sample task 080",
  );
  assert.equal(found.total, 1);
  assert.equal(found.tasks.length, 1);
  console.log(
    `PASS: ${first.count} projects, disjoint database pages, full-dataset search, 120-task board totals, 20-card windows and unloaded-row targeting.`,
  );
} finally {
  await supabase.auth.signOut({ scope: "local" });
}
