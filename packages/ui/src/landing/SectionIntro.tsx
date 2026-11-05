export function SectionIntro({ id, label, title, body }: { id: string; label?: string; title: string; body?: string }) {
  return (
    <header className="grid gap-3 lg:justify-items-center lg:text-center">
      {label && <p className="text-xs font-bold tracking-(--tracking-widest) text-(--landing-accent-text) uppercase">{label}</p>}
      <h2 id={id} className="landing-display text-4xl leading-none font-normal tracking-(--tracking-tight) lg:text-6xl">{title}</h2>
      {body && <p className="max-w-2xl leading-relaxed text-(--text-secondary) lg:text-lg">{body}</p>}
    </header>
  );
}
