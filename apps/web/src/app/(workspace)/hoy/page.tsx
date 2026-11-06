import { isHerramientaId, type HerramientaId } from "@hubly/ui";
import { redirect, unstable_rethrow } from "next/navigation";
import { loadWorkspaceDashboardAction } from "../../../actions";
import { WorkspaceScreen } from "../../../components/WorkspaceScreen";

export const dynamic = "force-dynamic";

export async function HoyPage({ todayDate, showWelcome = false, herramienta }: { todayDate?: string; showWelcome?: boolean; herramienta?: HerramientaId } = {}) {
  try {
    const data = await loadWorkspaceDashboardAction();
    return (
      <WorkspaceScreen
        initialStatus="ready" todayDate={todayDate ?? data.todayDate} initialTimezone={data.timezone}
        initialNotes={data.notes} initialTodos={data.todos} currentUserId={data.currentUserId}
        initialActiveWorkspace={data.activeWorkspace} initialWorkspaces={data.workspaces}
        initialMembers={data.members} initialPendingInvitations={data.pendingInvitations} initialPreferences={data.preferences} initialWallpaperImageUrl={data.wallpaperImageUrl} showWelcome={showWelcome} currentUserEmail={data.currentUserEmail} {...(herramienta ? { initialHerramienta: herramienta } : {})}
      />
    );
  } catch (err) {
    // La redirección a /login por sesión caducada (#92) no es un fallo: se deja pasar.
    unstable_rethrow(err);
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("Sesión caducada")) redirect("/login");
    return <WorkspaceScreen initialStatus="error" {...(todayDate ? { todayDate } : {})} errorMessage="No se pudo cargar tu espacio de trabajo." />;
  }
}

export default async function WorkspaceTodayPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const herramienta = typeof params.herramienta === "string" && isHerramientaId(params.herramienta) ? params.herramienta : undefined;
  return HoyPage({ showWelcome: params.bienvenida === "1", ...(herramienta ? { herramienta } : {}) });
}
