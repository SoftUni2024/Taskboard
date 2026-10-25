// Rebuild local SQL from the migration history retrieved through Supabase MCP.
// No database passwords, access tokens, or API keys are stored in the snapshot.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const root = new URL('../supabase/', import.meta.url);
const snapshot = JSON.parse(readFileSync(new URL('remote-migration-history.json', root), 'utf8'));
mkdirSync(new URL('migrations/', root), { recursive: true });
for (const migration of snapshot.migrations) {
  if (!/^\d{14}$/.test(migration.version) || !/^[a-z0-9_]+$/.test(migration.name)) {
    throw new Error('Invalid migration metadata');
  }
  const output = new URL(`migrations/${migration.version}_${migration.name}.sql`, root);
  writeFileSync(output, migration.statements.join('\n').trimEnd() + '\n');
  console.log(fileURLToPath(output));
}
