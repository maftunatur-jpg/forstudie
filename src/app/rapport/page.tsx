"use client";

import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useAuth } from "@/components/AuthProvider";
import { NotFound, WithId } from "@/components/WithId";
import { QualityPanel } from "@/components/QualityPanel";
import { Alert, Button, Card, PageHeader, RatingBadge, inputClass } from "@/components/ui";
import { db } from "@/lib/db/db";
import { canEdit, useOnline, useProjectRole } from "@/lib/hooks";
import { checkQuality, qualityIssueCount, ratingDistribution } from "@/lib/quality";
import { saveProject } from "@/lib/repo";
import { buildReportData, downloadBlob, reportFilename } from "@/lib/report/data";
import { suggestSummary } from "@/lib/ai/client";
import { LOCAL_ONLY } from "@/lib/supabase/client";
import type { Project, Template } from "@/lib/types";

function SummaryEditor({ project, editable }: { project: Project; editable: boolean }) {
  const auth = useAuth();
  const online = useOnline();
  const [text, setText] = useState(project.summary ?? "");
  const [ai, setAi] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(value: string) {
    if ((project.summary ?? "") !== value) await saveProject({ ...project, summary: value || null }, auth.userId);
  }

  async function suggest() {
    setBusy(true);
    setError(null);
    try {
      const visits = await db().visits.where("project_id").equals(project.id).filter((v) => !v.deleted_at).toArray();
      const templates = (await db().templates.bulkGet(project.template_ids)).filter((t): t is Template => !!t);
      setAi(await suggestSummary(project, visits, templates));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Något gick fel.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="space-y-3">
      <h2 className="font-semibold">Sammanfattning</h2>
      <textarea
        className={inputClass + " min-h-40"}
        disabled={!editable}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={(e) => void save(e.target.value)}
        placeholder="Skriv en sammanfattning av förstudien…"
        data-testid="summary"
      />
      {editable && !LOCAL_ONLY && !ai && (
        <Button variant="secondary" disabled={busy || !online} onClick={suggest}>
          {busy ? "Hämtar förslag…" : "✨ Föreslå sammanfattning"}
        </Button>
      )}
      {error && <Alert kind="error">{error}</Alert>}
      {ai && (
        <div className="space-y-2 rounded-xl border-2 border-dashed border-violet-400 bg-violet-50 p-3">
          <div className="text-sm font-bold uppercase tracking-wide text-violet-800">AI-förslag – granska</div>
          <p className="whitespace-pre-wrap">{ai}</p>
          <div className="flex gap-2">
            <Button
              onClick={() => {
                setText(ai);
                void save(ai);
                setAi(null);
              }}
            >
              Godkänn och använd
            </Button>
            <Button variant="secondary" onClick={() => setAi(null)}>
              Avvisa
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

function Report({ id }: { id: string }) {
  const auth = useAuth();
  const project = useLiveQuery(async () => (await db().projects.get(id)) ?? null, [id]);
  const visits = useLiveQuery(() => db().visits.where("project_id").equals(id).filter((v) => !v.deleted_at).toArray(), [id]);
  const photoCount = useLiveQuery(async () => {
    const m: Record<string, number> = {};
    await db().photos.where("project_id").equals(id).filter((p) => !p.deleted_at).each((p) => (m[p.visit_id] = (m[p.visit_id] ?? 0) + 1));
    return m;
  }, [id]);
  const role = useProjectRole(project ?? undefined, auth.userId);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const qc = useMemo(() => checkQuality(visits ?? [], photoCount ?? {}), [visits, photoCount]);
  const dist = useMemo(() => ratingDistribution(visits ?? []), [visits]);

  if (project === undefined) return null;
  if (!project) return <NotFound what="Projektet" />;

  async function exportReport(kind: "pdf" | "docx") {
    if (qualityIssueCount(qc) > 0 && !confirm("Kvalitetskontrollen har varningar. Exportera ändå?")) return;
    setError(null);
    setNotice(null);
    try {
      setProgress("Förbereder bilder…");
      const fresh = (await db().projects.get(id))!;
      const data = await buildReportData(fresh, fresh.summary ?? "", kind === "pdf" ? 900 : 800, (d, t) => setProgress(`Förbereder bild ${d} av ${t}…`));
      const blob =
        kind === "pdf"
          ? await (await import("@/lib/report/pdf")).buildPdf(data, setProgress)
          : await (await import("@/lib/report/docx")).buildDocx(data, setProgress);
      downloadBlob(blob, reportFilename(fresh, kind));
      if (data.missingImages) setNotice(`${data.missingImages} bilder kunde inte hämtas (är du offline?). De är markerade i rapporten.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kunde inte skapa rapporten.");
    } finally {
      setProgress(null);
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader title={`Rapport – ${project.name}`} back={`/projekt?id=${id}`} />
      <SummaryEditor key={project.id} project={project} editable={canEdit(role)} />

      <Card className="space-y-2">
        <h2 className="font-semibold">Fördelning</h2>
        <ul className="space-y-1">
          {dist.map((d) => (
            <li key={d.value} className="flex items-center justify-between">
              <RatingBadge rating={d.value} />
              <span>
                {d.count} ({Math.round(d.share * 100)} %)
              </span>
            </li>
          ))}
        </ul>
      </Card>

      <div className="space-y-2">
        <h2 className="font-semibold">Kvalitetskontroll före export</h2>
        <QualityPanel q={qc} />
      </div>

      <Card className="space-y-3">
        <h2 className="font-semibold">Exportera</h2>
        <p className="text-sm text-slate-600">
          Rapporten skapas i webbläsaren: försättsblad, sammanfattning, fördelning, översikt per objekt, ett avsnitt per besök med foton (3 per rad) och gemensamma utrymmen sist.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button className="flex-1" disabled={!!progress} onClick={() => exportReport("pdf")} data-testid="export-pdf">
            Ladda ner PDF
          </Button>
          <Button className="flex-1" variant="secondary" disabled={!!progress} onClick={() => exportReport("docx")} data-testid="export-docx">
            Ladda ner Word
          </Button>
        </div>
        {progress && <Alert>{progress}</Alert>}
        {notice && <Alert kind="warning">{notice}</Alert>}
        {error && <Alert kind="error">{error}</Alert>}
      </Card>
    </div>
  );
}

export default function Page() {
  return <WithId render={(id) => <Report id={id} />} />;
}
