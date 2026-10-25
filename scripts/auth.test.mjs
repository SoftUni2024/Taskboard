import test from 'node:test';
import assert from 'node:assert/strict';
import { createAuthService } from '../src/services/auth.js';
import { sanitizeRichText } from '../src/services/rich-text.js';
const user = { id: 'user-id', email: 'steve@gmail.com', user_metadata: { display_name: 'Steve' } };
test('email login returns the authenticated user and propagates invalid credentials', async () => {
  let credentials;
  const auth = createAuthService({ auth: { async signInWithPassword(value) { credentials = value; return { data: { user, session: { user } }, error: null }; } } });
  assert.equal((await auth.login(' steve@gmail.com ', 'pass123')).name, 'Steve');
  assert.deepEqual(credentials, { email: 'steve@gmail.com', password: 'pass123' });
  const bad = createAuthService({ auth: { async signInWithPassword() { return { error: new Error('Invalid login credentials') }; } } });
  await assert.rejects(bad.login('steve@gmail.com', 'wrong'), /Invalid login credentials/);
});
test('registration creates an email account with display name and requires immediate session', async () => {
  let submitted;
  const auth = createAuthService({ auth: { async signUp(value) { submitted=value; return { data: { user, session: { user } }, error: null }; } } });
  await auth.register(' Steve ', ' steve@gmail.com ', 'pass123');
  assert.equal(submitted.options.data.display_name, 'Steve');
  assert.equal(submitted.email, 'steve@gmail.com');
  const pending = createAuthService({ auth: { async signUp() { return { data: { user, session: null }, error: null }; } } });
  await assert.rejects(pending.register('Steve','steve@gmail.com','pass123'), /Email confirmation is still enabled/);
});
test('logout clears the local session and does not claim success on failure', async () => {
  let options;
  const auth=createAuthService({ auth: { async signOut(value) { options=value; return { error: null }; } } });
  await auth.logout(); assert.deepEqual(options, { scope: 'local' });
  const bad=createAuthService({auth:{async signOut(){return {error:new Error('Connection failed')}}}});
  await assert.rejects(bad.logout(), /Connection failed/);
});
test('expired user sessions are discarded; signed-out visitors make no user request', async () => {
  let signedOut=false;
  const auth=createAuthService({auth:{async getSession(){return {data:{session:{}}}},async getUser(){return {error:{status:401}}},async signOut(){signedOut=true;return {error:null}}}});
  assert.equal(await auth.currentUser(),null);assert.equal(signedOut,true);
  const visitor=createAuthService({auth:{async getSession(){return {data:{session:null}}},async getUser(){throw Error('Unexpected request')}}});
  assert.equal(await visitor.currentUser(),null);
});
test('rich text from direct database reads cannot inject markup or attributes', () => {
  const input='<b>Hello</b> &amp; <img src=x onerror=alert(1)><svg/onload=alert(1)><script>alert(1)</script>';
  const safe=sanitizeRichText(input);
  assert.ok(safe.includes('<b>Hello</b>'));assert.ok(!safe.includes('<img'));assert.ok(!safe.includes('<svg'));assert.ok(!safe.includes('<script'));
  assert.equal(sanitizeRichText(safe),safe);
});
