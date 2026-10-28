import { describe, expect, it } from "vitest";
import {
  copyTemplate,
  formatAnswer,
  isAnswered,
  ratingKey,
  readableAnswers,
  sectionProgress,
  setAnswer,
  templateProgress,
  toggleMulti,
  validateTemplate,
} from "@/lib/templates/engine";
import { SEED_TEMPLATES, TEMPLATE_IDS } from "@/lib/templates/seed";
import type { Question, Template } from "@/lib/types";

const q = (type: Question["type"], extra: Partial<Question> = {}): Question => ({ id: "x", label: "X", type, ...extra });

describe("isAnswered", () => {
  it("hanterar alla frågetyper", () => {
    expect(isAnswered(q("multi"), [])).toBe(false);
    expect(isAnswered(q("multi"), ["a"])).toBe(true);
    expect(isAnswered(q("single"), "  ")).toBe(false);
    expect(isAnswered(q("single"), "Ja")).toBe(true);
    expect(isAnswered(q("text"), "")).toBe(false);
    expect(isAnswered(q("number"), 0)).toBe(true);
    expect(isAnswered(q("number"), Number.NaN)).toBe(false);
    expect(isAnswered(q("yesno"), false)).toBe(true);
    expect(isAnswered(q("yesno"), null)).toBe(false);
    expect(isAnswered(q("yesno"), undefined)).toBe(false);
  });
});

describe("formatAnswer", () => {
  it("ger läsbar text", () => {
    expect(formatAnswer(q("multi"), ["Rost", "Läckage"])).toBe("Rost, Läckage");
    expect(formatAnswer(q("yesno"), true)).toBe("Ja");
    expect(formatAnswer(q("yesno"), false)).toBe("Nej");
    expect(formatAnswer(q("number", { unit: "st" }), 12)).toBe("12 st");
    expect(formatAnswer(q("text"), "")).toBeNull();
  });
});

describe("progress och läsbara svar", () => {
  const t = SEED_TEMPLATES.find((x) => x.id === TEMPLATE_IDS.stambyte)!;
  const kok = t.sections.find((s) => s.id === "kok")!;

  it("räknar besvarade frågor per sektion", () => {
    let answers = setAnswer({}, t.id, "diskbank_avlopp", "Plast");
    answers = setAnswer(answers, t.id, "avstangningsventiler", false);
    answers = setAnswer(answers, t.id, "ovrigt", "");
    expect(sectionProgress(kok, answers[t.id])).toEqual({ answered: 2, total: kok.questions.length });
    expect(templateProgress(t, answers).answered).toBe(2);
  });

  it("tar bara med ifyllda svar och satta bedömningar", () => {
    const answers = setAnswer({}, t.id, "diskbank_avlopp", "Plast");
    const out = readableAnswers([t], answers, { [ratingKey(t.id, "schakt")]: "deficient" });
    expect(out.map((s) => s.sectionTitle)).toEqual(["Kök", "Schakt/stam"]);
    expect(out[0].items).toEqual([{ label: "Diskbänksavlopp", text: "Plast" }]);
    expect(out[1].items).toEqual([]);
    expect(out[1].rating).toBe("deficient");
  });

  it("toggleMulti lägger till och tar bort", () => {
    expect(toggleMulti(undefined, "a")).toEqual(["a"]);
    expect(toggleMulti(["a", "b"], "a")).toEqual(["b"]);
  });
});

describe("mallar", () => {
  it("alla seedade mallar är giltiga", () => {
    for (const t of SEED_TEMPLATES) expect(validateTemplate(t)).toEqual([]);
  });

  it("miljömallen varnar för att röra misstänkt material", () => {
    const miljo = SEED_TEMPLATES.find((x) => x.id === TEMPLATE_IDS.miljo)!;
    const warnings = miljo.sections.flatMap((s) => s.questions).filter((x) => x.warning === "Rör inte – notera plats");
    expect(warnings.length).toBeGreaterThanOrEqual(miljo.sections.length * 2);
  });

  it("hittar fel i en ogiltig mall", () => {
    const bad: Pick<Template, "name" | "sections"> = {
      name: " ",
      sections: [
        { id: "a", title: "A", questions: [q("single", { id: "1", options: ["bara ett"] }), q("text", { id: "1", label: "" })] },
        { id: "a", title: "", questions: [] },
      ],
    };
    const errors = validateTemplate(bad);
    expect(errors).toContain("Mallen saknar namn.");
    expect(errors.some((e) => e.includes("minst två alternativ"))).toBe(true);
    expect(errors.some((e) => e.includes('Fråge-id "1"'))).toBe(true);
    expect(errors.some((e) => e.includes('Sektions-id "a"'))).toBe(true);
  });

  it("copyTemplate skapar en fristående kopia i organisationen", () => {
    const src = SEED_TEMPLATES[0];
    const c = copyTemplate(src, "new-id", "org-1", "2026-01-02T00:00:00Z");
    expect(c).toMatchObject({ id: "new-id", org_id: "org-1", based_on: src.id });
    c.sections[0].questions[0].label = "Ändrad";
    expect(src.sections[0].questions[0].label).not.toBe("Ändrad");
  });
});
