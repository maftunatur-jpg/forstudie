"use client";

import { useEffect, useState } from "react";
import { LOCAL_ONLY, supabase } from "@/lib/supabase/client";
import { Alert } from "./ui";

/** Varnar om någon annan har samma besök öppet (Supabase Realtime presence). */
export function PresenceWarning({ visitId, userId, email }: { visitId: string; userId: string; email: string }) {
  const [others, setOthers] = useState<string[]>([]);

  useEffect(() => {
    if (LOCAL_ONLY) return;
    const channel = supabase().channel(`visit:${visitId}`, { config: { presence: { key: userId } } });
    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<{ email: string }>();
        setOthers(
          Object.entries(state)
            .filter(([key]) => key !== userId)
            .map(([, metas]) => metas[0]?.email ?? "Okänd"),
        );
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") void channel.track({ email, at: Date.now() });
      });
    return () => {
      void supabase().removeChannel(channel);
    };
  }, [visitId, userId, email]);

  if (!others.length) return null;
  return (
    <Alert kind="warning">
      <strong>{others.join(", ")}</strong> har också det här besöket öppet. Ändringar kan skriva över varandra – samordna innan ni sparar.
    </Alert>
  );
}
