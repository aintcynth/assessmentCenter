import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key";

  return createServerClient(
    url,
    key,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component with no write access — safe to ignore
            // because middleware refreshes the session on every request.
          }
        },
      },
    }
  );
}

// Fetches the signed-in user's profile (role, name, etc.), or null if signed
// out or if Supabase isn't reachable (e.g. env vars not yet configured).
// Self-heals: if the auth user exists but the profiles row is missing (e.g.
// the sign-up trigger didn't fire, or was added after this account was
// created), it creates the row on the fly instead of leaving the page with
// nothing to render.
export async function getProfile() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (profile) return { ...profile, authUser: user };

    const { data: created } = await supabase
      .from("profiles")
      .insert({
        id: user.id,
        email: user.email,
        ac_name: user.user_metadata?.ac_name || "",
        phone: user.user_metadata?.phone || null,
        address: user.user_metadata?.address || null,
        role: user.user_metadata?.role || "user",
      })
      .select()
      .single();

    return created ? { ...created, authUser: user } : null;
  } catch {
    return null;
  }
}
