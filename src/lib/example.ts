// Påhittat exempelprojekt. Inga riktiga adresser eller personer.
import { emptyProject, emptyVisit, saveProject, saveVisit } from "./repo";
import { TEMPLATE_IDS } from "./templates/seed";
import { ratingKey } from "./templates/engine";
import type { Visit } from "./types";

export async function createExampleProject(orgId: string, userId: string | null) {
  const p = {
    ...emptyProject(orgId, userId),
    name: "Exempelfastigheten 1:1 – stambyte",
    property_designation: "Exempelfastigheten 1:1",
    address: "Exempelgatan 1, 123 45 Exempelstad",
    client: "Brf Exempel",
    study_type: "Stambyte",
    responsible: "Projektledare Exempel",
    level1_name: "Hus",
    level1_values: ["A", "B", "C"],
    level2_name: "Trapphus",
    level2_values: ["1", "2"],
    template_ids: [TEMPLATE_IDS.stambyte, TEMPLATE_IDS.miljo, TEMPLATE_IDS.boende],
    summary: "Exempelprojekt för att prova appen. Fastigheten är påhittad.",
  };
  await saveProject(p, userId);

  const S = TEMPLATE_IDS.stambyte;
  const visits: Partial<Visit>[] = [
    {
      level1: "A", level2: "1", object_number: "1001", floor: "1", shaft: "S1",
      answers: { [S]: { renovering_ar: 1998, vatrumsintyg: "Nej", golv: "Plastmatta", golv_skick: "Brister", golvbrunn: "Gjutjärn", skador: ["Fuktfläckar"], inspektionslucka: false } },
      ratings: { [ratingKey(S, "badrum")]: "deficient", [ratingKey(S, "kok")]: "acceptable" },
      overall_rating: "deficient",
      notes: "Fuktfläck vid golvbrunn. Plastmattan släpper i skarv.",
    },
    {
      level1: "A", level2: "1", object_number: "1002", floor: "1", shaft: "S1",
      answers: { [S]: { renovering_ar: 2015, vatrumsintyg: "Ja", golv: "Klinker", golv_skick: "God", golvbrunn: "Plast", skador: ["Inga"] } },
      ratings: { [ratingKey(S, "badrum")]: "good", [ratingKey(S, "kok")]: "good" },
      overall_rating: "good",
    },
    {
      level1: "B", level2: "2", object_number: "1201", floor: "2", shaft: "S4",
      answers: { [S]: { renovering_ar: 1972, vatrumsintyg: "Okänt", golvbrunn: "Gjutjärn", synliga_ror: ["Gjutjärn", "Galvaniserade rör"], skador: ["Läckage", "Rost"] } },
      ratings: { [ratingKey(S, "badrum")]: "urgent", [ratingKey(S, "schakt")]: "deficient" },
      overall_rating: "urgent",
      notes: "Aktivt läckage under tvättställ. Boende informerad.",
    },
    {
      level1: "A", kind: "common", object_number: "Källare", floor: "-1",
      answers: { [S]: {} },
      ratings: { [ratingKey(S, "kallare")]: "deficient" },
      overall_rating: "deficient",
      notes: "Rostangrepp på grundledning vid tvättstuga.",
    },
  ];
  for (const v of visits) {
    await saveVisit({ ...emptyVisit(p, userId, "Inventerare Exempel"), ...v }, userId);
  }
  return p.id;
}
