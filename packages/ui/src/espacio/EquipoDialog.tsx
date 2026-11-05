"use client";

import { useState, type FormEvent } from "react";
import { Dialog, Heading, Modal, ModalOverlay } from "react-aria-components";
import { Icon } from "./icons";
import {
  ROLE_LABEL, assignableRoles, canRemoveMember,
  type EspacioInvitation, type EspacioInviteRole, type EspacioMember, type EspacioRole, type EspacioWorkspace,
} from "./types";

export type EquipoDialogMode = "crear" | "equipo";

export interface EquipoDialogProps {
  mode: EquipoDialogMode | null;
  onClose: () => void;
  workspace: EspacioWorkspace;
  members: EspacioMember[];
  invitations: EspacioInvitation[];
  /** Ruta del último enlace generado («/invitacion#…»); solo se muestra a quien lo creó. */
  inviteLink: string | null;
  onCreateAgency: (name: string) => void;
  onInvite: (email: string, role: EspacioInviteRole) => void;
  onCopyInvite: (link: string) => void;
  onRevokeInvite: (id: string) => void;
  onChangeRole: (userId: string, role: EspacioRole) => void;
  onRemoveMember: (userId: string) => void;
  onLeave: () => void;
  onExportOwn: () => void;
}

const FIELD = "h-9 rounded-lg border border-(--border-control) bg-(--surface-raised) px-3 text-sm text-(--text-primary) outline-none focus:border-(--accent-primary)";
const PRIMARY = "h-9 cursor-pointer rounded-lg border-0 bg-(--accent-primary) px-3.5 text-sm font-semibold text-(--text-on-accent) transition-transform hover:bg-(--accent-primary-hover) active:scale-95";
const SECONDARY = "h-8 cursor-pointer rounded-lg border border-(--glass-line-strong) bg-transparent px-3 text-xs text-(--text-secondary) hover:bg-(--glass-hover)";
const ROW = "flex flex-wrap items-center justify-between gap-2 rounded-lg bg-(--glass-hover) px-3 py-2";

function CrearAgencia({ onCreate }: { onCreate: (name: string) => void }) {
  const [name, setName] = useState("");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (name.trim()) onCreate(name.trim());
  };
  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <p className="m-0 text-sm text-(--text-secondary)">Serás su propietario. Después podrás invitar a tu equipo con un enlace.</p>
      <label className="flex flex-col gap-1 text-xs font-semibold text-(--text-secondary)">
        Nombre de la agencia
        <input value={name} onChange={(event) => setName(event.target.value)} maxLength={80} autoFocus className={FIELD} />
      </label>
      <button type="submit" disabled={!name.trim()} className={`${PRIMARY} self-end disabled:cursor-default disabled:opacity-60`}>Crear agencia</button>
    </form>
  );
}

function Equipo(props: Omit<EquipoDialogProps, "mode" | "onClose" | "onCreateAgency">) {
  const { workspace, members, invitations, inviteLink, onInvite, onCopyInvite, onRevokeInvite, onChangeRole, onRemoveMember, onLeave, onExportOwn } = props;
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<EspacioInviteRole>("editor");
  const actor = workspace.role;
  const ownerCount = members.filter((member) => member.role === "owner").length;
  const canInvite = actor === "owner" || actor === "admin";
  const inviteRoles: EspacioInviteRole[] = actor === "owner" ? ["admin", "editor", "viewer"] : ["editor", "viewer"];
  const soleOwner = actor === "owner" && ownerCount < 2;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!email.trim()) return;
    onInvite(email.trim(), role);
    setEmail("");
  };

  return (
    <div className="flex flex-col gap-5">
      <section aria-labelledby="equipo-miembros" className="flex flex-col gap-2">
        <h3 id="equipo-miembros" className="m-0 text-sm font-semibold">Miembros · {members.length}</h3>
        <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
          {members.map((member) => {
            const roles = assignableRoles(actor, member, ownerCount);
            return (
              <li key={member.userId} className={ROW}>
                <span className="min-w-0 truncate text-sm">
                  {member.isCurrentUser ? "Tú" : `Miembro ${member.userId.slice(0, 8)}`} · <span className="text-(--text-muted)">{ROLE_LABEL[member.role]}</span>
                </span>
                <span className="flex items-center gap-2">
                  {roles.length > 0 && (
                    <select aria-label={`Cambiar rol de ${member.isCurrentUser ? "tu cuenta" : `miembro ${member.userId.slice(0, 8)}`}`} value={member.role} onChange={(event) => onChangeRole(member.userId, event.target.value as EspacioRole)} className={`${FIELD} h-8 text-xs`}>
                      {roles.map((option) => <option key={option} value={option}>{ROLE_LABEL[option]}</option>)}
                    </select>
                  )}
                  {canRemoveMember(actor, member, ownerCount) && <button type="button" onClick={() => onRemoveMember(member.userId)} className={SECONDARY}>Quitar</button>}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      {canInvite && (
        <section aria-labelledby="equipo-invitar" className="flex flex-col gap-2 border-t border-(--glass-line) pt-4">
          <h3 id="equipo-invitar" className="m-0 text-sm font-semibold">Invitar por enlace</h3>
          <form onSubmit={submit} className="flex flex-wrap gap-2">
            <input type="email" required aria-label="Correo de la persona invitada" placeholder="equipo@agencia.es" value={email} onChange={(event) => setEmail(event.target.value)} className={`${FIELD} min-w-48 grow`} />
            <select aria-label="Rol de la invitación" value={role} onChange={(event) => setRole(event.target.value as EspacioInviteRole)} className={FIELD}>
              {inviteRoles.map((option) => <option key={option} value={option}>{ROLE_LABEL[option]}</option>)}
            </select>
            <button type="submit" className={PRIMARY}>Generar enlace</button>
          </form>
          {inviteLink && (
            <div className={ROW}>
              <span className="text-xs text-(--text-secondary)">Enlace listo. Compártelo solo con esa persona: caduca en 7 días y sirve una vez.</span>
              <button type="button" onClick={() => onCopyInvite(inviteLink)} className={SECONDARY}>Copiar enlace</button>
            </div>
          )}
          {invitations.length > 0 && (
            <ul aria-label="Invitaciones pendientes" className="m-0 flex list-none flex-col gap-1.5 p-0">
              {invitations.map((invitation) => (
                <li key={invitation.id} className={ROW}>
                  <span className="min-w-0 truncate text-sm">{invitation.email} · <span className="text-(--text-muted)">{ROLE_LABEL[invitation.role]} · vence {invitation.expiresAt.slice(0, 10)}</span></span>
                  {(actor === "owner" || invitation.role !== "admin") && <button type="button" onClick={() => onRevokeInvite(invitation.id)} className={SECONDARY}>Revocar</button>}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section aria-labelledby="equipo-salir" className="flex flex-col gap-2 border-t border-(--glass-line) pt-4">
        <h3 id="equipo-salir" className="m-0 text-sm font-semibold">Tu participación</h3>
        <p className="m-0 text-xs text-(--text-secondary)">Si sales, tus elementos privados pasan a tu espacio personal. Antes puedes descargar lo que creaste aquí.</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={onExportOwn} className={SECONDARY}>Descargar lo que creé</button>
          {soleOwner
            ? <span className="text-xs text-(--text-muted)">Nombra a otro propietario antes de salir.</span>
            : <button type="button" onClick={onLeave} className={`${SECONDARY} text-(--status-danger-text)`}>Salir de la agencia</button>}
        </div>
      </section>
    </div>
  );
}

/** Crear agencia y gestionar su equipo e invitaciones (#64, #78). Los permisos reales los aplica el servidor con RLS. */
export function EquipoDialog({ mode, onClose, onCreateAgency, ...rest }: EquipoDialogProps) {
  const title = mode === "crear" ? "Crear agencia" : `Equipo de ${rest.workspace.name}`;
  return (
    <ModalOverlay isOpen={mode !== null} onOpenChange={(open) => { if (!open) onClose(); }} isDismissable className="fixed inset-0 z-50 flex items-start justify-center bg-(--glass-hover) px-3 pt-20 backdrop-blur-xs">
      <Modal className="hubly-pop w-full max-w-lg">
        <Dialog className="hubly-pop-surface flex max-h-160 flex-col overflow-hidden rounded-2xl text-(--text-primary) outline-none">
          <div className="flex items-center gap-2.5 border-b border-(--glass-line) px-4 py-3">
            <Icon name={mode === "crear" ? "mas" : "equipo"} className="size-4 text-(--accent-primary)" />
            <Heading slot="title" className="m-0 grow text-base font-semibold">{title}</Heading>
            <button type="button" aria-label="Cerrar" onClick={onClose} className="flex size-8 cursor-pointer items-center justify-center rounded-lg border-0 bg-transparent text-(--text-secondary) hover:bg-(--glass-hover)"><Icon name="cerrar" /></button>
          </div>
          <div className="overflow-y-auto px-4 py-4">
            {mode === "crear" ? <CrearAgencia onCreate={onCreateAgency} /> : <Equipo {...rest} />}
          </div>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}
