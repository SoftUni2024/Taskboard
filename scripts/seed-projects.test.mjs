import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSampleRows } from './seed-projects.mjs';
import { SAMPLE_PROJECTS } from './sample-projects.mjs';
const users = ['steve', 'maria', 'peter'].map(name => ({ email: `${name}@gmail.com`, id: `${name}-id` }));
test('four projects have three ordered stages and 10–12 tasks in multiple stages', () => {
  const data = buildSampleRows(users);
  assert.equal(data.projects.length, 4);
  assert.equal(data.stages.length, 12);
  assert.equal(data.tasks.length, 44);
  assert.equal(new Set([...data.projects, ...data.stages, ...data.tasks].map(row => row.id)).size, 60);
  for (const project of data.projects) {
    const stages = data.stages.filter(stage => stage.project_id === project.id);
    assert.deepEqual(stages.map(stage => stage.name), ['Not Started', 'In Progress', 'Done']);
    assert.deepEqual(stages.map(stage => stage.position), [0, 1, 2]);
    const tasks = data.tasks.filter(task => task.project_id === project.id);
    assert.ok(tasks.length >= 10 && tasks.length <= 12);
    for (const stage of stages) {
      const column = tasks.filter(task => task.stage_id === stage.id);
      assert.ok(column.length > 0);
      assert.deepEqual(column.map(task => task.position), column.map((_, index) => index));
      assert.ok(column.every(task => task.done === (stage.name === 'Done')));
    }
  }
});
test('stable IDs prevent duplicate inserts on repeated runs', () => {
  assert.deepEqual(buildSampleRows(users), buildSampleRows(users));
  assert.equal(SAMPLE_PROJECTS.filter(project => project.owner === 'steve@gmail.com').length, 2);
  assert.throws(() => buildSampleRows([]), /Missing sample owner/);
});
