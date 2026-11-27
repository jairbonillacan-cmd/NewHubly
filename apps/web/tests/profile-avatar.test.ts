import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { setSupabaseServerClientFactoryForTests } from "../src/server/composition/auth";
import {
  AVATAR_BUCKET,
  AVATAR_SIGNED_URL_SECONDS,
  signCoworkerAvatar,
  signCoworkerAvatars,
} from "../src/server/composition/profile";

const anaId = "11111111-1111-4111-8111-111111111111";
const betoId = "22222222-2222-4222-8222-222222222222";
const carlaId = "33333333-3333-4333-8333-333333333333";

function setupFakeAvatarStorage( deniedPaths = new Set<string>() ) {
  const signedCalls: Array<{ bucket: string; path: string; seconds: number }> = [];
  let clientCreated = 0;
  setSupabaseServerClientFactoryForTests(() => {
    clientCreated += 1;
    return {
      storage: {
        from: (bucket: string) => ({
          createSignedUrl: async (path: string, seconds: number) => {
            signedCalls.push({ bucket, path, seconds });
            if (deniedPaths.has(path)) return { data: null, error: new Error("RLS denied") };
            return { data: { signedUrl: `https://storage.test/${bucket}/${path}?exp=${seconds}` }, error: null };
          },
        }),
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
  });
  return { signedCalls, getClientCreated: () => clientCreated };
}

describe("Firma de avatares de compañeros con sesión autenticada (Issue 203, ADR 0012)", () => {
  afterEach(() => setSupabaseServerClientFactoryForTests(null));

  it("firma el avatar de un compañero válido por 1 hora y rechaza identificadores no UUID", async () => {
    const { signedCalls } = setupFakeAvatarStorage();
    expect(await signCoworkerAvatar(anaId)).toBe(`https://storage.test/${AVATAR_BUCKET}/${anaId}/foto?exp=${AVATAR_SIGNED_URL_SECONDS}`);
    expect(signedCalls).toEqual([{ bucket: AVATAR_BUCKET, path: `${anaId}/foto`, seconds: 3600 }]);

    expect(await signCoworkerAvatar("../otra-ruta")).toBeNull();
    expect(await signCoworkerAvatar("")).toBeNull();
    expect(signedCalls).toHaveLength(1);
  });

  it("firma en lote solo miembros con hasAvatar !== false, deduplica y devuelve null si RLS deniega", async () => {
    const { signedCalls, getClientCreated } = setupFakeAvatarStorage(new Set([`${carlaId}/foto`]));
    const urls = await signCoworkerAvatars([
      { id: anaId, hasAvatar: true },
      { id: anaId, hasAvatar: true },
      { id: betoId, hasAvatar: false },
      { id: carlaId, hasAvatar: true },
      { id: "no-es-uuid", hasAvatar: true },
    ]);

    expect(getClientCreated()).toBe(1);
    expect(signedCalls).toEqual([
      { bucket: AVATAR_BUCKET, path: `${anaId}/foto`, seconds: 3600 },
      { bucket: AVATAR_BUCKET, path: `${carlaId}/foto`, seconds: 3600 },
    ]);
    expect(urls.get(anaId)).toContain(`${anaId}/foto`);
    expect(urls.get(betoId)).toBeNull();
    expect(urls.get(carlaId)).toBeNull();
    expect(urls.get("no-es-uuid")).toBeNull();
  });

  it("no abre cliente de Supabase cuando ningún miembro tiene avatar para firmar", async () => {
    const { getClientCreated } = setupFakeAvatarStorage();
    const urls = await signCoworkerAvatars([{ id: anaId, hasAvatar: false }]);
    expect(urls.get(anaId)).toBeNull();
    expect(getClientCreated()).toBe(0);
  });

  it("usa createSignedUrls en un solo lote cuando Storage lo soporta y hace fallback si falla el lote (issue 292)", async () => {
    const batchCalls: Array<{ paths: string[]; seconds: number }> = [];
    const singleCalls: string[] = [];
    let batchFails = false;
    setSupabaseServerClientFactoryForTests(() => ({
      storage: {
        from: () => ({
          createSignedUrls: async (paths: string[], seconds: number) => {
            batchCalls.push({ paths, seconds });
            if (batchFails) return { data: null, error: new Error("batch unavailable") };
            return {
              data: paths.map((path) =>
                path.startsWith(carlaId)
                  ? { path, signedUrl: "", error: "not found" }
                  : { path, signedUrl: `https://storage.test/batch/${path}?exp=${seconds}`, error: null },
              ),
              error: null,
            };
          },
          createSignedUrl: async (path: string, seconds: number) => {
            singleCalls.push(path);
            return { data: { signedUrl: `https://storage.test/single/${path}?exp=${seconds}` }, error: null };
          },
        }),
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any);

    const urls = await signCoworkerAvatars([
      { id: anaId, hasAvatar: true },
      { id: betoId, hasAvatar: true },
      { id: carlaId, hasAvatar: true },
    ]);
    expect(batchCalls).toEqual([{ paths: [`${anaId}/foto`, `${betoId}/foto`, `${carlaId}/foto`], seconds: AVATAR_SIGNED_URL_SECONDS }]);
    expect(singleCalls).toHaveLength(0);
    expect(urls.get(anaId)).toBe(`https://storage.test/batch/${anaId}/foto?exp=3600`);
    expect(urls.get(betoId)).toBe(`https://storage.test/batch/${betoId}/foto?exp=3600`);
    expect(urls.get(carlaId)).toBeNull();

    batchFails = true;
    const fallbackUrls = await signCoworkerAvatars([{ id: anaId, hasAvatar: true }]);
    expect(singleCalls).toEqual([`${anaId}/foto`]);
    expect(fallbackUrls.get(anaId)).toBe(`https://storage.test/single/${anaId}/foto?exp=3600`);

    // Si createSignedUrls rechaza con excepción en lugar de devolver { error }, también cae al fallback individual.
    setSupabaseServerClientFactoryForTests(() => ({
      storage: {
        from: () => ({
          createSignedUrls: async () => { throw new Error("network boom"); },
          createSignedUrl: async (path: string, seconds: number) => ({
            data: { signedUrl: `https://storage.test/recovered/${path}?exp=${seconds}` },
            error: null,
          }),
        }),
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any);
    const recovered = await signCoworkerAvatars([{ id: betoId, hasAvatar: true }]);
    expect(recovered.get(betoId)).toBe(`https://storage.test/recovered/${betoId}/foto?exp=3600`);
  });
});
