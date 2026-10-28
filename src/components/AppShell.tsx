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
  let dot = "bg-[#5cc48a]";
  if (LOCAL_ONLY) {
    text = "Lokalt läge";
    dot = "bg-white/60";
  } else if (!s.online) {
    text = pending ? `Offline · ${pending} osynkade` : "Offline";
    dot = "bg-[#e3b04b]";
  } else if (s.syncing) {
    text = pending ? `Synkar… ${pending}` : "Synkar…";
    dot = "bg-white";
  } else if (s.error) {
    text = pending ? `${pending} osynkade · fel` : "Synkfel";
    dot = "bg-[#f07a6e]";
  } else if (pending) {
    text = `${pending} osynkade`;
    dot = "bg-[#e3b04b]";
  }
  return (
    <button
      type="button"
      onClick={() => void syncNow()}
      title={s.error ?? "Synka nu"}
      className="flex min-h-9 cursor-pointer items-center gap-1.5 font-mono text-[11px] font-medium tracking-[0.04em] text-on-accent/90"
      data-testid="sync-badge"
    >
      <span className={cx("h-2 w-2 rounded-full", dot)} aria-hidden />
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
      <header className="sticky top-[env(safe-area-inset-top)] z-20 bg-accent text-on-accent">
        <div className="mx-auto max-w-[720px] px-4 pt-3" id="page-header-slot" />
        <div className="mx-auto flex max-w-[720px] items-center gap-1 px-2 pb-1">
          <nav className="flex flex-1 gap-1 overflow-x-auto">
            {NAV.map((n) => {
              const active =
                n.href === "/"
                  ? pathname === "/" || ["/projekt", "/besok", "/rapport", "/team"].some((p) => pathname.startsWith(p))
                  : pathname.startsWith(n.href);
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  aria-current={active ? "page" : undefined}
                  className={cx(
                    "min-h-9 rounded-md px-2 py-2 text-[13px] font-semibold",
                    active ? "text-on-accent underline decoration-2 underline-offset-[6px]" : "text-on-accent/70",
                  )}
                >
                  {n.label}
                </Link>
              );
            })}
          </nav>
          <SyncBadge />
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-[720px] flex-1 flex-col gap-[14px] px-4 pt-4 pb-[calc(env(safe-area-inset-bottom)+2rem)]">{children}</main>
    </div>
  );
}
