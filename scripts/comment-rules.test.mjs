import test from "node:test";
import assert from "node:assert/strict";
import { commentBody } from "../src/services/comment-rules.js";
test("comments require text, enforce the limit, and keep markup as plain text", () => {
  assert.equal(commentBody("  Hello\nteam  "), "Hello\nteam");
  assert.equal(commentBody("<b>plain text</b>"), "<b>plain text</b>");
  assert.equal(commentBody("x".repeat(4000)).length, 4000);
  for (const value of ["", null, " \n\t ", "x".repeat(4001)])
    assert.throws(() => commentBody(value));
});
