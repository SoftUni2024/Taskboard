import test from "node:test";
import assert from "node:assert/strict";
import {
  validateFile,
  safeFilename,
  attachmentName,
  MAX_FILE_SIZE,
} from "../src/services/attachment-rules.js";
test("attachments accept screenshots and documents with a strict file size limit", () => {
  assert.equal(validateFile({ name: "screen.PNG", size: 123 }), "image/png");
  assert.equal(
    validateFile({ name: "brief.docx", size: MAX_FILE_SIZE }),
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  );
  for (const file of [
    { name: "bad.html", size: 1 },
    { name: "script.svg", size: 1 },
    { name: "empty.pdf", size: 0 },
    { name: "large.pdf", size: MAX_FILE_SIZE + 1 },
  ])
    assert.throws(() => validateFile(file));
});
test("storage filenames remove path characters and preserve recognizable names", () => {
  assert.equal(
    safeFilename("folder/screenshot 1.png"),
    "folder_screenshot_1.png",
  );
  assert.equal(
    attachmentName("00000000-0000-0000-0000-000000000000--notes.pdf"),
    "notes.pdf",
  );
  assert.equal(safeFilename("a".repeat(200) + ".pdf").length, 140);
});
