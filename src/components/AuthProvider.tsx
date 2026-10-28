"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { LOCAL_ONLY, REQUIRE_LOGIN, supabase } from "@/lib/supabase/client";
import { getMeta, setMeta } from "@/lib/db/db";
import { startSync, syncNow } from "@/lib/db/sync";
import { ensureSeedTemplates } from "@/lib/repo";

export interface AuthState {
  userId: string;
  email: string;
  orgId: string;
  /** Anonymt konto (ingen inloggning): inga team eller inbjudningar. */
  anonymous: boolean;
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
  const [needsNetwork, setNeedsNetwork] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const pathname = usePathname();
  const router = useRouter();
  const isPublic = PUBLIC_PATHS.includes(pathname);

  useEffect(() => {
    let cancelled = false;

    async function resolve() {
      await ensureSeedTemplates();
      if (LOCAL_ONLY) {
        if (!cancelled) setAuth({ userId: "00000000-0000-4000-8000-00000000000a", email: "lokal@exempel.se", orgId: "00000000-0000-4000-8000-00000000000b", anonymous: true });
        setChecked(true);
        return;
      }
      // getSession läser från lokal lagring och fungerar offline.
      const { data } = await supabase().auth.getSession();
      let session = data.session;
      // Utan inloggningskrav: skapa ett eget anonymt konto för enheten första gången.
      if (!session && !REQUIRE_LOGIN) {
        if (!navigator.onLine) {
          setNeedsNetwork(true);
          setChecked(true);
          return;
        }
        const { data: anon, error } = await supabase().auth.signInAnonymously();
        if (error) {
          console.error(error);
          setStartError(
            error.code === "anonymous_provider_disabled"
              ? "Anonyma konton är avstängda i Supabase. Slå på Authentication → Sign In / Providers → Allow anonymous sign-ins och ladda om sidan."
              : `Kunde inte skapa din lagring: ${error.message}`,
          );
        }
        session = anon.session;
        setNeedsNetwork(false);
      }
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
        setAuth(orgId ? { userId: session.user.id, email: session.user.email ?? "", orgId, anonymous: !!session.user.is_anonymous } : null);
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
    if (!auth && !isPublic && REQUIRE_LOGIN) router.replace("/login");
    if (isPublic && (auth || !REQUIRE_LOGIN)) router.replace("/");
  }, [checked, auth, isPublic, router]);

  if (isPublic && REQUIRE_LOGIN) return <>{children}</>;
  if (needsNetwork) {
    return <div className="flex flex-1 items-center justify-center p-8 text-center text-muted">Första gången behöver appen internet för att skapa din lagring. Anslut och ladda om sidan.</div>;
  }
  if (checked && !auth && !REQUIRE_LOGIN) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-center text-muted">
        {startError ?? "Kunde inte starta appen. Kontrollera nätverket och ladda om sidan."}
      </div>
    );
  }
  if (!checked || !auth) {
    return <div className="flex flex-1 items-center justify-center p-8 text-muted">Laddar…</div>;
  }
  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
}
