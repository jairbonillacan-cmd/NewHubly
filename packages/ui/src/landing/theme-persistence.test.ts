import { describe, expect, it } from "vitest";
import { createThemePersistenceTracker } from "./ThemeToggle";

describe("Guardar el tema en la cuenta (issue 105)", () => {
  it("al cargar con tema del servidor, hidratarlo no lo vuelve a guardar", () => {
    const shouldPersist = createThemePersistenceTracker("dark");
    // Primer render: el navegador tenía «light»; luego la hidratación aplica «dark», el valor del servidor.
    expect(shouldPersist("light")).toBe(false);
    expect(shouldPersist("dark")).toBe(false);
  });

  it("solo guarda los cambios que hace la persona después de entrar, una vez cada uno", () => {
    const shouldPersist = createThemePersistenceTracker("dark");
    shouldPersist("light");
    shouldPersist("dark");
    expect(shouldPersist("system")).toBe(true);
    expect(shouldPersist("system")).toBe(false);
    expect(shouldPersist("light")).toBe(true);
  });

  it("sin tema del servidor, el del navegador al entrar tampoco se guarda", () => {
    const shouldPersist = createThemePersistenceTracker(null);
    expect(shouldPersist("system")).toBe(false);
    expect(shouldPersist("system")).toBe(false);
    expect(shouldPersist("dark")).toBe(true);
  });
});
