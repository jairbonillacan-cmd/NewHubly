import { tokens } from "../tokens";

export interface LineGraphicCycleProps {
  activeStageIndex?: number;
  compact?: boolean;
}

export const LIFECYCLE_STAGES = [
  { id: "idea", name: "Idea", description: "Captura ágil del concepto" },
  { id: "draft", name: "Borrador", description: "Redacción y diseño inicial" },
  { id: "internal-review", name: "Revisión interna", description: "Control editorial del equipo" },
  { id: "client-approval", name: "Aprobación del cliente", description: "Validación formal en un clic" },
  { id: "scheduled", name: "Programada", description: "Fecha y canal fijados" },
  { id: "published", name: "Publicada", description: "En vivo en redes" },
  { id: "measured", name: "Medida", description: "Impacto real documentado" },
] as const;

export function LineGraphicCycle({ activeStageIndex = 3, compact = false }: LineGraphicCycleProps) {
  return (
    <div
      role="img"
      aria-label="Diagrama del ciclo de vida de la pieza: de idea a medida, con aprobación del cliente en curso"
      className="hubly-lifecycle-container"
    >
      <div className="hubly-lifecycle-track">
        {/* Línea conectora base */}
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            top: tokens.space[3],
            left: tokens.space[4],
            right: tokens.space[4],
            height: tokens.border.thin,
            backgroundColor: tokens.color.borderControl,
            zIndex: 0,
          }}
        />

        {LIFECYCLE_STAGES.map((stage, idx) => {
          const isPassed = idx < activeStageIndex;
          const isActive = idx === activeStageIndex;

          return (
            <div
              key={stage.id}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                textAlign: "center",
                position: "relative",
                zIndex: 1,
                gap: tokens.space[2],
                minWidth: tokens.space[0],
              }}
            >
              {/* Nodo indicador con línea fina */}
              <div
                style={{
                  width: tokens.space[6],
                  height: tokens.space[6],
                  borderRadius: tokens.radius.full,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: isActive
                    ? tokens.color.accentWarm
                    : isPassed
                      ? tokens.color.textPrimary
                      : tokens.bento.cardBg,
                  border: `${tokens.border.thin} solid ${
                    isActive
                      ? tokens.color.accentWarm
                      : isPassed
                        ? tokens.color.textPrimary
                        : tokens.color.borderControl
                  }`,
                  color: isActive || isPassed ? tokens.color.textOnAccent : tokens.color.textMuted,
                  fontSize: tokens.font.size.xs,
                  fontWeight: tokens.font.weight.semibold,
                  boxShadow: isActive ? `0 0 0 ${tokens.space[1]} ${tokens.color.accentWarmSubtle}` : "none",
                  transition: "transform 0.2s ease",
                }}
              >
                {isPassed ? "✓" : idx + 1}
              </div>

              {/* Etiqueta de la etapa */}
              <div style={{ display: "flex", flexDirection: "column", gap: tokens.space[0] }}>
                <span
                  style={{
                    fontSize: compact ? tokens.font.size.xs : tokens.font.size.sm,
                    fontWeight: isActive ? tokens.font.weight.bold : tokens.font.weight.medium,
                    color: isActive
                      ? tokens.color.accentWarmText
                      : isPassed
                        ? tokens.color.textPrimary
                        : tokens.color.textMuted,
                    lineHeight: tokens.font.leading.tight,
                  }}
                >
                  {stage.name}
                </span>
                {!compact && (
                  <span
                    style={{
                      fontSize: tokens.font.size.xs,
                      color: tokens.color.textMuted,
                      display: "none",
                    }}
                  >
                    {stage.description}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
