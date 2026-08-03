"use client";

import { useEffect, useState } from "react";

export function SupabaseHealthBanner() {
  const [down, setDown] = useState(false);

  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!url) return;

    let cancelled = false;

    async function check() {
      try {
        // Use no-cors to avoid CORS failures; network-level errors still throw.
        await fetch(url, { method: "GET", mode: "no-cors" });
        if (!cancelled) setDown(false);
      } catch (err) {
        if (!cancelled) setDown(true);
      }
    }

    check();

    const id = setInterval(check, 30_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  if (!down) return null;

  return (
    <div className="fixed left-0 right-0 top-0 z-50 bg-yellow-600 text-white text-sm text-center py-2">
      Não foi possível conectar ao Supabase. Verifique `NEXT_PUBLIC_SUPABASE_URL` em .env.local e sua conexão de rede.
    </div>
  );
}
