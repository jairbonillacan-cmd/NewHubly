import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type DbClient = ReturnType<typeof drizzle<typeof schema>>;

export function resolveDatabaseUrl(url?: string): string {
  if (url) return url;
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  if (process.env.NODE_ENV === "test" || process.env.NODE_ENV === "development") {
    return "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
  }
  throw new Error("DATABASE_URL no está definida. Configure DATABASE_URL en el entorno.");
}

let clientInstance: ReturnType<typeof postgres> | null = null, dbInstance: DbClient | null = null;

export function getDb(url?: string): DbClient {
  if (!dbInstance) {
    clientInstance = postgres(resolveDatabaseUrl(url), { prepare: false });
    dbInstance = drizzle(clientInstance, { schema });
  }
  return dbInstance;
}
export function createDbClient(url?: string): DbClient {
  return drizzle(postgres(resolveDatabaseUrl(url), { prepare: false }), { schema });
}
