import { pathToFileURL } from 'node:url';

export const SAMPLE_USERS = Object.freeze([
  Object.freeze({ email: 'steve@gmail.com', password: 'pass123', name: 'Steve' }),
  Object.freeze({ email: 'maria@gmail.com', password: 'pass123', name: 'Maria' }),
  Object.freeze({ email: 'peter@gmail.com', password: 'pass123', name: 'Peter' }),
]);

async function listUsers(admin) {
  const users = new Map();
  const perPage = 1000;
  for (let page = 1; ; page++) {
    const { data, error } = await admin.listUsers({ page, perPage });
    if (error) throw new Error(`Could not list Auth users: ${error.message}`);
    if (!Array.isArray(data?.users)) throw new Error('Auth returned an invalid user list.');
    for (const user of data.users) {
      if (user.email) users.set(user.email.toLowerCase(), user);
    }
    if (data.users.length < perPage) return users;
  }
}

export async function seedUsers({ supabase, users = SAMPLE_USERS, logger = console }) {
  const admin = supabase.auth.admin;
  const existing = await listUsers(admin);
  const results = [];

  for (const sample of users) {
    const email = sample.email.toLowerCase();
    if (existing.has(email)) {
      logger.log(`Skipped existing user: ${email}`);
      results.push({ email, id: existing.get(email).id, status: 'existing' });
      continue;
    }

    const { data, error } = await admin.createUser({
      email,
      password: sample.password,
      email_confirm: true,
      user_metadata: { display_name: sample.name },
    });
    if (error) {
      // Handle another seed process creating the same account after our initial read.
      if (['email_exists', 'user_already_exists'].includes(error.code)) {
        const refreshed = await listUsers(admin);
        if (refreshed.has(email)) {
          results.push({ email, id: refreshed.get(email).id, status: 'existing' });
          logger.log(`Skipped existing user: ${email}`);
          continue;
        }
      }
      throw new Error(`Could not create ${email}: ${error.message}`);
    }
    if (!data?.user?.id) throw new Error(`Auth did not return an ID for ${email}.`);

    const { data: saved, error: verificationError } = await admin.getUserById(data.user.id);
    if (verificationError || saved?.user?.email?.toLowerCase() !== email || !saved.user.email_confirmed_at) {
      throw new Error(`Could not verify confirmed Auth account for ${email}. Rerunning is safe.`);
    }
    existing.set(email, saved.user);
    results.push({ email, id: saved.user.id, status: 'created' });
    logger.log(`Created and verified user: ${email}`);
  }

  const created = results.filter(result => result.status === 'created').length;
  logger.log(`Seed complete: ${created} created, ${results.length - created} already existed.`);
  return results;
}

export async function main(args = process.argv.slice(2)) {
  const unknown = args.filter(arg => !['--help', '--dry-run'].includes(arg));
  if (unknown.length) throw new Error(`Unknown option: ${unknown[0]}`);
  if (args.includes('--help')) {
    console.log('Usage: npm run seed:users [-- --dry-run]');
    console.log('Loads .env.seed; requires SUPABASE_URL and SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY.');
    console.log('Creates confirmed sample Auth accounts. Existing accounts are not modified.');
    return;
  }
  if (args.includes('--dry-run')) {
    for (const { email } of SAMPLE_USERS) console.log(`Would create if missing: ${email}`);
    console.log('Dry run complete. No database requests made.');
    return;
  }

  const url = process.env.SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !secret) {
    throw new Error('Set SUPABASE_URL and SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY) in .env.seed, then run npm run seed:users. Do not use a publishable or anon key.');
  }
  const endpoint = new URL(url);
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(endpoint.hostname);
  if ((!local && (endpoint.protocol !== 'https:' || !endpoint.hostname.endsWith('.supabase.co'))) || endpoint.username || endpoint.password || endpoint.pathname !== '/' || endpoint.search || endpoint.hash) {
    throw new Error('SUPABASE_URL must be a Supabase HTTPS project origin or a local development origin.');
  }
  if (secret.startsWith('sb_publishable_')) throw new Error('Use a server-only Supabase secret/service-role key, not a publishable key.');

  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  try {
    console.log(`Seeding Auth users in ${endpoint.hostname}…`);
    return await seedUsers({ supabase });
  } finally {
    await supabase.removeAllChannels();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => {
    const secrets = [process.env.SUPABASE_SECRET_KEY, process.env.SUPABASE_SERVICE_ROLE_KEY].filter(Boolean);
    let message = error.message;
    for (const secret of secrets) message = message.replaceAll(secret, '[redacted]');
    console.error(`Seed failed: ${message}`);
    process.exitCode = 1;
  });
}
