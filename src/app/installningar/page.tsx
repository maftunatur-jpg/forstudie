"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { Alert, Button, Card, Field, PageHeader, inputClass } from "@/components/ui";
import { db } from "@/lib/db/db";
import { usePendingCount, useSyncState } from "@/lib/hooks";
import { syncNow } from "@/lib/db/sync";
import { LOCAL_ONLY, supabase } from "@/lib/supabase/client";

export default function SettingsPage() {
  const auth = useAuth();
  const router = useRouter();
  const pending = usePendingCount();
  const sync = useSyncState();
  const [orgName, setOrgName] = useState("");
  const [saved, setSaved] = useState(false);
  const [failed, setFailed] = useState<{ table: string; error?: string }[]>([]);

  useEffect(() => {
    void db()
      .outbox.where("failed")
      .equals(1)
      .toArray()
      .then((items) => setFailed(items.map((i) => ({ table: i.table, error: i.last_error }))));
    if (LOCAL_ONLY) return;
    void supabase()
      .from("organizations")
      .select("name")
      .eq("id", auth.orgId)
      .single()
      .then(({ data }) => data && setOrgName(data.name));
  }, [auth.orgId, pending]);

  return (
    <div className="space-y-4">
      <PageHeader title="Inställningar" />
      <Card className="space-y-2">
        <div className="text-sm text-slate-600">Inloggad som</div>
        <div className="font-medium">{auth.email}</div>
        {!LOCAL_ONLY && (
          <Button
            variant="secondary"
            onClick={async () => {
              if (pending && !confirm(`Du har ${pending} osynkade ändringar. De ligger kvar på enheten och synkas vid nästa inloggning. Logga ut ändå?`)) return;
              await supabase().auth.signOut();
              router.replace("/login");
            }}
          >
            Logga ut
          </Button>
        )}
      </Card>

      <Card className="space-y-3">
        <h2 className="font-semibold">Synk</h2>
        <p className="text-sm text-slate-600">
          {pending} osynkade poster. {sync.lastSync ? `Senaste synk ${new Date(sync.lastSync).toLocaleTimeString("sv-SE")}.` : ""}
        </p>
        {sync.error && <Alert kind="error">{sync.error}</Alert>}
        {failed.length > 0 && (
          <Alert kind="warning">
            {failed.length} poster avvisades av servern (t.ex. saknad behörighet). De finns kvar lokalt.
            <ul className="mt-1 list-disc pl-5">
              {failed.slice(0, 5).map((f, i) => (
                <li key={i}>
                  {f.table}: {f.error}
                </li>
              ))}
            </ul>
          </Alert>
        )}
        <Button variant="secondary" onClick={() => void syncNow()} disabled={LOCAL_ONLY}>
          Synka nu
        </Button>
      </Card>

      {!LOCAL_ONLY && (
        <Card className="space-y-3">
          <h2 className="font-semibold">Organisation</h2>
          <Field label="Namn">
            <input className={inputClass} value={orgName} onChange={(e) => setOrgName(e.target.value)} />
          </Field>
          <Button
            variant="secondary"
            onClick={async () => {
              const { error } = await supabase().from("organizations").update({ name: orgName }).eq("id", auth.orgId);
              setSaved(!error);
            }}
          >
            Spara namn
          </Button>
          {saved && <Alert>Sparat.</Alert>}
        </Card>
      )}
    </div>
  );
}
