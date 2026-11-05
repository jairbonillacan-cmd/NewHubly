import { HubiWordmark } from "../components/brand/HublyLogo";
import { ThemeToggle } from "./ThemeToggle";
import { MobileNav, type NavLink } from "./MobileNav";

export type { NavLink } from "./MobileNav";

export const LANDING_NAV_LINKS: readonly NavLink[] = [
  { href: "#producto", label: "Producto" },
  { href: "#lo-que-viene", label: "Lo que viene" },
  { href: "#privacidad", label: "Privacidad" },
  { href: "#preguntas", label: "Preguntas" },
];

export function LandingNav({ links = LANDING_NAV_LINKS }: { links?: readonly NavLink[] }) {
  return (
    <header className="relative z-10 px-4 pt-4 lg:pt-6" data-landing-section="navegacion">
      <nav aria-label="Principal" className="glass-panel relative mx-auto grid min-h-16 max-w-(--landing-width) grid-cols-[1fr_auto] items-center gap-2 rounded-full! px-3 shadow-(--landing-shadow)! lg:grid-cols-[1fr_auto_1fr] lg:px-5">
        <a href="/" aria-label="Hubly, inicio" className="inline-flex min-h-11 items-center justify-self-start rounded-full px-1">
          <HubiWordmark />
        </a>
        <ul className="m-0 hidden list-none gap-1 p-0 lg:flex">
          {links.map((link) => (
            <li key={link.href}>
              <a href={link.href} aria-current={link.current ? "page" : undefined} className="inline-flex min-h-11 items-center rounded-full px-3 text-sm font-medium text-(--text-secondary) hover:bg-(--landing-ice) aria-[current=page]:text-(--landing-accent-text)">
                {link.label}
              </a>
            </li>
          ))}
        </ul>
        <div className="flex items-center justify-self-end gap-2">
          {links !== LANDING_NAV_LINKS && <span className="hidden lg:inline-flex"><ThemeToggle variante="icono" /></span>}
          <a href="/login" className="inline-flex min-h-11 items-center rounded-full bg-(--landing-ice) px-4 text-sm font-semibold text-(--text-primary) hover:underline">Entrar</a>
          <a href="/login" className="hidden min-h-11 items-center rounded-full bg-(--landing-ink) px-5 text-sm font-semibold text-(--landing-on-ink) hover:underline lg:inline-flex">Crear cuenta</a>
          <MobileNav links={links} />
        </div>
      </nav>
    </header>
  );
}
