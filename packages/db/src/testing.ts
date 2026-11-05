import "server-only";
import { sql } from "drizzle-orm";
import { withUserContext } from "./context";

/**
 * Solo para pruebas: inserta un usuario en auth.users saltándose RLS con `reset role`.
 * Vive fuera de la API pública de @hubly/db y solo se exporta por @hubly/db/internal,
 * que dependency-cruiser restringe a pruebas y a la raíz de composición.
 */
export async function seedAuthUserForTests(id: string, email: string, confirmed = true): Promise<void> {
  if (process.env.NODE_ENV !== "test") throw new Error("Solo permitido en entorno de pruebas");
  await withUserContext({ sub: id, role: "authenticated" }, async (tx) => {
    await tx.execute(sql`reset role`);
    await tx.execute(sql`insert into auth.users (id, email, email_confirmed_at) values (${id}::uuid, ${email}, ${confirmed ? sql`now()` : sql`null`}) on conflict (id) do update set email = excluded.email, email_confirmed_at = excluded.email_confirmed_at`);
  });
}
