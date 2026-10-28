// Alla skrivningar går hit: spara lokalt, lägg i kön, begär synk.
import { db } from "./db/db";
import { enqueue } from "./db/queue";
import { requestSync } from "./db/sync";
import { SEED_TEMPLATES } from "./templates/seed";
import type { Photo, Project, SyncTable, Template, Visit } from "./types";

export const nowIso = () => new Date().toISOString();
export const newId = () => crypto.randomUUID();
export const today = () => new Date().toISOString().slice(0, 10);

async function put<T extends { id: string; updated_at: string }>(table: SyncTable, row: T, userId: string | null) {
  const stamped = { ...row, updated_at: nowIso(), updated_by: userId };
  await db().transaction("rw", db().table(table), db().outbox, async () => {
    await db().table(table).put(stamped);
    await enqueue(db(), "upsert", table, row.id);
  });
  requestSync();
  return stamped;
}

export const saveProject = (p: Project, userId: string | null) => put("projects", p, userId);
export const saveVisit = (v: Visit, userId: string | null) => put("visits", v, userId);
export const saveTemplate = (t: Template, userId: string | null) => put("templates", t, userId);
export const savePhoto = (p: Photo, userId: string | null) => put("photos", p, userId);

/** Mjuk radering så att den syns för andra vid nästa synk. */
export async function softDelete(table: SyncTable, id: string, userId: string | null) {
  const row = await db().table(table).get(id);
  if (!row) return;
  await put(table, { ...row, deleted_at: nowIso() }, userId);
}

export function emptyProject(orgId: string, userId: string | null): Project {
  const t = nowIso();
  return {
    id: newId(),
    org_id: orgId,
    name: "",
    property_designation: null,
    address: null,
    client: null,
    study_type: null,
    study_date: today(),
    responsible: null,
    level1_name: "Hus",
    level1_values: [],
    level2_name: null,
    level2_values: [],
    template_ids: [],
    summary: null,
    created_by: userId,
    updated_by: userId,
    created_at: t,
    updated_at: t,
    deleted_at: null,
  };
}

export function emptyVisit(project: Project, userId: string | null, inspector: string | null): Visit {
  const t = nowIso();
  return {
    id: newId(),
    project_id: project.id,
    level1: project.level1_values.length === 1 ? project.level1_values[0] : null,
    level2: null,
    kind: "apartment",
    object_number: null,
    floor: null,
    shaft: null,
    visit_date: today(),
    inspector,
    answers: {},
    ratings: {},
    overall_rating: null,
    notes: null,
    created_by: userId,
    updated_by: userId,
    created_at: t,
    updated_at: t,
    deleted_at: null,
  };
}

/** Lägg till ett foto: filen sparas lokalt direkt och laddas upp via kön. */
export async function addPhoto(
  visit: Visit,
  blob: Blob,
  size: { width: number; height: number },
  category: string | null,
  userId: string | null,
) {
  const id = newId();
  const t = nowIso();
  const existing = await db().photos.where("visit_id").equals(visit.id).count();
  const photo: Photo = {
    id,
    visit_id: visit.id,
    project_id: visit.project_id,
    storage_path: `${visit.project_id}/${visit.id}/${id}.jpg`,
    category,
    caption: null,
    sort_order: existing,
    width: size.width,
    height: size.height,
    created_by: userId,
    created_at: t,
    updated_at: t,
    deleted_at: null,
  };
  await db().transaction("rw", [db().photos, db().photoBlobs, db().outbox], async () => {
    await db().photoBlobs.put({ id, blob });
    await db().photos.put(photo);
    await enqueue(db(), "upload", "photos", id);
    await enqueue(db(), "upsert", "photos", id);
  });
  requestSync(300);
  return photo;
}

/** Ser till att standardmallarna finns lokalt även om appen startar offline. */
export async function ensureSeedTemplates() {
  const ids = SEED_TEMPLATES.map((t) => t.id);
  const existing = await db().templates.bulkGet(ids);
  const missing = SEED_TEMPLATES.filter((_, i) => !existing[i]);
  if (missing.length) await db().templates.bulkPut(missing);
}
