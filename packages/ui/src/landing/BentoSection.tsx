import { tokens } from "../tokens";
import { LineGraphicCycle } from "./LineGraphicCycle";

export function BentoSection() {
  return (
    <section id="ciclo" aria-label="Bloques Bento con el flujo de trabajo de Hubly" style={{ backgroundColor: tokens.bento.surfaceBase, color: tokens.color.textPrimary, paddingBlock: tokens.space[12], paddingInline: tokens.space[4], boxSizing: "border-box", width: "100%" }}>
      <div style={{ width: "100%", maxWidth: tokens.layout.bentoWidth, marginInline: "auto", display: "flex", flexDirection: "column", gap: tokens.space[10], boxSizing: "border-box" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: tokens.space[3], maxWidth: tokens.layout.readingWidth }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: tokens.space[2] }}>
            <span style={{ width: tokens.space[2], height: tokens.space[2], borderRadius: tokens.radius.full, backgroundColor: tokens.color.accentPrimary }} aria-hidden="true" />
            <span style={{ fontSize: tokens.font.size.xs, fontWeight: tokens.font.weight.bold, textTransform: "uppercase", letterSpacing: tokens.font.tracking.widest, color: tokens.color.accentPrimary }}>
              Arquitectura del producto
            </span>
          </div>
          <h2 style={{ margin: tokens.space[0], fontSize: tokens.font.size["3xl"], fontWeight: tokens.font.weight.bold, lineHeight: tokens.font.leading.tight, letterSpacing: tokens.font.tracking.tight, color: tokens.color.textPrimary }}>
            Construido sobre el flujo real de una agencia
          </h2>
          <p style={{ margin: tokens.space[0], fontSize: tokens.font.size.base, lineHeight: tokens.font.leading.relaxed, color: tokens.color.textSecondary }}>
            Diseñado para el ritmo de tu agencia: cada pieza tiene un estado claro y un responsable asignado desde el primer día.
          </p>
        </div>

        <div className="hubly-bento-grid">
          {/* MÓDULO 1 (12 col): Ciclo completo */}
          <article className="hubly-bento-card hubly-bento-card-12" style={{ gap: tokens.space[6] }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: tokens.space[4], flexWrap: "wrap" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: tokens.space[1] }}>
                <span style={{ fontSize: tokens.font.size.xs, fontWeight: tokens.font.weight.bold, textTransform: "uppercase", letterSpacing: tokens.font.tracking.wider, color: tokens.color.textMuted }}>Flujo central</span>
                <h3 style={{ margin: tokens.space[0], fontSize: tokens.font.size["2xl"], fontWeight: tokens.font.weight.semibold, color: tokens.color.textPrimary }}>El ciclo completo de la pieza</h3>
              </div>
              <div style={{ display: "inline-flex", alignItems: "center", gap: tokens.space[2], paddingBlock: tokens.space[1], paddingInline: tokens.space[3], backgroundColor: tokens.color.accentPrimarySubtle, borderRadius: tokens.radius.full, fontSize: tokens.font.size.xs, fontWeight: tokens.font.weight.semibold, color: tokens.color.accentPrimary }}>
                <span>7 etapas definidas</span>
              </div>
            </div>
            <p style={{ margin: tokens.space[0], fontSize: tokens.font.size.base, lineHeight: tokens.font.leading.relaxed, color: tokens.color.textSecondary, maxWidth: tokens.layout.readingWidth }}>
              Cada publicación avanza por transiciones ordenadas. No hay estados ambiguos: se sabe cuándo nació la idea, quién editó el borrador, quién dio el visto bueno interno y qué cliente autorizó la publicación.
            </p>
            <div style={{ borderTop: `${tokens.border.thin} solid ${tokens.bento.cardBorder}`, borderBottom: `${tokens.border.thin} solid ${tokens.bento.cardBorder}`, width: "100%", maxWidth: "100%", minWidth: tokens.space[0], overflowX: "auto" }}>
              <LineGraphicCycle activeStageIndex={3} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fit, minmax(${tokens.bento.colMin}, 1fr))`, gap: tokens.space[4], fontSize: tokens.font.size.xs, color: tokens.color.textMuted }}>
              <div><strong style={{ color: tokens.color.textPrimary, display: "block" }}>Auditoría inmutable (próximamente):</strong>Registro con marca de tiempo UTC, usuario y cambio de estado en cada paso.</div>
              <div><strong style={{ color: tokens.color.textPrimary, display: "block" }}>Cero saltos:</strong>No se puede programar sin aprobación; no se puede medir sin publicación real.</div>
              <div><strong style={{ color: tokens.color.textPrimary, display: "block" }}>Portal cliente (próximamente):</strong>El cliente aprueba o solicita ajustes desde un enlace seguro sin contraseñas.</div>
            </div>
          </article>

          {/* MÓDULO 2 (6 col): Claridad operativa */}
          <article className="hubly-bento-card hubly-bento-card-6" style={{ justifyContent: "space-between", gap: tokens.space[6] }}>
            <div style={{ display: "flex", flexDirection: "column", gap: tokens.space[2] }}>
              <span style={{ fontSize: tokens.font.size.xs, fontWeight: tokens.font.weight.bold, textTransform: "uppercase", letterSpacing: tokens.font.tracking.wider, color: tokens.color.textMuted }}>Claridad operativa</span>
              <h3 style={{ margin: tokens.space[0], fontSize: tokens.font.size.xl, fontWeight: tokens.font.weight.semibold, color: tokens.color.textPrimary }}>Sin preguntas en el limbo</h3>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: tokens.space[2] }}>
              <div style={{ fontSize: tokens.font.size["2xl"], lineHeight: tokens.font.leading.tight, fontWeight: tokens.font.weight.bold, color: tokens.bento.highlightText, letterSpacing: tokens.font.tracking.tight }}>
                Estado único y visible
              </div>
              <p style={{ margin: tokens.space[0], fontSize: tokens.font.size.sm, fontWeight: tokens.font.weight.medium, color: tokens.color.textSecondary, lineHeight: tokens.font.leading.normal }}>
                Sabes en qué quedó cada publicación sin hilos dispersos en chats ni mensajes cruzados. Cada pieza tiene un único estado y un responsable actual asignado.
              </p>
            </div>
            <p style={{ margin: tokens.space[0], fontSize: tokens.font.size.xs, color: tokens.color.textMuted, lineHeight: tokens.font.leading.normal, borderTop: `${tokens.border.thin} solid ${tokens.bento.cardBorder}`, paddingTop: tokens.space[4] }}>
              Visibilidad compartida en tiempo real para todo el equipo de redacción, diseño y cuentas.
            </p>
          </article>

          {/* MÓDULO 3 (6 col): Pregunta central */}
          <article id="pregunta" className="hubly-bento-card hubly-bento-card-6" style={{ gap: tokens.space[4] }}>
            <span style={{ fontSize: tokens.font.size.xs, fontWeight: tokens.font.weight.bold, textTransform: "uppercase", letterSpacing: tokens.font.tracking.wider, color: tokens.color.textMuted }}>Pregunta central</span>
            <h3 style={{ margin: tokens.space[0], fontSize: tokens.font.size.xl, fontWeight: tokens.font.weight.semibold, color: tokens.color.textPrimary }}>«¿Qué sigue y quién lo tiene?»</h3>
            <p style={{ margin: tokens.space[0], fontSize: tokens.font.size.sm, lineHeight: tokens.font.leading.relaxed, color: tokens.color.textSecondary }}>La pregunta que rige cada pantalla del sistema. La respuesta es siempre concreta:</p>
            <ul style={{ listStyle: "none", margin: tokens.space[0], padding: tokens.space[0], display: "flex", flexDirection: "column", gap: tokens.space[2], fontSize: tokens.font.size.xs }}>
              <li style={{ padding: tokens.space[2], backgroundColor: tokens.bento.surfaceBase, borderRadius: tokens.radius.sm, border: `${tokens.border.thin} solid ${tokens.bento.cardBorder}` }}><strong>Borrador:</strong> Redactor / Diseñador</li>
              <li style={{ padding: tokens.space[2], backgroundColor: tokens.bento.surfaceBase, borderRadius: tokens.radius.sm, border: `${tokens.border.thin} solid ${tokens.bento.cardBorder}` }}><strong>Revisión interna:</strong> Director creativo</li>
              <li style={{ padding: tokens.space[2], backgroundColor: tokens.color.accentPrimarySubtle, color: tokens.color.accentPrimary, borderRadius: tokens.radius.sm, border: `${tokens.border.thin} solid ${tokens.color.accentPrimary}` }}><strong>Aprobación:</strong> Cliente de la marca</li>
            </ul>
          </article>

          {/* MÓDULO 4 (6 col): Vista Hoy */}
          <article id="hoy" className="hubly-bento-card hubly-bento-card-6" style={{ gap: tokens.space[4] }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: tokens.font.size.xs, fontWeight: tokens.font.weight.bold, textTransform: "uppercase", letterSpacing: tokens.font.tracking.wider, color: tokens.color.textMuted }}>Entrada diaria</span>
              <span style={{ fontSize: tokens.font.size.xs, paddingBlock: tokens.space[1], paddingInline: tokens.space[2], backgroundColor: tokens.color.statusSuccessBg, color: tokens.color.statusSuccessText, borderRadius: tokens.radius.sm, fontWeight: tokens.font.weight.semibold }}>Operativo</span>
            </div>
            <h3 style={{ margin: tokens.space[0], fontSize: tokens.font.size.xl, fontWeight: tokens.font.weight.semibold, color: tokens.color.textPrimary }}>La vista Hoy</h3>
            <p style={{ margin: tokens.space[0], fontSize: tokens.font.size.sm, lineHeight: tokens.font.leading.relaxed, color: tokens.color.textSecondary }}>Sin paneles sobrecargados ni métricas superfluas. Tu jornada arranca con lo que requiere atención hoy:</p>
            <div style={{ display: "flex", flexDirection: "column", gap: tokens.space[2], borderTop: `${tokens.border.thin} solid ${tokens.bento.cardBorder}`, paddingTop: tokens.space[3], fontSize: tokens.font.size.xs, color: tokens.color.textSecondary }}>
              <div>• <strong>Pendientes priorizados</strong> con alertas claras.</div>
              <div>• <strong>Captura rápida de 1 línea</strong> sin abrir modales pesados.</div>
              <div>• <strong>Notas fijadas</strong> con persistencia inmediata.</div>
            </div>
          </article>

          {/* MÓDULO 5 (6 col): Soberanía de datos */}
          <article className="hubly-bento-card hubly-bento-card-6" style={{ gap: tokens.space[4] }}>
            <span style={{ fontSize: tokens.font.size.xs, fontWeight: tokens.font.weight.bold, textTransform: "uppercase", letterSpacing: tokens.font.tracking.wider, color: tokens.color.textMuted }}>Soberanía de datos</span>
            <h3 style={{ margin: tokens.space[0], fontSize: tokens.font.size.xl, fontWeight: tokens.font.weight.semibold, color: tokens.color.textPrimary }}>Los datos son de tu agencia</h3>
            <p style={{ margin: tokens.space[0], fontSize: tokens.font.size.sm, lineHeight: tokens.font.leading.relaxed, color: tokens.color.textSecondary }}>Toda la información generada en tu agencia puede exportarse en cualquier momento en formatos abiertos y estándar.</p>
            <div style={{ display: "flex", alignItems: "center", gap: tokens.space[2], paddingTop: tokens.space[2], flexWrap: "wrap" }}>
              <span style={{ paddingBlock: tokens.space[1], paddingInline: tokens.space[3], backgroundColor: tokens.bento.surfaceBase, border: `${tokens.border.thin} solid ${tokens.bento.cardBorder}`, borderRadius: tokens.radius.sm, fontFamily: tokens.font.mono, fontSize: tokens.font.size.xs, fontWeight: tokens.font.weight.semibold }}>.JSON</span>
              <span style={{ paddingBlock: tokens.space[1], paddingInline: tokens.space[3], backgroundColor: tokens.bento.surfaceBase, border: `${tokens.border.thin} solid ${tokens.bento.cardBorder}`, borderRadius: tokens.radius.sm, fontFamily: tokens.font.mono, fontSize: tokens.font.size.xs, fontWeight: tokens.font.weight.semibold }}>.MD</span>
              <span style={{ fontSize: tokens.font.size.xs, color: tokens.color.textMuted, fontStyle: "italic" }}>Exportación abierta (próximamente)</span>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
