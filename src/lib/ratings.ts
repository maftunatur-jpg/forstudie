import type { Rating, Role, VisitKind } from "./types";

export const RATINGS: { value: Rating; label: string; className: string; hex: string }[] = [
  { value: "good", label: "God", className: "bg-green-100 text-green-900 border-green-300", hex: "#2e7d32" },
  { value: "acceptable", label: "Acceptabel", className: "bg-lime-100 text-lime-900 border-lime-300", hex: "#9e9d24" },
  { value: "deficient", label: "Brister", className: "bg-amber-100 text-amber-900 border-amber-300", hex: "#ef6c00" },
  { value: "urgent", label: "Akut åtgärd", className: "bg-red-100 text-red-900 border-red-300", hex: "#c62828" },
  { value: "not_assessed", label: "Ej bedömt", className: "bg-slate-100 text-slate-700 border-slate-300", hex: "#757575" },
];

export function ratingInfo(r: Rating | null | undefined) {
  return RATINGS.find((x) => x.value === r) ?? RATINGS[4];
}

export const KINDS: { value: VisitKind; label: string }[] = [
  { value: "apartment", label: "Lägenhet" },
  { value: "premises", label: "Lokal" },
  { value: "common", label: "Gemensamt utrymme" },
];

export function kindLabel(k: VisitKind) {
  return KINDS.find((x) => x.value === k)?.label ?? k;
}

export const ROLE_LABELS: Record<Role, string> = {
  owner: "Ägare",
  editor: "Redigerare",
  viewer: "Läsare",
};

export const STUDY_TYPES = ["Stambyte", "Fönster", "Fasad", "Tak", "Ventilation", "Badrum", "Annat"];
