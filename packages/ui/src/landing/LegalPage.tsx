import { Card } from "@heroui/react";
import { buttonLinkClass } from "../heroui-classes";
import { LandingNav } from "./LandingNav";
import { LandingFooter } from "./LandingSections";

export interface LegalSection {
  id: string;
  title: string;
  body: string;
}

export interface LegalPageProps {
  eyebrow: string;
  title: string;
  intro: string;
  sections: readonly LegalSection[];
  current: "/privacidad" | "/terminos";
}

/** Plantilla de las páginas legales con la misma barra y pie que el landing (#85) y tarjetas de HeroUI. */
export function LegalPage({ eyebrow, title, intro, sections, current }: LegalPageProps) {
  return (
    <div className="min-h-dvh bg-(--surface-canvas) text-(--text-primary)">
      <LandingNav
        links={[
          { href: "/", label: "Inicio" },
          { href: "/privacidad", label: "Privacidad", current: current === "/privacidad" },
          { href: "/terminos", label: "Términos", current: current === "/terminos" },
        ]}
      />
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 pt-14 pb-20 lg:pt-20">
        <header className="hubly-enter flex flex-col gap-3 pb-6">
          <span className="text-xs font-bold tracking-(--tracking-widest) text-(--accent-primary) uppercase">{eyebrow}</span>
          <h1 className="m-0 text-4xl leading-tight font-bold tracking-(--tracking-tighter) lg:text-5xl">{title}</h1>
          <p className="m-0 text-lg leading-relaxed text-(--text-secondary)">{intro}</p>
        </header>
        {sections.map((section, index) => (
          <Card key={section.id} id={section.id} aria-labelledby={`heading-${section.id}`} className="hubly-enter scroll-mt-28" data-delay={Math.min(index + 1, 4)}>
            <Card.Header>
              <Card.Title id={`heading-${section.id}`} className="text-lg font-semibold">
                {section.title}
              </Card.Title>
            </Card.Header>
            <Card.Content>
              <p className="m-0 text-base leading-relaxed text-(--text-secondary)">{section.body}</p>
            </Card.Content>
          </Card>
        ))}
        <nav aria-label="Navegación legal" className="flex flex-wrap gap-2 pt-4">
          <a href="/" className={buttonLinkClass("secondary", "md")}>Volver al inicio</a>
          <a href="/hoy" className={buttonLinkClass("ghost", "md")}>Ir a Hoy</a>
        </nav>
      </main>
      <LandingFooter />
    </div>
  );
}
