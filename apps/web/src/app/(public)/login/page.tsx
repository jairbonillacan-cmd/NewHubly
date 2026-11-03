"use client";
import { GlassCard, ThemeToggle, tokens } from "@hubly/ui";
import React, { useState } from "react";
import { signInWithMagicLinkAction, signInWithPasswordAction, signUpWithPasswordAction } from "../../../actions/auth";

export type AuthMode = "signin" | "signup" | "magic";
export interface LoginScreenProps { initialMode?: AuthMode; onAuthenticated?: (workspaceId: string | null) => void; }

const ctrlBorder = `${tokens.border.thin} solid ${tokens.color.borderControl}`;
const inputStyle = { border: ctrlBorder, borderRadius: tokens.radius.sm, padding: tokens.space[3], backgroundColor: tokens.color.surfaceCanvas, color: tokens.color.textPrimary, fontSize: tokens.font.size.sm } as const;
const colGap = { display: "flex", flexDirection: "column", gap: tokens.space[1], fontSize: tokens.font.size.sm } as const;

export function LoginScreen({ initialMode = "signin", onAuthenticated }: LoginScreenProps) {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [email, setEmail] = useState(""), [password, setPassword] = useState(""), [workspaceName, setWorkspaceName] = useState("Mi Espacio");
  const [statusMessage, setStatusMessage] = useState<string | null>(null), [errorMessage, setErrorMessage] = useState<string | null>(null), [submitting, setSubmitting] = useState(false);

  const navigate = (wsId: string | null) => onAuthenticated ? onAuthenticated(wsId) : (typeof window !== "undefined" && window.location.assign("/hoy"));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true); setErrorMessage(null); setStatusMessage(null);
    try {
      if (mode === "signin") navigate((await signInWithPasswordAction({ email, password })).workspaceId);
      else if (mode === "signup") {
        const res = await signUpWithPasswordAction({ email, password, workspaceName });
        if (res.requiresEmailConfirmation) setStatusMessage("Revisa tu correo para confirmar tu cuenta y acceder a tu espacio.");
        else navigate(res.workspaceId);
      } else {
        await signInWithMagicLinkAction({ email });
        setStatusMessage("Te enviamos un enlace mágico a tu correo electrónico.");
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "No se pudo iniciar sesión");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main style={{ minHeight: tokens.layout.viewportHeight, backgroundColor: tokens.color.surfaceCanvas, color: tokens.color.textPrimary, paddingBlock: tokens.space[10], paddingInline: tokens.space[4], display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: "100%", maxWidth: tokens.layout.readingWidth, display: "flex", flexDirection: "column", gap: tokens.space[6] }}>
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: tokens.space[4] }}>
          <div>
            <h1 style={{ margin: tokens.space[0], fontSize: tokens.font.size["2xl"], fontWeight: tokens.font.weight.bold }}>Acceso a Hubly</h1>
            <p style={{ margin: tokens.space[0], fontSize: tokens.font.size.sm, color: tokens.color.textSecondary }}>¿Qué sigue y quién lo tiene? Entra a tu espacio personal.</p>
          </div>
          <ThemeToggle />
        </header>
        <GlassCard aria-label="Formulario de autenticación">
          <div role="tablist" aria-label="Método de acceso" style={{ display: "flex", gap: tokens.space[2], flexWrap: "wrap" }}>
            {([{ id: "signin", label: "Contraseña" }, { id: "signup", label: "Crear cuenta" }, { id: "magic", label: "Enlace mágico" }] as const).map((tab) => (
              <button key={tab.id} type="button" role="tab" aria-selected={mode === tab.id} onClick={() => { setMode(tab.id); setErrorMessage(null); setStatusMessage(null); }} style={{ border: ctrlBorder, borderRadius: tokens.radius.full, paddingBlock: tokens.space[2], paddingInline: tokens.space[4], backgroundColor: mode === tab.id ? tokens.color.accentPrimary : tokens.color.surfaceSubtle, color: mode === tab.id ? tokens.color.textOnAccent : tokens.color.textPrimary, fontWeight: tokens.font.weight.medium, cursor: "pointer" }}>{tab.label}</button>
            ))}
          </div>
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: tokens.space[4] }}>
            <label style={colGap}><span>Correo electrónico</span><input type="email" name="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="equipo@agencia.es" style={inputStyle} /></label>
            {mode !== "magic" && <label style={colGap}><span>Contraseña</span><input type="password" name="password" required minLength={8} autoComplete={mode === "signin" ? "current-password" : "new-password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo 8 caracteres" style={inputStyle} /></label>}
            {mode === "signup" && <label style={colGap}><span>Nombre de tu espacio personal</span><input type="text" name="workspaceName" value={workspaceName} onChange={(e) => setWorkspaceName(e.target.value)} style={inputStyle} /></label>}
            {errorMessage && <p role="alert" style={{ margin: tokens.space[0], padding: tokens.space[3], borderRadius: tokens.radius.sm, backgroundColor: tokens.color.statusDangerBg, color: tokens.color.statusDangerText, fontSize: tokens.font.size.sm }}>{errorMessage}</p>}
            {statusMessage && <p role="status" style={{ margin: tokens.space[0], padding: tokens.space[3], borderRadius: tokens.radius.sm, backgroundColor: tokens.color.statusSuccessBg, color: tokens.color.statusSuccessText, fontSize: tokens.font.size.sm }}>{statusMessage}</p>}
            <button type="submit" disabled={submitting} style={{ border: ctrlBorder, borderRadius: tokens.radius.md, paddingBlock: tokens.space[3], paddingInline: tokens.space[4], backgroundColor: tokens.color.accentPrimary, color: tokens.color.textOnAccent, fontWeight: tokens.font.weight.semibold, cursor: "pointer" }}>
              {submitting ? "Procesando…" : mode === "signin" ? "Entrar a Hoy" : mode === "signup" ? "Crear cuenta y espacio personal" : "Enviar enlace mágico"}
            </button>
          </form>
        </GlassCard>
      </div>
    </main>
  );
}

export default function LoginPage() { return <LoginScreen />; }
