import { Hubi, Wallpaper } from "@hubly/ui";
import Link from "next/link";

export default function NotFound() {
  return (
    <main className="relative isolate flex min-h-dvh items-center justify-center p-4 text-(--text-primary)">
      <Wallpaper fondo="contornos" />
      <section aria-labelledby="not-found-title" className="hubly-glass flex w-full max-w-md flex-col items-center gap-4 rounded-2xl px-6 py-8 text-center">
        <Hubi pose="buscar" tamano={128} decorativo />
        <h1 id="not-found-title" className="m-0 text-2xl font-bold">No encontramos esa página</h1>
        <p className="m-0 text-sm leading-relaxed text-(--text-secondary)">
          Puede que la dirección haya cambiado o que el enlace ya no esté disponible.
        </p>
        <Link href="/" className="inline-flex min-h-11 items-center justify-center rounded-lg bg-(--accent-primary) px-4 text-sm font-semibold text-(--text-on-accent) hover:bg-(--accent-primary-hover)">
          Volver al inicio
        </Link>
      </section>
    </main>
  );
}
