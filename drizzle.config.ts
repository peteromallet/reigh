import { defineConfig } from 'drizzle-kit';
import * as dotenv from 'dotenv';

// Load environment variables from appropriate files
// In development: .env.local
// In production: .env.production or environment variables set by hosting platform
const envFile = process.env.NODE_ENV === 'production' ? '.env.production' : '.env.local';
dotenv.config({ path: envFile });

// Also try to load from .env as fallback
dotenv.config({ path: '.env' });

const DATABASE_URL_PG = process.env.DATABASE_URL_PG;

if (!DATABASE_URL_PG) {
  console.error(`[Drizzle Config] DATABASE_URL_PG is not set. Please set it in ${envFile} or as an environment variable.`);
  console.error('[Drizzle Config] For Supabase, you can find this in your project settings under Database > Connection string');
  process.exit(1);
}

export default defineConfig({
  dialect: 'postgresql',
  schema: './db/schema/schema.ts',
  out: './db/migrations',
  dbCredentials: {
    url: DATABASE_URL_PG,
  },
  verbose: true,
  strict: true,
  // Config for SQLite (can be managed via CLI flags or a separate config file)
  // To generate for SQLite, you might use a command like:
  // npx drizzle-kit generate:sqlite --config path/to/sqlite.config.ts
  // or temporarily change this config.
  // Example for SQLite driver config (if using a separate file or switching this one):
  /*
  dialect: 'sqlite',
  driver: 'better-sqlite', // driver is used for specific sqlite variants if needed
  dbCredentials: {
    url: './local.db',
  },
  */
}); 