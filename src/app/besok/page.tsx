"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { useAuth } from "@/components/AuthProvider";
import { NotFound, WithId } from "@/components/WithId";
import { PhotoSection } from "@/components/PhotoSection";
import { PresenceWarning } from "@/components/Presence";
import { QuestionInput } from "@/components/QuestionInput";
import { ActivityLog } from "@/components/ActivityLog";
import { AiVisitSuggestion } from "@/components/AiSuggestion";
import { Alert, Button, Card, Chip, ChipGroup, Collapsible, Field, PageHeader, RatingBadge, RatingPicker, inputClass } from "@/components/ui";
import { db } from "@/lib/db/db";
import { canEdit, useProfiles, useProjectRole } from "@/lib/hooks";
import { KINDS } from "@/lib/ratings";
import { saveVisit, softDelete } from "@/lib/repo";
import { ratingKey, sectionProgress, setAnswer } from "@/lib/templates/engine";
import type { Project, Template, Visit } from "@/lib/types";

type SaveStatus = "saved" | "saving" | "error";

function VisitEditor({ latest, project, templates, editable }: { latest: Visit; project: Project; templates: Template[]; editable: boolean }) {
  const auth = useAuth();
  const router = useRouter();
  const profiles = useProfiles();
  const [v, setV] = useState(latest);
  const [status, setStatus] = useState<SaveStatus>("saved");
  const vRef = useRef(latest);
  const dirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (!dirty.current) return;
    dirty.current = false;
    try {
      const saved = await saveVisit(vRef.current, auth.userId);
      if (!dirty.current) vRef.current = { ...vRef.current, updated_at: saved.updated_at };
      setStatus(dirty.current ? "saving" : "saved");
    } catch {
      dirty.current = true;
      setStatus("error");
    }
  }, [auth.userId]);

  // Spara direkt när appen göms/stängs eller när man lämnar sidan.
  useEffect(() => {
    const onHide = () => void flush();
    const onVis = () => document.visibilityState === "hidden" && onHide();
    window.addEventListener("pagehide", onHide);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("pagehide", onHide);
      document.removeEventListener("visibilitychange", onVis);
      void flush();
    };
  }, [flush]);

  // Ta emot ändringar från synk (annan användare/enhet) när vi inte har osparat.
  useEffect(() => {
    if (!dirty.current && latest.updated_at !== vRef.current.updated_at) {
      vRef.current = latest;
      setV(latest);
    }
  }, [latest]);

  function update(patch: Partial<Visit>) {
    if (!editable) return;
    const next = { ...vRef.current, ...patch };
    vRef.current = next;
    dirty.current = true;
    setV(next);
    setStatus("saving");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), 600);
  }

  const title = [v.level1 && `${project.level1_name} ${v.level1}`, v.object_number].filter(Boolean).join(" · ") || "Nytt besök";
  const level1Options = project.level1_values.map((x) => ({ value: x, label: x }));
  const level2Options = project.level2_values.map((x) => ({ value: x, label: x }));

  return (
    <div className="space-y-4">
      <PageHeader
        title={title}
        back={`/projekt?id=${project.id}`}
        actions={
          <span className="text-sm text-slate-500" aria-live="polite" data-testid="save-status">
            {status === "saving" ? "Sparar…" : status === "error" ? "Kunde inte spara" : "Sparat"}
          </span>
        }
      />
      <PresenceWarning visitId={v.id} userId={auth.userId} email={auth.email} />
      {!editable && <Alert>Du har läsbehörighet i projektet.</Alert>}

      <Card className="space-y-4">
        <div>
          <div className="mb-1 text-sm font-medium text-slate-700">{project.level1_name} *</div>
          <ChipGroup options={level1Options} value={v.level1} onChange={(x) => update({ level1: x })} disabled={!editable} />
          {!v.level1 && <p className="mt-1 text-sm text-amber-700">Välj {project.level1_name.toLowerCase()}.</p>}
        </div>
        {project.level2_name && (
          <div>
            <div className="mb-1 text-sm font-medium text-slate-700">{project.level2_name}</div>
            <ChipGroup options={level2Options} value={v.level2} onChange={(x) => update({ level2: x })} disabled={!editable} />
          </div>
        )}
        <div>
          <div className="mb-1 text-sm font-medium text-slate-700">Typ</div>
          <div className="flex flex-wrap gap-2">
            {KINDS.map((k) => (
              <Chip key={k.value} selected={v.kind === k.value} disabled={!editable} onClick={() => update({ kind: k.value })}>
                {k.label}
              </Chip>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label={v.kind === "common" ? "Benämning/nummer" : "Objektnummer"}>
            <input className={inputClass} disabled={!editable} value={v.object_number ?? ""} onChange={(e) => update({ object_number: e.target.value || null })} data-testid="object-number" />
          </Field>
          <Field label="Våning">
            <input className={inputClass} disabled={!editable} inputMode="text" value={v.floor ?? ""} onChange={(e) => update({ floor: e.target.value || null })} />
          </Field>
          <Field label="Stam/schakt">
            <input className={inputClass} disabled={!editable} value={v.shaft ?? ""} onChange={(e) => update({ shaft: e.target.value || null })} />
          </Field>
          <Field label="Datum">
            <input type="date" className={inputClass} disabled={!editable} value={v.visit_date ?? ""} onChange={(e) => update({ visit_date: e.target.value || null })} />
          </Field>
        </div>
        <Field label="Inventerare">
          <input className={inputClass} disabled={!editable} value={v.inspector ?? ""} onChange={(e) => update({ inspector: e.target.value || null })} />
        </Field>
      </Card>

      {templates.map((t) => (
        <div key={t.id} className="space-y-2">
          {templates.length > 1 && <h2 className="pt-2 text-sm font-semibold uppercase tracking-wide text-slate-500">{t.name}</h2>}
          {t.sections.map((s) => {
            const p = sectionProgress(s, v.answers[t.id]);
            const rKey = ratingKey(t.id, s.id);
            return (
              <Collapsible
                key={s.id}
                title={s.title}
                right={
                  <span className="flex items-center gap-2">
                    {v.ratings[rKey] && <RatingBadge rating={v.ratings[rKey]} />}
                    <span className={"rounded-full px-2 py-0.5 text-sm " + (p.answered === p.total ? "bg-green-100 text-green-900" : "bg-slate-100 text-slate-700")}>
                      {p.answered}/{p.total}
                    </span>
                  </span>
                }
              >
                <div className="divide-y divide-slate-100">
                  {s.questions.map((q) => (
                    <QuestionInput
                      key={q.id}
                      q={q}
                      value={v.answers[t.id]?.[q.id]}
                      disabled={!editable}
                      onChange={(val) => update({ answers: setAnswer(vRef.current.answers, t.id, q.id, val) })}
                    />
                  ))}
                </div>
                <div className="mt-4 space-y-2 border-t border-slate-100 pt-4">
                  <div className="text-sm font-medium text-slate-700">Bedömning – {s.title}</div>
                  <RatingPicker
                    value={v.ratings[rKey]}
                    disabled={!editable}
                    onChange={(r) => {
                      const ratings = { ...vRef.current.ratings };
                      if (r) ratings[rKey] = r;
                      else delete ratings[rKey];
                      update({ ratings });
                    }}
                  />
                </div>
                <div className="mt-4 space-y-2">
                  <div className="text-sm font-medium text-slate-700">Foton – {s.title}</div>
                  <PhotoSection visit={v} category={s.title} editable={editable} />
                </div>
              </Collapsible>
            );
          })}
        </div>
      ))}

      <Card className="space-y-2">
        <h2 className="font-semibold">Övriga foton</h2>
        <PhotoSection visit={v} category={null} editable={editable} />
      </Card>

      <Card className="space-y-4">
        <h2 className="font-semibold">Samlad bedömning</h2>
        <RatingPicker value={v.overall_rating} disabled={!editable} onChange={(r) => update({ overall_rating: r })} />
        <Field label="Anteckningar">
          <textarea className={inputClass + " min-h-28"} disabled={!editable} value={v.notes ?? ""} onChange={(e) => update({ notes: e.target.value || null })} />
        </Field>
      </Card>

      {editable && (
        <AiVisitSuggestion
          visit={v}
          templates={templates}
          onApprove={(s) => update({ ratings: { ...vRef.current.ratings, ...s.ratings }, overall_rating: s.overall ?? vRef.current.overall_rating, notes: [vRef.current.notes, s.text].filter(Boolean).join("\n\n") })}
        />
      )}

      <Card className="space-y-2">
        <p className="text-sm text-slate-600">
          Senast ändrad {new Date(v.updated_at).toLocaleString("sv-SE")}
          {v.updated_by && ` av ${profiles[v.updated_by] ?? (v.updated_by === auth.userId ? auth.email : "okänd")}`}
        </p>
        <ActivityLog projectId={project.id} rowIds={[v.id]} />
      </Card>

      {editable && (
        <Button
          variant="danger"
          className="w-full"
          onClick={async () => {
            if (!confirm("Ta bort besöket?")) return;
            await flush();
            await softDelete("visits", v.id, auth.userId);
            router.push(`/projekt?id=${project.id}`);
          }}
        >
          Ta bort besök
        </Button>
      )}
    </div>
  );
}

function VisitPage({ id }: { id: string }) {
  const auth = useAuth();
  const visit = useLiveQuery(async () => (await db().visits.get(id)) ?? null, [id]);
  const project = useLiveQuery(async () => (visit ? ((await db().projects.get(visit.project_id)) ?? null) : undefined), [visit?.project_id]);
  const templates = useLiveQuery(async () => {
    if (!project) return undefined;
    const list = await db().templates.bulkGet(project.template_ids);
    return list.filter((t): t is Template => !!t);
  }, [project?.id, project?.template_ids.join(",")]);
  const role = useProjectRole(project ?? undefined, auth.userId);

  if (visit === undefined || (visit && (project === undefined || templates === undefined))) return null;
  if (!visit || visit.deleted_at || !project) return <NotFound what="Besöket" />;
  return <VisitEditor key={visit.id} latest={visit} project={project} templates={templates ?? []} editable={canEdit(role)} />;
}

export default function Page() {
  return <WithId render={(id) => <VisitPage id={id} />} />;
}
