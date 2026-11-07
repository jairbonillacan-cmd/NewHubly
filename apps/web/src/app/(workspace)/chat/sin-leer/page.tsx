import { HoyPage } from "../../hub/page";

export const dynamic = "force-dynamic";

/** El chat abierto en «Sin leer» con una URL limpia (#212), en lugar de ?vista=sin-leer. */
export default async function ChatUnreadPage() {
  return HoyPage({ chatMode: true, initiallyUnread: true });
}
