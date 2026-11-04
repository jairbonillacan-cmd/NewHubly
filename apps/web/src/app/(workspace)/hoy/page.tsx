import { redirect } from "next/navigation";
import { loadWorkspaceDashboardAction } from "../../../actions";
import { WorkspaceScreen } from "../../../components/WorkspaceScreen";

export const dynamic = "force-dynamic";

export async function HoyPage({ todayDate }: { todayDate?: string } = {}) {
  try {
    const { notes, todos, todayDate: serverToday, timezone } = await loadWorkspaceDashboardAction();
    return <WorkspaceScreen initialStatus="ready" todayDate={todayDate ?? serverToday} initialTimezone={timezone} initialNotes={notes} initialTodos={todos} />;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("Sesión caducada")) redirect("/login");
    return <WorkspaceScreen initialStatus="error" {...(todayDate ? { todayDate } : {})} errorMessage="No se pudo cargar tu espacio de trabajo." />;
  }
}

export default async function WorkspaceTodayPage() {
  return HoyPage();
}
