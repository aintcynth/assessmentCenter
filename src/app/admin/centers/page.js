"use client";

import { useEffect, useMemo, useState } from "react";
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
  const [search, setSearch] = useState("");
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
      .order("issuance_date", { ascending: false });
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

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return centers.filter((c) => {
      const name = c.profiles?.ac_name || c.center_name || "";
      const haystack = `${name} ${c.qualifications?.name || ""} ${c.cert_number} ${c.address || ""}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [centers, search]);

  return (
    <AdminShell acName={profile?.ac_name}>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-brass">Centers</p>
          <h1 className="font-display text-3xl font-semibold text-seal">Assessment centers</h1>
        </div>
        <p className="text-sm text-ink/50">{filtered.length} record(s)</p>
      </div>

      <div className="card overflow-x-auto">
        <input
          className="input-field mb-4 max-w-sm"
          placeholder="Search by center, qualification, or certificate no…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        {filtered.length === 0 ? (
          <p className="text-sm text-ink/50">
            {centers.length === 0
              ? "No centers on record yet — they're created automatically once an application is approved."
              : "No centers match."}
          </p>
        ) : (
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b border-seal/10 text-left text-xs uppercase tracking-wider text-ink/50">
                <th className="pb-3 pr-4 font-medium">Center</th>
                <th className="pb-3 pr-4 font-medium">Qualification</th>
                <th className="pb-3 pr-4 font-medium">Certificate</th>
                <th className="pb-3 pr-4 font-medium">Issued</th>
                <th className="pb-3 pr-4 font-medium">Status</th>
                <th className="pb-3 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-seal/10">
              {filtered.map((c) => (
                <tr key={c.id}>
                  <td className="py-3 pr-4">
                    <p className="font-medium text-ink">{c.profiles?.ac_name || c.center_name}</p>
                    {!c.profiles && c.address && <p className="text-xs text-ink/40">{c.address}</p>}
                  </td>
                  <td className="py-3 pr-4 text-ink/70">{c.qualifications?.name}</td>
                  <td className="py-3 pr-4 font-mono text-xs text-ink/70">{c.cert_number}</td>
                  <td className="py-3 pr-4 text-ink/50">{c.issuance_date}</td>
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
