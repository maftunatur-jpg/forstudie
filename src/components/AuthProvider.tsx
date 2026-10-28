"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { LOCAL_ONLY, supabase } from "@/lib/supabase/client";
import { getMeta, setMeta } from "@/lib/db/db";
import { startSync, syncNow } from "@/lib/db/sync";
import { ensureSeedTemplates } from "@/lib/repo";

export interface AuthState {
  userId: string;
  email: string;
  orgId: string;
}

const AuthContext = createContext<AuthState | null>(null);

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth utanför AuthProvider");
  return ctx;
}

const PUBLIC_PATHS = ["/login"];

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<AuthState | null>(null);
  const [checked, setChecked] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const isPublic = PUBLIC_PATHS.includes(pathname);

  useEffect(() => {
    let cancelled = false;

    async function resolve() {
      await ensureSeedTemplates();
      if (LOCAL_ONLY) {
        if (!cancelled) setAuth({ userId: "00000000-0000-4000-8000-00000000000a", email: "lokal@exempel.se", orgId: "00000000-0000-4000-8000-00000000000b" });
        setChecked(true);
        return;
      }
      // getSession läser från lokal lagring och fungerar offline.
      const { data } = await supabase().auth.getSession();
      const session = data.session;
      if (!session) {
        if (!cancelled) setAuth(null);
        setChecked(true);
        return;
      }
      let orgId = await getMeta<string>(`org:${session.user.id}`);
      if (navigator.onLine) {
        const { data: boot, error } = await supabase().rpc("bootstrap");
        if (!error && boot?.org_id) {
          orgId = boot.org_id as string;
          await setMeta(`org:${session.user.id}`, orgId);
        }
      }
      if (!cancelled) {
        setAuth(orgId ? { userId: session.user.id, email: session.user.email ?? "", orgId } : null);
        setChecked(true);
        startSync();
        void syncNow();
      }
    }

    void resolve();
    if (LOCAL_ONLY) return () => void (cancelled = true);
    const { data: sub } = supabase().auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") void resolve();
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!checked) return;
    if (!auth && !isPublic) router.replace("/login");
    if (auth && isPublic) router.replace("/");
  }, [checked, auth, isPublic, router]);

  if (isPublic) return <>{children}</>;
  if (!checked || !auth) {
    return <div className="flex flex-1 items-center justify-center p-8 text-slate-500">Laddar…</div>;
  }
  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
}
