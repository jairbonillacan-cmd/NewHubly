const AUDIENCE = [
  ["CM", "Community managers", "bg-(--landing-mist) text-(--landing-accent-text)"],
  ["D", "Diseñadores", "bg-(--tint-lilac) text-(--text-primary)"],
  ["DC", "Directores de cuenta", "bg-(--landing-soft) text-(--text-secondary)"],
  ["EC", "Estrategas de contenido", "bg-(--status-success-bg) text-(--status-success-text)"],
  ["F", "Freelancers", "bg-(--landing-note) text-(--landing-on-note)"],
] as const;

export function AudienceSection() {
  return (
    <section aria-labelledby="audiencia-titulo" data-landing-section="audiencia" className="mx-auto max-w-(--landing-width) px-4 pt-12 text-center lg:pt-18">
      <h2 id="audiencia-titulo" className="landing-display text-2xl leading-tight font-normal lg:text-3xl">
        Para quien saca el contenido de cada semana
      </h2>
      <ul className="mt-5 flex flex-wrap justify-center gap-2.5">
        {AUDIENCE.map(([initials, name, tone]) => (
          <li key={name} className="flex items-center gap-2 rounded-full border border-(--border-default) bg-(--landing-card) py-1.5 pr-3.5 pl-1.5 text-xs font-medium lg:text-sm">
            <span aria-hidden="true" className={`grid size-8 place-items-center rounded-full text-xs font-semibold ${tone}`}>{initials}</span>{name}
          </li>
        ))}
      </ul>
    </section>
  );
}
