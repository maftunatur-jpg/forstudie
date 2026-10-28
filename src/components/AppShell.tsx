"use client";

import Link from "next/link";
import { useEffect, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { usePendingCount, useSyncState } from "@/lib/hooks";
import { syncNow } from "@/lib/db/sync";
import { LOCAL_ONLY } from "@/lib/supabase/client";
import { cx } from "./ui";

function SyncBadge() {
  const pending = usePendingCount();
  const s = useSyncState();
  let text = "Synkat";
  let cls = "bg-green-100 text-green-900";
  if (LOCAL_ONLY) {
    text = "Lokalt läge";
    cls = "bg-slate-200 text-slate-800";
  } else if (!s.online) {
    text = pending ? `Offline · ${pending} osynkade` : "Offline";
    cls = "bg-amber-100 text-amber-900";
  } else if (s.syncing) {
    text = pending ? `Synkar… ${pending}` : "Synkar…";
    cls = "bg-blue-100 text-blue-900";
  } else if (s.error) {
    text = pending ? `${pending} osynkade · fel` : "Synkfel";
    cls = "bg-red-100 text-red-900";
  } else if (pending) {
    text = `${pending} osynkade`;
    cls = "bg-amber-100 text-amber-900";
  }
  return (
    <button
      type="button"
      onClick={() => void syncNow()}
      title={s.error ?? "Synka nu"}
      className={cx("min-h-9 rounded-full px-3 text-sm font-medium", cls)}
      data-testid="sync-badge"
    >
      {text}
    </button>
  );
}

const NAV = [
  { href: "/", label: "Projekt" },
  { href: "/mallar", label: "Mallar" },
  { href: "/installningar", label: "Inställningar" },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  if (pathname === "/login") return <>{children}</>;

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex max-w-3xl items-center gap-2 px-4 py-2">
          <Link href="/" className="flex-1 truncate text-lg font-bold text-blue-800">
            Fältinventering
          </Link>
          <SyncBadge />
        </div>
        <nav className="mx-auto flex max-w-3xl gap-1 overflow-x-auto px-2 pb-1">
          {NAV.map((n) => {
            const active = n.href === "/" ? pathname === "/" || pathname.startsWith("/projekt") || pathname.startsWith("/besok") || pathname.startsWith("/rapport") || pathname.startsWith("/team") : pathname.startsWith(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                className={cx("min-h-10 rounded-lg px-3 py-2 text-sm font-medium", active ? "bg-blue-50 text-blue-800" : "text-slate-600 hover:bg-slate-100")}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-4 pb-[calc(env(safe-area-inset-bottom)+2rem)]">{children}</main>
    </div>
  );
}
