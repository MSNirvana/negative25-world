import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import postgres from 'postgres';

if (typeof process.loadEnvFile === 'function') {
  try { process.loadEnvFile(new URL('../../../../.env', import.meta.url)); } catch { /* optional local file */ }
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required to run migrations');
const sql = postgres(databaseUrl, { max: 1 });
try {
  const migrationDir = resolve(import.meta.dirname, 'migrations');
  const files = (await readdir(migrationDir)).filter((file) => /^\d+_.+\.sql$/.test(file)).sort();
  for (const file of files) {
    await sql.unsafe(await readFile(resolve(migrationDir, file), 'utf8'));
    console.log(`Applied ${file}`);
  }
} finally {
  await sql.end();
}
