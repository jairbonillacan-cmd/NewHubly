import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import {
  WALLPAPER_BUCKET, WallpaperImageError, removeUserWallpaper, setSupabaseServerClientFactoryForTests, signUserWallpaper, uploadUserWallpaper,
} from "../src/server/composition";

const exifJpeg = () => {
  const seg = (marker: number, text: string) => [0xff, marker, 0, text.length + 2, ...Array.from(text, (c) => c.charCodeAt(0))];
  return Uint8Array.from([0xff, 0xd8, ...seg(0xe0, "JFIF\0"), ...seg(0xe1, "Exif\0\0GPSLatitude"), ...seg(0xda, "\x01\x01\0\0\x3f\0"), 0x11, 0x22, 0xff, 0xd9]);
};

function fakeStorage() {
  const calls = { upload: [] as Array<{ path: string; bytes: Uint8Array; options: Record<string, unknown> }>, signed: [] as Array<{ path: string; seconds: number }>, removed: [] as string[][], buckets: [] as string[] };
  const bucket = {
    upload: async (path: string, bytes: Uint8Array, options: Record<string, unknown>) => { calls.upload.push({ path, bytes, options }); return { error: null }; },
    createSignedUrl: async (path: string, seconds: number) => { calls.signed.push({ path, seconds }); return { data: { signedUrl: `https://storage.test/${path}?token=firmado` }, error: null }; },
    remove: async (paths: string[]) => { calls.removed.push(paths); return { error: null }; },
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setSupabaseServerClientFactoryForTests(() => ({ storage: { from: (name: string) => { calls.buckets.push(name); return bucket; } } }) as any);
  return calls;
}

describe("«Tu imagen» en Storage con la sesión de la persona (#84, ADR 0008)", () => {
  afterEach(() => setSupabaseServerClientFactoryForTests(null));

  it("limpia los metadatos antes de subir, usa la carpeta propia y devuelve una URL firmada de una hora", async () => {
    const calls = fakeStorage();
    const url = await uploadUserWallpaper("u-ana", exifJpeg());
    expect(calls.buckets.every((b) => b === WALLPAPER_BUCKET)).toBe(true);
    expect(calls.upload).toHaveLength(1);
    expect(calls.upload[0]!.path).toBe("u-ana/fondo");
    expect(calls.upload[0]!.options).toMatchObject({ contentType: "image/jpeg", upsert: true });
    expect(Buffer.from(calls.upload[0]!.bytes).toString("latin1")).not.toContain("GPS");
    expect(calls.signed).toEqual([{ path: "u-ana/fondo", seconds: 3600 }]);
    expect(url).toContain("u-ana/fondo");
  });

  it("no sube nada si el archivo no es una imagen válida o pesa demasiado", async () => {
    const calls = fakeStorage();
    await expect(uploadUserWallpaper("u-ana", new TextEncoder().encode("<svg onload='alert(1)'/>"))).rejects.toThrow(WallpaperImageError);
    const big = new Uint8Array(5 * 1024 * 1024 + 1);
    big.set(exifJpeg());
    await expect(uploadUserWallpaper("u-ana", big)).rejects.toThrow(/5 MB/);
    expect(calls.upload).toHaveLength(0);
  });

  it("firma y borra solo la ruta de la persona", async () => {
    const calls = fakeStorage();
    expect(await signUserWallpaper("u-beto")).toContain("u-beto/fondo");
    await removeUserWallpaper("u-beto");
    expect(calls.removed).toEqual([["u-beto/fondo"]]);
  });
});
