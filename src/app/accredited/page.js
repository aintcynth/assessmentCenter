import { redirect } from "next/navigation";
import { getProfile } from "@/lib/supabase/server";
import { createClient } from "@/lib/supabase/server";
import ClientShell from "@/components/ClientShell";
import StatusPill from "@/components/StatusPill";

export default async function AccreditedPage() {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  const supabase = await createClient();

  const { data: centers } = await supabase
    .from("assessment_centers")
    .select("*, qualifications:qualification_id(name, code, level)")
    .eq("user_id", profile.authUser.id)
    .order("created_at", { ascending: false });

  return (
    <ClientShell acName={profile.ac_name}>
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-wider text-brass">Accredited</p>
        <h1 className="font-display text-3xl font-semibold text-seal">Your accredited qualifications</h1>
      </div>

      {!centers || centers.length === 0 ? (
        <div className="card text-center">
          <p className="text-sm text-ink/60">
            No accredited qualifications yet. Once your application is approved, its certificate will appear here.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {centers.map((c) => (
            <div key={c.id} className="card">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-display text-lg font-semibold text-seal">{c.qualifications?.name}</p>
                  <p className="text-xs text-ink/50">
                    {c.qualifications?.code} · NC {c.qualifications?.level}
                  </p>
                </div>
                <StatusPill status={c.status} />
              </div>
              <div className="mt-4 rounded-seal border border-brass/30 bg-brass-light/20 px-4 py-3 text-sm">
                <p className="font-medium text-seal">Certificate {c.cert_number}</p>
                <p className="text-xs text-ink/60">
                  Issued {c.issuance_date || "—"} · Expires {c.expiration_date || "—"}
                </p>
                {c.cert_url && (
                  <a
                    href={c.cert_url}
                    target="_blank"
                    className="mt-2 inline-block text-sm font-semibold text-seal hover:text-brass"
                  >
                    View certificate →
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </ClientShell>
  );
}
