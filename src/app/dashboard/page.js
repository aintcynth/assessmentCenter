import { redirect } from "next/navigation";
import Link from "next/link";
import { FileText, Clock3, CheckCircle2 } from "lucide-react";
import { getProfile } from "@/lib/supabase/server";
import { createClient } from "@/lib/supabase/server";
import ClientShell from "@/components/ClientShell";
import StatusPill from "@/components/StatusPill";
import StatCard from "@/components/StatCard";

export default async function DashboardPage() {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  const supabase = await createClient();
  const { data: applications } = await supabase
    .from("assessment_applications")
    .select("*, qualifications:qualification_id(name, code, level)")
    .eq("user_id", profile.authUser.id)
    .order("created_at", { ascending: false });

  const apps = applications || [];
  const pending = apps.filter((a) => a.status === "pending").length;
  const approved = apps.filter((a) => a.status === "approved").length;

  return (
    <ClientShell acName={profile.email}>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-brass">Applicant workspace</p>
          <h1 className="font-display text-3xl font-semibold text-seal">
            Welcome, {profile.ac_name || "there"}
          </h1>
        </div>
        <Link href="/apply" className="btn-primary">
          Apply as AC
        </Link>
      </div>

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard icon={FileText} label="Total applications" value={apps.length} />
        <StatCard
          icon={Clock3}
          label="Pending review"
          value={pending}
          delta={pending > 0 ? "Awaiting admin action" : undefined}
          deltaTone="neutral"
        />
        <StatCard
          icon={CheckCircle2}
          label="Approved"
          value={approved}
          delta={approved > 0 ? "On track" : undefined}
        />
      </div>

      <div className="card">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-seal">Your applications</h2>
          <Link href="/documents" className="text-sm font-medium text-seal/70 hover:text-seal">
            View documents →
          </Link>
        </div>

        {apps.length === 0 ? (
          <div className="rounded-seal border border-dashed border-seal/20 px-6 py-10 text-center">
            <p className="text-sm text-ink/60">
              You haven't started an application yet. Apply as AC to pick a qualification and begin
              accreditation.
            </p>
            <Link href="/apply" className="btn-primary mt-4 inline-flex">
              Apply as AC
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-seal/10">
            {apps.map((app) => (
              <li key={app.id} className="flex items-center justify-between gap-4 py-4">
                <div>
                  <p className="font-medium text-ink">{app.qualifications?.name}</p>
                  <p className="text-xs text-ink/50">
                    {app.qualifications?.code} · NC {app.qualifications?.level}
                  </p>
                  {app.status === "denied" && app.admin_reason && (
                    <p className="mt-1 text-xs text-clay">Reason: {app.admin_reason}</p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <StatusPill status={app.status} />
                  <Link
                    href={`/application/${app.id}`}
                    className="text-sm font-medium text-seal hover:text-brass"
                  >
                    View
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </ClientShell>
  );
}
