import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import {
  acceptWorkspaceInvitationAction, changeNoteVisibilityAction, changeTodoVisibilityAction, changeWorkspaceMemberRoleAction,
  createAgencyWorkspaceAction, createNoteAction, createTodoAction, exportWorkspaceAction, inviteWorkspaceMemberAction, listNotesAction,
  loadWorkspaceDashboardAction, removeOrLeaveWorkspaceMemberAction, revokeWorkspaceInvitationAction, saveNoteAction, selectActiveWorkspaceAction,
} from "../src/actions";
import { ensureAuthenticatedWorkspace, issueWorkspaceInvitation, resolveActiveWorkspaceCookie, setActiveWorkspaceCookieForTests, setSupabaseServerClientFactoryForTests } from "../src/server/composition";
import { seedAuthUserForTests } from "../src/server/composition/testing";

describe("Server Actions Fase 1B · Agencia activa, equipo, invitaciones y visibilidad (#63)", { timeout: 30000 }, () => {
  const runId = Math.random().toString(36).slice(2, 10);
  const owner = { id: crypto.randomUUID(), email: `owner-${runId}@hubly.local` }, admin = { id: crypto.randomUUID(), email: `admin-${runId}@hubly.local` };
  const editor = { id: crypto.randomUUID(), email: `editor-${runId}@hubly.local` }, viewer = { id: crypto.randomUUID(), email: `viewer-${runId}@hubly.local` }, outsider = { id: crypto.randomUUID(), email: `outsider-${runId}@hubly.local` };
  const actAs = (user: { id: string; email: string } | null) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setSupabaseServerClientFactoryForTests(() => ({ auth: { getUser: vi.fn().mockResolvedValue(user ? { data: { user }, error: null } : { data: { user: null }, error: new Error("No session") }) } }) as any);

  beforeAll(async () => { for (const u of [owner, admin, editor, viewer, outsider]) await seedAuthUserForTests(u.id, u.email, true); });
  afterEach(() => { setSupabaseServerClientFactoryForTests(null); });

  it("1. Crea agencia, selecciona espacio activo con cookie httpOnly hubly_ws y cae a personal si la cookie no es miembro", async () => {
    actAs(owner);
    const personalId = (await loadWorkspaceDashboardAction()).activeWorkspace.id;
    const agency = await createAgencyWorkspaceAction({ name: "Agencia Pulso", slug: `pulso-${runId}` });
    expect(agency).toMatchObject({ kind: "agency", role: "owner" });
    expect(await resolveActiveWorkspaceCookie()).toBe(agency.id);
    const agencyDashboard = await loadWorkspaceDashboardAction();
    expect(agencyDashboard.activeWorkspace.id).toBe(agency.id);
    expect(agencyDashboard.workspaces.map((w) => w.id)).toEqual(expect.arrayContaining([personalId, agency.id]));
    await selectActiveWorkspaceAction(personalId);
    expect((await loadWorkspaceDashboardAction()).activeWorkspace.id).toBe(personalId);
    actAs(outsider);
    await expect(selectActiveWorkspaceAction(agency.id)).rejects.toThrow("No autorizado en el espacio de trabajo");
    setActiveWorkspaceCookieForTests(agency.id);
    expect((await loadWorkspaceDashboardAction()).activeWorkspace.kind).toBe("personal");
    expect(await resolveActiveWorkspaceCookie()).toBeNull();
  });

  it("2. Emite invitaciones sin exponer token_hash, re-invita tras caducar revocando la vencida (Obs #1 y #3 de Claude) y acepta enlace", async () => {
    actAs(owner);
    const agency = await createAgencyWorkspaceAction({ name: "Agencia Nexo", slug: `nexo-${runId}` });
    const expired = await issueWorkspaceInvitation(await ensureAuthenticatedWorkspace(agency.id), { email: editor.email, role: "editor", expiresAt: new Date(Date.now() - 60_000).toISOString() });
    expect(expired.invitationPath).toMatch(/^\/invitacion#[A-Za-z0-9_-]{43}$/);
    expect("tokenHash" in expired.invitation || "token_hash" in expired.invitation).toBe(false);
    const reinvited = await inviteWorkspaceMemberAction({ workspaceId: agency.id, email: editor.email.toUpperCase(), role: "editor" });
    expect(reinvited.invitation.id).not.toBe(expired.invitation.id);
    await expect(inviteWorkspaceMemberAction({ workspaceId: agency.id, email: editor.email, role: "editor" })).rejects.toThrow(/pendiente activa/);
    const toRevoke = await inviteWorkspaceMemberAction({ workspaceId: agency.id, email: outsider.email, role: "viewer" });
    await revokeWorkspaceInvitationAction({ workspaceId: agency.id, invitationId: toRevoke.invitation.id });
    actAs(outsider);
    await expect(acceptWorkspaceInvitationAction({ token: toRevoke.invitationPath })).rejects.toThrow();
    actAs(editor);
    await ensureAuthenticatedWorkspace(undefined, "Personal Editor");
    expect((await acceptWorkspaceInvitationAction({ token: reinvited.invitationPath })).workspaceId).toBe(agency.id);
    expect(await resolveActiveWorkspaceCookie()).toBe(agency.id);
    actAs(owner);
    const invAdmin = await inviteWorkspaceMemberAction({ workspaceId: agency.id, email: admin.email, role: "admin" });
    const invViewer = await inviteWorkspaceMemberAction({ workspaceId: agency.id, email: viewer.email, role: "viewer" });
    actAs(admin); await acceptWorkspaceInvitationAction({ token: invAdmin.invitationPath });
    actAs(viewer); await acceptWorkspaceInvitationAction({ token: invViewer.invitationPath });
  });

  it("3. Gestiona visibilidad private vs workspace, edición colaborativa, desenlace al privatizar nota y reubicación al salir", async () => {
    actAs(owner);
    const agency = await createAgencyWorkspaceAction({ name: "Agencia Trama", slug: `trama-${runId}` });
    const invEd = await inviteWorkspaceMemberAction({ workspaceId: agency.id, email: editor.email, role: "editor" });
    const invVw = await inviteWorkspaceMemberAction({ workspaceId: agency.id, email: viewer.email, role: "viewer" });
    actAs(editor);
    const edPersonal = (await loadWorkspaceDashboardAction()).activeWorkspace.id;
    await acceptWorkspaceInvitationAction({ token: invEd.invitationPath });
    actAs(viewer); await acceptWorkspaceInvitationAction({ token: invVw.invitationPath });
    actAs(owner);
    const ownerPriv = await createNoteAction({ title: "Privada Owner", visibility: "private" }, agency.id);
    const ownerShared = await createNoteAction({ title: "Pauta Mensual", visibility: "workspace" }, agency.id);
    expect([ownerPriv.visibility, ownerShared.visibility]).toEqual(["private", "workspace"]);
    actAs(viewer);
    expect((await listNotesAction(undefined, agency.id)).map((n) => n.id)).toEqual([ownerShared.id]);
    await expect(createNoteAction({ title: "Intento", visibility: "workspace" }, agency.id)).rejects.toThrow();
    const viewerPriv = await createNoteAction({ title: "Apunte Viewer", visibility: "private" }, agency.id);
    await expect(changeNoteVisibilityAction({ noteId: viewerPriv.id, visibility: "workspace" }, agency.id)).rejects.toThrow();
    // La exportación solo incluye lo creado por quien exporta, aunque RLS le deje leer lo compartido por otros (ADR 0007).
    const viewerExport = await exportWorkspaceAction(agency.id);
    expect(viewerExport.data.notes.map((n) => n.id)).toEqual([viewerPriv.id]);
    expect(viewerExport.markdownContent).not.toContain("Pauta Mensual");
    actAs(editor);
    expect((await saveNoteAction({ id: ownerShared.id, title: "Pauta v2", content: "Editada", expectedVersion: 1 }, agency.id)).version).toBe(2);
    const editorSharedTodo = await createTodoAction({ title: "Publicar copy", noteId: ownerShared.id, visibility: "workspace" }, agency.id);
    const editorPrivNote = await createNoteAction({ title: "Mi borrador privado", visibility: "private" }, agency.id);
    const editorPrivTodo = await createTodoAction({ title: "Revisar borrador", noteId: editorPrivNote.id, visibility: "private" }, agency.id);
    await expect(changeTodoVisibilityAction({ todoId: editorPrivTodo.id, visibility: "workspace" }, agency.id)).rejects.toThrow(/nota privada/);
    actAs(owner);
    expect((await changeNoteVisibilityAction({ noteId: ownerShared.id, visibility: "private" }, agency.id)).visibility).toBe("private");
    expect((await loadWorkspaceDashboardAction(agency.id)).todos.find((t) => t.id === editorSharedTodo.id)?.noteId).toBeNull();
    await changeWorkspaceMemberRoleAction({ workspaceId: agency.id, targetUserId: viewer.id, role: "editor" });
    await expect(removeOrLeaveWorkspaceMemberAction({ workspaceId: agency.id, targetUserId: owner.id })).rejects.toThrow(/al menos un propietario/);
    actAs(editor);
    await selectActiveWorkspaceAction(agency.id);
    expect((await removeOrLeaveWorkspaceMemberAction({ workspaceId: agency.id, targetUserId: editor.id })).leftCurrentWorkspace).toBe(true);
    expect(await resolveActiveWorkspaceCookie()).toBeNull();
    const edDash = await loadWorkspaceDashboardAction();
    expect(edDash.activeWorkspace.id).toBe(edPersonal);
    expect(edDash.notes.some((n) => n.id === editorPrivNote.id)).toBe(true);
    expect(edDash.todos.find((t) => t.id === editorPrivTodo.id)?.noteId).toBe(editorPrivNote.id);
  });
});
