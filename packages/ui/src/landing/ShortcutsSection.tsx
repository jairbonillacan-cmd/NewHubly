import { SectionIntro } from "./SectionIntro";
import { StatusBadge } from "./StatusBadge";

const SHORTCUTS = [
  { keys: ["C"], label: "Capturar un pendiente" },
  { keys: ["/"], label: "Buscar notas y pendientes" },
  { keys: ["Ctrl", "K"], label: "Buscar o ejecutar una acción" },
] as const;

export function ShortcutsSection() {
  return (
    <section aria-labelledby="teclas-titulo" data-landing-section="teclas" className="mx-auto max-w-(--landing-width) px-4 pt-16 lg:pt-24">
      <div className="rounded-(--landing-panel-radius) bg-(--landing-ice) px-5 py-8 lg:px-12 lg:py-12">
        <SectionIntro id="teclas-titulo" title="Tres teclas y estás al día." body="Para quien vive en el teclado." />
        <ul className="mt-7 grid gap-3 lg:grid-cols-3 lg:gap-4">
          {SHORTCUTS.map(({ keys, label }) => (
            <li key={label} className="grid justify-items-start gap-3 rounded-3xl bg-(--landing-card) p-4 lg:p-6">
              <div className="flex gap-2">
                {keys.map((key) => (
                  <kbd key={key} className="inline-grid h-11 min-w-11 place-items-center rounded-xl border border-b-4 border-(--landing-key) bg-(--landing-row) px-2.5 font-mono text-lg font-semibold">{key}</kbd>
                ))}
              </div>
              <h3 className="landing-display text-xl font-medium">{label}</h3>
              <StatusBadge status="disponible" />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
