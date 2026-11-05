"use client";
import { EspacioEstado } from "@hubly/ui";
import React, { useEffect, useState } from "react";
import { acceptWorkspaceInvitationAction } from "../actions";

/** Lee el token del fragmento y lo quita de la barra de direcciones y del historial. */
export function consumeInvitationHashToken(
  loc: { hash: string } | undefined,
  hist?: { replaceState: (data: unknown, unused: string, url?: string | URL | null) => void },
): string {
  const raw = (loc?.hash ?? "").replace(/^#/, "").trim();
  if (raw && hist) hist.replaceState(null, "", "/invitacion");
  return raw;
}

export interface InvitacionScreenProps {
  /** Correo de la sesión; "" si la sesión no trae correo; null si no hay sesión. */
  sessionEmail: string | null;
  initialToken?: string;
  onNavigate?: (path: string) => void;
}

type Estado = { kind: "listo" } | { kind: "enviando" } | { kind: "error"; message: string; retry: boolean };

export function InvitacionScreen({ sessionEmail, initialToken = "", onNavigate }: InvitacionScreenProps) {
  const [token, setToken] = useState(initialToken);
  const [estado, setEstado] = useState<Estado>({ kind: "listo" });
  const navigate = (path: string) => { if (onNavigate) onNavigate(path); else window.location.assign(path); };

  useEffect(() => {
    const extracted = consumeInvitationHashToken(window.location, window.history);
    if (extracted) setToken(extracted);
  }, []);

  if (sessionEmail === null) {
    return (
      <EspacioEstado
        title="Invitación a una agencia"
        message="Para aceptarla, inicia sesión con el correo al que llegó la invitación y después vuelve a abrir el enlace que recibiste."
        action={{ label: "Iniciar sesión", onPress: () => navigate("/login") }}
      />
    );
  }

  if (!token) {
    return (
      <EspacioEstado
        title="Falta el enlace de invitación"
        message="Abre el enlace completo que te compartieron. Si ya lo usaste o venció, pide uno nuevo a quien administra la agencia."
        action={{ label: "Ir a Hoy", onPress: () => navigate("/hoy") }}
      />
    );
  }

  const aceptar = async () => {
    setEstado({ kind: "enviando" });
    const res = await acceptWorkspaceInvitationAction({ token }).catch(() => null);
    if (res?.ok) { navigate("/hoy"); return; }
    setEstado({ kind: "error", message: res?.message ?? "No se pudo aceptar la invitación. Inténtalo de nuevo en unos minutos.", retry: !res || res.code === "ERROR" });
  };

  if (estado.kind === "error") {
    return (
      <EspacioEstado
        title="No se pudo aceptar la invitación"
        message={estado.message}
        action={estado.retry ? { label: "Reintentar", onPress: () => void aceptar() } : { label: "Ir a Hoy", onPress: () => navigate("/hoy") }}
      />
    );
  }

  return (
    <EspacioEstado
      title="Invitación a una agencia"
      message={`Vas a unirte con la cuenta ${sessionEmail || "actual"}. El correo debe coincidir con el de la invitación.`}
      busy={estado.kind === "enviando"}
      action={{ label: estado.kind === "enviando" ? "Aceptando…" : "Aceptar invitación", onPress: () => { if (estado.kind !== "enviando") void aceptar(); } }}
    />
  );
}
