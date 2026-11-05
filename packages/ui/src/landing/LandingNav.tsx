import { HubiWordmark } from "../components/brand/HublyLogo";
import { ThemeToggle } from "./ThemeToggle";

export const LANDING_NAV_LINKS = [
  { href: "#producto", label: "Producto" },
  { href: "#privacidad", label: "Privacidad" },
  { href: "#preguntas", label: "Preguntas" },
] as const;

/** Barra flotante de cristal del landing (#85): logo, secciones, tema, Entrar y Crear cuenta. */
export function LandingNav() {
  return (
    <header className="sticky top-3 z-30 px-3 pt-3 lg:top-5 lg:px-6 lg:pt-5">
      <nav
        aria-label="Principal"
        className="hubly-enter glass-panel mx-auto flex h-15 max-w-6xl items-center gap-2 rounded-2xl pr-2 pl-4 lg:h-16 lg:gap-8 lg:pl-5"
      >
        <a href="/" aria-label="Hubly, inicio" className="group flex items-center text-(--text-primary)">
          <HubiWordmark className="transition-transform group-hover:-rotate-3" />
        </a>
        <ul className="m-0 hidden list-none gap-7 p-0 text-sm text-(--text-secondary) lg:flex">
          {LANDING_NAV_LINKS.map((link) => (
            <li key={link.href}>
              <a href={link.href} className="no-underline hover:text-(--accent-primary)">
                {link.label}
              </a>
            </li>
          ))}
        </ul>
        <span className="grow" />
        <span className="hidden lg:inline-flex">
          <ThemeToggle variante="icono" />
        </span>
        <a href="/login" className="flex h-11 items-center px-3 text-sm font-semibold text-(--text-primary) no-underline">
          Entrar
        </a>
        <a
          href="/login"
          className="flex h-11 items-center rounded-xl bg-(--accent-primary) px-4 text-sm font-semibold text-(--text-on-accent) no-underline transition-transform hover:bg-(--accent-primary-hover) active:scale-95"
        >
          Crear cuenta
        </a>
      </nav>
    </header>
  );
}
