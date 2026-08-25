import { redirect } from "next/navigation";
import Link from "next/link";
import { getProfile } from "@/lib/supabase/server";
import { createClient } from "@/lib/supabase/server";
import AdminShell from "@/components/AdminShell";
import StatusPill from "@/components/StatusPill";

export default async function AdminDashboardPage() {
  const profile = await getProfile();
  if (!profile) redirect("/admin/login");
  const supabase = createClient();

  const { data: applications } = await supabase
    .from("assessment_applications")
    .select("*, profiles:user_id(ac_name, email), qualifications:qualification_id(name, code)")
    .order("created_at", { ascending: false });

  const apps = applications || [];
  const counts = {
    pending: apps.filter((a) => a.status === "pending").length,
    approved: apps.filter((a) => a.status === "approved").length,
    denied: apps.filter((a) => a.status === "denied").length,
    total: apps.length,
  };

  return (
    <AdminShell acName={profile.ac_name}>
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-wider text-brass">Admin dashboard</p>
        <h1 className="font-display text-3xl font-semibold text-seal">Accreditation overview</h1>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="card">
          <p className="text-xs uppercase tracking-wider text-ink/50">Total applications</p>
          <p className="mt-2 font-display text-3xl text-seal">{counts.total}</p>
        </div>
        <div className="card">
          <p className="text-xs uppercase tracking-wider text-ink/50">Pending</p>
          <p className="mt-2 font-display text-3xl text-brass">{counts.pending}</p>
        </div>
        <div className="card">
          <p className="text-xs uppercase tracking-wider text-ink/50">Approved</p>
          <p className="mt-2 font-display text-3xl text-moss">{counts.approved}</p>
        </div>
        <div className="card">
          <p className="text-xs uppercase tracking-wider text-ink/50">Denied</p>
          <p className="mt-2 font-display text-3xl text-clay">{counts.denied}</p>
        </div>
      </div>

      <div className="card">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-seal">Recent applications</h2>
          <Link href="/admin/applications" className="text-sm font-medium text-seal/70 hover:text-seal">
            View all →
          </Link>
        </div>
        {apps.length === 0 ? (
          <p className="text-sm text-ink/50">No applications yet.</p>
        ) : (
          <ul className="divide-y divide-seal/10">
            {apps.slice(0, 8).map((app) => (
              <li key={app.id} className="flex items-center justify-between gap-4 py-3">
                <div>
                  <p className="font-medium text-ink">{app.qualifications?.name}</p>
                  <p className="text-xs text-ink/50">{app.profiles?.ac_name}</p>
                </div>
                <div className="flex items-center gap-3">
                  <StatusPill status={app.status} />
                  <Link
                    href={`/admin/applications/${app.id}`}
                    className="text-sm font-medium text-seal hover:text-brass"
                  >
                    Review
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AdminShell>
  );
}
