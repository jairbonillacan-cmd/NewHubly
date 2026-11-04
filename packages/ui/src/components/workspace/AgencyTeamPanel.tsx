"use client";
import { Button, Card, Chip, Input, TextField } from "@heroui/react";
import { tokens } from "../../tokens";

export type WorkspaceRoleValue = "owner" | "admin" | "editor" | "viewer";
export type InvitationRoleValue = "admin" | "editor" | "viewer";
export type WorkspaceKindValue = "personal" | "agency";

export const WORKSPACE_ROLE_LABELS: Record<WorkspaceRoleValue, string> = {
  owner: "Propietario",
  admin: "Administrador",
  editor: "Editor",
  viewer: "Lectura",
};

export interface WorkspaceSummaryItem {
  id: string;
  name: string;
  kind: WorkspaceKindValue;
  role: WorkspaceRoleValue;
}

export interface AgencyMemberItem {
  userId: string;
  label?: string;
  role: WorkspaceRoleValue;
  isCurrentUser?: boolean;
}

export interface AgencyPendingInvitationItem {
  id: string;
  email: string;
  role: InvitationRoleValue;
  expiresAt: string;
}

export interface AgencyTeamPanelProps {
  workspaces: readonly WorkspaceSummaryItem[];
  activeWorkspaceId: string;
  currentUserRole: WorkspaceRoleValue;
  members?: readonly AgencyMemberItem[];
  pendingInvitations?: readonly AgencyPendingInvitationItem[];
  newAgencyName?: string;
  inviteEmail?: string;
  inviteRole?: InvitationRoleValue;
  generatedInviteLink?: string | null;
  isTeamSectionOpen?: boolean;
  statusMessage?: string | null;
  errorMessage?: string | null;
  onSelectWorkspace?: (workspaceId: string) => void;
  onNewAgencyNameChange?: (name: string) => void;
  onCreateAgency?: (name: string) => void;
  onToggleTeamSection?: () => void;
  onChangeMemberRole?: (targetUserId: string, nextRole: WorkspaceRoleValue) => void;
  onRemoveMember?: (targetUserId: string) => void;
  onLeaveAgency?: (workspaceId: string) => void;
  onExportPrivateData?: () => void;
  onInviteEmailChange?: (email: string) => void;
  onInviteRoleChange?: (role: InvitationRoleValue) => void;
  onCreateInvitation?: (input: { email: string; role: InvitationRoleValue }) => void;
  onCopyInviteLink?: (link: string) => void;
  onRevokeInvitation?: (invitationId: string) => void;
}

export function getAssignableRolesForMember(
  actorRole: WorkspaceRoleValue,
  member: AgencyMemberItem,
  ownerCount: number,
): readonly WorkspaceRoleValue[] {
  if (member.isCurrentUser) {
    return actorRole === "owner" && ownerCount >= 2 ? ["owner", "admin", "editor", "viewer"] : [];
  }
  if (actorRole === "owner") {
    return member.role === "owner" && ownerCount < 2 ? [] : ["owner", "admin", "editor", "viewer"];
  }
  if (actorRole === "admin" && (member.role === "editor" || member.role === "viewer")) {
    return ["editor", "viewer"];
  }
  return [];
}

export function AgencyTeamPanel({
  workspaces, activeWorkspaceId, currentUserRole, members = [], pendingInvitations = [],
  newAgencyName = "", inviteEmail = "", inviteRole = "editor", generatedInviteLink = null,
  isTeamSectionOpen = false, statusMessage = null, errorMessage = null,
  onSelectWorkspace, onNewAgencyNameChange, onCreateAgency, onToggleTeamSection,
  onChangeMemberRole, onRemoveMember, onLeaveAgency, onExportPrivateData,
  onInviteEmailChange, onInviteRoleChange, onCreateInvitation, onCopyInviteLink, onRevokeInvitation,
}: AgencyTeamPanelProps) {
  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId) ?? workspaces[0];
  const isAgency = activeWorkspace?.kind === "agency";
  const ownerCount = members.filter((m) => m.role === "owner").length;
  const canManageInvitations = isAgency && (currentUserRole === "owner" || currentUserRole === "admin");
  const availableInviteRoles: readonly InvitationRoleValue[] = currentUserRole === "owner" ? ["admin", "editor", "viewer"] : ["editor", "viewer"];

  const controlStyle = {
    border: `${tokens.border.thin} solid ${tokens.color.borderControl}`, borderRadius: tokens.radius.md,
    backgroundColor: tokens.bento.surfaceBase, color: tokens.color.textPrimary,
    paddingBlock: tokens.space[2], paddingInline: tokens.space[3], fontSize: tokens.font.size.sm,
  } as const;
  const primaryButtonStyle = {
    ...controlStyle, backgroundColor: tokens.color.accentPrimary, color: tokens.color.textOnAccent,
    borderColor: tokens.color.accentPrimary, borderRadius: tokens.radius.full,
    paddingInline: tokens.space[4], fontWeight: tokens.font.weight.semibold, cursor: "pointer",
  } as const;

  const submitCreateAgency = () => {
    const trimmed = newAgencyName.trim();
    if (trimmed) onCreateAgency?.(trimmed);
  };
  const submitInvitation = () => {
    const trimmed = inviteEmail.trim();
    if (trimmed) onCreateInvitation?.({ email: trimmed, role: inviteRole });
  };

  return (
    <Card aria-label="Espacio activo, agencia y equipo" style={{ display: "flex", flexDirection: "column", gap: tokens.space[3], padding: tokens.space[4], backgroundColor: tokens.bento.cardBg, border: `${tokens.border.thin} solid ${tokens.bento.cardBorder}`, borderRadius: tokens.radius.xl, boxShadow: tokens.bento.cardShadow }}>
      <Card.Content style={{ display: "flex", flexDirection: "column", gap: tokens.space[3] }}>
        <div style={{ display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: tokens.space[3], flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: tokens.space[2], flexWrap: "wrap" }}>
            <label htmlFor="hubly-workspace-selector" style={{ fontSize: tokens.font.size.xs, fontWeight: tokens.font.weight.semibold, color: tokens.color.textSecondary }}>
              Espacio activo
            </label>
            <select
              id="hubly-workspace-selector"
              aria-label="Seleccionar espacio o agencia activa"
              value={activeWorkspace?.id ?? activeWorkspaceId}
              onChange={(e) => onSelectWorkspace?.(e.currentTarget.value)}
              style={controlStyle}
            >
              {workspaces.map((ws) => (
                <option key={ws.id} value={ws.id}>
                  {ws.name} ({ws.kind === "personal" ? "Personal" : "Agencia"} · {WORKSPACE_ROLE_LABELS[ws.role]})
                </option>
              ))}
            </select>
            <Chip size="sm" variant="soft" style={{ backgroundColor: isAgency ? tokens.color.accentPrimarySubtle : tokens.bento.surfaceBase, color: isAgency ? tokens.color.accentPrimary : tokens.color.textSecondary, paddingInline: tokens.space[3], paddingBlock: tokens.space[1], borderRadius: tokens.radius.full, fontSize: tokens.font.size.xs, fontWeight: tokens.font.weight.semibold }}>
              Rol: {WORKSPACE_ROLE_LABELS[currentUserRole]}
            </Chip>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: tokens.space[2], flexWrap: "wrap" }}>
            <TextField aria-label="Nombre de la nueva agencia" value={newAgencyName} onChange={(val) => onNewAgencyNameChange?.(val)}>
              <Input
                type="text" aria-label="Nombre de la nueva agencia" value={newAgencyName}
                placeholder="Nombre de la agencia"
                onChange={(e) => onNewAgencyNameChange?.(e.currentTarget.value)}
                style={controlStyle}
              />
            </TextField>
            <Button type="button" variant="secondary" size="sm" onPress={submitCreateAgency} onClick={submitCreateAgency} style={controlStyle}>
              Crear agencia
            </Button>
            {isAgency ? (
              <Button
                type="button" variant="secondary" size="sm" aria-expanded={isTeamSectionOpen}
                onPress={() => onToggleTeamSection?.()} onClick={() => onToggleTeamSection?.()}
                style={controlStyle}
              >
                {isTeamSectionOpen ? "Ocultar equipo e invitaciones" : "Equipo e invitaciones"}
              </Button>
            ) : null}
          </div>
        </div>

        {statusMessage ? (
          <p role="status" style={{ margin: tokens.space[0], fontSize: tokens.font.size.xs, color: tokens.color.statusSuccessText, backgroundColor: tokens.color.statusSuccessBg, paddingBlock: tokens.space[1], paddingInline: tokens.space[3], borderRadius: tokens.radius.md }}>
            {statusMessage}
          </p>
        ) : null}
        {errorMessage ? (
          <p role="alert" style={{ margin: tokens.space[0], fontSize: tokens.font.size.xs, color: tokens.color.statusDangerText, backgroundColor: tokens.color.statusDangerBg, paddingBlock: tokens.space[1], paddingInline: tokens.space[3], borderRadius: tokens.radius.md }}>
            {errorMessage}
          </p>
        ) : null}

        {isAgency && isTeamSectionOpen ? (
          <div style={{ display: "flex", flexDirection: "column", gap: tokens.space[4], borderBlockStart: `${tokens.border.thin} solid ${tokens.bento.cardBorder}`, paddingBlockStart: tokens.space[3] }}>
            <section aria-label="Miembros de la agencia" style={{ display: "flex", flexDirection: "column", gap: tokens.space[2] }}>
              <h3 style={{ margin: tokens.space[0], fontSize: tokens.font.size.sm, fontWeight: tokens.font.weight.semibold, color: tokens.color.textPrimary }}>
                Miembros de la agencia ({members.length})
              </h3>
              <ul style={{ listStyle: "none", margin: tokens.space[0], padding: tokens.space[0], display: "flex", flexDirection: "column", gap: tokens.space[2] }}>
                {members.map((member) => {
                  const assignableRoles = getAssignableRolesForMember(currentUserRole, member, ownerCount);
                  const canRemoveOther = !member.isCurrentUser && ((currentUserRole === "owner" && (member.role !== "owner" || ownerCount >= 2)) || (currentUserRole === "admin" && (member.role === "editor" || member.role === "viewer")));
                  const isSoleOwnerSelf = Boolean(member.isCurrentUser && member.role === "owner" && ownerCount < 2);
                  return (
                    <li key={member.userId} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: tokens.space[2], flexWrap: "wrap", paddingBlock: tokens.space[2], paddingInline: tokens.space[3], backgroundColor: tokens.bento.surfaceBase, borderRadius: tokens.radius.md }}>
                      <div style={{ display: "flex", alignItems: "center", gap: tokens.space[2], flexWrap: "wrap" }}>
                        <span style={{ fontSize: tokens.font.size.sm, fontWeight: tokens.font.weight.medium, color: tokens.color.textPrimary }}>
                          {member.label ?? member.userId}{member.isCurrentUser ? " (Tú)" : ""}
                        </span>
                        <Chip size="sm" variant="soft" style={{ backgroundColor: tokens.bento.cardBg, color: tokens.color.textSecondary, paddingInline: tokens.space[2], paddingBlock: tokens.space[1], borderRadius: tokens.radius.full, fontSize: tokens.font.size.xs }}>
                          {WORKSPACE_ROLE_LABELS[member.role]}
                        </Chip>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: tokens.space[2], flexWrap: "wrap" }}>
                        {assignableRoles.length > 0 ? (
                          <select
                            aria-label={`Cambiar rol de ${member.label ?? member.userId}`}
                            value={member.role}
                            onChange={(e) => onChangeMemberRole?.(member.userId, e.currentTarget.value as WorkspaceRoleValue)}
                            style={controlStyle}
                          >
                            {assignableRoles.map((roleOpt) => (
                              <option key={roleOpt} value={roleOpt}>{WORKSPACE_ROLE_LABELS[roleOpt]}</option>
                            ))}
                          </select>
                        ) : null}
                        {canRemoveOther ? (
                          <Button type="button" variant="secondary" size="sm" aria-label={`Quitar a ${member.label ?? member.userId} de la agencia`} onPress={() => onRemoveMember?.(member.userId)} onClick={() => onRemoveMember?.(member.userId)} style={controlStyle}>
                            Quitar miembro
                          </Button>
                        ) : null}
                        {member.isCurrentUser ? (
                          <>
                            <Button type="button" variant="secondary" size="sm" onPress={() => onExportPrivateData?.()} onClick={() => onExportPrivateData?.()} style={controlStyle}>
                              Exportar datos privados
                            </Button>
                            {isSoleOwnerSelf ? (
                              <span style={{ fontSize: tokens.font.size.xs, color: tokens.color.textSecondary }}>
                                Promueve a otro miembro a Propietario antes de salir
                              </span>
                            ) : (
                              <Button type="button" variant="secondary" size="sm" onPress={() => activeWorkspace && onLeaveAgency?.(activeWorkspace.id)} onClick={() => activeWorkspace && onLeaveAgency?.(activeWorkspace.id)} style={{ ...controlStyle, color: tokens.color.statusDangerText }}>
                                Salir de la agencia
                              </Button>
                            )}
                          </>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>

            {canManageInvitations ? (
              <section aria-label="Invitaciones por enlace" style={{ display: "flex", flexDirection: "column", gap: tokens.space[3], borderBlockStart: `${tokens.border.thin} solid ${tokens.bento.cardBorder}`, paddingBlockStart: tokens.space[3] }}>
                <h3 style={{ margin: tokens.space[0], fontSize: tokens.font.size.sm, fontWeight: tokens.font.weight.semibold, color: tokens.color.textPrimary }}>
                  Invitar miembro por enlace copiable
                </h3>
                <div style={{ display: "flex", alignItems: "center", gap: tokens.space[2], flexWrap: "wrap" }}>
                  <TextField aria-label="Correo electrónico del invitado" value={inviteEmail} onChange={(val) => onInviteEmailChange?.(val)}>
                    <Input
                      type="email" aria-label="Correo electrónico del invitado" value={inviteEmail}
                      placeholder="equipo@agencia.es"
                      onChange={(e) => onInviteEmailChange?.(e.currentTarget.value)}
                      style={controlStyle}
                    />
                  </TextField>
                  <select
                    aria-label="Rol para la invitación"
                    value={inviteRole}
                    onChange={(e) => onInviteRoleChange?.(e.currentTarget.value as InvitationRoleValue)}
                    style={controlStyle}
                  >
                    {availableInviteRoles.map((r) => (
                      <option key={r} value={r}>{WORKSPACE_ROLE_LABELS[r]}</option>
                    ))}
                  </select>
                  <Button type="button" variant="primary" size="sm" onPress={submitInvitation} onClick={submitInvitation} style={primaryButtonStyle}>
                    Generar enlace de invitación
                  </Button>
                </div>

                {generatedInviteLink ? (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: tokens.space[2], flexWrap: "wrap", padding: tokens.space[3], backgroundColor: tokens.bento.surfaceBase, borderRadius: tokens.radius.md }}>
                    <code style={{ fontSize: tokens.font.size.xs, fontFamily: tokens.font.mono, color: tokens.color.textPrimary, wordBreak: "break-all" }}>
                      {generatedInviteLink}
                    </code>
                    <Button type="button" variant="secondary" size="sm" onPress={() => onCopyInviteLink?.(generatedInviteLink)} onClick={() => onCopyInviteLink?.(generatedInviteLink)} style={controlStyle}>
                      Copiar enlace de invitación
                    </Button>
                  </div>
                ) : null}

                {pendingInvitations.length > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: tokens.space[2] }}>
                    <p style={{ margin: tokens.space[0], fontSize: tokens.font.size.xs, fontWeight: tokens.font.weight.semibold, color: tokens.color.textSecondary }}>
                      Invitaciones pendientes ({pendingInvitations.length})
                    </p>
                    <ul style={{ listStyle: "none", margin: tokens.space[0], padding: tokens.space[0], display: "flex", flexDirection: "column", gap: tokens.space[2] }}>
                      {pendingInvitations.map((inv) => {
                        const canRevoke = currentUserRole === "owner" || inv.role !== "admin";
                        return (
                          <li key={inv.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: tokens.space[2], flexWrap: "wrap", paddingBlock: tokens.space[2], paddingInline: tokens.space[3], backgroundColor: tokens.bento.surfaceBase, borderRadius: tokens.radius.md }}>
                            <span style={{ fontSize: tokens.font.size.sm, color: tokens.color.textPrimary }}>
                              {inv.email} · {WORKSPACE_ROLE_LABELS[inv.role]} · Vence: {inv.expiresAt}
                            </span>
                            {canRevoke ? (
                              <Button type="button" variant="secondary" size="sm" aria-label={`Revocar invitación de ${inv.email}`} onPress={() => onRevokeInvitation?.(inv.id)} onClick={() => onRevokeInvitation?.(inv.id)} style={controlStyle}>
                                Revocar
                              </Button>
                            ) : null}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ) : null}
              </section>
            ) : null}
          </div>
        ) : null}
      </Card.Content>
    </Card>
  );
}
