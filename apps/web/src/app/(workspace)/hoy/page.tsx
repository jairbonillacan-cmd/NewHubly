import { chatScopeSchema } from "@hubly/contracts";
import { isHerramientaId, type HerramientaId } from "@hubly/ui";
import { notFound, redirect, unstable_rethrow } from "next/navigation";
import { loadWorkspaceDashboardAction } from "../../../actions";
import { WorkspaceScreen } from "../../../components/WorkspaceScreen";

export const dynamic = "force-dynamic";

export async function HoyPage({ todayDate, showWelcome = false, herramienta, workspaceId, chatMode = false, initiallyUnread = false }: {
  todayDate?: string; showWelcome?: boolean; herramienta?: HerramientaId; workspaceId?: string; chatMode?: boolean; initiallyUnread?: boolean;
} = {}) {
  try {
    const data = await loadWorkspaceDashboardAction(workspaceId);
    if (chatMode && !data.chat) notFound();
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
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("Sesión caducada")) redirect("/login");
    if (workspaceId && msg.includes("No autorizado en el espacio")) notFound();
    return <WorkspaceScreen initialStatus="error" {...(todayDate ? { todayDate } : {})} errorMessage="No se pudo cargar tu espacio de trabajo." />;
  }
}

export default async function WorkspaceTodayPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const herramienta = typeof params.herramienta === "string" && isHerramientaId(params.herramienta) ? params.herramienta : undefined;
  const scope = chatScopeSchema.partial().safeParse({ workspaceId: params.workspaceId });
  if (!scope.success) notFound();
  return HoyPage({
    showWelcome: params.bienvenida === "1", ...(herramienta ? { herramienta } : {}),
    ...(scope.data.workspaceId ? { workspaceId: scope.data.workspaceId } : {}),
  });
}
