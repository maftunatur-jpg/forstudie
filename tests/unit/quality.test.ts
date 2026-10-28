import { describe, expect, it } from "vitest";
import { parseLevelValues } from "@/lib/levels";
import { checkQuality, groupVisits, ratingDistribution } from "@/lib/quality";
import { orderVisits } from "@/lib/report/data";
import type { Visit } from "@/lib/types";

const v = (id: string, p: Partial<Visit>): Visit => ({
  id, project_id: "p", level1: "A", level2: null, kind: "apartment", object_number: null, floor: null, shaft: null,
  visit_date: null, inspector: null, answers: {}, ratings: {}, overall_rating: null, notes: null,
  created_by: null, updated_by: null, created_at: "", updated_at: "", deleted_at: null, ...p,
});

describe("byggnadsnivåer", () => {
  it("tolkar intervall och listor", () => {
    expect(parseLevelValues("A-E")).toEqual(["A", "B", "C", "D", "E"]);
    expect(parseLevelValues("1–3, Gård")).toEqual(["1", "2", "3", "Gård"]);
    expect(parseLevelValues("A, A, B")).toEqual(["A", "B"]);
    expect(parseLevelValues("")).toEqual([]);
  });
});

describe("översikt och kvalitetskontroll", () => {
  const visits = [
    v("1", { level1: "B", floor: "2", object_number: "10", overall_rating: "good" }),
    v("2", { level1: "A", floor: "10", object_number: "2" }),
    v("3", { level1: "A", floor: "2", object_number: "11", overall_rating: "urgent" }),
    v("4", { level1: "A", floor: "2", object_number: "11" }),
    v("5", { level1: null, object_number: "9" }),
    v("6", { kind: "common", object_number: "Källare", floor: "-1" }),
  ];

  it("grupperar per byggnadsdel → våning med naturlig sortering", () => {
    const g = groupVisits(visits);
    expect(g.map((x) => x.level1)).toEqual(["A", "B", "Utan byggnadsdel"]);
    expect(g[0].floors.map((f) => f.floor)).toEqual(["-1", "2", "10"]);
  });

  it("varnar för saknad byggnadsdel, saknade foton och dubbla nummer", () => {
    const q = checkQuality(visits, { "1": 2, "3": 1 });
    expect(q.missingLevel.map((x) => x.id)).toEqual(["5"]);
    expect(q.missingPhotos.map((x) => x.id)).toEqual(["2", "4", "5", "6"]);
    expect(q.duplicates.map((g) => g.map((x) => x.id))).toEqual([["3", "4"]]);
  });

  it("räknar fördelning där obedömda blir Ej bedömt", () => {
    const d = ratingDistribution(visits);
    expect(d.find((x) => x.value === "not_assessed")!.count).toBe(4);
    expect(d.find((x) => x.value === "urgent")!.count).toBe(1);
  });

  it("lägger gemensamma utrymmen sist i rapporten", () => {
    const ids = orderVisits(visits).map((x) => x.id);
    expect(ids.at(-1)).toBe("6");
  });
});
