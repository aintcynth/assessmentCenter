import { redirect } from "next/navigation";
import { getProfile } from "@/lib/supabase/server";
import { createClient } from "@/lib/supabase/server";
import AdminShell from "@/components/AdminShell";
import StatusPill from "@/components/StatusPill";

export default async function AdminAccreditedPage() {
  const profile = await getProfile();
  if (!profile) redirect("/admin/login");
  const supabase = createClient();
  const { data: centers } = await supabase
    .from("assessment_centers")
    .select("*, profiles:user_id(ac_name), qualifications:qualification_id(name, code)")
    .eq("status", "active")
    .order("created_at", { ascending: false });

  return (
    <AdminShell acName={profile.ac_name}>
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-wider text-brass">Accredited</p>
        <h1 className="font-display text-3xl font-semibold text-seal">Active accreditations</h1>
      </div>
      <div className="card">
        {!centers || centers.length === 0 ? (
          <p className="text-sm text-ink/50">No centers have been accredited yet.</p>
        ) : (
          <ul className="divide-y divide-seal/10">
            {centers.map((c) => (
              <li key={c.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="font-medium text-ink">{c.qualifications?.name}</p>
                  <p className="text-xs text-ink/50">
                    {c.profiles?.ac_name} · {c.cert_number}
                  </p>
                </div>
                <StatusPill status={c.status} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </AdminShell>
  );
}
