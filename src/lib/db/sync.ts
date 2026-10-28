// Synkmotor: spolar kön till Supabase och hämtar ändringar från servern.
import { db, getMeta, setMeta } from "./db";
import { flushQueue, hasPending, NetworkError, pendingCount, type Remote } from "./queue";
import { LOCAL_ONLY, supabase } from "../supabase/client";
import type { SyncTable } from "../types";

function isNetworkFailure(err: { message?: string; status?: number; statusCode?: string | number } | null) {
  if (typeof navigator !== "undefined" && !navigator.onLine) return true;
  const status = Number(err?.status ?? err?.statusCode ?? 0);
  if (status >= 500 || status === 408 || status === 429) return true;
  return /fetch|network|load failed|timeout|aborted/i.test(err?.message ?? "");
}

export const supabaseRemote: Remote = {
  async upsert(table, row) {
    const { error, status } = await supabase().from(table).upsert(row, { onConflict: "id" });
    if (error) {
      if (isNetworkFailure({ message: error.message, status })) throw new NetworkError(error.message);
      throw new Error(error.message);
    }
  },
  async uploadPhoto(path, blob) {
    const { error } = await supabase().storage.from("photos").upload(path, blob, { upsert: true, contentType: "image/jpeg" });
    if (error) {
      const e = error as { message: string; statusCode?: string };
      // Filen finns redan (t.ex. efter ett avbrutet försök) räknas som klart.
      if (/exists|duplicate/i.test(e.message)) return;
      if (isNetworkFailure(e)) throw new NetworkError(e.message);
      throw new Error(e.message);
    }
  },
};

// --------------------------------------------------------------- status

export interface SyncState {
  syncing: boolean;
  lastSync: number | null;
  error: string | null;
  online: boolean;
}

let state: SyncState = { syncing: false, lastSync: null, error: null, online: true };
const listeners = new Set<() => void>();

function setState(patch: Partial<SyncState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

export function subscribeSync(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function getSyncState() {
  return state;
}

// --------------------------------------------------------------- pull

const PULL_TABLES: SyncTable[] = ["templates", "projects", "visits", "photos"];

async function pullTable(table: SyncTable) {
  const key = `cursor:${table}`;
  const cursor = (await getMeta<string>(key)) ?? "1970-01-01T00:00:00Z";
  // Lite överlapp så att inget missas p.g.a. samtidiga transaktioner.
  const since = new Date(new Date(cursor).getTime() - 2 * 60_000).toISOString();
  let newest = cursor;
  const pageSize = 500;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase()
      .from(table)
      .select("*")
      .gt("updated_at", since)
      .order("updated_at", { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as Array<{ id: string; updated_at: string; deleted_at?: string | null }>;
    const local = db().table(table);
    for (const row of rows) {
      if (row.updated_at > newest) newest = row.updated_at;
      if (await hasPending(db(), table, row.id)) continue; // Lokala osynkade ändringar vinner.
      if (row.deleted_at) {
        await local.delete(row.id);
        if (table === "photos") await db().photoBlobs.delete(row.id);
      } else {
        await local.put(row);
      }
    }
    if (rows.length < pageSize) break;
  }
  await setMeta(key, newest);
}

export async function pullAll() {
  for (const t of PULL_TABLES) await pullTable(t);
  // Profiler för "ändrad av".
  const { data } = await supabase().from("profiles").select("id, email, display_name");
  if (data) await setMeta("profiles", Object.fromEntries(data.map((p) => [p.id, p.display_name || p.email])));
  // Egna roller, så att UI:t kan låsa redigering för läsare även offline.
  const { data: session } = await supabase().auth.getSession();
  const uid = session.session?.user.id;
  if (uid) {
    const [{ data: orgRoles }, { data: projectRoles }] = await Promise.all([
      supabase().from("members").select("org_id, role").eq("user_id", uid),
      supabase().from("project_members").select("project_id, role").eq("user_id", uid),
    ]);
    if (orgRoles) await setMeta("orgRoles", Object.fromEntries(orgRoles.map((r) => [r.org_id, r.role])));
    if (projectRoles) await setMeta("projectRoles", Object.fromEntries(projectRoles.map((r) => [r.project_id, r.role])));
  }
}

// --------------------------------------------------------------- körning

export async function syncNow({ pull = true } = {}) {
  if (LOCAL_ONLY || typeof window === "undefined") return;
  if (!navigator.onLine) {
    setState({ online: false });
    return;
  }
  const { data } = await supabase().auth.getSession();
  if (!data.session) return;
  setState({ syncing: true, online: true });
  try {
    // Kör kön tills den är tom eller inte går framåt (nya ändringar under synk).
    for (let i = 0; i < 5; i++) {
      const before = await pendingCount(db());
      if (!before) break;
      const r = await flushQueue(db(), supabaseRemote);
      if (r.stoppedByNetwork || r.done === 0) break;
    }
    if (pull) await pullAll();
    const failed = await db().outbox.where("failed").equals(1).count();
    setState({ lastSync: Date.now(), error: failed ? `${failed} poster kunde inte sparas på servern.` : null });
  } catch (err) {
    setState({ error: err instanceof Error ? err.message : String(err) });
  } finally {
    setState({ syncing: false });
  }
}

let timer: ReturnType<typeof setTimeout> | null = null;

/** Begär synk snart (debounce), används efter varje lokal ändring. */
export function requestSync(delay = 1500) {
  if (LOCAL_ONLY || typeof window === "undefined") return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    void syncNow({ pull: false });
  }, delay);
}

/** Spola kön direkt, t.ex. när appen göms eller stängs. */
function flushNow() {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  void syncNow({ pull: false });
}

let started = false;

export function startSync() {
  if (started || LOCAL_ONLY || typeof window === "undefined") return;
  started = true;
  setState({ online: navigator.onLine });
  window.addEventListener("online", () => {
    setState({ online: true });
    void syncNow();
  });
  window.addEventListener("offline", () => setState({ online: false }));
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushNow();
    else void syncNow();
  });
  window.addEventListener("pagehide", flushNow);
  setInterval(() => void syncNow(), 60_000);
  void syncNow();
}
