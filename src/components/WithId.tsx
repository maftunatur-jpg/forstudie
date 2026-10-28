"use client";

import { Suspense, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";

// Sidor använder ?id=… i stället för dynamiska segment, så att ett litet antal
// fasta sidor kan cachas av service workern och fungera offline.
function Inner({ render }: { render: (id: string) => ReactNode }) {
  const id = useSearchParams().get("id");
  if (!id) return <p className="text-slate-600">Saknar id.</p>;
  return <>{render(id)}</>;
}

export function WithId({ render }: { render: (id: string) => ReactNode }) {
  return (
    <Suspense fallback={<p className="text-slate-500">Laddar…</p>}>
      <Inner render={render} />
    </Suspense>
  );
}

export function NotFound({ what }: { what: string }) {
  return <p className="text-slate-600">{what} hittades inte på den här enheten. Den kan vara borttagen eller inte synkad ännu.</p>;
}
