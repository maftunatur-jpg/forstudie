"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db/db";
import { saveProject, softDelete } from "@/lib/repo";
import { formatLevelValues, parseLevelValues } from "@/lib/levels";
import { STUDY_TYPES } from "@/lib/ratings";
import type { Project } from "@/lib/types";
import { useAuth } from "./AuthProvider";
import { Alert, Button, Card, Chip, Field, inputClass } from "./ui";

export function ProjectForm({ initial, isNew, isOwner }: { initial: Project; isNew: boolean; isOwner: boolean }) {
  const auth = useAuth();
  const router = useRouter();
  const [p, setP] = useState<Project>(initial);
  const [level1Text, setLevel1Text] = useState(formatLevelValues(initial.level1_values));
  const [level2Text, setLevel2Text] = useState(formatLevelValues(initial.level2_values));
  const [useLevel2, setUseLevel2] = useState(!!initial.level2_name);
  const [error, setError] = useState<string | null>(null);
  const templates = useLiveQuery(() => db().templates.filter((t) => !t.deleted_at && (t.org_id === null || t.org_id === p.org_id)).toArray(), [p.org_id]);

  const set = <K extends keyof Project>(k: K, v: Project[K]) => setP((prev) => ({ ...prev, [k]: v }));
  const text = (k: keyof Project) => ({
    value: (p[k] as string | null) ?? "",
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => set(k, (e.target.value || null) as never),
    className: inputClass,
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const level1 = parseLevelValues(level1Text);
    const level2 = useLevel2 ? parseLevelValues(level2Text) : [];
    if (!p.name.trim()) return setError("Ange ett projektnamn.");
    if (!p.level1_name.trim() || !level1.length) return setError("Ange namn och värden för byggnadsnivå 1.");
    if (useLevel2 && (!p.level2_name?.trim() || !level2.length)) return setError("Ange namn och värden för byggnadsnivå 2, eller ta bort den.");
    if (!p.template_ids.length) return setError("Välj minst en checklistmall.");
    await saveProject(
      { ...p, level1_values: level1, level2_values: level2, level2_name: useLevel2 ? p.level2_name : null },
      auth.userId,
    );
    router.push(`/projekt?id=${p.id}`);
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Card className="space-y-4">
        <Field label="Projektnamn *">
          <input {...text("name")} value={p.name} onChange={(e) => set("name", e.target.value)} required />
        </Field>
        <Field label="Fastighetsbeteckning">
          <input {...text("property_designation")} />
        </Field>
        <Field label="Adress">
          <input {...text("address")} />
        </Field>
        <Field label="Beställare">
          <input {...text("client")} />
        </Field>
        <div>
          <span className="mb-1 block text-sm font-medium text-slate-700">Förstudietyp</span>
          <div className="flex flex-wrap gap-2">
            {STUDY_TYPES.map((t) => (
              <Chip key={t} selected={p.study_type === t} onClick={() => set("study_type", p.study_type === t ? null : t)}>
                {t}
              </Chip>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Datum">
            <input type="date" {...text("study_date")} />
          </Field>
          <Field label="Ansvarig">
            <input {...text("responsible")} />
          </Field>
        </div>
      </Card>

      <Card className="space-y-4">
        <h2 className="font-semibold">Byggnadsnivåer</h2>
        <p className="text-sm text-slate-600">T.ex. &quot;Lamell&quot; med A–M, eller &quot;Hus&quot; med 1–5. Intervall och kommatecken fungerar.</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Nivå 1 – namn *">
            <input className={inputClass} value={p.level1_name} onChange={(e) => set("level1_name", e.target.value)} />
          </Field>
          <Field label="Nivå 1 – värden *" hint={`Blir: ${parseLevelValues(level1Text).join(", ") || "–"}`}>
            <input className={inputClass} value={level1Text} onChange={(e) => setLevel1Text(e.target.value)} placeholder="A-M" />
          </Field>
        </div>
        {useLevel2 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Nivå 2 – namn">
              <input className={inputClass} value={p.level2_name ?? ""} onChange={(e) => set("level2_name", e.target.value)} placeholder="Trapphus" />
            </Field>
            <Field label="Nivå 2 – värden" hint={`Blir: ${parseLevelValues(level2Text).join(", ") || "–"}`}>
              <input className={inputClass} value={level2Text} onChange={(e) => setLevel2Text(e.target.value)} placeholder="1-3" />
            </Field>
            <Button variant="ghost" onClick={() => setUseLevel2(false)}>
              Ta bort nivå 2
            </Button>
          </div>
        ) : (
          <Button variant="secondary" onClick={() => setUseLevel2(true)}>
            + Lägg till nivå 2
          </Button>
        )}
      </Card>

      <Card className="space-y-3">
        <h2 className="font-semibold">Checklistmallar *</h2>
        {(templates ?? []).map((t) => {
          const checked = p.template_ids.includes(t.id);
          return (
            <label key={t.id} className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-slate-200 px-3 py-2">
              <input
                type="checkbox"
                className="h-5 w-5"
                checked={checked}
                onChange={() => set("template_ids", checked ? p.template_ids.filter((x) => x !== t.id) : [...p.template_ids, t.id])}
              />
              <span>
                <span className="block font-medium">{t.name}</span>
                {t.description && <span className="block text-sm text-slate-500">{t.description}</span>}
              </span>
            </label>
          );
        })}
      </Card>

      {error && <Alert kind="error">{error}</Alert>}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" className="flex-1">
          {isNew ? "Skapa projekt" : "Spara"}
        </Button>
        {!isNew && isOwner && (
          <Button
            variant="danger"
            onClick={async () => {
              if (!confirm("Ta bort projektet? Besöken döljs för alla.")) return;
              await softDelete("projects", p.id, auth.userId);
              router.push("/");
            }}
          >
            Ta bort
          </Button>
        )}
      </div>
    </form>
  );
}
