import { Wallpaper } from "../espacio/Wallpaper";
import { Icon } from "../espacio/icons";
import { StatusBadge } from "./StatusBadge";

const SWATCHES = [
  ["Contornos", "contornos", "light"],
  ["Contornos · oscuro", "contornos", "dark"],
  ["Niebla", "tinta", "light"],
] as const;

export function WorkspaceSection() {
  return (
    <section aria-labelledby="espacio-titulo" data-landing-section="espacio" className="mx-auto max-w-(--landing-width) px-4 pt-16 lg:pt-24">
      <div className="grid items-center gap-6 rounded-(--landing-panel-radius) border border-(--border-default) bg-(--landing-card) px-5 py-8 lg:grid-cols-2 lg:gap-12 lg:p-12">
        <div className="grid gap-3">
          <StatusBadge status="disponible" />
          <h2 id="espacio-titulo" className="landing-display text-4xl leading-none font-normal tracking-(--tracking-tight) lg:text-5xl">Un lugar de trabajo que se siente tuyo.</h2>
          <p className="max-w-md leading-relaxed text-(--text-secondary)">Elige tu fondo, acomoda tus paneles y trabaja en claro u oscuro. Tu fondo solo lo ves tú.</p>
        </div>
        <ul className="grid grid-cols-2 gap-2.5">
          {SWATCHES.map(([label, wallpaper, theme]) => (
            <li key={label} className="relative flex h-32.5 items-end overflow-hidden rounded-2xl p-2 isolate">
              <Wallpaper fondo={wallpaper} preview={theme} />
              <span className="rounded-full bg-(--landing-card) px-2.5 py-1 text-xs font-semibold">{label}</span>
            </li>
          ))}
          <li className="grid h-32.5 place-content-center justify-items-center gap-2 rounded-2xl border border-dashed border-(--border-control) p-2 text-center text-xs font-semibold text-(--text-secondary)">
            <Icon name="imagen" className="size-6" />Tu imagen · Muy pronto
          </li>
        </ul>
      </div>
    </section>
  );
}
