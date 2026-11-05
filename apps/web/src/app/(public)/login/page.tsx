"use client";
import { Alert, Button, Hubi, HubiWordmark, Icon, Input, Label, TextField, ThemeToggle, Wallpaper } from "@hubly/ui";
import React from "react";
import { signInWithMagicLinkAction, signInWithPasswordAction, signUpWithPasswordAction } from "../../../actions/auth";

export type AuthMode = "signin" | "signup" | "magic";
export interface LoginScreenProps { initialMode?: AuthMode; onAuthenticated?: (workspaceId: string | null) => void; }

const RESEND_WAIT_SECONDS = 60;
const AUTH_ERROR_TITLE = "No se pudo iniciar sesión.";
const LINK = "inline-flex min-h-11 items-center font-semibold text-(--accent-primary) underline underline-offset-2";
const FIELD = "h-12 text-base";
const PRIMARY = "min-h-12.5";
const HEADING = "text-2xl leading-tight font-bold tracking-(--tracking-tight)";
const TITLES = { signin: "Entra a tu espacio", signup: "Crea tu cuenta", magic: "Entra sin contraseña", sent: "Revisa tu correo" } as const;
const SUBTITLES = {
  signin: "Tus pendientes y notas siguen donde los dejaste.",
  signup: "Empiezas con tu espacio personal. A una agencia te unes o la creas después.",
  magic: "Te enviamos un enlace de un solo uso. Ábrelo en este mismo navegador.",
} as const;

function visibleError(message: string) {
  // Next oculta el mensaje de una Server Action que lanza en producción (React #441).
  if (/^(Minified React error #441;|An error occurred in the Server Components render)/.test(message) || message === "No se pudo iniciar sesión") {
    return AUTH_ERROR_TITLE;
  }
  return message;
}

const syncBrowserTimeZoneCookie = () => {
  if (typeof document === "undefined") return;
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (tz) document.cookie = `hubly_tz=${encodeURIComponent(tz)}; path=/; max-age=31536000; SameSite=Lax`;
};

export function LoginScreen({ initialMode = "signin", onAuthenticated }: LoginScreenProps) {
  const [mode, setMode] = React.useState<AuthMode>(initialMode);
  const [email, setEmail] = React.useState(""), [password, setPassword] = React.useState(""), [workspaceName, setWorkspaceName] = React.useState("Mi espacio");
  const [statusMessage, setStatusMessage] = React.useState<string | null>(null), [errorMessage, setErrorMessage] = React.useState<string | null>(null), [submitting, setSubmitting] = React.useState(false);
  const [showPassword, setShowPassword] = React.useState(false);
  const [sent, setSent] = React.useState(false);
  const [secondsLeft, setSecondsLeft] = React.useState(RESEND_WAIT_SECONDS);
  const screen = statusMessage || sent ? "sent" : mode === "signin" && errorMessage ? "error" : mode;
  const heading = React.useRef<HTMLHeadingElement>(null);
  const previousScreen = React.useRef(screen);

  React.useEffect(() => { syncBrowserTimeZoneCookie(); }, []);
  const navigate = (wsId: string | null) => onAuthenticated ? onAuthenticated(wsId) : (typeof window !== "undefined" && window.location.assign("/hoy"));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    syncBrowserTimeZoneCookie();
    setSubmitting(true); setErrorMessage(null); setStatusMessage(null);
    try {
      if (mode === "signin") {
        const res = await signInWithPasswordAction({ email, password });
        if (res.ok) navigate(res.workspaceId); else setErrorMessage(res.message);
      } else if (mode === "signup") {
        const res = await signUpWithPasswordAction({ email, password, workspaceName });
        if (!res.ok) setErrorMessage(res.message);
        else if (res.requiresEmailConfirmation) setStatusMessage("Revisa tu correo para confirmar tu cuenta y acceder a tu espacio.");
        else navigate(res.workspaceId);
      } else {
        const res = await signInWithMagicLinkAction({ email });
        if (res.ok) setStatusMessage(res.message); else setErrorMessage(res.message);
      }
    } catch {
      // Fallo inesperado (red o servidor): en producción su mensaje no es legible, así que se muestra uno propio (#92).
      setErrorMessage("No se pudo conectar. Inténtalo de nuevo en unos minutos.");
    } finally {
      setSubmitting(false);
    }
  };

  React.useEffect(() => {
    if (screen !== previousScreen.current) {
      previousScreen.current = screen;
      heading.current?.focus();
    }
  }, [screen]);

  React.useEffect(() => {
    if (!statusMessage || submitting) return;
    const deadline = Date.now() + RESEND_WAIT_SECONDS * 1000;
    setSent(true);
    setSecondsLeft(RESEND_WAIT_SECONDS);
    const timer = window.setInterval(() => {
      const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setSecondsLeft(remaining);
      if (remaining === 0) window.clearInterval(timer);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [statusMessage, submitting]);

  const changeMode = (next: AuthMode) => {
    setMode(next);
    setShowPassword(false);
    setErrorMessage(null);
    setStatusMessage(null);
    setSent(false);
    setSecondsLeft(RESEND_WAIT_SECONDS);
  };

  const signIn = mode === "signin";
  const signUp = mode === "signup";
  const isSent = screen === "sent";

  return (
    <main className="relative isolate flex min-h-dvh flex-col px-4 pt-3 pb-4 text-(--glass-text-primary)">
      <Wallpaper fondo="contornos" />
      <header className="hubly-glass sticky top-3 z-10 -mx-1 flex h-13 shrink-0 items-center justify-between rounded-(--glass-radius-access-bar) px-2">
        <a href="/" aria-label="Volver al inicio" className="flex size-11 items-center justify-center sm:hidden">
          <span aria-hidden="true">←</span>
        </a>
        <a href="/" aria-label="Hubly, inicio" className="flex min-h-11 items-center px-2">
          <HubiWordmark />
        </a>
        <div className="flex items-center gap-2 [&>button]:size-11">
          <a href="/" className="hidden min-h-11 items-center px-2 text-sm font-semibold text-(--glass-text-secondary) sm:inline-flex">← Volver al inicio</a>
          <ThemeToggle variante="icono" />
        </div>
      </header>
      <div className="mx-auto flex w-full max-w-(--container-access) grow flex-col justify-center pt-12">
        <section aria-labelledby="login-heading" className="hubly-glass relative rounded-(--glass-radius-access-card) p-5 sm:p-9">
          <div className="pointer-events-none absolute right-5 bottom-full h-11.5 overflow-hidden sm:right-8">
            <Hubi acabado="volumen" pose="laptop" tamano={96} decorativo />
          </div>
          <form onSubmit={handleSubmit} className="flex flex-col gap-5.5">
            {screen === "magic" && (
              <Button type="button" variant="ghost" className="min-h-11 self-start" isDisabled={submitting} onPress={() => changeMode("signin")}>← Entrar con contraseña</Button>
            )}
            <div role={isSent ? "status" : undefined} className="flex flex-col gap-2">
              {isSent && (
                <span className="flex size-11 items-center justify-center rounded-xl bg-(--accent-primary-subtle) text-(--accent-primary)">
                  <Icon name="sobre" className="size-6" />
                </span>
              )}
              {screen === "error" ? <p className={HEADING}>{TITLES.signin}</p> : (
                <h1 id="login-heading" tabIndex={-1} ref={heading} className={HEADING}>{TITLES[screen]}</h1>
              )}
              {isSent ? (
                <div className="flex min-w-0 flex-col gap-2 break-words text-sm text-(--glass-text-secondary)">
                  <p>{signUp ? <>Te enviamos un correo a <strong>{email}</strong> para confirmar la cuenta.</> : <>Si <strong>{email}</strong> tiene cuenta en Hubly, te llegará un enlace para entrar.</>}</p>
                  <p>Puede tardar un par de minutos. Mira también en el correo no deseado.</p>
                </div>
              ) : <p className="text-sm text-(--glass-text-secondary)">{SUBTITLES[mode]}</p>}
            </div>
            {!isSent && (
              <div className="flex flex-col gap-4">
                <TextField name="email" type="email" isRequired value={email} onChange={setEmail} isReadOnly={submitting}>
                  <Label>Correo electrónico</Label>
                  <Input className={FIELD} placeholder="equipo@agencia.es" autoComplete="email" />
                </TextField>
                {mode !== "magic" && (
                  <TextField name="password" type={showPassword ? "text" : "password"} isRequired value={password} onChange={setPassword} isReadOnly={submitting}>
                    <Label>Contraseña</Label>
                    <div className="relative">
                      <Input className={`${FIELD} w-full pr-24`} minLength={8} autoComplete={signIn ? "current-password" : "new-password"} aria-describedby={signUp ? "password-hint" : undefined} />
                      <Button type="button" variant="ghost" className="absolute inset-y-0.5 right-0.5 min-h-11 px-2 text-sm" aria-pressed={showPassword} onPress={() => setShowPassword(!showPassword)}>
                        {showPassword ? "Ocultar" : "Mostrar"}
                      </Button>
                    </div>
                    {signUp && <p id="password-hint" className="text-sm text-(--glass-text-secondary)">Al menos 8 caracteres.</p>}
                  </TextField>
                )}
                {signUp && (
                  <TextField name="workspaceName" value={workspaceName} onChange={setWorkspaceName} isReadOnly={submitting}>
                    <Label>Nombre de tu espacio</Label>
                    <Input className={FIELD} aria-describedby="workspace-hint" />
                    <p id="workspace-hint" className="text-sm text-(--glass-text-secondary)">Es privado: solo lo ves tú.</p>
                  </TextField>
                )}
              </div>
            )}
            {errorMessage && (
              <Alert status="danger" role="alert" className="bg-(--status-danger-bg) text-(--status-danger-text)">
                <Alert.Indicator />
                <Alert.Content>
                  {screen === "error" ? (
                    <h1 id="login-heading" tabIndex={-1} ref={heading} className="text-sm font-semibold">{visibleError(errorMessage)}</h1>
                  ) : <Alert.Title className="text-(--status-danger-text)">{visibleError(errorMessage)}</Alert.Title>}
                  {signIn && <Alert.Description className="text-(--status-danger-text)">Revisa el correo y la contraseña, o entra con un enlace por correo.</Alert.Description>}
                </Alert.Content>
              </Alert>
            )}
            <Button type="submit" variant="primary" className={`${PRIMARY} disabled:bg-(--surface-interactive) disabled:text-(--text-secondary) disabled:opacity-100`} isDisabled={submitting || (isSent && secondsLeft > 0)} fullWidth>
              {submitting ? "Procesando…" : isSent ? (secondsLeft > 0 ? `Reenviar en ${secondsLeft} s` : "Reenviar") : signIn ? "Entrar" : signUp ? "Crear cuenta" : "Enviar enlace"}
            </Button>
            {signIn && (
              <div className="flex flex-col gap-3">
                <div aria-hidden="true" className="hidden items-center gap-3 text-sm text-(--glass-text-secondary) before:h-px before:grow before:bg-(--glass-line-strong) after:h-px after:grow after:bg-(--glass-line-strong) sm:flex">o</div>
                <Button type="button" variant="secondary" className={PRIMARY} fullWidth isDisabled={submitting} onPress={() => changeMode("magic")}>
                  <Icon name="sobre" /> Recibir un enlace por correo
                </Button>
              </div>
            )}
            {signUp && !isSent && (
              <p className="text-sm text-(--glass-text-secondary)">
                Te enviaremos un correo para confirmar la dirección. Al crear la cuenta aceptas los <a className={LINK} href="/terminos">Términos</a> y la <a className={LINK} href="/privacidad">Privacidad</a>.
              </p>
            )}
            {(isSent || mode !== "magic") && (
              <div className="flex flex-wrap items-center justify-center gap-x-1 text-sm text-(--glass-text-secondary)">
                {!isSent && (signIn ? "¿Primera vez en Hubly?" : "¿Ya tienes cuenta?")}
                <Button type="button" variant="ghost" className={`${LINK} px-2`} isDisabled={submitting} onPress={() => changeMode(isSent ? "magic" : signIn ? "signup" : "signin")}>
                  {isSent ? "Usar otro correo" : signIn ? "Crea tu cuenta" : "Entra"}
                </Button>
              </div>
            )}
          </form>
        </section>
        <footer className="mt-4 text-center text-sm text-(--glass-text-secondary)">
          <p className="flex items-center justify-center gap-2">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true" className="size-4 shrink-0">
              <path d="M7 11V7a5 5 0 0 1 10 0v4M5 11h14v10H5z" />
            </svg>
            <span>Privado por defecto: lo que guardas solo lo ves tú.</span>
          </p>
          <div className="flex justify-center gap-4">
            <a href="/privacidad" className={LINK}>Privacidad</a>
            <a href="/terminos" className={LINK}>Términos</a>
          </div>
        </footer>
      </div>
    </main>
  );
}

export default function LoginPage() { return <LoginScreen />; }
