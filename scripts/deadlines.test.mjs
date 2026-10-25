import test from "node:test";
import assert from "node:assert/strict";
import {localDay,deadlineValue,deadlineText} from "../src/services/deadline-rules.js";
test("deadline dates validate leap days and preserve calendar dates",()=>{
  assert.equal(deadlineValue("2028-02-29"),"2028-02-29");
  assert.equal(deadlineValue(""),null);
  for(const invalid of ["2026-02-29","2026-13-01","2026-01-32","not a date","2026-01-01T00:00:00Z"])assert.throws(()=>deadlineValue(invalid));
  assert.equal(localDay(new Date(2026,9,25,23,59)),"2026-10-25");
});
test("deadline status excludes completed tasks from overdue wording",()=>{
  assert.match(deadlineText({due_on:"2026-10-24",done:false},"2026-10-25"),/^Overdue/);
  assert.match(deadlineText({due_on:"2026-10-25",done:false},"2026-10-25"),/^Due today/);
  assert.match(deadlineText({due_on:"2026-10-24",done:true},"2026-10-25"),/^Completed/);
  assert.equal(deadlineText({due_on:null}),"");
});
