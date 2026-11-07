import { Hubi } from "../components/brand/Hubi";
import { HubiWordmark } from "../components/brand/HublyLogo";
import { ThemeToggle } from "./ThemeToggle";

type FooterLink = { href: string; label: string };

export const DEFAULT_FOOTER_LINKS: readonly FooterLink[] = [
  { href: "/privacidad", label: "Privacidad" },
  { href: "/terminos", label: "Términos" },
];

// Columnas del pie (issue 129): todas apuntan a rutas o secciones que existen.
const COLUMNS: readonly { title: string; links: readonly FooterLink[] }[] = [
  { title: "Producto", links: [
    { href: "/#producto", label: "Cómo funciona" },
    { href: "/#dia", label: "Así se trabaja" },
    { href: "/#crece", label: "Crece a tu manera" },
    { href: "/#lo-que-viene", label: "Lo que viene" },
    { href: "/precios", label: "Precios" },
  ] },
  { title: "Hubly", links: [
    { href: "/#hubi", label: "Conoce a Hubi" },
    { href: "/#privacidad", label: "Tranquilidad" },
    { href: "/#preguntas", label: "Preguntas" },
  ] },
  { title: "Tu cuenta", links: [
    { href: "/registro", label: "Crear cuenta" },
    { href: "/login", label: "Entrar" },
    { href: "/inicio", label: "Ir a Inicio" },
  ] },
];

const LINK = "inline-flex min-h-11 items-center text-sm text-(--text-secondary) hover:text-(--text-primary) hover:underline";

export function LandingFooter({ links = DEFAULT_FOOTER_LINKS }: { links?: readonly FooterLink[] }) {
  return (
    <footer data-landing-section="pie" className="border-t border-(--border-default) bg-(--landing-paper) px-4 pt-12 pb-6 lg:pt-16">
      <div className="mx-auto grid max-w-(--landing-width) grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-4 lg:grid-cols-[1.4fr_repeat(4,minmax(0,1fr))] lg:gap-8">
        <div className="col-span-2 flex flex-col items-start gap-4 sm:col-span-4 lg:col-span-1">
          <a href="/" aria-label="Hubly, inicio" className="inline-flex min-h-11 items-center text-(--text-primary)"><HubiWordmark /></a>
          <p className="max-w-xs text-sm leading-relaxed text-(--text-secondary)">Un solo espacio para todo tu marketing: tu marca o las de tus clientes, por tu cuenta o con tu equipo.</p>
          <div className="flex items-center gap-3">
            <Hubi acabado="volumen" tamano={64} decorativo priority="deferred" className="hubly-wiggle size-16" sizing="css" />
            <ThemeToggle />
          </div>
        </div>
        {[...COLUMNS, { title: "Legal", links }].map((column) => (
          <nav key={column.title} aria-label={column.title}>
            <p className="text-xs font-bold tracking-(--tracking-widest) text-(--text-muted) uppercase">{column.title}</p>
            <ul className="mt-2 grid list-none p-0">
              {column.links.map((link) => <li key={link.href}><a href={link.href} className={LINK}>{link.label}</a></li>)}
            </ul>
          </nav>
        ))}
      </div>
      <div className="mx-auto mt-10 flex max-w-(--landing-width) flex-wrap items-center justify-between gap-2 border-t border-(--border-default) pt-5 text-xs text-(--text-muted)">
        <span>© 2026 Hubly</span>
        <span>Para tu marca y para tu agencia.</span>
      </div>
    </footer>
  );
}
