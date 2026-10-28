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
import { Alert, Button, ChipGroup, Collapsible, Field, HeaderButton, Label, PageHeader, RatingBadge, RatingPicker, inputClass } from "@/components/ui";
import { db } from "@/lib/db/db";
import { canEdit, useProfiles, useProjectRole } from "@/lib/hooks";
import { KINDS } from "@/lib/ratings";
import { LOCAL_ONLY } from "@/lib/supabase/client";
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
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [generalPhotos, setGeneralPhotos] = useState(0);
  const pendingSync = useLiveQuery(async () => (await db().outbox.where({ table: "visits", row_id: latest.id }).count()) > 0, [latest.id], false);

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

  const kindTitle = v.kind === "common" ? "Gemensamt utrymme" : v.kind === "premises" ? "Lokal" : "Lägenhet";
  const title = v.object_number ? `${kindTitle} ${v.object_number}` : kindTitle;
  const sub = [project.name, v.level1 && `${project.level1_name} ${v.level1}`].filter(Boolean).join(" · ");
  const level1Options = project.level1_values.map((x) => ({ value: x, label: x }));
  const level2Options = project.level2_values.map((x) => ({ value: x, label: x }));
  const back = `/projekt?id=${project.id}`;
  const savedText =
    status === "saving" ? "Sparar…" : status === "error" ? "Kunde inte spara – försöker igen" : pendingSync && !LOCAL_ONLY ? "Sparat på enheten · synkas när nätet finns" : "Sparat";

  async function done() {
    await flush();
    router.push(back);
  }

  return (
    <>
      <PageHeader sub={sub} title={title} back={back} actions={<HeaderButton onClick={done}>Klar</HeaderButton>} />
      <div className="font-mono text-xs font-medium text-muted" aria-live="polite" data-testid="save-status">
        {savedText}
      </div>
      <PresenceWarning visitId={v.id} userId={auth.userId} email={auth.email} />
      {!editable && <Alert>Du har läsbehörighet i projektet.</Alert>}

      <Collapsible title="Plats" right={v.kind === "common" ? "byggnadsdel · benämning" : "nr · byggnadsdel · våning"} defaultOpen>
        <div>
          <Label>Typ</Label>
          <ChipGroup options={KINDS} value={v.kind} allowClear={false} disabled={!editable} onChange={(k) => k && update({ kind: k })} />
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <Field label={v.kind === "common" ? "Benämning" : v.kind === "premises" ? "Lokal nr" : "Lgh nr"}>
            <input
              className={inputClass}
              disabled={!editable}
              inputMode={v.kind === "common" ? "text" : "numeric"}
              placeholder={v.kind === "common" ? "t.ex. Källare" : ""}
              value={v.object_number ?? ""}
              onChange={(e) => update({ object_number: e.target.value || null })}
              data-testid="object-number"
            />
          </Field>
          <Field label="Datum">
            <input type="date" className={inputClass} disabled={!editable} value={v.visit_date ?? ""} onChange={(e) => update({ visit_date: e.target.value || null })} />
          </Field>
        </div>
        <div>
          <Label>{project.level1_name}</Label>
          <ChipGroup mono options={level1Options} value={v.level1} onChange={(x) => update({ level1: x })} disabled={!editable} />
          {!v.level1 && <div className="mt-1.5 text-[12.5px] text-warn">Välj {project.level1_name.toLowerCase()}.</div>}
        </div>
        {project.level2_name && (
          <div>
            <Label>{project.level2_name}</Label>
            <ChipGroup mono options={level2Options} value={v.level2} onChange={(x) => update({ level2: x })} disabled={!editable} />
          </div>
        )}
        <div>
          <Label>Våning (tr)</Label>
          <ChipGroup mono options={FLOORS} value={FLOORS.some((f) => f.value === v.floor) ? v.floor : null} onChange={(x) => update({ floor: x })} disabled={!editable} />
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <Field label="Stam / schakt">
            <input className={inputClass} disabled={!editable} value={v.shaft ?? ""} onChange={(e) => update({ shaft: e.target.value || null })} />
          </Field>
          <Field label="Inventerare">
            <input className={inputClass} disabled={!editable} value={v.inspector ?? ""} onChange={(e) => update({ inspector: e.target.value || null })} />
          </Field>
        </div>
      </Collapsible>

      <Collapsible title="Foton" right={generalPhotos} defaultOpen>
        <PhotoSection visit={v} category={null} editable={editable} onCount={setGeneralPhotos} />
      </Collapsible>

      {templates.map((t) => [
        templates.length > 1 && (
          <div key={`h-${t.id}`} className="pt-1 text-xs font-semibold uppercase tracking-[0.08em] text-muted">
            {t.name}
          </div>
        ),
        ...t.sections.map((s, si) => {
          const p = sectionProgress(s, v.answers[t.id]);
          const rKey = ratingKey(t.id, s.id);
          return (
            <Collapsible
              key={`${t.id}:${s.id}`}
              title={s.title}
              defaultOpen={si === 0 && t.id === templates[0]?.id}
              right={
                <>
                  {v.ratings[rKey] && <RatingBadge rating={v.ratings[rKey]} />}
                  <span className={p.answered === p.total ? "text-ok" : ""}>
                    {p.answered}/{p.total}
                  </span>
                </>
              }
            >
              {s.questions.map((q) => (
                <QuestionInput
                  key={q.id}
                  q={q}
                  value={v.answers[t.id]?.[q.id]}
                  disabled={!editable}
                  onChange={(val) => update({ answers: setAnswer(vRef.current.answers, t.id, q.id, val) })}
                />
              ))}
              <div>
                <Label>Bedömning – {s.title}</Label>
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
              <div>
                <Label>Foton – {s.title}</Label>
                <PhotoSection visit={v} category={s.title} editable={editable} />
              </div>
            </Collapsible>
          );
        }),
      ])}

      <Collapsible title="Samlad bedömning" defaultOpen>
        <RatingPicker value={v.overall_rating} disabled={!editable} onChange={(r) => update({ overall_rating: r })} />
        <Field label="Övriga anteckningar">
          <textarea className={inputClass + " min-h-[84px] resize-y"} disabled={!editable} value={v.notes ?? ""} onChange={(e) => update({ notes: e.target.value || null })} />
        </Field>
      </Collapsible>

      {editable && (
        <AiVisitSuggestion
          visit={v}
          templates={templates}
          onApprove={(s) => update({ ratings: { ...vRef.current.ratings, ...s.ratings }, overall_rating: s.overall ?? vRef.current.overall_rating, notes: [vRef.current.notes, s.text].filter(Boolean).join("\n\n") })}
        />
      )}

      <Button className="w-full py-[15px] text-base" onClick={done}>
        Klar – tillbaka till listan
      </Button>

      <div className="flex flex-col gap-1 text-[12.5px] text-muted">
        <span>
          Senast ändrad {new Date(v.updated_at).toLocaleString("sv-SE")}
          {v.updated_by && profiles[v.updated_by] ? ` av ${profiles[v.updated_by]}` : ""}
        </span>
        {!auth.anonymous && <ActivityLog projectId={project.id} rowIds={[v.id]} />}
      </div>

      {editable &&
        (confirmDelete ? (
          <div className="flex gap-2">
            <Button
              variant="danger"
              className="flex-1"
              onClick={async () => {
                await flush();
                await softDelete("visits", v.id, auth.userId);
                router.push(back);
              }}
            >
              Ja, ta bort
            </Button>
            <Button variant="secondary" className="flex-1" onClick={() => setConfirmDelete(false)}>
              Avbryt
            </Button>
          </div>
        ) : (
          <Button variant="danger" className="w-full" onClick={() => setConfirmDelete(true)}>
            Ta bort besöket
          </Button>
        ))}
    </>
  );
}

const FLOORS = ["BV", "1", "2", "3", "4", "5", "6", "7", "8", "9"].map((f) => ({ value: f, label: f }));


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
