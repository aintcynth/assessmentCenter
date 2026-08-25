import Link from "next/link";
import { getProfile } from "@/lib/supabase/server";
import { createClient } from "@/lib/supabase/server";
import AdminShell from "@/components/AdminShell";
import StatusPill from "@/components/StatusPill";

export default async function AdminApplicationsPage() {
  const profile = await getProfile();
  const supabase = createClient();

  const { data: applications } = await supabase
    .from("assessment_applications")
    .select("*, profiles:user_id(ac_name, email), qualifications:qualification_id(name, code, level)")
    .order("created_at", { ascending: false });

  return (
    <AdminShell acName={profile.ac_name}>
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-wider text-brass">Applications</p>
        <h1 className="font-display text-3xl font-semibold text-seal">Application queue</h1>
      </div>

      <div className="card overflow-x-auto">
        {!applications || applications.length === 0 ? (
          <p className="text-sm text-ink/50">No applications submitted yet.</p>
        ) : (
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-seal/10 text-left text-xs uppercase tracking-wider text-ink/50">
                <th className="pb-3 pr-4 font-medium">Qualification</th>
                <th className="pb-3 pr-4 font-medium">Applicant</th>
                <th className="pb-3 pr-4 font-medium">Status</th>
                <th className="pb-3 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-seal/10">
              {applications.map((app) => (
                <tr key={app.id}>
                  <td className="py-3 pr-4">
                    <p className="font-medium text-ink">{app.qualifications?.name}</p>
                    <p className="text-xs text-ink/50">{app.qualifications?.code}</p>
                  </td>
                  <td className="py-3 pr-4 text-ink/70">{app.profiles?.ac_name || "—"}</td>
                  <td className="py-3 pr-4">
                    <StatusPill status={app.status} />
                  </td>
                  <td className="py-3 text-right">
                    <Link
                      href={`/admin/applications/${app.id}`}
                      className="text-sm font-medium text-seal hover:text-brass"
                    >
                      Review →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </AdminShell>
  );
}
