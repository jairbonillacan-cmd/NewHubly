import { HoyPage } from "../hub/page";

export const dynamic = "force-dynamic";

export default async function ChatPage() {
  return HoyPage({ chatMode: true });
}
