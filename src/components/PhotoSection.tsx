"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db/db";
import { resizeImage } from "@/lib/image";
import { getPhotoBlob } from "@/lib/photos";
import { addPhoto, savePhoto, softDelete } from "@/lib/repo";
import type { Photo, Visit } from "@/lib/types";
import { useAuth } from "./AuthProvider";
import { Alert, inputClass } from "./ui";

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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- filen ändras aldrig för samma foto
  }, [photo.id]);
  if (missing) return <div className="flex aspect-square items-center justify-center rounded-lg border border-line bg-paper p-2 text-center text-[11px] text-muted">Hämtas när du är online</div>;
  // eslint-disable-next-line @next/next/no-img-element
  return url ? <img src={url} alt={photo.caption ?? "Foto"} className="aspect-square w-full rounded-lg border border-line object-cover" /> : <div className="aspect-square animate-pulse rounded-lg bg-paper" />;
}

export function PhotoSection({ visit, category, editable, onCount }: { visit: Visit; category: string | null; editable: boolean; onCount?: (n: number) => void }) {
  const auth = useAuth();
  const inputId = useId();
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

  useEffect(() => {
    if (photos) onCount?.(photos.length);
  }, [photos, onCount]);

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
    <div className="flex flex-col gap-2">
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(88px,1fr))] gap-2">
        {(photos ?? []).map((p, i) => (
          <li key={p.id} className="flex flex-col gap-1">
            <div className="relative">
              <Thumb photo={p} />
              <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 font-mono text-[11px] text-white">{i + 1}</span>
              {pendingUploads?.has(p.id) && (
                <span className="absolute bottom-1 right-1 rounded bg-black/60 px-1.5 text-[11px] text-white" title="Inte uppladdad ännu">
                  ↑
                </span>
              )}
              {editable && (
                <button
                  type="button"
                  aria-label="Ta bort foto"
                  className="absolute right-1 top-1 flex h-[26px] w-[26px] cursor-pointer items-center justify-center rounded-full bg-black/60 text-sm text-white"
                  onClick={() => confirm("Ta bort fotot?") && void softDelete("photos", p.id, auth.userId)}
                >
                  ×
                </button>
              )}
            </div>
            {editable ? (
              <input
                className={inputClass + " px-2 py-1.5 text-[13px]"}
                placeholder="Bildtext"
                aria-label={`Bildtext foto ${i + 1}`}
                defaultValue={p.caption ?? ""}
                onBlur={(e) => {
                  const caption = e.target.value.trim() || null;
                  if (caption !== p.caption) void savePhoto({ ...p, caption }, auth.userId);
                }}
              />
            ) : (
              p.caption && <span className="text-xs text-muted">{p.caption}</span>
            )}
          </li>
        ))}
        {editable && (
          <li>
            <label
              htmlFor={inputId}
              className="flex aspect-square cursor-pointer items-center justify-center rounded-lg border border-dashed border-accent p-1.5 text-center text-[13px] font-semibold text-accent"
            >
              {busy ? "Sparar…" : "+ Ta foto"}
            </label>
            <input
              id={inputId}
              ref={cameraRef}
              type="file"
              accept="image/*"
              capture="environment"
              multiple
              hidden
              onChange={(e) => void onFiles(e.target.files)}
              data-testid="camera-input"
            />
          </li>
        )}
      </ul>
      {editable && (
        <>
          <input ref={galleryRef} type="file" accept="image/*" multiple hidden onChange={(e) => void onFiles(e.target.files)} />
          <button type="button" className="self-start cursor-pointer text-[13px] font-semibold text-accent" onClick={() => galleryRef.current?.click()}>
            Välj från bildbiblioteket
          </button>
        </>
      )}
      {error && <Alert kind="error">{error}</Alert>}
    </div>
  );
}
