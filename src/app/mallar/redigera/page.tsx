"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { useAuth } from "@/components/AuthProvider";
import { NotFound, WithId } from "@/components/WithId";
import { QuestionInput } from "@/components/QuestionInput";
import { Alert, Button, Card, Collapsible, Field, PageHeader, inputClass } from "@/components/ui";
import { db } from "@/lib/db/db";
import { saveTemplate, softDelete } from "@/lib/repo";
import { newQuestionId, validateTemplate } from "@/lib/templates/engine";
import type { Question, QuestionType, Section, Template } from "@/lib/types";

const TYPES: { value: QuestionType; label: string }[] = [
  { value: "single", label: "Ett val" },
  { value: "multi", label: "Flera val" },
  { value: "yesno", label: "Ja/Nej" },
  { value: "number", label: "Tal" },
  { value: "text", label: "Fritext" },
];

function move<T>(list: T[], i: number, d: number) {
  const j = i + d;
  if (j < 0 || j >= list.length) return list;
  const c = [...list];
  [c[i], c[j]] = [c[j], c[i]];
  return c;
}

function QuestionEditor({ q, onChange, onRemove, onMove }: { q: Question; onChange: (q: Question) => void; onRemove: () => void; onMove: (d: number) => void }) {
  return (
    <div className="space-y-2 rounded-xl border border-slate-200 p-3">
      <Field label="Fråga">
        <input className={inputClass} value={q.label} onChange={(e) => onChange({ ...q, label: e.target.value })} />
      </Field>
      <Field label="Typ">
        <select className={inputClass} value={q.type} onChange={(e) => onChange({ ...q, type: e.target.value as QuestionType })}>
          {TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </Field>
      {(q.type === "single" || q.type === "multi") && (
        <Field label="Alternativ (ett per rad)">
          <textarea
            className={inputClass + " min-h-24"}
            value={(q.options ?? []).join("\n")}
            onChange={(e) => onChange({ ...q, options: e.target.value.split("\n") })}
          />
        </Field>
      )}
      {q.type === "number" && (
        <Field label="Enhet">
          <input className={inputClass} value={q.unit ?? ""} onChange={(e) => onChange({ ...q, unit: e.target.value || undefined })} />
        </Field>
      )}
      <Field label="Hjälptext">
        <input className={inputClass} value={q.help ?? ""} onChange={(e) => onChange({ ...q, help: e.target.value || undefined })} />
      </Field>
      <Field label="Varning">
        <input className={inputClass} value={q.warning ?? ""} onChange={(e) => onChange({ ...q, warning: e.target.value || undefined })} placeholder="T.ex. Rör inte – notera plats" />
      </Field>
      <div className="flex gap-2">
        <Button variant="ghost" onClick={() => onMove(-1)} aria-label="Flytta upp">↑</Button>
        <Button variant="ghost" onClick={() => onMove(1)} aria-label="Flytta ned">↓</Button>
        <span className="flex-1" />
        <Button variant="danger" onClick={onRemove}>Ta bort fråga</Button>
      </div>
    </div>
  );
}

function Editor({ initial }: { initial: Template }) {
  const auth = useAuth();
  const router = useRouter();
  const [t, setT] = useState(initial);
  const [errors, setErrors] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  const readOnly = initial.org_id === null;

  const setSection = (i: number, s: Section) => setT({ ...t, sections: t.sections.map((x, j) => (j === i ? s : x)) });

  async function save() {
    const cleaned: Template = {
      ...t,
      sections: t.sections.map((s) => ({
        ...s,
        questions: s.questions.map((q) => ({ ...q, options: q.type === "single" || q.type === "multi" ? (q.options ?? []).map((o) => o.trim()).filter(Boolean) : undefined })),
      })),
    };
    const errs = validateTemplate(cleaned);
    setErrors(errs);
    if (errs.length) return;
    await saveTemplate(cleaned, auth.userId);
    setT(cleaned);
    setSaved(true);
  }

  if (readOnly) {
    return (
      <div className="space-y-3">
        <PageHeader title={t.name} back="/mallar" />
        <Alert>Standardmall – kopiera den under Mallar för att redigera.</Alert>
        {t.sections.map((s) => (
          <Collapsible key={s.id} title={s.title}>
            {s.questions.map((q) => (
              <QuestionInput key={q.id} q={q} value={undefined} onChange={() => {}} disabled />
            ))}
          </Collapsible>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Redigera mall" back="/mallar" />
      <Card className="space-y-3">
        <Field label="Namn">
          <input className={inputClass} value={t.name} onChange={(e) => setT({ ...t, name: e.target.value })} />
        </Field>
        <Field label="Beskrivning">
          <input className={inputClass} value={t.description ?? ""} onChange={(e) => setT({ ...t, description: e.target.value || null })} />
        </Field>
      </Card>

      {t.sections.map((s, si) => (
        <Collapsible key={s.id} title={s.title || "Namnlös sektion"} right={<span className="text-sm text-slate-500">{s.questions.length} frågor</span>}>
          <div className="space-y-3">
            <Field label="Sektionsrubrik">
              <input className={inputClass} value={s.title} onChange={(e) => setSection(si, { ...s, title: e.target.value })} />
            </Field>
            {s.questions.map((q, qi) => (
              <QuestionEditor
                key={q.id}
                q={q}
                onChange={(nq) => setSection(si, { ...s, questions: s.questions.map((x, j) => (j === qi ? nq : x)) })}
                onRemove={() => setSection(si, { ...s, questions: s.questions.filter((_, j) => j !== qi) })}
                onMove={(d) => setSection(si, { ...s, questions: move(s.questions, qi, d) })}
              />
            ))}
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => setSection(si, { ...s, questions: [...s.questions, { id: newQuestionId(s), label: "", type: "single", options: ["", ""] }] })}>
                + Fråga
              </Button>
              <Button variant="ghost" onClick={() => setT({ ...t, sections: move(t.sections, si, -1) })}>↑ Sektion</Button>
              <Button variant="ghost" onClick={() => setT({ ...t, sections: move(t.sections, si, 1) })}>↓ Sektion</Button>
              <Button variant="danger" onClick={() => confirm("Ta bort sektionen?") && setT({ ...t, sections: t.sections.filter((_, j) => j !== si) })}>
                Ta bort sektion
              </Button>
            </div>
          </div>
        </Collapsible>
      ))}
      <Button
        variant="secondary"
        className="w-full"
        onClick={() => {
          let n = t.sections.length + 1;
          while (t.sections.some((s) => s.id === `s${n}`)) n++;
          setT({ ...t, sections: [...t.sections, { id: `s${n}`, title: `Sektion ${n}`, questions: [] }] });
        }}
      >
        + Sektion
      </Button>

      {errors.length > 0 && (
        <Alert kind="error">
          <ul className="list-disc pl-5">
            {errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </Alert>
      )}
      {saved && !errors.length && <Alert>Mallen är sparad. Befintliga svar behålls för frågor med samma id.</Alert>}
      <div className="flex gap-2">
        <Button className="flex-1" onClick={save}>
          Spara mall
        </Button>
        <Button
          variant="danger"
          onClick={async () => {
            if (!confirm("Ta bort mallen? Projekt som använder den visar inte längre dess frågor.")) return;
            await softDelete("templates", t.id, auth.userId);
            router.push("/mallar");
          }}
        >
          Ta bort
        </Button>
      </div>
    </div>
  );
}

function Page_({ id }: { id: string }) {
  const t = useLiveQuery(async () => (await db().templates.get(id)) ?? null, [id]);
  if (t === undefined) return null;
  if (!t || t.deleted_at) return <NotFound what="Mallen" />;
  return <Editor key={t.id} initial={t} />;
}

export default function Page() {
  return <WithId render={(id) => <Page_ id={id} />} />;
}
