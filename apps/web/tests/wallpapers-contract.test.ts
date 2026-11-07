import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { wallpaperSchema } from "@hubly/contracts";
import { FONDOS_ILUSTRADOS, WALLPAPERS, WALLPAPERS_ILUSTRADOS } from "@hubly/ui";
import { describe, expect, it } from "vitest";

const root = join(__dirname, "..", "..", "..");
const migrationsDir = join(root, "supabase", "migrations");
const publicDir = join(__dirname, "..", "public");

/** Valores del último check de wallpaper en las migraciones: es el que manda en la base de datos. */
function wallpapersInLatestMigration(): { file: string; values: string[] } {
  const file = readdirSync(migrationsDir).filter((name) => name.endsWith(".sql")).sort()
    .filter((name) => /add constraint user_preferences_wallpaper_check/.test(readFileSync(join(migrationsDir, name), "utf8"))).at(-1);
  if (!file) throw new Error("No hay migración que defina user_preferences_wallpaper_check");
  const body = readFileSync(join(migrationsDir, file), "utf8").split("add constraint user_preferences_wallpaper_check")[1]!;
  const list = /check\s*\(\s*wallpaper\s+in\s*\(([\s\S]*?)\)\s*\)/i.exec(body)?.[1] ?? "";
  return { file, values: [...list.matchAll(/'([^']+)'/g)].map((match) => match[1]!) };
}

describe("Contrato de fondos entre SQL, Zod y la interfaz (issue 238)", () => {
  const sorted = (values: readonly string[]) => [...values].sort();

  it("la última migración acepta exactamente los fondos del contrato", () => {
    const { file, values } = wallpapersInLatestMigration();
    expect(sorted(values), file).toEqual(sorted(wallpaperSchema.options));
  });

  it("el selector ofrece exactamente los fondos del contrato, más la imagen propia", () => {
    const offered = [...WALLPAPERS, ...WALLPAPERS_ILUSTRADOS].map(({ id }) => id);
    expect(new Set(offered).size).toBe(offered.length);
    expect(sorted([...offered, "imagen"])).toEqual(sorted(wallpaperSchema.options));
  });

  it("cada fondo ilustrado tiene sus imágenes publicadas", () => {
    for (const { id, animado } of FONDOS_ILUSTRADOS) {
      const files = [`${id}.webp`, `${id}-mini.webp`, ...(animado ? [`${id}-animado.webp`] : [])];
      for (const file of files) expect(existsSync(join(publicDir, "fondos", file)), file).toBe(true);
    }
  });
});
