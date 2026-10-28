"use client";

import { useEffect, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db/db";
import { resizeImage } from "@/lib/image";
import { getPhotoBlob } from "@/lib/photos";
import { addPhoto, savePhoto, softDelete } from "@/lib/repo";
import type { Photo, Visit } from "@/lib/types";
import { useAuth } from "./AuthProvider";
import { Alert, Button, inputClass } from "./ui";

function Thumb({ photo }: { photo: Photo }) {
  const [url, setUrl] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  useEffect(() => {
    let revoked = false;
    let u: string | null = null;
    getPhotoBlob(photo).then((b) => {
      if (revoked) return;
      if (!b) return setMissing(true);
      u = URL.createObjectURL(b);
      setUrl(u);
    });
    return () => {
      revoked = true;
      if (u) URL.revokeObjectURL(u);
    };
  }, [photo]);
  if (missing) return <div className="flex aspect-square items-center justify-center bg-slate-100 p-2 text-center text-xs text-slate-500">Bilden hämtas när du är online</div>;
  // eslint-disable-next-line @next/next/no-img-element
  return url ? <img src={url} alt={photo.caption ?? "Foto"} className="aspect-square w-full object-cover" /> : <div className="aspect-square animate-pulse bg-slate-100" />;
}

export function PhotoSection({ visit, category, editable }: { visit: Visit; category: string | null; editable: boolean }) {
  const auth = useAuth();
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const photos = useLiveQuery(
    () => db().photos.where("visit_id").equals(visit.id).filter((p) => !p.deleted_at && (p.category ?? null) === category).sortBy("sort_order"),
    [visit.id, category],
  );
  const pendingUploads = useLiveQuery(async () => {
    const items = await db().outbox.where("table").equals("photos").toArray().catch(() => []);
    return new Set(items.filter((i) => i.op === "upload").map((i) => i.row_id));
  }, []);

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setError(null);
    try {
      for (const file of Array.from(files)) {
        const { blob, width, height } = await resizeImage(file, 1600);
        await addPhoto(visit, blob, { width, height }, category, auth.userId);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kunde inte spara fotot.");
    } finally {
      setBusy(false);
      if (cameraRef.current) cameraRef.current.value = "";
      if (galleryRef.current) galleryRef.current.value = "";
    }
  }

  return (
    <div className="space-y-2">
      {photos && photos.length > 0 && (
        <ul className="grid grid-cols-3 gap-2">
          {photos.map((p, i) => (
            <li key={p.id} className="overflow-hidden rounded-lg border border-slate-200 bg-white">
              <div className="relative">
                <Thumb photo={p} />
                <span className="absolute left-1 top-1 rounded bg-black/60 px-1.5 text-xs text-white">{i + 1}</span>
                {pendingUploads?.has(p.id) && <span className="absolute right-1 top-1 rounded bg-amber-500 px-1.5 text-xs text-white" title="Ej uppladdad ännu">↑</span>}
              </div>
              {editable ? (
                <div className="flex items-center gap-1 p-1">
                  <input
                    className={inputClass + " min-h-9 px-2 py-1 text-sm"}
                    placeholder="Bildtext"
                    defaultValue={p.caption ?? ""}
                    onBlur={(e) => {
                      const caption = e.target.value.trim() || null;
                      if (caption !== p.caption) void savePhoto({ ...p, caption }, auth.userId);
                    }}
                  />
                  <button
                    type="button"
                    className="min-h-9 min-w-9 rounded text-red-700 hover:bg-red-50"
                    aria-label="Ta bort foto"
                    onClick={() => confirm("Ta bort fotot?") && void softDelete("photos", p.id, auth.userId)}
                  >
                    ✕
                  </button>
                </div>
              ) : (
                p.caption && <div className="p-1 text-xs">{p.caption}</div>
              )}
            </li>
          ))}
        </ul>
      )}
      {editable && (
        <div className="flex gap-2">
          <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => void onFiles(e.target.files)} data-testid="camera-input" />
          <input ref={galleryRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => void onFiles(e.target.files)} />
          <Button onClick={() => cameraRef.current?.click()} disabled={busy} className="flex-1">
            {busy ? "Sparar foto…" : "📷 Ta foto"}
          </Button>
          <Button variant="secondary" onClick={() => galleryRef.current?.click()} disabled={busy}>
            Välj bild
          </Button>
        </div>
      )}
      {error && <Alert kind="error">{error}</Alert>}
    </div>
  );
}
