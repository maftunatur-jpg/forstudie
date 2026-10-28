"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db/db";
import { useAuth } from "@/components/AuthProvider";
import { BottomBar, Button, Empty, LinkButton, PageHeader, Status, Tag } from "@/components/ui";
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
    <>
      <PageHeader sub="Fältinventering" title="Projekt" />
      <Status>{projects ? `${sorted.length} projekt på den här enheten. Allt sparas först på enheten och synkas automatiskt.` : "Laddar…"}</Status>
      {projects && sorted.length === 0 && (
        <Empty>
          <p className="mb-3">
            Inga projekt ännu. Tryck <b>+ Nytt projekt</b> för att börja, eller prova med ett påhittat exempel.
          </p>
          <Button variant="secondary" onClick={async () => router.push(`/projekt?id=${await createExampleProject(auth.orgId, auth.userId)}`)}>
            Skapa exempelprojekt
          </Button>
        </Empty>
      )}
      <ul className="flex flex-col gap-2.5">
        {sorted.map((p) => (
          <li key={p.id}>
            <Link href={`/projekt?id=${p.id}`} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-xl border border-line bg-card px-[14px] py-3">
              <Tag>{(p.study_type ?? "Förstudie").slice(0, 9)}</Tag>
              <span className="min-w-0">
                <span className="block truncate font-semibold">{p.name || "Namnlöst projekt"}</span>
                <span className="block truncate text-[13px] text-muted">{[p.property_designation, p.address].filter(Boolean).join(" · ") || "Ingen adress"}</span>
              </span>
              <span className="font-mono text-xs font-medium text-muted">{counts?.[p.id] ?? 0} besök</span>
            </Link>
          </li>
        ))}
      </ul>
      <BottomBar>
        <LinkButton href="/projekt/ny" className="flex-1 py-[15px] text-base">
          + Nytt projekt
        </LinkButton>
      </BottomBar>
    </>
  );
}
