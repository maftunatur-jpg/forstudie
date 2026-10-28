"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { useAuth } from "@/components/AuthProvider";
import { NotFound, WithId } from "@/components/WithId";
import { QualityPanel } from "@/components/QualityPanel";
import { BottomBar, Button, Card, Chip, Empty, HeaderButton, LinkButton, PageHeader, RatingBadge, SectionTitle, Status, Tag, cx } from "@/components/ui";
import { db } from "@/lib/db/db";
import { canEdit, useProfiles, useProjectRole } from "@/lib/hooks";
import { checkQuality, groupVisits, qualityIssueCount, ratingDistribution } from "@/lib/quality";
import { kindLabel } from "@/lib/ratings";
import { emptyVisit, saveVisit } from "@/lib/repo";
import type { Project, Rating, Visit } from "@/lib/types";

type Tab = "units" | "common";

function placeTag(p: Project, v: Visit) {
  const floor = v.floor ? (/^\d+$/.test(v.floor) ? `${v.floor} tr` : v.floor) : "–";
  return v.kind === "common" ? `${v.level1 ?? "–"}` : `${v.level1 ?? "–"} · ${floor}`;
}

function visitTitle(v: Visit) {
  if (v.kind === "common") return v.object_number || "Gemensamt utrymme";
  const prefix = v.kind === "premises" ? "Lokal" : "Lgh";
  return `${prefix} ${v.object_number || "(nr saknas)"}`;
}

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
  const [tab, setTab] = useState<Tab>("units");
  const [filter, setFilter] = useState<Rating | null>(null);
  const [showQc, setShowQc] = useState(false);

  const all = useMemo(() => visits ?? [], [visits]);
  const units = all.filter((v) => v.kind !== "common");
  const common = all.filter((v) => v.kind === "common");
  const shown = (tab === "units" ? units : common).filter((v) => !filter || (v.overall_rating ?? "not_assessed") === filter);
  const groups = groupVisits(shown);
  const dist = useMemo(() => ratingDistribution(all), [all]);
  const qc = useMemo(() => checkQuality(all, photoCount ?? {}), [all, photoCount]);
  const totalPhotos = Object.values(photoCount ?? {}).reduce((a, b) => a + b, 0);
  const warnings = qualityIssueCount(qc);

  if (project === undefined) return null;
  if (!project || project.deleted_at) return <NotFound what="Projektet" />;
  const editable = canEdit(role);

  async function newVisit() {
    const v = { ...emptyVisit(project!, auth.userId, auth.email || null), kind: tab === "common" ? ("common" as const) : ("apartment" as const) };
    await saveVisit(v, auth.userId);
    router.push(`/besok?id=${v.id}`);
  }

  return (
    <>
      <PageHeader
        sub={[project.property_designation, project.address].filter(Boolean).join(" · ") || project.study_type || "Förstudie"}
        title={project.name}
        back="/"
        actions={editable ? <HeaderButton href={`/projekt/redigera?id=${id}`}>Redigera</HeaderButton> : undefined}
      />

      <div className="flex gap-2" role="group" aria-label="Typ">
        {(
          [
            ["units", "Lägenheter", units.length],
            ["common", "Gemensamt", common.length],
          ] as const
        ).map(([k, label, n]) => (
          <button
            key={k}
            type="button"
            aria-pressed={tab === k}
            onClick={() => setTab(k)}
            className={cx(
              "min-h-11 flex-1 cursor-pointer rounded-[10px] border px-2 py-2.5 text-sm font-semibold",
              tab === k ? "border-accent bg-accent-soft text-accent" : "border-line bg-card text-ink",
            )}
          >
            {label} {n ? `(${n})` : ""}
          </button>
        ))}
      </div>

      <Status>
        {all.length} besök · {totalPhotos} foton ·{" "}
        <button type="button" className={cx("cursor-pointer underline", warnings ? "text-warn" : "")} onClick={() => setShowQc(!showQc)}>
          {warnings ? `${warnings} varningar` : "inga varningar"}
        </button>
      </Status>

      {showQc && <QualityPanel q={qc} />}

      {all.length > 0 && (
        <Card className="flex flex-col gap-3">
          <SectionTitle right={filter ? "filtrerat" : `${all.length} st`}>Samlad bedömning</SectionTitle>
          <div className="flex h-2.5 overflow-hidden rounded-full bg-paper" role="img" aria-label="Fördelning av bedömningar">
            {dist.filter((d) => d.count).map((d) => (
              <div key={d.value} style={{ width: `${d.share * 100}%`, background: d.hex }} title={`${d.label}: ${d.count}`} />
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {dist.map((d) => (
              <Chip key={d.value} selected={filter === d.value} onClick={() => setFilter(filter === d.value ? null : d.value)} className="min-h-9 py-1.5 text-[13px]">
                {d.label} <span className="font-mono">{d.count}</span>
              </Chip>
            ))}
          </div>
        </Card>
      )}

      {groups.length === 0 && (
        <Empty>
          {filter
            ? "Inga besök med vald bedömning."
            : tab === "units"
              ? "Inga lägenheter ännu. Tryck + Ny lägenhet när du står i den första."
              : "Inga gemensamma utrymmen ännu. Lägg till källare, vind och tvättstuga."}
        </Empty>
      )}

      {groups.map((g) => (
        <section key={g.level1} className="flex flex-col gap-2.5">
          <div className="pt-1 text-xs font-semibold uppercase tracking-[0.08em] text-muted">
            {project.level1_name} {g.level1}
          </div>
          {g.floors.flatMap((f) =>
            f.visits.map((v) => {
              const sub = [
                v.kind === "premises" ? kindLabel(v.kind) : null,
                v.level2 && project.level2_name ? `${project.level2_name} ${v.level2}` : null,
                v.shaft ? `Stam ${v.shaft}` : null,
                photoCount?.[v.id] ? `${photoCount[v.id]} foton` : null,
                v.updated_by && profiles[v.updated_by] ? `ändrad av ${profiles[v.updated_by]}` : null,
              ].filter(Boolean);
              return (
                <Link
                  key={v.id}
                  href={`/besok?id=${v.id}`}
                  className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-xl border border-line bg-card px-[14px] py-3"
                >
                  <Tag>{placeTag(project, v)}</Tag>
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{visitTitle(v)}</span>
                    <span className="block truncate text-[13px] text-muted">{sub.join(" · ") || "Ej ifyllt"}</span>
                  </span>
                  <RatingBadge rating={v.overall_rating} />
                </Link>
              );
            }),
          )}
        </section>
      ))}

      <div className="flex flex-wrap gap-2 pt-2">
        {!auth.anonymous && (
          <LinkButton variant="secondary" href={`/team?id=${id}`} className="min-h-10 py-2 text-sm">
            Team
          </LinkButton>
        )}
        <Button variant="secondary" className="min-h-10 py-2 text-sm" onClick={() => setShowQc(!showQc)}>
          Kvalitetskontroll
        </Button>
      </div>

      <BottomBar>
        {editable && (
          <Button onClick={newVisit} className="flex-1 py-[15px] text-base">
            {tab === "units" ? "+ Ny lägenhet" : "+ Nytt utrymme"}
          </Button>
        )}
        <LinkButton variant="secondary" href={`/rapport?id=${id}`} className={cx("py-[15px]", !editable && "flex-1")}>
          Rapport
        </LinkButton>
      </BottomBar>
    </>
  );
}

export default function Page() {
  return <WithId render={(id) => <ProjectView id={id} />} />;
}
