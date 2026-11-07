import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { userPreferences } from "../src/schema";

// Sin base de datos: compara el enum de Drizzle con el último CHECK de las migraciones. apps/web/tests/wallpapers-contract.test.ts
// compara ese mismo CHECK con Zod y con el selector, así que las cuatro listas quedan encadenadas (issue 238).
const migrationsDir = join(__dirname, "..", "..", "..", "supabase", "migrations");

function wallpapersInLatestMigration(): string[] {
  const file = readdirSync(migrationsDir).filter((name) => name.endsWith(".sql")).sort()
    .filter((name) => readFileSync(join(migrationsDir, name), "utf8").includes("add constraint user_preferences_wallpaper_check")).at(-1);
  if (!file) throw new Error("No hay migración que defina user_preferences_wallpaper_check");
  const body = readFileSync(join(migrationsDir, file), "utf8").split("add constraint user_preferences_wallpaper_check")[1]!;
  const list = /check\s*\(\s*wallpaper\s+in\s*\(([\s\S]*?)\)\s*\)/i.exec(body)?.[1] ?? "";
  return [...list.matchAll(/'([^']+)'/g)].map((match) => match[1]!);
}

describe("Fondos en Drizzle (issue 238)", () => {
  it("el enum de user_preferences.wallpaper coincide exactamente con el último CHECK de las migraciones", () => {
    const sorted = (values: readonly string[]) => [...values].sort();
    expect(sorted(userPreferences.wallpaper.enumValues)).toEqual(sorted(wallpapersInLatestMigration()));
  });
});
