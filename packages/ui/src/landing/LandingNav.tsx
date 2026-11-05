import { HubiWordmark } from "../components/brand/HublyLogo";
import { buttonLinkClass } from "../heroui-classes";
import { ThemeToggle } from "./ThemeToggle";

export interface NavLink {
  href: string;
  label: string;
  current?: boolean;
}

export const LANDING_NAV_LINKS: readonly NavLink[] = [
  { href: "#producto", label: "Producto" },
  { href: "#privacidad", label: "Privacidad" },
  { href: "#preguntas", label: "Preguntas" },
];

/** Barra flotante de cristal (#85): logo, secciones, tema, Entrar y Crear cuenta, con botones de HeroUI. */
export function LandingNav({ links = LANDING_NAV_LINKS }: { links?: readonly NavLink[] }) {
  return (
    <header className="sticky top-3 z-30 px-3 pt-3 lg:top-5 lg:px-6 lg:pt-5">
      <nav
        aria-label="Principal"
        className="hubly-enter glass-panel mx-auto flex h-15 max-w-6xl items-center gap-2 rounded-2xl pr-2 pl-4 lg:h-16 lg:gap-8 lg:pl-5"
      >
        <a href="/" aria-label="Hubly, inicio" className="group flex items-center text-(--text-primary)">
          <HubiWordmark className="transition-transform group-hover:-rotate-3" />
        </a>
        <ul className="m-0 hidden list-none gap-1 p-0 lg:flex">
          {links.map((link) => (
            <li key={link.href}>
              <a href={link.href} aria-current={link.current ? "page" : undefined} className={buttonLinkClass("ghost", "sm", "text-(--text-secondary) aria-[current=page]:text-(--accent-primary)")}>
                {link.label}
              </a>
            </li>
          ))}
        </ul>
        <span className="grow" />
        <span className="hidden lg:inline-flex">
          <ThemeToggle variante="icono" />
        </span>
        <a href="/login" className={buttonLinkClass("ghost", "md")}>
          Entrar
        </a>
        <a href="/login" className={buttonLinkClass("primary", "md")}>
          Crear cuenta
        </a>
      </nav>
    </header>
  );
}
