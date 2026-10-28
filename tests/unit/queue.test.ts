import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FieldDb } from "@/lib/db/db";
import { enqueue, flushQueue, NetworkError, pendingCount, type Remote } from "@/lib/db/queue";
import type { Photo, SyncTable, Visit } from "@/lib/types";

let db: FieldDb;
let n = 0;

beforeEach(async () => {
  db = new FieldDb(`test-${n++}`);
  await db.open();
});
afterEach(async () => {
  db.close();
  await db.delete();
});

function visit(id: string, notes = ""): Visit {
  return {
    id, project_id: "p1", level1: "A", level2: null, kind: "apartment", object_number: "1", floor: "1", shaft: null,
    visit_date: null, inspector: null, answers: {}, ratings: {}, overall_rating: null, notes,
    created_by: null, updated_by: null, created_at: "", updated_at: "", deleted_at: null,
  };
}

function photo(id: string): Photo {
  return {
    id, visit_id: "v1", project_id: "p1", storage_path: `p1/v1/${id}.jpg`, category: null, caption: null, sort_order: 0,
    width: 10, height: 10, created_by: null, created_at: "", updated_at: "", deleted_at: null,
  };
}

function recorder(fail?: (call: string) => Error | null) {
  const calls: string[] = [];
  const rows: Record<string, unknown>[] = [];
  const remote: Remote = {
    async upsert(table: SyncTable, row) {
      const c = `upsert:${table}:${row.id}`;
      const err = fail?.(c);
      if (err) throw err;
      calls.push(c);
      rows.push(row);
    },
    async uploadPhoto(path) {
      const c = `upload:${path}`;
      const err = fail?.(c);
      if (err) throw err;
      calls.push(c);
    },
  };
  return { remote, calls, rows };
}

describe("synkkön", () => {
  it("slår ihop flera ändringar av samma rad och skickar senaste innehållet", async () => {
    await db.visits.put(visit("v1", "första"));
    await enqueue(db, "upsert", "visits", "v1");
    await db.visits.put(visit("v1", "andra"));
    await enqueue(db, "upsert", "visits", "v1");
    expect(await pendingCount(db)).toBe(1);

    const r = recorder();
    const res = await flushQueue(db, r.remote);
    expect(res.done).toBe(1);
    expect(r.rows[0].notes).toBe("andra");
    expect(await pendingCount(db)).toBe(0);
  });

  it("laddar upp foton före fotots rad och föräldrar före barn", async () => {
    await db.photos.put(photo("f1"));
    await db.photoBlobs.put({ id: "f1", blob: new Blob(["x"]) });
    await db.visits.put(visit("v1"));
    await enqueue(db, "upsert", "photos", "f1");
    await enqueue(db, "upload", "photos", "f1");
    await enqueue(db, "upsert", "visits", "v1");

    const r = recorder();
    await flushQueue(db, r.remote);
    expect(r.calls).toEqual(["upsert:visits:v1", "upload:p1/v1/f1.jpg", "upsert:photos:f1"]);
  });

  it("behåller allt i kön vid nätverksfel och stoppar", async () => {
    await db.visits.put(visit("v1"));
    await db.visits.put(visit("v2"));
    await enqueue(db, "upsert", "visits", "v1");
    await enqueue(db, "upsert", "visits", "v2");

    const r = recorder(() => new NetworkError("Failed to fetch"));
    const res = await flushQueue(db, r.remote);
    expect(res.stoppedByNetwork).toBe(true);
    expect(res.done).toBe(0);
    expect(await pendingCount(db)).toBe(2);
    const first = (await db.outbox.toArray())[0];
    expect(first.attempts).toBe(1);
    expect(first.failed).toBe(0);

    // Nätet tillbaka: allt går igenom.
    const ok = recorder();
    await flushQueue(db, ok.remote);
    expect(ok.calls).toHaveLength(2);
    expect(await pendingCount(db)).toBe(0);
  });

  it("markerar poster som servern avvisar men fortsätter med resten", async () => {
    await db.visits.put(visit("v1"));
    await db.visits.put(visit("v2"));
    await enqueue(db, "upsert", "visits", "v1");
    await enqueue(db, "upsert", "visits", "v2");

    const r = recorder((c) => (c.endsWith("v1") ? new Error("new row violates row-level security policy") : null));
    const res = await flushQueue(db, r.remote);
    expect(res).toMatchObject({ done: 1, failed: 1 });
    const left = await db.outbox.toArray();
    expect(left).toHaveLength(1);
    expect(left[0]).toMatchObject({ row_id: "v1", failed: 1 });

    // En ny ändring av samma rad gör att den provas igen.
    await enqueue(db, "upsert", "visits", "v1");
    expect((await db.outbox.toArray())[0].failed).toBe(0);
  });

  it("tappar inte en ändring som görs medan raden synkas", async () => {
    await db.visits.put(visit("v1", "före"));
    await enqueue(db, "upsert", "visits", "v1");

    const remote: Remote = {
      async upsert() {
        // Användaren ändrar under pågående uppladdning.
        await db.visits.put(visit("v1", "under"));
        await enqueue(db, "upsert", "visits", "v1");
      },
      async uploadPhoto() {},
    };
    await flushQueue(db, remote);
    expect(await pendingCount(db)).toBe(1);

    const r = recorder();
    await flushQueue(db, r.remote);
    expect(r.rows[0].notes).toBe("under");
    expect(await pendingCount(db)).toBe(0);
  });

  it("samtidiga anrop kör bara en synk", async () => {
    await db.visits.put(visit("v1"));
    await enqueue(db, "upsert", "visits", "v1");
    const r = recorder();
    const [a, b] = await Promise.all([flushQueue(db, r.remote), flushQueue(db, r.remote)]);
    expect(a).toBe(b);
    expect(r.calls).toHaveLength(1);
  });
});
