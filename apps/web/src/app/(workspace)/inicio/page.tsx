import { type HerramientaId } from "@hubly/ui";
import { redirect, unstable_rethrow } from "next/navigation";
import { loadWorkspaceDashboardAction } from "../../../actions";
import { WorkspaceScreen } from "../../../components/WorkspaceScreen";

export const dynamic = "force-dynamic";

// El espacio activo sale de la cookie httpOnly «hubly_ws», no de la URL (#212): las rutas quedan limpias.
export async function HoyPage({ todayDate, showWelcome = false, herramienta, chatMode = false, initiallyUnread = false }: {
  todayDate?: string; showWelcome?: boolean; herramienta?: HerramientaId; chatMode?: boolean; initiallyUnread?: boolean;
} = {}) {
  try {
    const data = await loadWorkspaceDashboardAction();
    // El espacio sale de la cookie: al volver atrás o recargar /chat tras cambiar a un espacio sin chat, se va a Hoy en vez de dar 404.
    if (chatMode && !data.chat) redirect("/inicio");
    return (
      <WorkspaceScreen
        initialChat={data.chat ?? null} chatMode={chatMode} initiallyUnread={initiallyUnread}
        initialStatus="ready" todayDate={todayDate ?? data.todayDate} initialTimezone={data.timezone}
        initialNotes={data.notes} initialTodos={data.todos} currentUserId={data.currentUserId}
        initialActiveWorkspace={data.activeWorkspace} initialWorkspaces={data.workspaces}
        initialMembers={data.members} initialPendingInvitations={data.pendingInvitations} initialPreferences={data.preferences} initialWallpaperImageUrl={data.wallpaperImageUrl} showWelcome={showWelcome} currentUserEmail={data.currentUserEmail} currentUserName={data.currentUserName} initialAvatarUrl={data.avatarUrl} initialPresence={data.presence} {...(herramienta ? { initialHerramienta: herramienta } : {})}
      />
    );
  } catch (err) {
    // La redirección a /login por sesión caducada (#92) no es un fallo: se deja pasar.
    unstable_rethrow(err);
    console.error("[hoy] No se pudo cargar el espacio:", err);
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("Sesión caducada")) redirect("/login");
    return <WorkspaceScreen initialStatus="error" {...(todayDate ? { todayDate } : {})} errorMessage="No se pudo cargar tu espacio de trabajo." />;
  }
}

export default async function WorkspaceTodayPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  return HoyPage({ showWelcome: params.bienvenida === "1" });
}
