import test from "node:test";
import assert from "node:assert/strict";
import { beforeTask } from "../src/components/task-card/board-drag.js";
test("drop slots use card midpoints and support the beginning, middle, end and empty columns", () => {
  const cards = [
    { id: "a", top: 100, height: 100 },
    { id: "b", top: 215, height: 160 },
  ];
  assert.equal(beforeTask(cards, 90), "a");
  assert.equal(beforeTask(cards, 149), "a");
  assert.equal(beforeTask(cards, 151), "b");
  assert.equal(beforeTask(cards, 290), "b");
  assert.equal(beforeTask(cards, 300), null);
  assert.equal(beforeTask([], 100), null);
});
