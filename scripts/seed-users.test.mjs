import test from 'node:test';
import assert from 'node:assert/strict';
import { seedUsers, SAMPLE_USERS } from './seed-users.mjs';

function mockAuth(initial = [], overrides = {}) {
  const records = initial.slice();
  const creates = [];
  return {
    records, creates,
    supabase: { auth: { admin: {
      async listUsers({ page, perPage }) { return { data: { users: records.slice((page - 1) * perPage, page * perPage) }, error: null }; },
      async createUser(input) {
        creates.push(input);
        const user = { id: crypto.randomUUID(), email: input.email, email_confirmed_at: new Date().toISOString() };
        records.push(user);
        return { data: { user }, error: null };
      },
      async getUserById(id) { return { data: { user: records.find(user => user.id === id) }, error: null }; },
      ...overrides,
    } } },
  };
}
const quiet = { log() {} };

test('creates exactly the requested confirmed users and is safe to rerun', async () => {
  const mock = mockAuth();
  const result = await seedUsers({ supabase: mock.supabase, logger: quiet });
  assert.deepEqual(result.map(user => user.email), ['steve@gmail.com', 'maria@gmail.com', 'peter@gmail.com']);
  assert.ok(result.every(user => user.status === 'created'));
  for (const input of mock.creates) {
    assert.equal(input.password, 'pass123');
    assert.equal(input.email_confirm, true);
  }
  const rerun = await seedUsers({ supabase: mock.supabase, logger: quiet });
  assert.ok(rerun.every(user => user.status === 'existing'));
  assert.equal(mock.creates.length, 3);
});

test('finds existing accounts on later pages and compares emails case-insensitively', async () => {
  const initial = Array.from({ length: 1000 }, (_, i) => ({ id: String(i), email: `other${i}@example.invalid` }));
  initial.push({ id: 'steve', email: 'STEVE@gmail.com' });
  const mock = mockAuth(initial);
  const result = await seedUsers({ supabase: mock.supabase, logger: quiet });
  assert.equal(result[0].status, 'existing');
  assert.equal(mock.creates.length, 2);
});

test('stops on Auth errors without reporting success', async () => {
  const mock = mockAuth([], { async createUser() { return { data: null, error: { message: 'password policy rejected', code: 'weak_password' } }; } });
  await assert.rejects(seedUsers({ supabase: mock.supabase, logger: quiet }), /password policy rejected/);
  assert.equal(mock.records.length, 0);
});

test('fails if a newly created account cannot be verified as confirmed', async () => {
  const mock = mockAuth([], { async getUserById() { return { data: { user: null }, error: null }; } });
  await assert.rejects(seedUsers({ supabase: mock.supabase, logger: quiet }), /Could not verify/);
});

test('handles a concurrent seed creating an account', async () => {
  const mock = mockAuth();
  mock.supabase.auth.admin.createUser = async input => {
    mock.records.push({ id: 'concurrent', email: input.email });
    return { data: null, error: { code: 'email_exists', message: 'Already exists' } };
  };
  const result = await seedUsers({ supabase: mock.supabase, users: SAMPLE_USERS.slice(0, 1), logger: quiet });
  assert.equal(result[0].status, 'existing');
});
