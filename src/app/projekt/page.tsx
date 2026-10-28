"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { useAuth } from "@/components/AuthProvider";
import { NotFound, WithId } from "@/components/WithId";
import { QualityPanel } from "@/components/QualityPanel";
import { Button, Card, Chip, LinkButton, PageHeader, RatingBadge, cx } from "@/components/ui";
import { db } from "@/lib/db/db";
import { canEdit, useProfiles, useProjectRole } from "@/lib/hooks";
import { checkQuality, groupVisits, ratingDistribution, visitLabel } from "@/lib/quality";
import { KINDS, RATINGS, kindLabel } from "@/lib/ratings";
import { emptyVisit, saveVisit } from "@/lib/repo";
import type { Rating } from "@/lib/types";

function ProjectView({ id }: { id: string }) {
  const auth = useAuth();
  const router = useRouter();
  const profiles = useProfiles();
  const project = useLiveQuery(async () => (await db().projects.get(id)) ?? null, [id]);
  const visits = useLiveQuery(() => db().visits.where("project_id").equals(id).filter((v) => !v.deleted_at).toArray(), [id]);
  const photoCount = useLiveQuery(async () => {
    const photos = await db().photos.where("project_id").equals(id).filter((p) => !p.deleted_at).toArray();
    const m: Record<string, number> = {};
    for (const p of photos) m[p.visit_id] = (m[p.visit_id] ?? 0) + 1;
    return m;
  }, [id]);
  const role = useProjectRole(project ?? undefined, auth.userId);
  const [filter, setFilter] = useState<Rating | null>(null);
  const [showQc, setShowQc] = useState(false);

  const all = useMemo(() => visits ?? [], [visits]);
  const filtered = filter ? all.filter((v) => (v.overall_rating ?? "not_assessed") === filter) : all;
  const groups = useMemo(() => groupVisits(filtered), [filtered]);
  const dist = useMemo(() => ratingDistribution(all), [all]);
  const qc = useMemo(() => checkQuality(all, photoCount ?? {}), [all, photoCount]);
  const totalPhotos = Object.values(photoCount ?? {}).reduce((a, b) => a + b, 0);

  if (project === undefined) return null;
  if (!project || project.deleted_at) return <NotFound what="Projektet" />;

  async function newVisit() {
    const v = emptyVisit(project!, auth.userId, auth.email);
    await saveVisit(v, auth.userId);
    router.push(`/besok?id=${v.id}`);
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={project.name}
        back="/"
        actions={canEdit(role) ? <LinkButton variant="secondary" href={`/projekt/redigera?id=${id}`}>Redigera</LinkButton> : undefined}
      />
      <p className="-mt-3 text-sm text-slate-600">{[project.property_designation, project.address, project.study_type].filter(Boolean).join(" · ")}</p>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Kpi label="Besök" value={all.length} />
        {KINDS.map((k) => (
          <Kpi key={k.value} label={k.label} value={all.filter((v) => v.kind === k.value).length} />
        ))}
        <Kpi label="Foton" value={totalPhotos} />
        <Kpi label="Varningar" value={qc.missingLevel.length + qc.missingPhotos.length + qc.duplicates.length} warn />
      </div>

      <Card>
        <div className="mb-2 text-sm font-medium text-slate-700">Fördelning samlad bedömning</div>
        <div className="flex h-4 overflow-hidden rounded-full bg-slate-100" role="img" aria-label="Fördelning av bedömningar">
          {dist.filter((d) => d.count).map((d) => (
            <div key={d.value} style={{ width: `${d.share * 100}%`, background: d.hex }} title={`${d.label}: ${d.count}`} />
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Chip selected={!filter} onClick={() => setFilter(null)}>Alla ({all.length})</Chip>
          {dist.map((d) => (
            <Chip key={d.value} selected={filter === d.value} onClick={() => setFilter(filter === d.value ? null : d.value)}>
              {d.label} ({d.count})
            </Chip>
          ))}
        </div>
      </Card>

      <div className="flex flex-wrap gap-2">
        {canEdit(role) && <Button onClick={newVisit} className="flex-1">+ Nytt besök</Button>}
        <Button variant="secondary" onClick={() => setShowQc(!showQc)}>Kvalitetskontroll</Button>
        <LinkButton variant="secondary" href={`/rapport?id=${id}`}>Rapport</LinkButton>
        {!auth.anonymous && <LinkButton variant="secondary" href={`/team?id=${id}`}>Team</LinkButton>}
      </div>

      {showQc && <QualityPanel q={qc} />}

      {groups.length === 0 && <p className="text-slate-600">Inga besök{filter ? " med vald bedömning" : ""}.</p>}
      {groups.map((g) => (
        <section key={g.level1}>
          <h2 className="mb-2 text-lg font-bold">
            {project.level1_name} {g.level1}
          </h2>
          {g.floors.map((f) => (
            <div key={f.floor} className="mb-3">
              <h3 className="mb-1 text-sm font-semibold uppercase tracking-wide text-slate-500">Våning {f.floor}</h3>
              <ul className="space-y-2">
                {f.visits.map((v) => (
                  <li key={v.id}>
                    <Link href={`/besok?id=${v.id}`} className="flex min-h-14 items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2 hover:border-blue-300">
                      <div className="flex-1">
                        <div className="font-semibold">
                          {visitLabel(v)}
                          {v.level2 && <span className="font-normal text-slate-500"> · {project.level2_name} {v.level2}</span>}
                        </div>
                        <div className="text-xs text-slate-500">
                          {kindLabel(v.kind)} · {photoCount?.[v.id] ?? 0} foton
                          {v.updated_by && profiles[v.updated_by] ? ` · ändrad av ${profiles[v.updated_by]}` : ""}
                        </div>
                      </div>
                      <RatingBadge rating={v.overall_rating} />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      ))}
      <p className="text-xs text-slate-400">Skala: {RATINGS.map((r) => r.label).join(" / ")}</p>
    </div>
  );
}

function Kpi({ label, value, warn }: { label: string; value: number; warn?: boolean }) {
  return (
    <div className={cx("rounded-xl border bg-white p-3", warn && value ? "border-amber-300 bg-amber-50" : "border-slate-200")}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs text-slate-600">{label}</div>
    </div>
  );
}

export default function Page() {
  return <WithId render={(id) => <ProjectView id={id} />} />;
}
