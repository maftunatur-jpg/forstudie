"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { useAuth } from "@/components/AuthProvider";
import { Button, Card, LinkButton, PageHeader } from "@/components/ui";
import { db } from "@/lib/db/db";
import { newId, nowIso, saveTemplate } from "@/lib/repo";
import { copyTemplate } from "@/lib/templates/engine";
import type { Template } from "@/lib/types";

export default function TemplatesPage() {
  const auth = useAuth();
  const router = useRouter();
  const templates = useLiveQuery(() => db().templates.filter((t) => !t.deleted_at && (t.org_id === null || t.org_id === auth.orgId)).toArray(), [auth.orgId]);

  async function copy(t: Template) {
    const c = copyTemplate(t, newId(), auth.orgId, nowIso());
    await saveTemplate(c, auth.userId);
    router.push(`/mallar/redigera?id=${c.id}`);
  }

  async function create() {
    const t: Template = {
      id: newId(),
      org_id: auth.orgId,
      name: "Ny mall",
      description: null,
      sections: [{ id: "s1", title: "Sektion 1", questions: [{ id: "q1", label: "Skick", type: "single", options: ["God", "Acceptabel", "Brister"] }] }],
      based_on: null,
      updated_at: nowIso(),
      deleted_at: null,
    };
    await saveTemplate(t, auth.userId);
    router.push(`/mallar/redigera?id=${t.id}`);
  }

  const sorted = (templates ?? []).sort((a, b) => Number(a.org_id === null) - Number(b.org_id === null) || a.name.localeCompare(b.name, "sv"));

  return (
    <div className="space-y-3">
      <PageHeader title="Checklistmallar" actions={<Button onClick={create}>+ Ny mall</Button>} />
      <p className="text-sm text-slate-600">Standardmallarna är gemensamma och kan inte ändras – kopiera dem för att anpassa.</p>
      {sorted.map((t) => (
        <Card key={t.id} className="space-y-2">
          <div className="flex items-start gap-2">
            <div className="flex-1">
              <div className="font-semibold">{t.name}</div>
              <div className="text-sm text-slate-500">
                {t.org_id ? "Egen mall" : "Standardmall"} · {t.sections.length} sektioner · {t.sections.reduce((n, s) => n + s.questions.length, 0)} frågor
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            {t.org_id ? (
              <LinkButton variant="secondary" href={`/mallar/redigera?id=${t.id}`}>
                Redigera
              </LinkButton>
            ) : (
              <Link href={`/mallar/redigera?id=${t.id}`} className="inline-flex min-h-12 items-center px-3 text-blue-700">
                Visa
              </Link>
            )}
            <Button variant="secondary" onClick={() => copy(t)}>
              Kopiera
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
}
