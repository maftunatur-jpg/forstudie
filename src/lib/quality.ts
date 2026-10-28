import type { Rating, Visit } from "./types";
import { RATINGS } from "./ratings";

const collator = new Intl.Collator("sv", { numeric: true, sensitivity: "base" });
export const naturalCompare = (a: string | null, b: string | null) => collator.compare(a ?? "", b ?? "");

export function visitLabel(v: Visit) {
  return v.object_number || (v.kind === "common" ? "Gemensamt utrymme" : "Utan nummer");
}

export interface VisitGroup {
  level1: string;
  floors: { floor: string; visits: Visit[] }[];
}

/** Grupperar besök per byggnadsdel → våning → nummer (naturlig sortering). */
export function groupVisits(visits: Visit[]): VisitGroup[] {
  const by1 = new Map<string, Map<string, Visit[]>>();
  for (const v of visits) {
    const l1 = v.level1 ?? "Utan byggnadsdel";
    const fl = v.floor ?? "Okänd våning";
    if (!by1.has(l1)) by1.set(l1, new Map());
    const m = by1.get(l1)!;
    if (!m.has(fl)) m.set(fl, []);
    m.get(fl)!.push(v);
  }
  return [...by1.entries()]
    .sort(([a], [b]) => naturalCompare(a, b))
    .map(([level1, floors]) => ({
      level1,
      floors: [...floors.entries()]
        .sort(([a], [b]) => naturalCompare(a, b))
        .map(([floor, vs]) => ({ floor, visits: vs.sort((a, b) => naturalCompare(a.object_number, b.object_number)) })),
    }));
}

export function ratingDistribution(visits: Visit[]) {
  const counts = Object.fromEntries(RATINGS.map((r) => [r.value, 0])) as Record<Rating, number>;
  for (const v of visits) counts[v.overall_rating ?? "not_assessed"]++;
  return RATINGS.map((r) => ({ ...r, count: counts[r.value], share: visits.length ? counts[r.value] / visits.length : 0 }));
}

export interface QualityReport {
  missingLevel: Visit[];
  missingPhotos: Visit[];
  duplicates: Visit[][];
  missingRating: Visit[];
}

/** Kontroller före export. */
export function checkQuality(visits: Visit[], photoCount: Record<string, number>): QualityReport {
  const missingLevel = visits.filter((v) => !v.level1);
  const missingPhotos = visits.filter((v) => !photoCount[v.id]);
  const missingRating = visits.filter((v) => !v.overall_rating);
  const byKey = new Map<string, Visit[]>();
  for (const v of visits) {
    if (!v.object_number) continue;
    const key = `${v.level1 ?? ""}|${v.level2 ?? ""}|${v.kind}|${v.object_number.trim().toLowerCase()}`;
    byKey.set(key, [...(byKey.get(key) ?? []), v]);
  }
  const duplicates = [...byKey.values()].filter((g) => g.length > 1);
  return { missingLevel, missingPhotos, duplicates, missingRating };
}

export function qualityIssueCount(q: QualityReport) {
  return q.missingLevel.length + q.missingPhotos.length + q.duplicates.length;
}
