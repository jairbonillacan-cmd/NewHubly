import { vi } from "vitest";
vi.mock("server-only", () => ({}));
import { describe, expect, it } from "vitest";
import { AVATAR_BUCKET, DISPLAY_NAME_MAX, avatarObjectPath, normalizeDisplayName } from "../src/server/composition";

describe("Perfil (issue 135)", () => {
  it("guarda la foto en la carpeta de la persona, en su propio bucket", () => {
    expect(AVATAR_BUCKET).toBe("user-avatars");
    expect(avatarObjectPath("u-1")).toBe("u-1/foto");
  });

  it("limpia el nombre: sin espacios de sobra, con tope y sin aceptar vacíos", () => {
    expect(normalizeDisplayName("  Ana   López ")).toBe("Ana López");
    expect(normalizeDisplayName("   ")).toBeNull();
    expect(normalizeDisplayName("x".repeat(80))).toHaveLength(DISPLAY_NAME_MAX);
  });
});
