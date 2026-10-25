import test from "node:test";
import assert from "node:assert/strict";
import { createRefreshQueue } from "../src/services/task-sync.js";
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
test("Realtime bursts coalesce and wait for an active drag/save", async () => {
  let allowed = false,
    calls = 0;
  const queue = createRefreshQueue({
    refresh: async () => {
      calls++;
    },
    canRefresh: () => allowed,
    delay: 5,
  });
  queue.schedule();
  queue.schedule();
  queue.schedule();
  await wait(20);
  assert.equal(calls, 0);
  allowed = true;
  await wait(20);
  assert.equal(calls, 1);
  queue.stop();
  queue.schedule();
  await wait(10);
  assert.equal(calls, 1);
});
test("changes during a fetch request one trailing refresh without overlap", async () => {
  let calls = 0,
    release;
  const first = new Promise((resolve) => (release = resolve));
  const queue = createRefreshQueue({
    refresh: async () => {
      calls++;
      if (calls === 1) await first;
    },
    delay: 5,
  });
  queue.schedule();
  await wait(15);
  assert.equal(calls, 1);
  queue.schedule();
  queue.schedule();
  await wait(15);
  assert.equal(calls, 1);
  release();
  await wait(20);
  assert.equal(calls, 2);
  queue.stop();
});
test("refresh errors are reported and stopping prevents further work", async () => {
  let errors = 0;
  const queue = createRefreshQueue({
    refresh: async () => {
      throw new Error("offline");
    },
    onError: () => errors++,
    delay: 5,
  });
  queue.schedule();
  await wait(20);
  assert.equal(errors, 1);
  queue.schedule();
  queue.stop();
  await wait(15);
  assert.equal(errors, 1);
});
