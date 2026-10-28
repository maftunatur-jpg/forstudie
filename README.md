# Fältinventering för förstudier

Mobilanpassad webbapp (PWA) för fältinventering i förstudier inom bygg och fastighet – stambyte, fönster, fasad, tak, ventilation, badrum m.m. Projektledare dokumenterar lägenheter, lokaler och gemensamma utrymmen med checklistor, bedömningar, anteckningar och foton – även utan nät – och exporterar rapport som PDF eller Word.

**Teknik:** Next.js (App Router, TypeScript) + Tailwind · Supabase (Auth med magisk länk, Postgres med RLS, Storage) · IndexedDB (Dexie) med synkkö · PWA · rapport genereras i webbläsaren (pdf-lib, docx) · valfria AI-förslag via Anthropic API.

## Inloggning

Som standard behövs **ingen inloggning**. Första gången appen öppnas skapas automatiskt ett eget anonymt konto för enheten (Supabase anonymous sign-in). Var och en ser bara sina egna projekt, och allt sparas i molnet som backup. Kontot sitter i webbläsaren: rensar man webbläsardatan eller byter telefon kommer man inte längre åt sina tidigare projekt. Exportera rapporten för att spara arbetet.

Vill ni dela projekt i ett team: sätt `NEXT_PUBLIC_REQUIRE_LOGIN=1`. Då slås e-postinloggning, roller och inbjudningar på.

## Funktioner

- **Projekt** med fastighetsbeteckning, adress, beställare, förstudietyp, datum, ansvarig, 1–2 egna byggnadsnivåer (t.ex. *Lamell A–M* eller *Hus 1–5*) och valda checklistmallar.
- **Besök** med plats som chips överst, mallens sektioner som hopfällbara kort med räknare (*3/12*), bedömning per kategori, foton per kategori, samlad bedömning och anteckningar. Autosparning med *Sparar… / Sparat*.
- **Bedömningsskala:** God / Acceptabel / Brister / Akut åtgärd / Ej bedömt, med färgade etiketter.
- **Mallar:** fyra standardmallar (Stambyte/VA, Fönster och balkongdörrar, Miljö (observation), Frågor till boende). Kopiera och redigera utan kod under *Mallar*.
- **Offline:** allt sparas först i IndexedDB och synkas via en kö. Kön spolas vid `online`, `visibilitychange` och `pagehide`. Antal osynkade poster visas i sidhuvudet. Appen kan installeras på hemskärmen.
- **Foton:** *Ta foto* öppnar kameran, bilden skalas ned till max 1600 px på enheten och laddas upp till Supabase Storage via kön.
- **Team:** bjud in via e-post per projekt, roller (Ägare/Redigerare/Läsare) upprätthålls i RLS, ändringshistorik (”vem ändrade vad”) och varning om två personer har samma besök öppet.
- **Översikt och kvalitetskontroll:** besök grupperade per byggnadsdel → våning → nummer, filter per bedömning, nyckeltal, varningar för saknad byggnadsdel, saknade foton och dubbla objektnummer.
- **Rapport (PDF + Word):** försättsblad, redigerbar sammanfattning, fördelningstabell, översikt per objekt, ett avsnitt per besök med ifyllda svar, anteckningar och foton (3 per rad, numrerade), gemensamma utrymmen sist och ansvarsfriskrivning. Bilderna skalas ned en i taget innan de bäddas in.
- **AI-förslag (valfritt):** *Föreslå bedömning* per besök och *Föreslå sammanfattning* per projekt. Förslag märks *AI-förslag – granska* och sparas först när du godkänner. Max 30 anrop per användare och timme.

## Lokal körning

Krav: Node.js 20+ (testat med 24).

```bash
npm install
cp .env.example .env.local   # fyll i värdena, se nedan
npm run dev
```

Öppna http://localhost:3000. Vill du prova utan Supabase: sätt `NEXT_PUBLIC_LOCAL_ONLY=1` i `.env.local` – då finns ingen inloggning och ingen synk, allt ligger i webbläsaren.

Service workern registreras bara i produktionsläge (`npm run build && npm start`).

### Kommandon

| Kommando | Vad |
|---|---|
| `npm run dev` | Utvecklingsserver |
| `npm run build` | Produktionsbygge |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript |
| `npm test` | Enhetstester (synkkö, mallmotor, kvalitetskontroll) |
| `npm run test:e2e` | Playwright: nytt projekt → besök → foto → rapport (kör i lokalt läge). Första gången: `npx playwright install chromium` |
| `npm run gen:seed` | Generera SQL för standardmallarna från `src/lib/templates/seed.ts` |

## Supabase-setup

1. Skapa ett projekt på [supabase.com](https://supabase.com) (region t.ex. `eu-north-1`/`eu-west-1`).
2. Kör migrationerna i ordning, antingen med Supabase CLI (`supabase link` + `supabase db push`) eller genom att klistra in filerna i *SQL Editor*:
   - `supabase/migrations/20261028120000_init.sql` – tabeller, RLS, triggers, storage-bucket `photos`
   - `supabase/migrations/20261028120100_seed_templates.sql` – fyra standardmallar
   - `supabase/migrations/20261028120200_harden_functions.sql` – begränsar vem som får anropa funktioner
3. **Authentication → URL Configuration:**
   - *Site URL:* din produktions-URL, t.ex. `https://faltinventering.vercel.app`
   - *Redirect URLs:* lägg till `http://localhost:3000/**` och `https://<ditt-projekt>.vercel.app/**` (och ev. `https://*-<team>.vercel.app/**` för förhandsversioner).
4. **Authentication → Sign In / Providers:** slå på **Allow anonymous sign-ins** (krävs i standardläget utan inloggning). Med `NEXT_PUBLIC_REQUIRE_LOGIN=1` används i stället e-post med magisk länk, som är på som standard.
5. **E-post (viktigt för team):** Supabase inbyggda e-post är kraftigt begränsad (några mejl per timme). Lägg in egen SMTP under *Authentication → SMTP Settings* (t.ex. Resend, Postmark, SendGrid) innan ni bjuder in kollegor.
6. Hämta *Project URL* och *Publishable key* under *Project Settings → API*.

**Exempeldata:** på startsidan finns knappen *Skapa exempelprojekt* (”Exempelfastigheten 1:1”, påhittade uppgifter) när du inte har några projekt.

## Miljövariabler

| Variabel | Var | Beskrivning |
|---|---|---|
| `NEXT_PUBLIC_APP_SUPABASE_URL` | klient + server | Valfri. Supabase Project URL. Standard: projektet i `src/lib/supabase/config.ts`. |
| `NEXT_PUBLIC_APP_SUPABASE_ANON_KEY` | klient + server | Valfri. Publishable/anon key. Får finnas i webbläsaren – RLS skyddar datan. |
| `ANTHROPIC_API_KEY` | **endast server** | Valfri. Aktiverar AI-förslag. Utan den visas ett felmeddelande när man trycker på knappen. |
| `NEXT_PUBLIC_REQUIRE_LOGIN` | klient | Valfri. `1` = e-postinloggning, team och inbjudningar. Utan den: anonymt konto per enhet. |
| `NEXT_PUBLIC_LOCAL_ONLY` | klient | Valfri. `1` = lokalt läge utan Supabase. |

Hemligheter ligger bara i `.env.local` (ignoreras av git) och i Vercels miljövariabler.

## Deploy till Vercel

1. Lägg koden i ett GitHub-repo (`git push`).
2. På [vercel.com](https://vercel.com): **Add New → Project** → välj repot. Framework: Next.js (identifieras automatiskt).
3. Under **Environment Variables**: lägg (valfritt) in `ANTHROPIC_API_KEY` och, om ni använder ett eget Supabase-projekt, `NEXT_PUBLIC_APP_SUPABASE_URL` och `NEXT_PUBLIC_APP_SUPABASE_ANON_KEY`. Variablerna heter `APP_` med flit: Vercels Supabase-integration sätter `NEXT_PUBLIC_SUPABASE_*` automatiskt och kan peka på ett annat, tomt projekt för *Production* och *Preview*.
4. **Deploy.** Varje push till `main` deployas automatiskt; pull requests får förhandsversioner.
5. Lägg till Vercel-URL:en som *Site URL* och i *Redirect URLs* i Supabase (se ovan), annars hamnar inloggningslänken fel.
6. Öppna appen i mobilen → *Lägg till på hemskärmen* för att installera.

## Arkitektur i korthet

```
src/app/               sidor (?id=… i stället för dynamiska segment, så att service workern kan cacha alla sidor offline)
src/app/api/ai/        serverroutes för AI-förslag (rate limiting i Postgres)
src/components/        UI (chips, kort, bedömningsetiketter, fotosektion, närvarovarning …)
src/lib/db/            Dexie-schema, synkkö (queue.ts) och synkmotor (sync.ts)
src/lib/templates/     mallmotor och standardmallar
src/lib/report/        PDF (pdf-lib) och Word (docx)
supabase/migrations/   SQL
tests/unit/            Vitest
tests/e2e/             Playwright
```

**Synk:** varje ändring skrivs till IndexedDB och en post (tabell + rad-id) läggs i `outbox`. Synkmotorn läser radens senaste innehåll och gör `upsert` mot Supabase, med föräldrar före barn och filuppladdning före fotots rad. Nätverksfel stoppar körningen och allt ligger kvar; poster som servern avvisar (t.ex. saknad behörighet) markeras och syns under *Inställningar*. Ändringar från servern hämtas inkrementellt via `updated_at`; lokala osynkade ändringar skrivs aldrig över. Radering sker mjukt (`deleted_at`). Vid samtidig redigering av samma besök gäller senast sparade – därför varnar appen när någon annan har besöket öppet.

**GDPR:** mallen *Frågor till boende* sparar inga namn eller telefonnummer. Skriv inte personuppgifter i fritextfälten.
