import { updateSession } from "@/lib/supabase/middleware";

// Renamed from `middleware` to `proxy` per Next.js 16's file convention
// (middleware.js -> proxy.js, exported `middleware` -> exported `proxy`).
// See https://nextjs.org/docs/messages/middleware-to-proxy
export async function proxy(request) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
