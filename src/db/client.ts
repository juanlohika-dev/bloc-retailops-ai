import 'dotenv/config';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from './schema.js';

let url = process.env.TURSO_DATABASE_URL || 'file:local.db';
if (url.startsWith('libsql://')) {
  url = url.replace('libsql://', 'https://');
}
const authToken = process.env.TURSO_AUTH_TOKEN;

export const libSqlClient = createClient({
  url,
  authToken,
});

export const db = drizzle(libSqlClient, { schema });
