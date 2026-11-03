import "server-only";
import { sql } from "drizzle-orm";
import type { PgTransaction } from "drizzle-orm/pg-core";
import { getDb } from "./client";

export interface UserClaims {
  sub: string;
  role: "authenticated" | "anon";
  email?: string;
  [key: string]: unknown;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type DbTransaction = PgTransaction<any, any, any>;

export async function withUserContext<T>(
  claims: UserClaims,
  fn: (tx: DbTransaction) => Promise<T>,
  dbInstance = getDb(),
): Promise<T> {
  if (!claims || typeof claims !== "object") throw new Error("Invalid user context: claims object is required");
  if (!claims.sub || typeof claims.sub !== "string" || claims.sub.trim() === "") throw new Error("Invalid user context: valid sub claim is required");
  if (claims.role !== "authenticated") throw new Error("Invalid user context: role must be 'authenticated'");

  const claimsJson = JSON.stringify(claims);
  return await dbInstance.transaction(async (tx) => {
    await tx.execute(sql`set local role authenticated`);
    await tx.execute(sql`select set_config('request.jwt.claims', ${claimsJson}, true)`);
    await tx.execute(sql`select set_config('request.jwt.claim.sub', ${claims.sub}, true)`);
    return await fn(tx);
  });
}
