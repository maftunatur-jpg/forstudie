// Samlar ihop allt som behövs för rapporten. Bilder skalas ner en i taget
// så att hundratals foton inte tar slut på webbläsarens minne.
import { db } from "../db/db";
import { blobToBytes, resizeImage } from "../image";
import { getPhotoBlob } from "../photos";
import { naturalCompare, ratingDistribution, visitLabel } from "../quality";
import { kindLabel } from "../ratings";
import { readableAnswers, type ReadableSection } from "../templates/engine";
import type { Project, Rating, Template, Visit } from "../types";

export const DISCLAIMER = "Bedömningen bygger på okulär besiktning utan ingrepp.";

export interface ReportImage {
  number: number;
  caption: string;
  bytes: Uint8Array | null; // null = kunde inte hämtas (offline)
  width: number;
  height: number;
}

export interface ReportVisit {
  visit: Visit;
  title: string;
  meta: string;
  sections: ReadableSection[];
  images: ReportImage[];
}

export interface ReportData {
  project: Project;
  summary: string;
  generatedAt: string;
  distribution: ReturnType<typeof ratingDistribution>;
  visits: ReportVisit[];
  missingImages: number;
}

export function visitTitle(project: Project, v: Visit) {
  return [v.level1 && `${project.level1_name} ${v.level1}`, v.level2 && project.level2_name && `${project.level2_name} ${v.level2}`, visitLabel(v)]
    .filter(Boolean)
    .join(" · ");
}

/** Lägenheter/lokaler sorterade efter byggnadsdel → våning → nummer, gemensamma utrymmen sist. */
export function orderVisits(visits: Visit[]) {
  const key = (v: Visit) => [v.level1, v.floor, v.object_number] as const;
  const cmp = (a: Visit, b: Visit) => {
    const ka = key(a);
    const kb = key(b);
    for (let i = 0; i < ka.length; i++) {
      const c = naturalCompare(ka[i], kb[i]);
      if (c) return c;
    }
    return 0;
  };
  return [...visits.filter((v) => v.kind !== "common").sort(cmp), ...visits.filter((v) => v.kind === "common").sort(cmp)];
}

export async function buildReportData(
  project: Project,
  summary: string,
  imageMaxSize: number,
  onProgress?: (done: number, total: number) => void,
): Promise<ReportData> {
  const visits = orderVisits(await db().visits.where("project_id").equals(project.id).filter((v) => !v.deleted_at).toArray());
  const templates = (await db().templates.bulkGet(project.template_ids)).filter((t): t is Template => !!t);
  const allPhotos = await db().photos.where("project_id").equals(project.id).filter((p) => !p.deleted_at).toArray();
  const total = allPhotos.length;
  let done = 0;
  let number = 0;
  let missingImages = 0;

  const out: ReportVisit[] = [];
  for (const v of visits) {
    const photos = allPhotos
      .filter((p) => p.visit_id === v.id)
      .sort((a, b) => naturalCompare(a.category, b.category) || a.sort_order - b.sort_order);
    const images: ReportImage[] = [];
    for (const p of photos) {
      number++;
      const caption = [p.category, p.caption].filter(Boolean).join(": ");
      // Hämta utan att cacha – annars fylls enheten av alla kollegors bilder.
      const blob = await getPhotoBlob(p, false);
      if (blob) {
        const small = await resizeImage(blob, imageMaxSize, 0.72);
        images.push({ number, caption, bytes: await blobToBytes(small.blob), width: small.width, height: small.height });
      } else {
        missingImages++;
        images.push({ number, caption, bytes: null, width: 4, height: 3 });
      }
      onProgress?.(++done, total);
    }
    const meta = [kindLabel(v.kind), v.floor && `våning ${v.floor}`, v.shaft && `stam ${v.shaft}`, v.visit_date, v.inspector && `inventerare ${v.inspector}`]
      .filter(Boolean)
      .join(" · ");
    out.push({ visit: v, title: visitTitle(project, v), meta, sections: readableAnswers(templates, v.answers, v.ratings), images });
  }

  return {
    project,
    summary,
    generatedAt: new Date().toLocaleDateString("sv-SE"),
    distribution: ratingDistribution(visits),
    visits: out,
    missingImages,
  };
}

export function coverRows(p: Project): [string, string][] {
  return (
    [
      ["Projekt", p.name],
      ["Fastighetsbeteckning", p.property_designation],
      ["Adress", p.address],
      ["Beställare", p.client],
      ["Förstudietyp", p.study_type],
      ["Datum", p.study_date],
      ["Ansvarig", p.responsible],
    ] as [string, string | null][]
  ).filter((r): r is [string, string] => !!r[1]);
}

export function ratingOf(v: Visit): Rating {
  return v.overall_rating ?? "not_assessed";
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function reportFilename(p: Project, ext: string) {
  const base = (p.property_designation || p.name || "rapport").replace(/[^\p{L}\p{N}\- ]+/gu, "").trim().replace(/\s+/g, "_");
  return `Forstudie_${base}_${new Date().toISOString().slice(0, 10)}.${ext}`;
}
