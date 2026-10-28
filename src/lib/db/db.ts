import Dexie, { type EntityTable } from "dexie";
import type { Photo, Project, SyncTable, Template, Visit } from "../types";

export interface OutboxItem {
  id?: number;
  /** upsert = skicka radens aktuella innehåll, upload = ladda upp fotots fil. */
  op: "upsert" | "upload";
  table: SyncTable;
  row_id: string;
  created_at: number;
  attempts: number;
  /** Räknas upp vid varje ny ändring av samma rad. */
  seq?: number;
  /** Satt när servern avvisat posten (t.ex. saknad behörighet). Posten ligger kvar så att inget försvinner. */
  failed?: 0 | 1;
  last_error?: string;
}

export interface PhotoBlob {
  id: string;
  blob: Blob;
}

export interface Meta {
  key: string;
  value: unknown;
}

export class FieldDb extends Dexie {
  projects!: EntityTable<Project, "id">;
  visits!: EntityTable<Visit, "id">;
  photos!: EntityTable<Photo, "id">;
  templates!: EntityTable<Template, "id">;
  photoBlobs!: EntityTable<PhotoBlob, "id">;
  outbox!: EntityTable<OutboxItem, "id">;
  meta!: EntityTable<Meta, "key">;

  constructor(name = "faltinventering") {
    super(name);
    this.version(1).stores({
      projects: "id, org_id, updated_at",
      visits: "id, project_id, updated_at",
      photos: "id, visit_id, project_id, updated_at",
      templates: "id, org_id, updated_at",
      photoBlobs: "id",
      outbox: "++id, [table+row_id], failed",
      meta: "key",
    });
  }
}

let instance: FieldDb | null = null;

export function db(): FieldDb {
  if (!instance) instance = new FieldDb();
  return instance;
}

export async function getMeta<T>(key: string): Promise<T | undefined> {
  return (await db().meta.get(key))?.value as T | undefined;
}

export async function setMeta(key: string, value: unknown) {
  await db().meta.put({ key, value });
}
