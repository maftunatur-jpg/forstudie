"use client";

import { useState } from "react";
import { suggestForVisit, type VisitSuggestion } from "@/lib/ai/client";
import { useOnline } from "@/lib/hooks";
import { LOCAL_ONLY } from "@/lib/supabase/client";
import { ratingKey } from "@/lib/templates/engine";
import type { Template, Visit } from "@/lib/types";
import { Alert, Button, Card, RatingBadge } from "./ui";

export function AiVisitSuggestion({ visit, templates, onApprove }: { visit: Visit; templates: Template[]; onApprove: (s: VisitSuggestion) => void }) {
  const online = useOnline();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<VisitSuggestion | null>(null);

  if (LOCAL_ONLY) return null;

  const titles = Object.fromEntries(templates.flatMap((t) => t.sections.map((s) => [ratingKey(t.id, s.id), s.title])));

  async function run() {
    setBusy(true);
    setError(null);
    try {
      setSuggestion(await suggestForVisit(visit, templates));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Något gick fel.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="space-y-3">
      {!suggestion && (
        <Button variant="secondary" className="w-full" disabled={busy || !online} onClick={run}>
          {busy ? "Hämtar förslag…" : online ? "✨ Föreslå bedömning" : "AI-förslag kräver nätverk"}
        </Button>
      )}
      {error && <Alert kind="error">{error}</Alert>}
      {suggestion && (
        <div className="space-y-3 rounded-xl border-2 border-dashed border-violet-400 bg-violet-50 p-3">
          <div className="text-sm font-bold uppercase tracking-wide text-violet-800">AI-förslag – granska</div>
          <p className="whitespace-pre-wrap text-slate-800">{suggestion.text}</p>
          <ul className="space-y-1 text-sm">
            {Object.entries(suggestion.ratings).map(([k, r]) => (
              <li key={k} className="flex items-center justify-between gap-2">
                <span>{titles[k] ?? k}</span>
                <RatingBadge rating={r} />
              </li>
            ))}
            <li className="flex items-center justify-between gap-2 font-semibold">
              <span>Samlad bedömning</span>
              <RatingBadge rating={suggestion.overall} />
            </li>
          </ul>
          <div className="flex gap-2">
            <Button
              className="flex-1"
              onClick={() => {
                onApprove(suggestion);
                setSuggestion(null);
              }}
            >
              Godkänn och spara
            </Button>
            <Button variant="secondary" onClick={() => setSuggestion(null)}>
              Avvisa
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
