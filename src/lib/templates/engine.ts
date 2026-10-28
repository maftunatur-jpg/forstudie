import type { AnswerValue, Answers, Question, Rating, Ratings, Section, Template } from "../types";

/** Är frågan besvarad? Tomma strängar, tomma listor och null räknas som obesvarade. */
export function isAnswered(q: Question, v: AnswerValue | undefined): boolean {
  if (v === null || v === undefined) return false;
  switch (q.type) {
    case "multi":
      return Array.isArray(v) && v.length > 0;
    case "single":
    case "text":
      return typeof v === "string" && v.trim().length > 0;
    case "number":
      return typeof v === "number" ? Number.isFinite(v) : typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v));
    case "yesno":
      return typeof v === "boolean";
  }
}

export function sectionProgress(section: Section, values: Record<string, AnswerValue> | undefined) {
  const total = section.questions.length;
  const answered = section.questions.filter((q) => isAnswered(q, values?.[q.id])).length;
  return { answered, total };
}

export function templateProgress(t: Template, answers: Answers) {
  let answered = 0;
  let total = 0;
  for (const s of t.sections) {
    const p = sectionProgress(s, answers[t.id]);
    answered += p.answered;
    total += p.total;
  }
  return { answered, total };
}

/** Läsbar text för ett svar, eller null om obesvarat. */
export function formatAnswer(q: Question, v: AnswerValue | undefined): string | null {
  if (!isAnswered(q, v)) return null;
  switch (q.type) {
    case "multi":
      return (v as string[]).join(", ");
    case "yesno":
      return v ? "Ja" : "Nej";
    case "number":
      return `${Number(v).toLocaleString("sv-SE")}${q.unit ? " " + q.unit : ""}`;
    default:
      return String(v).trim();
  }
}

export function ratingKey(templateId: string, sectionId: string) {
  return `${templateId}:${sectionId}`;
}

export interface ReadableSection {
  templateName: string;
  sectionTitle: string;
  rating: Rating | null;
  items: { label: string; text: string }[];
}

/** Bara ifyllda svar och satta bedömningar, i mallens ordning. */
export function readableAnswers(templates: Template[], answers: Answers, ratings: Ratings): ReadableSection[] {
  const out: ReadableSection[] = [];
  for (const t of templates) {
    for (const s of t.sections) {
      const items: { label: string; text: string }[] = [];
      for (const q of s.questions) {
        const text = formatAnswer(q, answers[t.id]?.[q.id]);
        if (text !== null) items.push({ label: q.label, text });
      }
      const rating = ratings[ratingKey(t.id, s.id)] ?? null;
      if (items.length || rating) out.push({ templateName: t.name, sectionTitle: s.title, rating, items });
    }
  }
  return out;
}

/** Uppdaterar ett svar oföränderligt. */
export function setAnswer(answers: Answers, templateId: string, questionId: string, value: AnswerValue): Answers {
  return { ...answers, [templateId]: { ...(answers[templateId] ?? {}), [questionId]: value } };
}

export function toggleMulti(current: AnswerValue | undefined, option: string): string[] {
  const list = Array.isArray(current) ? current : [];
  return list.includes(option) ? list.filter((o) => o !== option) : [...list, option];
}

/** Kontrollerar att en mall är giltig innan den sparas. Returnerar felmeddelanden. */
export function validateTemplate(t: Pick<Template, "name" | "sections">): string[] {
  const errors: string[] = [];
  if (!t.name.trim()) errors.push("Mallen saknar namn.");
  if (!t.sections.length) errors.push("Mallen behöver minst en sektion.");
  const sectionIds = new Set<string>();
  for (const s of t.sections) {
    if (!s.title.trim()) errors.push("En sektion saknar rubrik.");
    if (sectionIds.has(s.id)) errors.push(`Sektions-id "${s.id}" finns flera gånger.`);
    sectionIds.add(s.id);
    const qIds = new Set<string>();
    for (const q of s.questions) {
      if (!q.label.trim()) errors.push(`En fråga i "${s.title}" saknar text.`);
      if (qIds.has(q.id)) errors.push(`Fråge-id "${q.id}" finns flera gånger i "${s.title}".`);
      qIds.add(q.id);
      if ((q.type === "multi" || q.type === "single") && !(q.options && q.options.filter((o) => o.trim()).length >= 2)) {
        errors.push(`Frågan "${q.label || q.id}" behöver minst två alternativ.`);
      }
    }
  }
  return errors;
}

/** Skapar en redigerbar kopia av en mall (t.ex. en global mall till den egna organisationen). */
export function copyTemplate(t: Template, newId: string, orgId: string, now: string): Template {
  return {
    ...structuredClone(t),
    id: newId,
    org_id: orgId,
    name: `${t.name} (kopia)`,
    based_on: t.id,
    updated_at: now,
    deleted_at: null,
  };
}

export function newQuestionId(section: Section): string {
  let i = section.questions.length + 1;
  while (section.questions.some((q) => q.id === `q${i}`)) i++;
  return `q${i}`;
}
