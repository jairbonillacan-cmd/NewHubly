import { chatScopeSchema } from "@hubly/contracts";
import { notFound } from "next/navigation";
import { HoyPage } from "../hoy/page";

export const dynamic = "force-dynamic";

export default async function ChatPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const scope = chatScopeSchema.partial().safeParse({ workspaceId: params.workspaceId });
  if (!scope.success) notFound();
  return HoyPage({
    chatMode: true, initiallyUnread: params.vista === "sin-leer",
    ...(scope.data.workspaceId ? { workspaceId: scope.data.workspaceId } : {}),
  });
}
