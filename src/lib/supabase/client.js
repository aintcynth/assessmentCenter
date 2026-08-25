"use client";

import { createBrowserClient } from "@supabase/ssr";

// Falls back to harmless placeholder values so the build never crashes if
// env vars aren't wired up yet (e.g. a Vercel deploy before you've added
// them in Project Settings → Environment Variables). At runtime in the
// browser, calls will simply fail with a network/auth error instead of
// bringing down the whole build — see README "Deploy to Vercel".
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key";

  if (typeof window !== "undefined" && (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)) {
    // eslint-disable-next-line no-console
    console.warn(
      "Supabase env vars are missing. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY."
    );
  }

  return createBrowserClient(url, key);
}
