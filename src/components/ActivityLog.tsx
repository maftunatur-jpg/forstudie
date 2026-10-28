"use client";

import { useState } from "react";
import { LOCAL_ONLY, supabase } from "@/lib/supabase/client";
import { useOnline, useProfiles } from "@/lib/hooks";
import { Button } from "./ui";

interface Row {
  id: number;
  table_name: string;
  action: string;
  changed_fields: string[] | null;
  actor: string | null;
  created_at: string;
}

const FIELD_LABELS: Record<string, string> = {
  answers: "svar",
  ratings: "bedömningar",
  overall_rating: "samlad bedömning",
  notes: "anteckningar",
  level1: "byggnadsdel",
  level2: "nivå 2",
  object_number: "objektnummer",
  floor: "våning",
  shaft: "stam/schakt",
  kind: "typ",
  visit_date: "datum",
  inspector: "inventerare",
  caption: "bildtext",
  deleted_at: "borttagen",
};

const ACTIONS: Record<string, string> = { created: "skapade", updated: "ändrade", deleted: "tog bort" };

/** Visar vem som ändrat vad i ett besök (hämtas från servern). */
export function ActivityLog({ projectId, rowIds }: { projectId: string; rowIds: string[] }) {
  const online = useOnline();
  const profiles = useProfiles();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (LOCAL_ONLY) return null;

  async function load() {
    const { data, error } = await supabase()
      .from("activity")
      .select("id, table_name, action, changed_fields, actor, created_at")
      .eq("project_id", projectId)
      .in("row_id", rowIds)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) setError(error.message);
    else setRows(data as Row[]);
  }

  return (
    <div className="space-y-2">
      {rows === null ? (
        <Button variant="ghost" disabled={!online} onClick={load}>
          {online ? "Visa ändringshistorik" : "Ändringshistorik kräver nätverk"}
        </Button>
      ) : (
        <ul className="space-y-1 text-sm text-muted">
          {rows.length === 0 && <li>Ingen historik ännu (osynkade ändringar visas efter synk).</li>}
          {rows.map((r) => (
            <li key={r.id}>
              <span className="text-muted">{new Date(r.created_at).toLocaleString("sv-SE")}</span> –{" "}
              <strong>{(r.actor && profiles[r.actor]) || "Okänd"}</strong> {ACTIONS[r.action] ?? r.action}{" "}
              {r.table_name === "photos" ? "ett foto" : ""}
              {r.changed_fields?.length ? ` (${r.changed_fields.map((f) => FIELD_LABELS[f] ?? f).join(", ")})` : ""}
            </li>
          ))}
        </ul>
      )}
      {error && <p className="text-sm text-bad">{error}</p>}
    </div>
  );
}
