"use client";

import { useCallback, useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useAuth } from "@/components/AuthProvider";
import { NotFound, WithId } from "@/components/WithId";
import { Alert, Button, Card, ChipGroup, Field, PageHeader, inputClass } from "@/components/ui";
import { db } from "@/lib/db/db";
import { useOnline, useProjectRole } from "@/lib/hooks";
import { ROLE_LABELS } from "@/lib/ratings";
import { LOCAL_ONLY, supabase } from "@/lib/supabase/client";
import type { Role } from "@/lib/types";

const ROLE_OPTIONS = (Object.keys(ROLE_LABELS) as Role[]).map((r) => ({ value: r, label: ROLE_LABELS[r] }));

interface Member {
  user_id: string;
  role: Role;
  email: string;
}
interface Invitation {
  id: string;
  email: string;
  role: Role;
  accepted_at: string | null;
}

function Team({ id }: { id: string }) {
  const auth = useAuth();
  const online = useOnline();
  const project = useLiveQuery(async () => (await db().projects.get(id)) ?? null, [id]);
  const role = useProjectRole(project ?? undefined, auth.userId);
  const isOwner = role === "owner";
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invitation[]>([]);
  const [email, setEmail] = useState("");
  const [newRole, setNewRole] = useState<Role>("editor");
  const [message, setMessage] = useState<{ kind: "info" | "error"; text: string } | null>(null);

  const load = useCallback(async () => {
    if (LOCAL_ONLY || !navigator.onLine) return;
    const [{ data: pm }, { data: inv }, { data: profiles }] = await Promise.all([
      supabase().from("project_members").select("user_id, role").eq("project_id", id),
      supabase().from("invitations").select("id, email, role, accepted_at").eq("project_id", id).is("accepted_at", null),
      supabase().from("profiles").select("id, email"),
    ]);
    const emails = Object.fromEntries((profiles ?? []).map((p) => [p.id, p.email]));
    setMembers((pm ?? []).map((m) => ({ ...m, email: emails[m.user_id] ?? m.user_id })) as Member[]);
    setInvites((inv ?? []) as Invitation[]);
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hämtar från servern
    void load();
  }, [load, online]);

  if (project === undefined) return null;
  if (!project) return <NotFound what="Projektet" />;

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    const addr = email.trim().toLowerCase();
    const { data, error } = await supabase().rpc("invite_to_project", { p_project: id, p_email: addr, p_role: newRole });
    if (error) return setMessage({ kind: "error", text: error.message });
    // Skicka en inloggningslänk; inbjudan accepteras automatiskt vid inloggning.
    const { error: mailError } = await supabase().auth.signInWithOtp({
      email: addr,
      options: { emailRedirectTo: `${window.location.origin}/projekt?id=${id}`, shouldCreateUser: true },
    });
    setMessage(
      mailError
        ? { kind: "error", text: `Inbjudan sparad, men e-post kunde inte skickas: ${mailError.message}` }
        : { kind: "info", text: data === "added" ? `${addr} har lagts till och fått en inloggningslänk.` : `Inbjudan skickad till ${addr}.` },
    );
    setEmail("");
    void load();
  }

  async function changeRole(userId: string, r: Role) {
    const { error } = await supabase().from("project_members").update({ role: r }).eq("project_id", id).eq("user_id", userId);
    if (error) setMessage({ kind: "error", text: error.message });
    void load();
  }

  async function remove(userId: string) {
    if (!confirm("Ta bort personen från projektet?")) return;
    const { error } = await supabase().from("project_members").delete().eq("project_id", id).eq("user_id", userId);
    if (error) setMessage({ kind: "error", text: error.message });
    void load();
  }

  async function revoke(inviteId: string) {
    await supabase().from("invitations").delete().eq("id", inviteId);
    void load();
  }

  return (
    <div className="space-y-4">
      <PageHeader title={`Team – ${project.name}`} back={`/projekt?id=${id}`} />
      {(LOCAL_ONLY || auth.anonymous) && <Alert>Team och inbjudningar kräver inloggning, som är avstängd. Dina projekt syns bara för dig.</Alert>}
      {!online && <Alert kind="warning">Team kräver nätverk.</Alert>}
      {message && <Alert kind={message.kind}>{message.text}</Alert>}

      <Card className="space-y-3">
        <h2 className="font-semibold">Medlemmar</h2>
        <p className="text-sm text-muted">Alla i organisationen ser också projektet enligt sin organisationsroll.</p>
        <ul className="divide-y divide-line">
          {members.map((m) => (
            <li key={m.user_id} className="space-y-2 py-3">
              <div className="font-medium">
                {m.email}
                {m.user_id === auth.userId && " (du)"}
              </div>
              {isOwner && m.user_id !== auth.userId ? (
                <div className="flex flex-wrap items-center gap-2">
                  <ChipGroup options={ROLE_OPTIONS} value={m.role} allowClear={false} onChange={(r) => r && void changeRole(m.user_id, r)} />
                  <Button variant="danger" onClick={() => remove(m.user_id)}>
                    Ta bort
                  </Button>
                </div>
              ) : (
                <div className="text-sm text-muted">{ROLE_LABELS[m.role]}</div>
              )}
            </li>
          ))}
        </ul>
      </Card>

      {isOwner && (
        <Card className="space-y-3">
          <h2 className="font-semibold">Bjud in via e-post</h2>
          <form onSubmit={invite} className="space-y-3">
            <Field label="E-post">
              <input type="email" required className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            <ChipGroup options={ROLE_OPTIONS} value={newRole} allowClear={false} onChange={(r) => r && setNewRole(r)} />
            <p className="text-sm text-muted">Ägare: allt inkl. medlemmar. Redigerare: inventera och redigera. Läsare: bara läsa och exportera.</p>
            <Button type="submit" disabled={!online || !email} className="w-full">
              Skicka inbjudan
            </Button>
          </form>
          {invites.length > 0 && (
            <ul className="space-y-1 text-sm">
              {invites.map((i) => (
                <li key={i.id} className="flex items-center justify-between gap-2">
                  <span>
                    {i.email} – {ROLE_LABELS[i.role]} (väntar)
                  </span>
                  <Button variant="ghost" onClick={() => revoke(i.id)}>
                    Återkalla
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </div>
  );
}

export default function Page() {
  return <WithId render={(id) => <Team id={id} />} />;
}
