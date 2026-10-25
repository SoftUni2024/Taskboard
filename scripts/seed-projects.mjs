import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { seedUsers } from './seed-users.mjs';
import { DEFAULT_STAGES, SAMPLE_PROJECTS } from './sample-projects.mjs';

// Stable UUIDs make retries safe without overwriting later edits to seeded rows.
export function sampleId(key) {
  const bytes = createHash('sha256').update('taskboard-sample-v1:' + key).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x80;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function buildSampleRows(users) {
  const owners = new Map(users.map(user => [user.email.toLowerCase(), user.id]));
  const projects = [], stages = [], tasks = [];
  for (const sample of SAMPLE_PROJECTS) {
    const owner_id = owners.get(sample.owner);
    if (!owner_id) throw new Error(`Missing sample owner: ${sample.owner}`);
    const id = sampleId(`project:${sample.owner}:${sample.title}`);
    projects.push({ id, title: sample.title, description: sample.description, owner_id });
    const stageRows = DEFAULT_STAGES.map((name, position) => ({
      id: sampleId(`stage:${id}:${name}`), project_id: id, name, position,
    }));
    stages.push(...stageRows);
    const positions = [0, 0, 0];
    sample.tasks.forEach((task, index) => tasks.push({
      id: sampleId(`task:${id}:${index}`),
      project_id: id,
      stage_id: stageRows[task.stage].id,
      title: task.title,
      description: task.description,
      position: positions[task.stage]++,
      done: task.stage === 2,
    }));
  }
  return { projects, stages, tasks };
}

export async function seedProjects({ supabase, logger = console }) {
  const users = await seedUsers({ supabase, logger });
  const rows = buildSampleRows(users);
  for (const [table, values] of [['projects', rows.projects], ['project_stages', rows.stages], ['tasks', rows.tasks]]) {
    const { error } = await supabase.from(table).upsert(values, { onConflict: 'id', ignoreDuplicates: true });
    if (error) throw new Error(`Could not seed ${table}: ${error.message}`);
  }
  for (const [table, values] of [['projects', rows.projects], ['project_stages', rows.stages], ['tasks', rows.tasks]]) {
    const { data, error } = await supabase.from(table).select('id').in('id', values.map(row => row.id));
    if (error || data?.length !== values.length) throw new Error(`Could not verify seeded ${table}. Rerunning is safe.`);
  }
  for (const sample of SAMPLE_PROJECTS) logger.log(`${sample.title}: ${sample.tasks.length} tasks; owner ${sample.owner}`);
  logger.log(`Verified ${rows.projects.length} projects, ${rows.stages.length} stages, ${rows.tasks.length} tasks.`);
  return rows;
}

export async function main(args = process.argv.slice(2)) {
  if (args.some(arg => !['--dry-run', '--help'].includes(arg))) throw new Error('Use --dry-run or --help.');
  if (args.includes('--help')) {
    console.log('Usage: npm run seed:projects [-- --dry-run]');
    console.log('Requires the same server-side environment configuration as seed:users.');
    return;
  }
  if (args.includes('--dry-run')) {
    for (const sample of SAMPLE_PROJECTS) console.log(`${sample.title}: ${sample.tasks.length} tasks for ${sample.owner}`);
    console.log('4 projects, 12 stages, 44 tasks. No database requests made.');
    return;
  }
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Set SUPABASE_URL and a server-only SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY.');
  const endpoint = new URL(url);
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(endpoint.hostname);
  if ((!local && (endpoint.protocol !== 'https:' || !endpoint.hostname.endsWith('.supabase.co'))) || endpoint.username || endpoint.password || endpoint.pathname !== '/' || endpoint.search || endpoint.hash) throw new Error('Use a Supabase HTTPS project origin or a local origin.');
  if (key.startsWith('sb_publishable_')) throw new Error('Use a server-only admin key.');
  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  try { return await seedProjects({ supabase }); }
  finally { await supabase.removeAllChannels(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => {
    let message = error.message;
    for (const key of [process.env.SUPABASE_SECRET_KEY, process.env.SUPABASE_SERVICE_ROLE_KEY].filter(Boolean)) message = message.replaceAll(key, '[redacted]');
    console.error(`Seed failed: ${message}`);
    process.exitCode = 1;
  });
}
