import { currentSessionEmail } from "../../../server/composition";
import { InvitacionScreen } from "../../../components/InvitacionScreen";

export const dynamic = "force-dynamic";

/** Aceptar una invitación a agencia (#64). El token viaja en el fragmento (#), que nunca llega al servidor. */
export default async function InvitacionPage() {
  return <InvitacionScreen sessionEmail={await currentSessionEmail()} />;
}
