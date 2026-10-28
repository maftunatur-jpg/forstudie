// Hämtar fotots fil: lokalt om den finns, annars från Supabase Storage (och cachas lokalt).
import { db } from "./db/db";
import { LOCAL_ONLY, supabase } from "./supabase/client";
import type { Photo } from "./types";

export async function getPhotoBlob(photo: Photo, cache = true): Promise<Blob | null> {
  const local = await db().photoBlobs.get(photo.id);
  if (local) return local.blob;
  if (LOCAL_ONLY || !navigator.onLine) return null;
  const { data, error } = await supabase().storage.from("photos").download(photo.storage_path);
  if (error || !data) return null;
  if (cache) await db().photoBlobs.put({ id: photo.id, blob: data });
  return data;
}
