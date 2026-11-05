import { redirect, unstable_rethrow } from "next/navigation";
import { loadWorkspaceDashboardAction } from "../../../actions";
import { WorkspaceScreen } from "../../../components/WorkspaceScreen";

export const dynamic = "force-dynamic";

export async function HoyPage({ todayDate }: { todayDate?: string } = {}) {
  try {
    const data = await loadWorkspaceDashboardAction();
    return (
      <WorkspaceScreen
        initialStatus="ready" todayDate={todayDate ?? data.todayDate} initialTimezone={data.timezone}
        initialNotes={data.notes} initialTodos={data.todos} currentUserId={data.currentUserId}
        initialActiveWorkspace={data.activeWorkspace} initialWorkspaces={data.workspaces}
        initialMembers={data.members} initialPendingInvitations={data.pendingInvitations} initialPreferences={data.preferences} initialWallpaperImageUrl={data.wallpaperImageUrl}
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

export default async function WorkspaceTodayPage() {
  return HoyPage();
}
