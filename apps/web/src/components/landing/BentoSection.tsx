import { tokens } from "@hubly/ui";
import { LineGraphicCycle } from "./LineGraphic";

export interface BentoSectionProps {
  layoutVariant?: "asymmetric" | "integrated" | "timeline";
}

export function BentoSection({ layoutVariant = "asymmetric" }: BentoSectionProps) {
  return (
    <section
      id="ciclo"
      aria-label="Bloques Bento con el producto real de Hubly"
      style={{
        backgroundColor: tokens.bento.surfaceBase,
        color: tokens.color.textPrimary,
        paddingBlock: tokens.space[12],
        paddingInline: tokens.space[4],
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: tokens.layout.bentoWidth,
          marginInline: "auto",
          display: "flex",
          flexDirection: "column",
          gap: tokens.space[10],
        }}
      >
        {/* Cabecera del bloque Bento */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: tokens.space[3],
            maxWidth: tokens.layout.readingWidth,
          }}
        >
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: tokens.space[2],
            }}
          >
            <span
              style={{
                width: tokens.space[2],
                height: tokens.space[2],
                borderRadius: tokens.radius.full,
                backgroundColor: tokens.color.accentWarm,
              }}
              aria-hidden="true"
            />
            <span
              style={{
                fontSize: tokens.font.size.xs,
                fontWeight: tokens.font.weight.bold,
                textTransform: "uppercase",
                letterSpacing: tokens.font.tracking.widest,
                color: tokens.color.accentWarmText,
              }}
            >
              Arquitectura del producto
            </span>
          </div>

          <h2
            style={{
              margin: tokens.space[0],
              fontSize: tokens.font.size["3xl"],
              fontWeight: tokens.font.weight.bold,
              lineHeight: tokens.font.leading.tight,
              letterSpacing: tokens.font.tracking.tight,
              color: tokens.color.textPrimary,
            }}
          >
            Construido sobre el flujo real de una agencia
          </h2>
          <p
            style={{
              margin: tokens.space[0],
              fontSize: tokens.font.size.base,
              lineHeight: tokens.font.leading.relaxed,
              color: tokens.color.textSecondary,
            }}
          >
            Sin datos simulados ni métricas inventadas. Cada módulo de este bento refleja el modelo operativo que ejecuta NewHubly desde el primer día.
          </p>
        </div>

        {/* Cuadrícula Bento Asimétrica */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(12, minmax(0, 1fr))",
            gap: tokens.space[6],
          }}
        >
          {/* MÓDULO 1 (Grande, 8 columnas): El ciclo de la pieza (Constitución #2) */}
          <article
            style={{
              gridColumn: "span 12",
              backgroundColor: tokens.bento.cardBg,
              border: `${tokens.border.thin} solid ${tokens.bento.cardBorder}`,
              borderRadius: tokens.radius["2xl"],
              padding: tokens.space[8],
              display: "flex",
              flexDirection: "column",
              gap: tokens.space[6],
              boxShadow: tokens.bento.cardShadow,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: tokens.space[4],
                flexWrap: "wrap",
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: tokens.space[1] }}>
                <span
                  style={{
                    fontSize: tokens.font.size.xs,
                    fontWeight: tokens.font.weight.bold,
                    textTransform: "uppercase",
                    letterSpacing: tokens.font.tracking.wider,
                    color: tokens.color.textMuted,
                  }}
                >
                  Constitución #2 · Columna vertebral
                </span>
                <h3
                  style={{
                    margin: tokens.space[0],
                    fontSize: tokens.font.size["2xl"],
                    fontWeight: tokens.font.weight.semibold,
                    color: tokens.color.textPrimary,
                  }}
                >
                  El ciclo completo de la pieza
                </h3>
              </div>

              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: tokens.space[2],
                  paddingBlock: tokens.space[1],
                  paddingInline: tokens.space[3],
                  backgroundColor: tokens.color.accentWarmSubtle,
                  borderRadius: tokens.radius.full,
                  fontSize: tokens.font.size.xs,
                  fontWeight: tokens.font.weight.semibold,
                  color: tokens.color.accentWarmText,
                }}
              >
                <span>7 etapas auditadas</span>
              </div>
            </div>

            <p
              style={{
                margin: tokens.space[0],
                fontSize: tokens.font.size.base,
                lineHeight: tokens.font.leading.relaxed,
                color: tokens.color.textSecondary,
                maxWidth: tokens.layout.readingWidth,
              }}
            >
              Cada publicación avanza por transiciones irreversibles y auditadas. No hay estados ambiguos: se sabe cuándo nació la idea, quién editó el borrador, quién dio el visto bueno interno y qué cliente autorizó la publicación.
            </p>

            {/* Gráfico lineal fino monocromo con 1 solo acento naranja */}
            <div
              style={{
                paddingBlock: tokens.space[4],
                paddingInline: tokens.space[2],
                borderTop: `${tokens.border.thin} solid ${tokens.bento.cardBorder}`,
                borderBottom: `${tokens.border.thin} solid ${tokens.bento.cardBorder}`,
              }}
            >
              <LineGraphicCycle activeStageIndex={3} />
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: `repeat(auto-fit, minmax(${tokens.bento.colMin}, 1fr))`,
                gap: tokens.space[4],
                fontSize: tokens.font.size.xs,
                color: tokens.color.textMuted,
              }}
            >
              <div>
                <strong style={{ color: tokens.color.textPrimary, display: "block" }}>Auditoría inmutable:</strong>
                Registro con marca de tiempo UTC, usuario y cambio de estado en cada paso.
              </div>
              <div>
                <strong style={{ color: tokens.color.textPrimary, display: "block" }}>Cero saltos:</strong>
                No se puede programar sin aprobación del cliente; no se puede medir sin publicación real.
              </div>
              <div>
                <strong style={{ color: tokens.color.textPrimary, display: "block" }}>Portal cliente:</strong>
                El cliente aprueba o solicita ajustes desde un enlace firmado sin tener que crear cuenta.
              </div>
            </div>
          </article>

          {/* MÓDULO 2 (4 columnas): Contraste tipográfico radical (Número grande en peso ligero) */}
          <article
            id="pregunta"
            style={{
              gridColumn: layoutVariant === "integrated" ? "span 12" : "span 4",
              backgroundColor: tokens.bento.cardBg,
              border: `${tokens.border.thin} solid ${tokens.bento.cardBorder}`,
              borderRadius: tokens.radius["2xl"],
              padding: tokens.space[8],
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              gap: tokens.space[6],
              boxShadow: tokens.bento.cardShadow,
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: tokens.space[2] }}>
              <span
                style={{
                  fontSize: tokens.font.size.xs,
                  fontWeight: tokens.font.weight.bold,
                  textTransform: "uppercase",
                  letterSpacing: tokens.font.tracking.wider,
                  color: tokens.color.textMuted,
                }}
              >
                Honestidad operativa
              </span>
              <h3
                style={{
                  margin: tokens.space[0],
                  fontSize: tokens.font.size.xl,
                  fontWeight: tokens.font.weight.semibold,
                  color: tokens.color.textPrimary,
                }}
              >
                Cero ambigüedad
              </h3>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: tokens.space[1] }}>
              <div
                style={{
                  fontSize: tokens.font.size.displayNum,
                  lineHeight: "1",
                  fontWeight: tokens.font.weight.light,
                  color: tokens.color.surfaceBrand,
                  letterSpacing: tokens.font.tracking.tightest,
                }}
              >
                0
              </div>
              <p
                style={{
                  margin: tokens.space[0],
                  fontSize: tokens.font.size.sm,
                  fontWeight: tokens.font.weight.medium,
                  color: tokens.color.textSecondary,
                  lineHeight: tokens.font.leading.normal,
                }}
              >
                Preguntas de «¿en qué quedó este post?» en WhatsApp o Slack.
              </p>
            </div>

            <p
              style={{
                margin: tokens.space[0],
                fontSize: tokens.font.size.xs,
                color: tokens.color.textMuted,
                lineHeight: tokens.font.leading.normal,
                borderTop: `${tokens.border.thin} solid ${tokens.bento.cardBorder}`,
                paddingTop: tokens.space[4],
              }}
            >
              Cada pieza tiene un único estado y un único responsable actual claramente visibles para todo el equipo.
            </p>
          </article>

          {/* MÓDULO 3 (4 columnas): La pregunta central («¿Qué sigue y quién lo tiene?») */}
          <article
            style={{
              gridColumn: "span 4",
              backgroundColor: tokens.bento.cardBg,
              border: `${tokens.border.thin} solid ${tokens.bento.cardBorder}`,
              borderRadius: tokens.radius["2xl"],
              padding: tokens.space[8],
              display: "flex",
              flexDirection: "column",
              gap: tokens.space[4],
              boxShadow: tokens.bento.cardShadow,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: tokens.space[2] }}>
              <span
                style={{
                  fontSize: tokens.font.size.xs,
                  fontWeight: tokens.font.weight.bold,
                  textTransform: "uppercase",
                  letterSpacing: tokens.font.tracking.wider,
                  color: tokens.color.textMuted,
                }}
              >
                Constitución #1
              </span>
            </div>

            <h3
              style={{
                margin: tokens.space[0],
                fontSize: tokens.font.size.xl,
                fontWeight: tokens.font.weight.semibold,
                color: tokens.color.textPrimary,
              }}
            >
              «¿Qué sigue y quién lo tiene?»
            </h3>

            <p
              style={{
                margin: tokens.space[0],
                fontSize: tokens.font.size.sm,
                lineHeight: tokens.font.leading.relaxed,
                color: tokens.color.textSecondary,
              }}
            >
              La pregunta que rige cada pantalla del sistema. La respuesta es siempre concreta:
            </p>

            <ul
              style={{
                listStyle: "none",
                margin: tokens.space[0],
                padding: tokens.space[0],
                display: "flex",
                flexDirection: "column",
                gap: tokens.space[2],
                fontSize: tokens.font.size.xs,
              }}
            >
              <li
                style={{
                  padding: tokens.space[2],
                  backgroundColor: tokens.bento.surfaceBase,
                  borderRadius: tokens.radius.sm,
                  border: `${tokens.border.thin} solid ${tokens.bento.cardBorder}`,
                }}
              >
                <strong>Borrador:</strong> Redactor / Diseñador
              </li>
              <li
                style={{
                  padding: tokens.space[2],
                  backgroundColor: tokens.bento.surfaceBase,
                  borderRadius: tokens.radius.sm,
                  border: `${tokens.border.thin} solid ${tokens.bento.cardBorder}`,
                }}
              >
                <strong>Revisión interna:</strong> Director creativo
              </li>
              <li
                style={{
                  padding: tokens.space[2],
                  backgroundColor: tokens.color.accentWarmSubtle,
                  color: tokens.color.accentWarmText,
                  borderRadius: tokens.radius.sm,
                  border: `${tokens.border.thin} solid ${tokens.color.accentWarm}`,
                }}
              >
                <strong>Aprobación:</strong> Cliente de la marca
              </li>
            </ul>
          </article>

          {/* MÓDULO 4 (4 columnas): Vista Hoy (Fase 1A) */}
          <article
            id="hoy"
            style={{
              gridColumn: "span 4",
              backgroundColor: tokens.bento.cardBg,
              border: `${tokens.border.thin} solid ${tokens.bento.cardBorder}`,
              borderRadius: tokens.radius["2xl"],
              padding: tokens.space[8],
              display: "flex",
              flexDirection: "column",
              gap: tokens.space[4],
              boxShadow: tokens.bento.cardShadow,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span
                style={{
                  fontSize: tokens.font.size.xs,
                  fontWeight: tokens.font.weight.bold,
                  textTransform: "uppercase",
                  letterSpacing: tokens.font.tracking.wider,
                  color: tokens.color.textMuted,
                }}
              >
                Fase 1A · Entrada Diaria
              </span>
              <span
                style={{
                  fontSize: tokens.font.size.xs,
                  paddingBlock: tokens.space[1],
                  paddingInline: tokens.space[2],
                  backgroundColor: tokens.color.statusSuccessBg,
                  color: tokens.color.statusSuccessText,
                  borderRadius: tokens.radius.sm,
                  fontWeight: tokens.font.weight.semibold,
                }}
              >
                Listo
              </span>
            </div>

            <h3
              style={{
                margin: tokens.space[0],
                fontSize: tokens.font.size.xl,
                fontWeight: tokens.font.weight.semibold,
                color: tokens.color.textPrimary,
              }}
            >
              La vista Hoy
            </h3>

            <p
              style={{
                margin: tokens.space[0],
                fontSize: tokens.font.size.sm,
                lineHeight: tokens.font.leading.relaxed,
                color: tokens.color.textSecondary,
              }}
            >
              Sin dashboards sobrecargados ni paneles infinitos. Tu jornada arranca con lo que requiere atención hoy:
            </p>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: tokens.space[2],
                borderTop: `${tokens.border.thin} solid ${tokens.bento.cardBorder}`,
                paddingTop: tokens.space[3],
                fontSize: tokens.font.size.xs,
                color: tokens.color.textSecondary,
              }}
            >
              <div>• <strong>Pendientes vencidos y de hoy</strong> priorizados primero.</div>
              <div>• <strong>Captura rápida de 1 línea</strong> sin abrir modales.</div>
              <div>• <strong>Notas fijadas</strong> con autoguardado visible.</div>
            </div>
          </article>

          {/* MÓDULO 5 (4 columnas): Soberanía de datos (Constitución #5) */}
          <article
            style={{
              gridColumn: "span 4",
              backgroundColor: tokens.bento.cardBg,
              border: `${tokens.border.thin} solid ${tokens.bento.cardBorder}`,
              borderRadius: tokens.radius["2xl"],
              padding: tokens.space[8],
              display: "flex",
              flexDirection: "column",
              gap: tokens.space[4],
              boxShadow: tokens.bento.cardShadow,
            }}
          >
            <span
              style={{
                fontSize: tokens.font.size.xs,
                fontWeight: tokens.font.weight.bold,
                textTransform: "uppercase",
                letterSpacing: tokens.font.tracking.wider,
                color: tokens.color.textMuted,
              }}
            >
              Constitución #5 · Soberanía
            </span>

            <h3
              style={{
                margin: tokens.space[0],
                fontSize: tokens.font.size.xl,
                fontWeight: tokens.font.weight.semibold,
                color: tokens.color.textPrimary,
              }}
            >
              Los datos son del cliente
            </h3>

            <p
              style={{
                margin: tokens.space[0],
                fontSize: tokens.font.size.sm,
                lineHeight: tokens.font.leading.relaxed,
                color: tokens.color.textSecondary,
              }}
            >
              Toda la información generada en tu agencia puede exportarse en cualquier momento en formatos abiertos y estándar.
            </p>

            <div
              style={{
                display: "flex",
                gap: tokens.space[2],
                paddingTop: tokens.space[2],
              }}
            >
              <span
                style={{
                  paddingBlock: tokens.space[1],
                  paddingInline: tokens.space[3],
                  backgroundColor: tokens.bento.surfaceBase,
                  border: `${tokens.border.thin} solid ${tokens.bento.cardBorder}`,
                  borderRadius: tokens.radius.sm,
                  fontFamily: tokens.font.mono,
                  fontSize: tokens.font.size.xs,
                  fontWeight: tokens.font.weight.semibold,
                }}
              >
                .JSON
              </span>
              <span
                style={{
                  paddingBlock: tokens.space[1],
                  paddingInline: tokens.space[3],
                  backgroundColor: tokens.bento.surfaceBase,
                  border: `${tokens.border.thin} solid ${tokens.bento.cardBorder}`,
                  borderRadius: tokens.radius.sm,
                  fontFamily: tokens.font.mono,
                  fontSize: tokens.font.size.xs,
                  fontWeight: tokens.font.weight.semibold,
                }}
              >
                .MD
              </span>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
