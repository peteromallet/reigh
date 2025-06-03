import type { Config } from 'drizzle-kit';

export default {
  schema: './db/schema/schema.ts',
  out: './db/migrations-sqlite',
  dialect: 'sqlite',
  dbCredentials: {
    url: './local.db',
  },
  breakpoints: true,
  verbose: true,
} satisfies Config; 