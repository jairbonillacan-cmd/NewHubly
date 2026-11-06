import { HoyPage } from "../hoy/page";

export const dynamic = "force-dynamic";

export default async function ChatPage() {
  return HoyPage({ chatMode: true });
}
