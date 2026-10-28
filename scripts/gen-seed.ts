// Genererar supabase/migrations/..._seed_templates.sql från src/lib/templates/seed.ts.
// Kör: node scripts/gen-seed.ts
import { writeFileSync } from "node:fs";
import { SEED_TEMPLATES } from "../src/lib/templates/seed.ts";

const q = (s: string | null) => (s === null ? "null" : `'${s.replace(/'/g, "''")}'`);

const rows = SEED_TEMPLATES.map(
  (t) => `  (${q(t.id)}, null, ${q(t.name)}, ${q(t.description)}, ${q(JSON.stringify(t.sections))}::jsonb)`,
).join(",\n");

const sql = `-- Genererad av scripts/gen-seed.ts – redigera inte för hand.
-- Globala standardmallar (org_id = null).
insert into public.templates (id, org_id, name, description, sections) values
${rows}
on conflict (id) do update set name = excluded.name, description = excluded.description, sections = excluded.sections;
`;

writeFileSync(new URL("../supabase/migrations/20261028120100_seed_templates.sql", import.meta.url), sql);
console.log("Skrev seed för", SEED_TEMPLATES.length, "mallar.");
