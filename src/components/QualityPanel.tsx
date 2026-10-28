"use client";

import Link from "next/link";
import type { QualityReport } from "@/lib/quality";
import { visitLabel } from "@/lib/quality";
import type { Visit } from "@/lib/types";
import { Alert } from "./ui";

function VisitLinks({ visits }: { visits: Visit[] }) {
  return (
    <span className="flex flex-wrap gap-1">
      {visits.map((v) => (
        <Link key={v.id} href={`/besok?id=${v.id}`} className="rounded-full bg-white px-2 py-0.5 underline">
          {[v.level1, visitLabel(v)].filter(Boolean).join(" ")}
        </Link>
      ))}
    </span>
  );
}

export function QualityPanel({ q }: { q: QualityReport }) {
  const any = q.missingLevel.length || q.missingPhotos.length || q.duplicates.length;
  if (!any) return <Alert>Kvalitetskontroll: inga varningar.</Alert>;
  return (
    <div className="space-y-2" data-testid="quality-panel">
      {q.missingLevel.length > 0 && (
        <Alert kind="warning">
          <strong>{q.missingLevel.length} besök saknar byggnadsdel:</strong> <VisitLinks visits={q.missingLevel} />
        </Alert>
      )}
      {q.missingPhotos.length > 0 && (
        <Alert kind="warning">
          <strong>{q.missingPhotos.length} besök saknar foton:</strong> <VisitLinks visits={q.missingPhotos} />
        </Alert>
      )}
      {q.duplicates.map((g) => (
        <Alert kind="warning" key={g[0].id}>
          <strong>Dubbla objektnummer ({g[0].object_number}):</strong> <VisitLinks visits={g} />
        </Alert>
      ))}
    </div>
  );
}
