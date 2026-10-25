import test from "node:test";
import assert from "node:assert/strict";
import { normalizePage } from "../src/services/paged-data.js";
test("paging rejects invalid, fractional, negative and overflowing offsets", () => {
  assert.equal(normalizePage("6"), 6);
  for (const value of [
    null,
    "",
    0,
    -1,
    1.5,
    Infinity,
    "invalid",
    Number.MAX_SAFE_INTEGER,
  ])
    assert.equal(normalizePage(value), 1);
});
