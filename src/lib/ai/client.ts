// Klientsidan för AI-förslag: bygger underlaget och anropar serverroutes.
import { db } from "../db/db";
import { blobToBase64, resizeImage } from "../image";
import { getPhotoBlob } from "../photos";
import { kindLabel, ratingInfo } from "../ratings";
import { supabase } from "../supabase/client";
import { ratingKey, readableAnswers } from "../templates/engine";
import type { Project, Rating, Template, Visit } from "../types";

export interface VisitSuggestion {
  text: string;
  ratings: Record<string, Rating>;
  overall: Rating | null;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const { data } = await supabase().auth.getSession();
  const res = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${data.session?.access_token ?? ""}` },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? `Fel ${res.status}`);
  return json as T;
}

export function describeVisit(v: Visit, templates: Template[], level1Name = "Byggnadsdel") {
  const lines = [
    `${level1Name}: ${v.level1 ?? "–"}, typ: ${kindLabel(v.kind)}, nummer: ${v.object_number ?? "–"}, våning: ${v.floor ?? "–"}, stam: ${v.shaft ?? "–"}`,
  ];
  for (const s of readableAnswers(templates, v.answers, v.ratings)) {
    lines.push(`\n## ${s.templateName} – ${s.sectionTitle}${s.rating ? ` (bedömd: ${ratingInfo(s.rating).label})` : ""}`);
    for (const i of s.items) lines.push(`- ${i.label}: ${i.text}`);
  }
  if (v.overall_rating) lines.push(`\nSamlad bedömning: ${ratingInfo(v.overall_rating).label}`);
  if (v.notes) lines.push(`\nAnteckningar: ${v.notes}`);
  return lines.join("\n");
}

export async function suggestForVisit(v: Visit, templates: Template[]): Promise<VisitSuggestion> {
  const categories = templates.flatMap((t) => t.sections.map((s) => ({ key: ratingKey(t.id, s.id), title: `${t.name} – ${s.title}` })));
  const photos = (await db().photos.where("visit_id").equals(v.id).filter((p) => !p.deleted_at).sortBy("sort_order")).slice(0, 6);
  const images: string[] = [];
  for (const p of photos) {
    const blob = await getPhotoBlob(p);
    if (!blob) continue;
    const small = await resizeImage(blob, 800, 0.7);
    images.push(await blobToBase64(small.blob));
  }
  const res = await post<{ text: string; ratings: { key: string; rating: Rating }[]; overall: Rating }>("/api/ai/visit", {
    description: describeVisit(v, templates),
    categories,
    images,
  });
  return { text: res.text, ratings: Object.fromEntries(res.ratings.map((r) => [r.key, r.rating])), overall: res.overall };
}

export async function suggestSummary(project: Project, visits: Visit[], templates: Template[]) {
  const parts = [
    `Projekt: ${project.name}. Förstudietyp: ${project.study_type ?? "–"}. Antal besök: ${visits.length}.`,
    ...visits.map((v, i) => `\n### Besök ${i + 1}\n${describeVisit(v, templates, project.level1_name)}`),
  ];
  const res = await post<{ summary: string }>("/api/ai/summary", { description: parts.join("\n").slice(0, 190_000) });
  return res.summary;
}
