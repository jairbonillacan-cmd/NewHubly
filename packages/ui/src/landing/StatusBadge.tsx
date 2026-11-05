export type FeatureStatus = "disponible" | "pronto" | "proximamente";

const STATUS = {
  disponible: ["Ya disponible", "bg-(--status-success-bg) text-(--status-success-text)"],
  pronto: ["Muy pronto", "bg-(--landing-ice) text-(--landing-accent-text)"],
  proximamente: ["Próximamente", "bg-(--landing-soft) text-(--text-secondary)"],
} as const;

export function StatusBadge({ status, short = false }: { status: FeatureStatus; short?: boolean }) {
  const [label, tone] = STATUS[status];
  return (
    <span className={`inline-flex w-fit items-center rounded-full px-3 py-1 text-xs leading-tight font-semibold ${tone}`}>
      {short && status === "disponible" ? "Disponible" : label}
    </span>
  );
}
