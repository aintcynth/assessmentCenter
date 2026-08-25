import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";

// Mirrors the "Logged in?" / "Login" decision diamonds in the flowchart:
// refreshes the session, then gates /dashboard* and /admin* routes.
export async function updateSession(request) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    // Env vars not configured yet — let requests through rather than
    // crashing every route; pages will show a clear Supabase error instead.
    return response;
  }

  const supabase = createServerClient(
    url,
    key,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isClientArea = path.startsWith("/dashboard") || path.startsWith("/apply") || path.startsWith("/profile") || path.startsWith("/documents") || path.startsWith("/accredited");
  const isAdminArea = path.startsWith("/admin") && path !== "/admin/login";

  // Logged in? -> No -> End (redirect to Log in)
  if (!user && isClientArea) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (!user && isAdminArea) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/login";
    return NextResponse.redirect(url);
  }

  // Admin area also requires role = admin
  if (user && isAdminArea) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    if (profile?.role !== "admin") {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }
  }

  return response;
}
