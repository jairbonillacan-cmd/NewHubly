import { vi } from "vitest";
vi.mock("server-only", () => ({}));
import { describe, expect, it } from "vitest";
import { presenceStatusSchema } from "@hubly/contracts";
import { AVATAR_BUCKET, DISPLAY_NAME_MAX, avatarObjectPath, normalizeDisplayName } from "../src/server/composition";

describe("Perfil (issue 135)", () => {
  it("guarda la foto en la carpeta de la persona, en su propio bucket", () => {
    expect(AVATAR_BUCKET).toBe("user-avatars");
    expect(avatarObjectPath("u-1")).toBe("u-1/foto");
  });

  it("limpia el nombre: sin controles ni bidi, sin espacios de sobra, con tope y sin aceptar vacíos", () => {
    expect(normalizeDisplayName("  Ana   López ")).toBe("Ana López");
    expect(normalizeDisplayName("\u202eAna\u0007\u2066 López\u0000")).toBe("Ana López");
    expect(normalizeDisplayName("\u202e\u0000\u0007")).toBeNull();
    expect(normalizeDisplayName("   ")).toBeNull();
    expect(normalizeDisplayName("x".repeat(80))).toHaveLength(DISPLAY_NAME_MAX);
  });

  it("el estado solo acepta en línea, ausente o no molestar (issue 143)", () => {
    for (const status of ["online", "away", "dnd"]) expect(presenceStatusSchema.safeParse(status).success).toBe(true);
    expect(presenceStatusSchema.safeParse("invisible").success).toBe(false);
  });
});
