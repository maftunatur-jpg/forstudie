"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { Alert, Button, Field, inputClass } from "@/components/ui";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabase().auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin + "/" },
    });
    setBusy(false);
    if (error) setError(error.message);
    else setSent(true);
  }

  return (
    <div className="flex flex-1 items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-xl border border-line bg-card p-6">
        <h1 className="mb-1 text-2xl font-bold text-accent">Fältinventering</h1>
        <p className="mb-6 text-muted">Logga in med en länk som skickas till din e-post.</p>
        {sent ? (
          <Alert>
            Kolla din e-post (<strong>{email}</strong>) och klicka på länken för att logga in. Du kan stänga den här fliken.
          </Alert>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <Field label="E-post">
              <input type="email" required autoComplete="email" inputMode="email" className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            {error && <Alert kind="error">{error}</Alert>}
            <Button type="submit" disabled={busy || !email} className="w-full">
              {busy ? "Skickar…" : "Skicka inloggningslänk"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
