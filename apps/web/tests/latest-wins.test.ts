import { describe, expect, it } from "vitest";
import { createLatestWins } from "../src/components/latest-wins";

const deferred = () => { let resolve!: () => void; const promise = new Promise<void>((r) => { resolve = r; }); return { promise, resolve }; };

describe("Cambio de espacio: gana el último", () => {
  it("ejecuta los cambios en orden, descarta los superados y avisa una sola vez al terminar el último", async () => {
    const enqueue = createLatestWins();
    const log: string[] = [];
    const a = deferred();
    const idle = () => log.push("idle");
    const pA = enqueue(async (isCurrent) => { log.push("A:inicio"); await a.promise; log.push(`A:fin:${String(isCurrent())}`); }, idle);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(log).toEqual(["A:inicio"]);
    const pB = enqueue(async () => { log.push("B"); }, idle);
    const pC = enqueue(async (isCurrent) => { log.push(`C:${String(isCurrent())}`); }, idle);
    a.resolve();
    await Promise.all([pA, pB, pC]);
    expect(log).toEqual(["A:inicio", "A:fin:false", "C:true", "idle"]);
  });

  it("un cambio que falla no bloquea al siguiente y el aviso final llega igual", async () => {
    const enqueue = createLatestWins();
    const log: string[] = [];
    await expect(enqueue(async () => { throw new Error("red caída"); }, () => log.push("idle-1"))).rejects.toThrow("red caída");
    await enqueue(async () => { log.push("segundo"); }, () => log.push("idle-2"));
    expect(log).toEqual(["idle-1", "segundo", "idle-2"]);
  });
});
