"use client";
import { Alert, Button, Card, Hubi, HubiWordmark, Input, Label, Tabs, TextField, ThemeToggle, Wallpaper } from "@hubly/ui";
import React, { useEffect, useState } from "react";
import { signInWithMagicLinkAction, signInWithPasswordAction, signUpWithPasswordAction } from "../../../actions/auth";

export type AuthMode = "signin" | "signup" | "magic";
export interface LoginScreenProps { initialMode?: AuthMode; onAuthenticated?: (workspaceId: string | null) => void; }

const authTabs: ReadonlyArray<{ id: AuthMode; label: string }> = [
  { id: "signin", label: "Contraseña" },
  { id: "signup", label: "Crear cuenta" },
  { id: "magic", label: "Enlace mágico" },
];
const syncBrowserTimeZoneCookie = () => {
  if (typeof document === "undefined") return;
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (tz) document.cookie = `hubly_tz=${encodeURIComponent(tz)}; path=/; max-age=31536000; SameSite=Lax`;
};

export function LoginScreen({ initialMode = "signin", onAuthenticated }: LoginScreenProps) {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [email, setEmail] = useState(""), [password, setPassword] = useState(""), [workspaceName, setWorkspaceName] = useState("Mi Espacio");
  const [statusMessage, setStatusMessage] = useState<string | null>(null), [errorMessage, setErrorMessage] = useState<string | null>(null), [submitting, setSubmitting] = useState(false);

  useEffect(() => { syncBrowserTimeZoneCookie(); }, []);
  const navigate = (wsId: string | null) => onAuthenticated ? onAuthenticated(wsId) : (typeof window !== "undefined" && window.location.assign("/hoy"));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    syncBrowserTimeZoneCookie();
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
    <main className="relative isolate flex min-h-dvh flex-col items-center justify-center gap-6 px-4 py-10 text-(--text-primary)">
      <Wallpaper fondo="contornos" />
      <header className="hubly-enter flex w-full max-w-md items-center justify-between gap-4">
        <a href="/" aria-label="Hubly, volver al inicio" className="flex items-center text-(--text-primary)">
          <HubiWordmark />
        </a>
        <ThemeToggle variante="icono" />
      </header>
      <Card aria-label="Formulario de autenticación" className="hubly-glass hubly-enter w-full max-w-md gap-5 p-6" data-delay="1">
        <Card.Header className="flex flex-row items-center justify-between gap-3">
          <div className="flex flex-col gap-1">
            <Card.Title className="text-2xl font-bold tracking-(--tracking-tight)">Acceso a Hubly</Card.Title>
            <Card.Description>¿Qué sigue y quién lo tiene? Entra a tu espacio personal.</Card.Description>
          </div>
          <Hubi acabado="volumen" pose="laptop" tamano={72} decorativo className="hubly-float shrink-0" />
        </Card.Header>
        <Card.Content>
          <Tabs selectedKey={mode} onSelectionChange={(key) => { setMode(String(key) as AuthMode); setErrorMessage(null); setStatusMessage(null); }} className="w-full min-w-0">
            <Tabs.ListContainer>
              <Tabs.List aria-label="Método de acceso" className="w-full">
                {authTabs.map((tab) => (
                  <Tabs.Tab key={tab.id} id={tab.id} className="grow px-1.5 text-xs whitespace-nowrap sm:px-2 sm:text-sm">
                    {tab.label}
                    <Tabs.Indicator />
                  </Tabs.Tab>
                ))}
              </Tabs.List>
            </Tabs.ListContainer>
            <Tabs.Panel id={mode}>
              <form onSubmit={handleSubmit} className="flex flex-col gap-4 pt-4">
                <TextField name="email" type="email" isRequired value={email} onChange={setEmail} className="flex flex-col gap-1">
                  <Label>Correo electrónico</Label>
                  <Input placeholder="equipo@agencia.es" autoComplete="email" />
                </TextField>
                {mode !== "magic" && (
                  <TextField name="password" type="password" isRequired value={password} onChange={setPassword} className="flex flex-col gap-1">
                    <Label>Contraseña</Label>
                    <Input placeholder="Mínimo 8 caracteres" minLength={8} autoComplete={mode === "signin" ? "current-password" : "new-password"} />
                  </TextField>
                )}
                {mode === "signup" && (
                  <TextField name="workspaceName" type="text" value={workspaceName} onChange={setWorkspaceName} className="flex flex-col gap-1">
                    <Label>Nombre de tu espacio personal</Label>
                    <Input />
                  </TextField>
                )}
                {errorMessage && (
                  <Alert status="danger" role="alert" className="hubly-pop">
                    <Alert.Indicator />
                    <Alert.Content><Alert.Description>{errorMessage}</Alert.Description></Alert.Content>
                  </Alert>
                )}
                {statusMessage && (
                  <Alert status="success" role="status" className="hubly-pop">
                    <Alert.Indicator />
                    <Alert.Content><Alert.Description>{statusMessage}</Alert.Description></Alert.Content>
                  </Alert>
                )}
                <Button type="submit" variant="primary" size="lg" isDisabled={submitting} fullWidth>
                  {submitting ? "Procesando…" : mode === "signin" ? "Entrar a Hoy" : mode === "signup" ? "Crear cuenta y espacio personal" : "Enviar enlace mágico"}
                </Button>
              </form>
            </Tabs.Panel>
          </Tabs>
        </Card.Content>
      </Card>
      <a href="/" className="hubly-enter text-sm text-(--text-secondary) no-underline hover:text-(--accent-primary)" data-delay="2">← Volver al inicio</a>
    </main>
  );
}

export default function LoginPage() { return <LoginScreen />; }
