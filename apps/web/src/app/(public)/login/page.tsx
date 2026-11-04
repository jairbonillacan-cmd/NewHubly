"use client";
import { Button, Card, Input, Label, Tabs, TextField, ThemeToggle, tokens } from "@hubly/ui";
import React, { useState } from "react";
import { signInWithMagicLinkAction, signInWithPasswordAction, signUpWithPasswordAction } from "../../../actions/auth";

export type AuthMode = "signin" | "signup" | "magic";
export interface LoginScreenProps { initialMode?: AuthMode; onAuthenticated?: (workspaceId: string | null) => void; }

const ctrlBorder = `${tokens.border.thin} solid ${tokens.color.borderControl}`;
const inputStyle = { border: ctrlBorder, borderRadius: tokens.radius.md, padding: tokens.space[3], backgroundColor: tokens.color.surfaceCanvas, color: tokens.color.textPrimary, fontSize: tokens.font.size.sm } as const;

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
        const res = await signInWithMagicLinkAction({ email });
        setStatusMessage(res.message);
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "No se pudo iniciar sesión");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main style={{ minHeight: tokens.layout.viewportHeight, backgroundColor: tokens.color.surfaceBrand, color: tokens.glass.textPrimary, paddingBlock: tokens.space[10], paddingInline: tokens.space[4], display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: "100%", maxWidth: tokens.layout.readingWidth, display: "flex", flexDirection: "column", gap: tokens.space[6] }}>
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: tokens.space[4] }}>
          <div>
            <h1 style={{ margin: tokens.space[0], fontSize: tokens.font.size["2xl"], fontWeight: tokens.font.weight.bold, color: tokens.glass.textPrimary }}>Acceso a Hubly</h1>
            <p style={{ margin: tokens.space[0], fontSize: tokens.font.size.sm, color: tokens.glass.textSecondary }}>¿Qué sigue y quién lo tiene? Entra a tu espacio personal.</p>
          </div>
          <ThemeToggle />
        </header>
        <Card aria-label="Formulario de autenticación" style={{ backgroundColor: tokens.glass.bg, border: `${tokens.border.thin} solid ${tokens.glass.border}`, boxShadow: tokens.glass.shadow, borderRadius: tokens.radius.xl, padding: tokens.space[6], display: "flex", flexDirection: "column", gap: tokens.space[5] }}>
          <Card.Content style={{ display: "flex", flexDirection: "column", gap: tokens.space[4] }}>
            <Tabs selectedKey={mode} onSelectionChange={(key) => { setMode(String(key) as AuthMode); setErrorMessage(null); setStatusMessage(null); }}>
              <Tabs.ListContainer>
                <Tabs.List aria-label="Método de acceso" style={{ display: "flex", gap: tokens.space[2], padding: tokens.space[1], backgroundColor: tokens.pill.glassBg, border: `${tokens.border.thin} solid ${tokens.pill.glassBorder}`, borderRadius: tokens.radius.full }}>
                  <Tabs.Tab id="signin" style={{ borderRadius: tokens.radius.full, paddingBlock: tokens.space[2], paddingInline: tokens.space[4] }}>Contraseña</Tabs.Tab>
                  <Tabs.Tab id="signup" style={{ borderRadius: tokens.radius.full, paddingBlock: tokens.space[2], paddingInline: tokens.space[4] }}>Crear cuenta</Tabs.Tab>
                  <Tabs.Tab id="magic" style={{ borderRadius: tokens.radius.full, paddingBlock: tokens.space[2], paddingInline: tokens.space[4] }}>Enlace mágico</Tabs.Tab>
                </Tabs.List>
              </Tabs.ListContainer>
              <Tabs.Panel id={mode}>
                <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: tokens.space[4], paddingTop: tokens.space[3] }}>
                  <TextField name="email" type="email" isRequired value={email} onChange={setEmail} style={{ display: "flex", flexDirection: "column", gap: tokens.space[1] }}>
                    <Label style={{ fontSize: tokens.font.size.sm, color: tokens.glass.textPrimary }}>Correo electrónico</Label>
                    <Input placeholder="equipo@agencia.es" autoComplete="email" style={inputStyle} />
                  </TextField>
                  {mode !== "magic" && (
                    <TextField name="password" type="password" isRequired value={password} onChange={setPassword} style={{ display: "flex", flexDirection: "column", gap: tokens.space[1] }}>
                      <Label style={{ fontSize: tokens.font.size.sm, color: tokens.glass.textPrimary }}>Contraseña</Label>
                      <Input placeholder="Mínimo 8 caracteres" minLength={8} autoComplete={mode === "signin" ? "current-password" : "new-password"} style={inputStyle} />
                    </TextField>
                  )}
                  {mode === "signup" && (
                    <TextField name="workspaceName" type="text" value={workspaceName} onChange={setWorkspaceName} style={{ display: "flex", flexDirection: "column", gap: tokens.space[1] }}>
                      <Label style={{ fontSize: tokens.font.size.sm, color: tokens.glass.textPrimary }}>Nombre de tu espacio personal</Label>
                      <Input style={inputStyle} />
                    </TextField>
                  )}
                  {errorMessage && <p role="alert" style={{ margin: tokens.space[0], padding: tokens.space[3], borderRadius: tokens.radius.sm, backgroundColor: tokens.color.statusDangerBg, color: tokens.color.statusDangerText, fontSize: tokens.font.size.sm }}>{errorMessage}</p>}
                  {statusMessage && <p role="status" style={{ margin: tokens.space[0], padding: tokens.space[3], borderRadius: tokens.radius.sm, backgroundColor: tokens.color.statusSuccessBg, color: tokens.color.statusSuccessText, fontSize: tokens.font.size.sm }}>{statusMessage}</p>}
                  <Button type="submit" variant="primary" isDisabled={submitting} fullWidth style={{ borderRadius: tokens.radius.full, paddingBlock: tokens.space[3], paddingInline: tokens.space[5], backgroundColor: tokens.color.accentPrimary, color: tokens.color.textOnAccent, fontWeight: tokens.font.weight.semibold }}>
                    {submitting ? "Procesando…" : mode === "signin" ? "Entrar a Hoy" : mode === "signup" ? "Crear cuenta y espacio personal" : "Enviar enlace mágico"}
                  </Button>
                </form>
              </Tabs.Panel>
            </Tabs>
          </Card.Content>
        </Card>
      </div>
    </main>
  );
}

export default function LoginPage() { return <LoginScreen />; }
