# PLAN – Fältinventeringsapp för förstudier

## Arkitektur
- **Next.js (App Router, TypeScript) + Tailwind**, deploy på Vercel.
- **Supabase**: Auth (magisk länk), Postgres med RLS, Storage-bucket `photos` (privat).
- **Klient-först**: alla skrivningar (projekt, besök, foton) går till IndexedDB (Dexie) och en synkkö
  (`outbox`). Synkmotorn spolar kön till Supabase när nätet finns, vid `online`,
  `visibilitychange` och `pagehide`. UI läser från IndexedDB (live-queries) så att allt fungerar offline.
- **PWA**: `manifest.webmanifest` + egen service worker (`public/sw.js`) som cachar app-skal och statiska resurser.
- **Rapport**: genereras i webbläsaren – PDF med `pdf-lib`, Word med `docx`. Bilder skalas ner till ~800 px
  via canvas en i taget innan de bäddas in.
- **AI (fas 6)**: `/api/ai/*` serverroutes som anropar Anthropic API, nyckel i `ANTHROPIC_API_KEY`,
  enkel rate limiting per användare (tabell i Postgres).

## Datamodell (Postgres)
| Tabell | Viktiga kolumner |
|---|---|
| organizations | id, name, created_by |
| members | org_id, user_id, role (`owner`/`editor`/`viewer`) |
| projects | id, org_id, name, property_designation, address, client, study_type, date, responsible, level1_name, level1_values text[], level2_name, level2_values text[], template_ids uuid[], summary, timestamps |
| project_members | project_id, user_id, role – inbjudna till ett enskilt projekt |
| invitations | id, project_id, email, role, token, accepted_at |
| templates | id, org_id (null = global), name, description, sections jsonb, based_on |
| visits | id, project_id, level1, level2, kind (`apartment`/`premises`/`common`), object_number, floor, shaft, date, inspector, answers jsonb, ratings jsonb (per kategori), overall_rating, notes, created_by, updated_by, updated_at, deleted_at |
| photos | id, visit_id, storage_path, category, caption, sort_order, created_by |
| visit_presence | visit_id, user_id, seen_at – för varning om samtidig redigering |
| ai_usage | user_id, created_at – rate limiting |

Mallens `sections` = `[{ id, title, questions: [{ id, label, type: multi|single|text|number|yesno, options?, help?, warning? }] }]`.
Bedömningsskala: `good` God · `acceptable` Acceptabel · `deficient` Brister · `urgent` Akut åtgärd · `not_assessed` Ej bedömt.

**RLS**: org-medlemmar ser org:ens projekt; projektmedlemmar ser sina projekt. `viewer` läser, `editor`/`owner` skriver,
bara `owner` raderar projekt och hanterar medlemmar. Storage-policy kopplar sökvägen `projectId/visitId/fil` till projektåtkomst.

## Mappstruktur
```
src/app/               sidor (login, projekt, besök, översikt, rapport, mallar, api)
src/components/        UI-komponenter (chips, kort, bedömningsetiketter …)
src/lib/supabase/      klient/server-klienter
src/lib/db/            Dexie-schema, synkkö
src/lib/templates/     mallmotor (räknare, validering, läsbar text)
src/lib/report/        PDF- och Word-generering
supabase/migrations/   SQL-migrationer
supabase/seed.sql      mallar + exempelprojekt
tests/                 Vitest (enhet) och Playwright (e2e)
```

## Faser
1. Grund: auth, organisationer, projekt-CRUD, mallmotor + seed, besöksformulär, autosparning.
2. Foton + offline: kamera, komprimering (1600 px), Storage, Dexie-kö, PWA.
3. Team: inbjudningar, roller i RLS, ”ändrad av”, varning vid samtidig redigering.
4. Översikt + kvalitetskontroll: gruppering, filter, nyckeltal, validering före export.
5. Rapport: PDF + Word.
6. AI-förslag (valfri).

Användaren har bett att köra igenom alla faser utan mellanliggande OK.
