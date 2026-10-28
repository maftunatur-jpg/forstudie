import type { Rating, Role, VisitKind } from "./types";

// text = textfärg för konturetiketten, fill = ifylld variant (vald knapp), hex = rapporter.
export const RATINGS: { value: Rating; label: string; text: string; fill: string; hex: string }[] = [
  { value: "good", label: "God", text: "text-ok", fill: "bg-ok border-ok text-on-accent", hex: "#2e7d4f" },
  { value: "acceptable", label: "Acceptabel", text: "text-accent", fill: "bg-accent border-accent text-on-accent", hex: "#1f4e79" },
  { value: "deficient", label: "Brister", text: "text-warn", fill: "bg-warn border-warn text-on-accent", hex: "#b7791f" },
  { value: "urgent", label: "Akut åtgärd", text: "text-bad", fill: "bg-bad border-bad text-on-accent", hex: "#b42318" },
  { value: "not_assessed", label: "Ej bedömt", text: "text-muted", fill: "bg-muted border-muted text-on-accent", hex: "#5b6878" },
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
