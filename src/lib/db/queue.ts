// Synkkö ("outbox"). Varje lokal ändring sparas först i IndexedDB och läggs
// sedan i kön. Kön innehåller bara referenser (tabell + rad-id); vid synk läses
// radens senaste innehåll, så flera snabba ändringar blir en enda uppladdning.
import type { FieldDb, OutboxItem } from "./db";
import type { SyncTable } from "../types";

export interface Remote {
  upsert(table: SyncTable, row: Record<string, unknown>): Promise<void>;
  uploadPhoto(path: string, blob: Blob): Promise<void>;
}

/** Fel som betyder att servern inte nåddes – då försöker vi igen senare. */
export class NetworkError extends Error {}

export async function enqueue(db: FieldDb, op: OutboxItem["op"], table: SyncTable, rowId: string) {
  await db.transaction("rw", db.outbox, async () => {
    const existing = await db.outbox.where({ table, row_id: rowId }).filter((i) => i.op === op).first();
    if (existing) {
      // Redan i kön: räkna upp seq (så att en pågående synk inte tar bort
      // posten) och återställ ett ev. tidigare fel så att den provas igen.
      await db.outbox.update(existing.id!, { seq: (existing.seq ?? 0) + 1, failed: 0, last_error: undefined });
      return;
    }
    await db.outbox.add({ op, table, row_id: rowId, created_at: Date.now(), attempts: 0, failed: 0, seq: 0 });
  });
}

export async function pendingCount(db: FieldDb) {
  return db.outbox.count();
}

export async function hasPending(db: FieldDb, table: SyncTable, rowId: string) {
  return (await db.outbox.where({ table, row_id: rowId }).count()) > 0;
}

// Föräldrar före barn så att främmande nycklar finns när barnet laddas upp.
const TABLE_ORDER: Record<SyncTable, number> = { templates: 0, projects: 1, visits: 2, photos: 3 };

function sortItems(items: OutboxItem[]) {
  return items.sort((a, b) => {
    // Filuppladdning före fotots rad, så att raden aldrig pekar på en saknad fil.
    const ta = TABLE_ORDER[a.table] * 2 + (a.op === "upload" ? 0 : 1);
    const tb = TABLE_ORDER[b.table] * 2 + (b.op === "upload" ? 0 : 1);
    return ta - tb || a.id! - b.id!;
  });
}

let running: Promise<FlushResult> | null = null;

export interface FlushResult {
  done: number;
  failed: number;
  stoppedByNetwork: boolean;
}

/** Spolar kön. Bara en körning åt gången; samtidiga anrop får samma löfte. */
export function flushQueue(db: FieldDb, remote: Remote): Promise<FlushResult> {
  if (!running) {
    running = doFlush(db, remote).finally(() => {
      running = null;
    });
  }
  return running;
}

async function doFlush(db: FieldDb, remote: Remote): Promise<FlushResult> {
  const result: FlushResult = { done: 0, failed: 0, stoppedByNetwork: false };
  const items = sortItems(await db.outbox.filter((i) => !i.failed).toArray());

  for (const item of items) {
    try {
      await processItem(db, remote, item);
      // Ta bara bort posten om ingen ny ändring kommit in under tiden.
      await db.transaction("rw", db.outbox, async () => {
        const current = await db.outbox.get(item.id!);
        if (current && (current.seq ?? 0) === (item.seq ?? 0)) await db.outbox.delete(item.id!);
      });
      result.done++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (err instanceof NetworkError) {
        await db.outbox.update(item.id!, { attempts: item.attempts + 1, last_error: message });
        result.stoppedByNetwork = true;
        break;
      }
      await db.outbox.update(item.id!, { attempts: item.attempts + 1, failed: 1, last_error: message });
      result.failed++;
    }
  }
  return result;
}

async function processItem(db: FieldDb, remote: Remote, item: OutboxItem) {
  if (item.op === "upload") {
    const photo = await db.photos.get(item.row_id);
    const blob = await db.photoBlobs.get(item.row_id);
    if (!photo || !blob) return; // Raderad lokalt innan uppladdning – inget att göra.
    await remote.uploadPhoto(photo.storage_path, blob.blob);
    return;
  }
  const row = await db.table(item.table).get(item.row_id);
  if (!row) return;
  await remote.upsert(item.table, row);
}
