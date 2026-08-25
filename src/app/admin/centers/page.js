"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import AdminShell from "@/components/AdminShell";
import StatusPill from "@/components/StatusPill";

// Client-only Supabase calls happen at render time, so skip static
// prerendering (which runs at build time, before env vars may be wired up).
export const dynamic = "force-dynamic";

export default function AdminCentersPage() {
  const supabase = createClient();
  const [profile, setProfile] = useState(null);
  const [centers, setCenters] = useState([]);
  const [busyId, setBusyId] = useState(null);

  async function load() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data: p } = await supabase.from("profiles").select("*").eq("id", user.id).single();
    setProfile(p);

    const { data } = await supabase
      .from("assessment_centers")
      .select("*, profiles:user_id(ac_name, email), qualifications:qualification_id(name, code)")
      .order("created_at", { ascending: false });
    setCenters(data || []);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function toggleStatus(center) {
    setBusyId(center.id);
    const next = center.status === "active" ? "inactive" : "active";
    await supabase.from("assessment_centers").update({ status: next }).eq("id", center.id);
    await load();
    setBusyId(null);
  }

  return (
    <AdminShell acName={profile?.ac_name}>
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-wider text-brass">Centers</p>
        <h1 className="font-display text-3xl font-semibold text-seal">Assessment centers</h1>
      </div>
      <div className="card overflow-x-auto">
        {centers.length === 0 ? (
          <p className="text-sm text-ink/50">
            No centers on record yet — they're created automatically once an application is approved.
          </p>
        ) : (
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-seal/10 text-left text-xs uppercase tracking-wider text-ink/50">
                <th className="pb-3 pr-4 font-medium">Center</th>
                <th className="pb-3 pr-4 font-medium">Qualification</th>
                <th className="pb-3 pr-4 font-medium">Certificate</th>
                <th className="pb-3 pr-4 font-medium">Status</th>
                <th className="pb-3 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-seal/10">
              {centers.map((c) => (
                <tr key={c.id}>
                  <td className="py-3 pr-4 font-medium text-ink">{c.profiles?.ac_name}</td>
                  <td className="py-3 pr-4 text-ink/70">{c.qualifications?.name}</td>
                  <td className="py-3 pr-4 font-mono text-xs text-ink/70">{c.cert_number}</td>
                  <td className="py-3 pr-4">
                    <StatusPill status={c.status} />
                  </td>
                  <td className="py-3 text-right">
                    <button
                      disabled={busyId === c.id}
                      onClick={() => toggleStatus(c)}
                      className="text-sm font-medium text-seal hover:text-brass"
                    >
                      {c.status === "active" ? "Deactivate" : "Reactivate"}
                    </button>
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
