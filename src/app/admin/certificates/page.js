import { redirect } from "next/navigation";
import { getProfile } from "@/lib/supabase/server";
import { createClient } from "@/lib/supabase/server";
import AdminShell from "@/components/AdminShell";

export default async function AdminCertificatesPage() {
  const profile = await getProfile();
  if (!profile) redirect("/admin/login");
  const supabase = await createClient();
  const { data: centers } = await supabase
    .from("assessment_centers")
    .select("*, profiles:user_id(ac_name), qualifications:qualification_id(name, code)")
    .order("issuance_date", { ascending: false });

  return (
    <AdminShell acName={profile.ac_name}>
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-wider text-brass">Certificate of accreditation</p>
        <h1 className="font-display text-3xl font-semibold text-seal">Issued certificates</h1>
      </div>
      <div className="card overflow-x-auto">
        {!centers || centers.length === 0 ? (
          <p className="text-sm text-ink/50">No certificates issued yet.</p>
        ) : (
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-seal/10 text-left text-xs uppercase tracking-wider text-ink/50">
                <th className="pb-3 pr-4 font-medium">Certificate no.</th>
                <th className="pb-3 pr-4 font-medium">Center</th>
                <th className="pb-3 pr-4 font-medium">Qualification</th>
                <th className="pb-3 pr-4 font-medium">Issued</th>
                <th className="pb-3 font-medium">Expires</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-seal/10">
              {centers.map((c) => (
                <tr key={c.id}>
                  <td className="py-3 pr-4 font-mono text-xs text-ink/70">{c.cert_number}</td>
                  <td className="py-3 pr-4 font-medium text-ink">{c.profiles?.ac_name}</td>
                  <td className="py-3 pr-4 text-ink/70">{c.qualifications?.name}</td>
                  <td className="py-3 pr-4 text-ink/70">{c.issuance_date}</td>
                  <td className="py-3 text-ink/70">{c.expiration_date || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </AdminShell>
  );
}
