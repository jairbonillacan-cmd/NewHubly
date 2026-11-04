"use client";
import { Button, Card, HublyWordmark, ThemeToggle, tokens } from "@hubly/ui";
import React, { useEffect, useState } from "react";
import { acceptWorkspaceInvitationAction } from "../../../actions";

export interface InvitacionPageProps { initialToken?: string; initialError?: string | null; onNavigate?: (path: string) => void; }
export function consumeInvitationHashToken(
  loc: { hash: string } | undefined,
  hist?: { replaceState: (data: unknown, unused: string, url?: string | URL | null) => void },
): string {
  const raw = (loc?.hash ?? "").replace(/^#/, "").trim();
  if (raw && hist) hist.replaceState(null, "", "/invitacion");
  return raw;
}

export function InvitacionPage({ initialToken = "", initialError = null, onNavigate }: InvitacionPageProps = {}) {
  const [token, setToken] = useState(initialToken), [status, setStatus] = useState<"idle" | "submitting" | "accepted">("idle"), [errorMessage, setErrorMessage] = useState<string | null>(initialError);
  const navigate = (path: string) => { if (onNavigate) onNavigate(path); else if (typeof window !== "undefined") window.location.assign(path); };

  useEffect(() => {
    if (typeof window !== "undefined") {
      const extracted = consumeInvitationHashToken(window.location, window.history);
      if (extracted) setToken(extracted);
    }
  }, []);

  const handleAccept = async () => {
    if (!token) { setErrorMessage("El enlace de invitación no contiene un token válido en el fragmento URL."); return; }
    setStatus("submitting"); setErrorMessage(null);
    try { await acceptWorkspaceInvitationAction({ token }); setStatus("accepted"); navigate("/hoy"); }
    catch (err) { setStatus("idle"); setErrorMessage(err instanceof Error && err.message ? err.message : "No se pudo aceptar la invitación. Verifica que iniciaste sesión con el correo invitado."); }
  };

  const ctrlBorder = `${tokens.border.thin} solid ${tokens.color.borderControl}`, cardBorder = `${tokens.border.thin} solid ${tokens.bento.cardBorder}`;
  const btnBase = { border: ctrlBorder, borderRadius: tokens.radius.full, paddingBlock: tokens.space[2], paddingInline: tokens.space[4], fontSize: tokens.font.size.sm, fontWeight: tokens.font.weight.semibold, cursor: "pointer" } as const;

  return (
    <main style={{ minHeight: tokens.layout.viewportHeight, backgroundColor: tokens.bento.surfaceBase, color: tokens.color.textPrimary, padding: tokens.space[6], display: "flex", flexDirection: "column", gap: tokens.space[6] }}>
      <header style={{ maxWidth: tokens.layout.readingWidth, width: "100%", marginInline: "auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: tokens.space[3] }}>
        <a href="/" aria-label="Volver al inicio de Hubly" style={{ color: tokens.color.textPrimary, textDecoration: "none", display: "inline-flex", alignItems: "center" }}><HublyWordmark height={24} /></a>
        <ThemeToggle />
      </header>
      <Card style={{ maxWidth: tokens.layout.readingWidth, width: "100%", marginInline: "auto", backgroundColor: tokens.bento.cardBg, border: cardBorder, borderRadius: tokens.radius.xl, padding: tokens.space[6], boxShadow: tokens.bento.cardShadow }}>
        <Card.Content style={{ display: "flex", flexDirection: "column", gap: tokens.space[4] }}>
          <h1 style={{ margin: tokens.space[0], fontSize: tokens.font.size["2xl"], fontWeight: tokens.font.weight.bold }}>Invitación a agencia en Hubly</h1>
          <p style={{ margin: tokens.space[0], fontSize: tokens.font.size.sm, color: tokens.color.textSecondary, lineHeight: tokens.font.leading.relaxed }}>
            {token ? "El token de tu invitación se leyó en tu navegador y se retiró de la barra de direcciones para proteger tu acceso. Confirma con tu cuenta autenticada cuyo correo coincida con la invitación." : "No se detectó un token de invitación activo en el enlace. Solicita a quien administra la agencia un nuevo enlace copiable desde Hoy."}
          </p>
          {errorMessage ? <div role="alert" style={{ padding: tokens.space[3], backgroundColor: tokens.color.statusDangerBg, color: tokens.color.statusDangerText, border: ctrlBorder, borderRadius: tokens.radius.md, fontSize: tokens.font.size.sm }}>{errorMessage}</div> : null}
          <div style={{ display: "flex", alignItems: "center", gap: tokens.space[3], flexWrap: "wrap" }}>
            <Button type="button" variant="primary" size="sm" isDisabled={!token || status === "submitting"} onPress={() => void handleAccept()} onClick={() => void handleAccept()} style={{ ...btnBase, backgroundColor: tokens.color.accentPrimary, color: tokens.color.textOnAccent, borderColor: tokens.color.accentPrimary }}>{status === "submitting" ? "Verificando invitación…" : errorMessage ? "Reintentar aceptación" : "Aceptar invitación a la agencia"}</Button>
            <Button type="button" variant="secondary" size="sm" onPress={() => navigate("/login")} onClick={() => navigate("/login")} style={{ ...btnBase, backgroundColor: tokens.bento.surfaceBase, color: tokens.color.textPrimary }}>Iniciar sesión con otra cuenta</Button>
            <Button type="button" variant="ghost" size="sm" onPress={() => navigate("/hoy")} onClick={() => navigate("/hoy")} style={{ ...btnBase, backgroundColor: tokens.bento.cardBg, color: tokens.color.textPrimary }}>Ir a Hoy</Button>
          </div>
        </Card.Content>
      </Card>
    </main>
  );
}

export default function WorkspaceInvitationRoutePage() { return <InvitacionPage />; }
