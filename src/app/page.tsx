"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db/db";
import { useAuth } from "@/components/AuthProvider";
import { Button, Card, LinkButton, PageHeader } from "@/components/ui";
import { createExampleProject } from "@/lib/example";

export default function ProjectsPage() {
  const auth = useAuth();
  const router = useRouter();
  const projects = useLiveQuery(() => db().projects.filter((p) => !p.deleted_at).toArray(), []);
  const counts = useLiveQuery(async () => {
    const visits = await db().visits.filter((v) => !v.deleted_at).toArray();
    const m: Record<string, number> = {};
    for (const v of visits) m[v.project_id] = (m[v.project_id] ?? 0) + 1;
    return m;
  }, []);

  const sorted = (projects ?? []).sort((a, b) => b.updated_at.localeCompare(a.updated_at));

  return (
    <div>
      <PageHeader title="Projekt" actions={<LinkButton href="/projekt/ny">+ Nytt projekt</LinkButton>} />
      {projects && sorted.length === 0 && (
        <Card className="space-y-3 text-center">
          <p className="text-slate-600">Inga projekt ännu.</p>
          <Button
            variant="secondary"
            onClick={async () => router.push(`/projekt?id=${await createExampleProject(auth.orgId, auth.userId)}`)}
          >
            Skapa exempelprojekt
          </Button>
        </Card>
      )}
      <ul className="space-y-3">
        {sorted.map((p) => (
          <li key={p.id}>
            <Link href={`/projekt?id=${p.id}`} className="block rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:border-blue-300">
              <div className="text-lg font-semibold text-slate-900">{p.name || "Namnlöst projekt"}</div>
              <div className="text-sm text-slate-600">
                {[p.property_designation, p.address].filter(Boolean).join(" · ")}
              </div>
              <div className="mt-1 text-sm text-slate-500">
                {p.study_type ?? "Förstudie"} · {counts?.[p.id] ?? 0} besök
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
