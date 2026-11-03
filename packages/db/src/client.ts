import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const DEFAULT_URL = process.env.DATABASE_URL || "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
let clientInstance: ReturnType<typeof postgres> | null = null;
let dbInstance: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getDb(url: string = DEFAULT_URL) {
  if (!dbInstance) {
    clientInstance = postgres(url, { prepare: false }); // ADR 0004: pooler en modo transacción
    dbInstance = drizzle(clientInstance, { schema });
  }
  return dbInstance;
}

export function createDbClient(url: string = DEFAULT_URL) {
  return drizzle(postgres(url, { prepare: false }), { schema });
}
