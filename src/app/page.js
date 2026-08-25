import { redirect } from "next/navigation";
import { getProfile } from "@/lib/supabase/server";

export default async function StartPage() {
  const profile = await getProfile();

  // Start -> Logged in? -> Yes -> Dashboard, No -> Log in
  if (!profile) redirect("/login");
  if (profile.role === "admin") redirect("/admin/dashboard");
  redirect("/dashboard");
}
