// Globala standardmallar. Används både för databas-seeden (scripts/gen-seed.ts)
// och som reserv i appen om den startar offline innan mallarna hämtats.
import type { Question, Section, Template } from "../types";

const SKICK = ["God", "Acceptabel", "Brister", "Ej synligt"];
const yesno = (id: string, label: string, extra: Partial<Question> = {}): Question => ({ id, label, type: "yesno", ...extra });
const single = (id: string, label: string, options: string[], extra: Partial<Question> = {}): Question => ({ id, label, type: "single", options, ...extra });
const multi = (id: string, label: string, options: string[], extra: Partial<Question> = {}): Question => ({ id, label, type: "multi", options, ...extra });
const text = (id: string, label: string, extra: Partial<Question> = {}): Question => ({ id, label, type: "text", ...extra });
const num = (id: string, label: string, extra: Partial<Question> = {}): Question => ({ id, label, type: "number", ...extra });

export const TEMPLATE_IDS = {
  stambyte: "00000000-0000-4000-8000-000000000001",
  fonster: "00000000-0000-4000-8000-000000000002",
  miljo: "00000000-0000-4000-8000-000000000003",
  boende: "00000000-0000-4000-8000-000000000004",
} as const;

const stambyte: Section[] = [
  {
    id: "badrum",
    title: "Badrum",
    questions: [
      num("renovering_ar", "Renoveringsår (ungefär)", { help: "Uppskatta om okänt." }),
      single("vatrumsintyg", "Våtrumsintyg finns", ["Ja", "Nej", "Okänt"]),
      single("golv", "Golv", ["Klinker", "Plastmatta", "Annat"]),
      single("golv_skick", "Golv – skick", SKICK),
      single("vagg", "Vägg", ["Kakel", "Våtrumstapet", "Plastmatta", "Målad", "Annat"]),
      single("vagg_skick", "Vägg – skick", SKICK),
      single("golvbrunn", "Golvbrunn", ["Plast", "Gjutjärn", "Okänt"]),
      single("golvbrunn_skick", "Golvbrunn – skick", SKICK),
      single("wc", "WC", ["Golvstående", "Vägghängd"]),
      single("bad_dusch", "Bad/dusch", ["Badkar", "Duschhörna", "Duschkabin", "Ingen"]),
      multi("synliga_ror", "Synliga rör", ["Kopparrör", "Galvaniserade rör", "Plaströr", "Gjutjärn", "Inga synliga"]),
      yesno("inspektionslucka", "Inspektionslucka till schakt finns"),
      multi("skador", "Synliga skador", ["Fuktfläckar", "Mögel", "Sprickor i klinker/kakel", "Läckage", "Rost", "Inga"], {
        warning: "Notera plats och fotografera vid fukt eller mögel.",
      }),
      single("ventilation", "Ventilation", ["Frånluftsdon", "Fläkt", "Ingen", "Okänt"]),
      text("ovrigt", "Övrigt badrum"),
    ],
  },
  {
    id: "kok",
    title: "Kök",
    questions: [
      single("diskbank_avlopp", "Diskbänksavlopp", ["Plast", "Gjutjärn", "Okänt"]),
      single("diskbank_skick", "Diskbänksavlopp – skick", SKICK),
      yesno("avstangningsventiler", "Avstängningsventiler finns"),
      single("diskmaskin", "Diskmaskin", ["Ja, med läckageskydd", "Ja, utan läckageskydd", "Nej"]),
      single("koksflakt", "Köksfläkt", ["Kolfilterfläkt", "Imkanal", "Spiskåpa", "Ingen"]),
      text("ovrigt", "Övrigt kök"),
    ],
  },
  {
    id: "schakt",
    title: "Schakt/stam",
    questions: [
      single("material", "Stammaterial", ["Gjutjärn", "Plast", "Koppar", "Galvaniserat", "Okänt"]),
      single("skick", "Skick", SKICK),
      yesno("atkomst", "Åtkomligt för inspektion"),
      text("ovrigt", "Anteckningar schakt"),
    ],
  },
  {
    id: "kallare",
    title: "Källare/grundledningar",
    questions: [
      single("material", "Material grundledning", ["Gjutjärn", "Betong", "Plast", "Okänt"]),
      multi("observationer", "Observationer", ["Läckage", "Rost", "Fuktfläckar", "Rotinträngning (enligt filmning)", "Inga"]),
      yesno("filmad", "Ledningar filmade"),
      text("ovrigt", "Anteckningar källare"),
    ],
  },
  {
    id: "vind",
    title: "Vind/avluftning/takavvattning",
    questions: [
      single("avluftning", "Avluftning", ["Genom tak", "Ventil", "Okänt"]),
      single("avluftning_skick", "Avluftning – skick", SKICK),
      single("takavvattning", "Takavvattning", ["Utvändig", "Invändig", "Okänt"]),
      single("takavvattning_skick", "Takavvattning – skick", SKICK),
      text("ovrigt", "Anteckningar vind"),
    ],
  },
];

const fonster: Section[] = [
  {
    id: "fonster",
    title: "Fönster och balkongdörrar",
    questions: [
      single("typ", "Typ", ["2-glas kopplat", "3-glas", "Isolerruta", "Balkongdörr", "Annat"]),
      single("material", "Material", ["Trä", "Trä/aluminium", "Aluminium", "PVC"]),
      single("bage_karm", "Båge/karm", SKICK),
      single("kitt_glas", "Kitt/glas", SKICK),
      single("funktion", "Funktion (öppna/stänga/låsa)", ["Fungerar", "Trög", "Fungerar ej"]),
      single("tatning", "Tätning", SKICK),
      single("bank_bleck", "Fönsterbänk/bleck", SKICK),
      single("tilluft", "Tilluft", ["Spaltventil", "Ventil i vägg", "Ingen", "Okänt"]),
      num("antal", "Antal fönster", { unit: "st" }),
      text("ovrigt", "Anteckningar"),
    ],
  },
];

const MILJO_VARNING = "Rör inte – notera plats";
const miljoQuestions = (part: string): Question[] => [
  single(`${part}_asbest`, "Misstänkt asbest", ["Nej", "Misstänkt", "Okänt"], { warning: MILJO_VARNING }),
  single(`${part}_pcb`, "Misstänkt PCB", ["Nej", "Misstänkt", "Okänt"], { warning: MILJO_VARNING }),
  text(`${part}_plats`, "Plats/notering"),
];

const miljo: Section[] = [
  { id: "golv", title: "Golv (mattor, lim, fix)", questions: miljoQuestions("golv") },
  { id: "vagg", title: "Väggar och fogar", questions: miljoQuestions("vagg") },
  { id: "ror", title: "Rörisolering", questions: miljoQuestions("ror") },
  { id: "fonster", title: "Fönster (fogmassor)", questions: miljoQuestions("fonster") },
  { id: "ovrigt", title: "Övriga byggdelar", questions: miljoQuestions("ovrigt") },
];

const boende: Section[] = [
  {
    id: "boende",
    title: "Frågor till boende",
    questions: [
      multi("problem", "Upplevda problem", ["Drag", "Kallt", "Lukt från avlopp", "Dålig ventilation", "Lågt vattentryck", "Buller", "Inga"]),
      single("vattenskador", "Tidigare vattenskador", ["Ja", "Nej", "Vet ej"]),
      text("vattenskador_beskrivning", "Beskriv vattenskador"),
      single("ombyggnader", "Egna ombyggnader", ["Ja", "Nej", "Vet ej"]),
      text("ombyggnader_beskrivning", "Beskriv ombyggnader"),
      multi("behov", "Behov under produktion", ["Tillgång till dusch", "Tillgång till WC", "Husdjur", "Särskilda hänsyn", "Inga"]),
      text("ovrigt", "Övrigt", {
        help: "GDPR: skriv inte namn, telefonnummer eller andra personuppgifter.",
        warning: "Spara inga namn eller telefonnummer.",
      }),
    ],
  },
];

const T = "2026-01-01T00:00:00.000Z";

export const SEED_TEMPLATES: Template[] = [
  { id: TEMPLATE_IDS.stambyte, org_id: null, name: "Stambyte/VA", description: "Badrum, kök, schakt, källare och vind.", sections: stambyte, based_on: null, updated_at: T },
  { id: TEMPLATE_IDS.fonster, org_id: null, name: "Fönster och balkongdörrar", description: "Skick och funktion per fönster.", sections: fonster, based_on: null, updated_at: T },
  { id: TEMPLATE_IDS.miljo, org_id: null, name: "Miljö (observation)", description: "Misstänkt asbest/PCB per byggdel.", sections: miljo, based_on: null, updated_at: T },
  { id: TEMPLATE_IDS.boende, org_id: null, name: "Frågor till boende", description: "Inga personuppgifter sparas.", sections: boende, based_on: null, updated_at: T },
];
