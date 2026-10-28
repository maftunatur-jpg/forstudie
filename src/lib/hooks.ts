"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "./db/db";
import { getSyncState, subscribeSync } from "./db/sync";
import { LOCAL_ONLY } from "./supabase/client";
import type { Project, Role } from "./types";

export function useSyncState() {
  return useSyncExternalStore(subscribeSync, getSyncState, getSyncState);
}

export function usePendingCount() {
  return useLiveQuery(() => db().outbox.count(), [], 0);
}

export function useMeta<T>(key: string) {
  return useLiveQuery(async () => (await db().meta.get(key))?.value as T | undefined, [key]);
}

const RANK: Record<Role, number> = { viewer: 1, editor: 2, owner: 3 };

/** Användarens effektiva roll i projektet. Nya lokala projekt ägs av skaparen. */
export function useProjectRole(project: Project | undefined, userId: string): Role | undefined {
  const orgRoles = useMeta<Record<string, Role>>("orgRoles");
  const projectRoles = useMeta<Record<string, Role>>("projectRoles");
  if (!project) return undefined;
  if (LOCAL_ONLY || project.created_by === userId) return "owner";
  const roles = [orgRoles?.[project.org_id], projectRoles?.[project.id]].filter(Boolean) as Role[];
  if (!roles.length) return orgRoles || projectRoles ? "viewer" : "editor";
  return roles.sort((a, b) => RANK[b] - RANK[a])[0];
}

export function canEdit(role: Role | undefined) {
  return role === "owner" || role === "editor";
}

export function useOnline() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return online;
}

export function useProfiles() {
  return useMeta<Record<string, string>>("profiles") ?? {};
}
