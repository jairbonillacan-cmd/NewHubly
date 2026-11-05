import { Accordion } from "@heroui/react";
import { Hubi } from "../components/brand/Hubi";
import { HubiWordmark } from "../components/brand/HublyLogo";
import { buttonLinkClass } from "../heroui-classes";
import { Reveal } from "./Reveal";

const PAIN_LINES = [
  "Las ideas, en un grupo de WhatsApp.",
  "La parrilla, en un Excel que nadie actualiza.",
  "Los cambios del cliente, en un audio de cuatro minutos.",
] as const;

/** Lo que vive hoy una agencia, en frases grandes, y la respuesta de Hubly. */
export function PainSection() {
  return (
    <section aria-label="El problema" className="mx-auto flex max-w-7xl flex-col gap-3 px-4 pt-24 lg:items-center lg:gap-3.5 lg:pt-36 lg:text-center">
      {PAIN_LINES.map((line, index) => (
        <Reveal key={line} retraso={index as 0 | 1 | 2}>
          <p className="m-0 text-2xl leading-snug font-semibold tracking-(--tracking-tight) text-(--text-faint) lg:text-4xl lg:leading-tight">{line}</p>
        </Reveal>
      ))}
      <Reveal retraso={3}>
        <p className="m-0 text-2xl leading-snug font-semibold tracking-(--tracking-tight) text-(--text-muted) lg:text-4xl lg:leading-tight">
          Y la pregunta de siempre: ¿quién tiene esto?
        </p>
      </Reveal>
      <Reveal retraso={5} className="mt-4 lg:mt-7">
        <p className="m-0 text-2xl leading-snug font-bold tracking-(--tracking-tight) text-(--text-primary) lg:text-4xl lg:leading-tight">
          En Hubly, <span className="text-(--accent-primary)">cada pieza dice qué sigue y quién la tiene.</span>
        </p>
      </Reveal>
    </section>
  );
}

const DATA_POINTS = [
  { title: "Privado hasta que lo compartas", body: "Nadie más ve tus notas si no lo decides tú.", icon: "M7 10V7a5 5 0 0 1 10 0v3M6 10h12a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1z" },
  { title: "Te lo llevas cuando quieras", body: "Exportas todo en JSON o Markdown.", icon: "M12 4v11M7 10l5 5 5-5M5 20h14" },
  { title: "Tu hora, tu «hoy»", body: "Lo que vence hoy, vence en tu día.", icon: "M12 4a8 8 0 1 0 0 16a8 8 0 1 0 0-16M12 8v4l3 2" },
] as const;

export function DataSection() {
  return (
    <section id="privacidad" aria-labelledby="privacidad-titulo" className="mx-auto w-full max-w-6xl scroll-mt-28 px-4 pt-16 lg:px-6 lg:pt-24">
      <Reveal className="grid gap-6 rounded-3xl border border-(--border-default) bg-(--surface-subtle) px-6 py-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.6fr)] lg:items-center lg:gap-14 lg:px-16 lg:py-14">
        <h2 id="privacidad-titulo" className="m-0 text-3xl leading-tight font-bold tracking-(--tracking-tighter) text-(--text-primary) lg:text-5xl">
          Tus datos son tuyos.
        </h2>
        <ul className="m-0 grid list-none gap-6 p-0 md:grid-cols-3 lg:gap-7">
          {DATA_POINTS.map((point) => (
            <li key={point.title} className="group flex flex-col gap-2">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="text-(--accent-primary) transition-transform group-hover:-translate-y-0.5 group-hover:scale-110">
                <path d={point.icon} />
              </svg>
              <span className="text-base font-semibold text-(--text-primary) lg:text-lg">{point.title}</span>
              <span className="text-sm leading-normal text-(--text-secondary) lg:text-base">{point.body}</span>
            </li>
          ))}
        </ul>
      </Reveal>
    </section>
  );
}

export const LANDING_FAQ = [
  { q: "¿Para quién es Hubly?", a: "Para agencias y equipos de redes que hoy se coordinan entre chats, hojas y notas sueltas. También si trabajas solo." },
  { q: "¿Qué puedo usar hoy?", a: "Tu espacio personal: notas, pendientes y la vista Hoy. Lo de equipo, clientes y aprobaciones lo vamos sacando por partes." },
  { q: "¿Mi cliente tiene que crear cuenta?", a: "No. Cuando llegue la aprobación, le mandas un enlace y listo." },
  { q: "¿Me puedo llevar mis datos?", a: "Sí, cuando quieras, en JSON o Markdown." },
] as const;

export function FaqSection() {
  return (
    <section id="preguntas" aria-labelledby="preguntas-titulo" className="mx-auto grid w-full max-w-6xl scroll-mt-28 gap-4 px-4 pt-20 lg:grid-cols-[22rem_minmax(0,1fr)] lg:gap-16 lg:px-6 lg:pt-28">
      <div className="flex flex-col gap-3">
        <span className="text-xs font-bold tracking-(--tracking-widest) text-(--accent-primary) uppercase">Preguntas</span>
        <h2 id="preguntas-titulo" className="m-0 text-3xl leading-tight font-bold tracking-(--tracking-tighter) text-(--text-primary) lg:text-5xl">
          Lo que nos preguntan.
        </h2>
      </div>
      <Accordion defaultExpandedKeys={[LANDING_FAQ[0].q]} className="w-full">
        {LANDING_FAQ.map((item) => (
          <Accordion.Item key={item.q} id={item.q} className="border-t border-(--border-default)">
            <Accordion.Heading>
              <Accordion.Trigger className="py-5 text-base font-semibold text-(--text-primary) lg:py-6 lg:text-lg">
                {item.q}
                <Accordion.Indicator />
              </Accordion.Trigger>
            </Accordion.Heading>
            <Accordion.Panel>
              <Accordion.Body className="pr-10 pb-6 text-base leading-relaxed text-(--text-secondary)">{item.a}</Accordion.Body>
            </Accordion.Panel>
          </Accordion.Item>
        ))}
      </Accordion>
    </section>
  );
}

export function FinalCta() {
  return (
    <section aria-labelledby="cta-titulo" className="mx-auto w-full max-w-6xl px-4 pt-16 pb-16 lg:px-6 lg:pt-28 lg:pb-24">
      <Reveal className="relative flex flex-col gap-4 overflow-hidden rounded-3xl bg-(--tint-blue) px-6 pt-8 pb-40 lg:min-h-100 lg:justify-center lg:px-18 lg:py-0">
        <h2 id="cta-titulo" className="m-0 max-w-xl text-4xl leading-none font-bold tracking-(--tracking-tightest) text-(--text-primary) lg:text-6xl">
          Empieza con tu día de hoy.
        </h2>
        <p className="m-0 max-w-xl text-base leading-relaxed text-(--text-secondary) lg:text-lg">Crea tu cuenta y ten tus pendientes en orden en un minuto.</p>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row">
          <a href="/login" className={buttonLinkClass("primary", "lg")}>
            Crear cuenta
          </a>
          <a href="/login" className={buttonLinkClass("secondary", "lg")}>
            Ya tengo cuenta
          </a>
        </div>
        <span className="hubly-float pointer-events-none absolute right-3 -bottom-3 lg:right-16">
          <span className="lg:hidden"><Hubi acabado="volumen" pose="laptop" tamano={150} decorativo /></span>
          <span className="hidden lg:block"><Hubi acabado="volumen" pose="laptop" tamano={320} decorativo /></span>
        </span>
      </Reveal>
    </section>
  );
}

export const DEFAULT_FOOTER_LINKS: readonly { href: string; label: string }[] = [
  { href: "/privacidad", label: "Privacidad" },
  { href: "/terminos", label: "Términos" },
];

export function LandingFooter({ links = DEFAULT_FOOTER_LINKS }: { links?: readonly { href: string; label: string }[] }) {
  return (
    <footer className="border-t border-(--border-default) px-4 py-8 lg:px-6">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 text-sm text-(--text-muted)">
        <a href="/" aria-label="Hubly, inicio" className="flex items-center text-(--text-primary)">
          <HubiWordmark tamano="sm" />
        </a>
        <span>© 2026</span>
        <span className="grow" />
        {links.map((link) => (
          <a key={link.href} href={link.href} className={buttonLinkClass("ghost", "sm", "text-(--text-muted)")}>{link.label}</a>
        ))}
        <a href="/login" className={buttonLinkClass("ghost", "sm", "text-(--text-muted)")}>Entrar</a>
      </div>
    </footer>
  );
}
