import { HubiWordmark } from "../components/brand/HublyLogo";

export const DEFAULT_FOOTER_LINKS: readonly { href: string; label: string }[] = [
  { href: "/privacidad", label: "Privacidad" },
  { href: "/terminos", label: "Términos" },
];

export function LandingFooter({ links = DEFAULT_FOOTER_LINKS }: { links?: readonly { href: string; label: string }[] }) {
  return (
    <footer data-landing-section="pie" className="border-t border-(--border-default) px-4 py-5">
      <div className="mx-auto flex max-w-(--landing-width) flex-wrap items-center gap-x-4 text-sm text-(--text-muted)">
        <a href="/" aria-label="Hubly, inicio" className="inline-flex min-h-11 items-center text-(--text-primary)"><HubiWordmark tamano="sm" /></a>
        <span className="mr-auto">© 2026 Hubly</span>
        <nav aria-label="Pie de página" className="flex flex-wrap gap-x-4">
          {links.map((link) => (
            <a key={link.href} href={link.href} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full hover:underline">{link.label}</a>
          ))}
          <a href="/login" className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full hover:underline">Entrar</a>
        </nav>
      </div>
    </footer>
  );
}
