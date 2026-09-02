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
  const [allUsers, setAllUsers] = useState([]);
  const [search, setSearch] = useState("");
  const [unclaimedOnly, setUnclaimedOnly] = useState(false);
  const [busyId, setBusyId] = useState(null);

  // Linking panel state
  const [linkingCenter, setLinkingCenter] = useState(null);
  const [linkSearch, setLinkSearch] = useState("");
  const [linkTargetUserId, setLinkTargetUserId] = useState("");
  const [linkAllSameName, setLinkAllSameName] = useState(true);
  const [linkBusy, setLinkBusy] = useState(false);
  const [linkError, setLinkError] = useState("");

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

    const { data: users } = await supabase
      .from("profiles")
      .select("id, ac_name, email")
      .eq("role", "user")
      .order("ac_name");
    setAllUsers(users || []);
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

  function openLinkPanel(center) {
    setLinkingCenter(center);
    setLinkSearch("");
    setLinkTargetUserId("");
    setLinkAllSameName(true);
    setLinkError("");
  }

  const matchingUnclaimedCount = useMemo(() => {
    if (!linkingCenter) return 0;
    return centers.filter((c) => !c.user_id && c.center_name === linkingCenter.center_name).length;
  }, [centers, linkingCenter]);

  async function handleLink() {
    if (!linkTargetUserId) {
      setLinkError("Pick a user to link this center to.");
      return;
    }
    setLinkBusy(true);
    setLinkError("");
    try {
      let query = supabase.from("assessment_centers").update({ user_id: linkTargetUserId });
      if (linkAllSameName) {
        query = query.eq("center_name", linkingCenter.center_name).is("user_id", null);
      } else {
        query = query.eq("id", linkingCenter.id);
      }
      const { error } = await query;
      if (error) throw error;
      setLinkingCenter(null);
      await load();
    } catch (err) {
      setLinkError(err.message);
    } finally {
      setLinkBusy(false);
    }
  }

  async function handleUnlink(center) {
    setBusyId(center.id);
    await supabase.from("assessment_centers").update({ user_id: null }).eq("id", center.id);
    await load();
    setBusyId(null);
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return centers
      .filter((c) => (unclaimedOnly ? !c.user_id : true))
      .filter((c) => {
        const name = c.profiles?.ac_name || c.center_name || "";
        const haystack = `${name} ${c.qualifications?.name || ""} ${c.cert_number} ${c.address || ""}`.toLowerCase();
        return haystack.includes(q);
      });
  }, [centers, search, unclaimedOnly]);

  const filteredUsers = useMemo(() => {
    const q = linkSearch.toLowerCase();
    return allUsers.filter((u) => `${u.ac_name} ${u.email}`.toLowerCase().includes(q));
  }, [allUsers, linkSearch]);

  const unclaimedTotal = centers.filter((c) => !c.user_id).length;

  return (
    <AdminShell acName={profile?.ac_name}>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-brass">Centers</p>
          <h1 className="font-display text-3xl font-semibold text-seal">Assessment centers</h1>
        </div>
        <p className="text-sm text-ink/50">
          {filtered.length} record(s){unclaimedTotal > 0 && ` · ${unclaimedTotal} unclaimed`}
        </p>
      </div>

      {linkingCenter && (
        <div className="card mb-6 space-y-4 border-brass/30 bg-brass-light/10">
          <div>
            <h2 className="font-display text-lg font-semibold text-seal">
              Link "{linkingCenter.center_name}" to an account
            </h2>
            <p className="text-sm text-ink/60">
              {linkingCenter.qualifications?.name} · {linkingCenter.cert_number}
            </p>
          </div>

          <input
            className="input-field"
            placeholder="Search users by name or email…"
            value={linkSearch}
            onChange={(e) => setLinkSearch(e.target.value)}
          />
          <div className="max-h-56 overflow-y-auto rounded-seal border border-seal/10">
            {filteredUsers.length === 0 ? (
              <p className="px-4 py-3 text-sm text-ink/50">No matching users.</p>
            ) : (
              filteredUsers.map((u) => (
                <label
                  key={u.id}
                  className={`flex cursor-pointer items-center justify-between border-b border-seal/5 px-4 py-2.5 text-sm last:border-b-0 ${
                    linkTargetUserId === u.id ? "bg-seal/5" : "hover:bg-seal/5"
                  }`}
                >
                  <span>
                    <span className="font-medium text-ink">{u.ac_name || "(no name set)"}</span>
                    <span className="ml-2 text-xs text-ink/50">{u.email}</span>
                  </span>
                  <input
                    type="radio"
                    name="linkTargetUser"
                    checked={linkTargetUserId === u.id}
                    onChange={() => setLinkTargetUserId(u.id)}
                  />
                </label>
              ))
            )}
          </div>

          {matchingUnclaimedCount > 1 && (
            <label className="flex items-center gap-2 text-sm text-ink/70">
              <input
                type="checkbox"
                checked={linkAllSameName}
                onChange={(e) => setLinkAllSameName(e.target.checked)}
              />
              Link all {matchingUnclaimedCount} unclaimed records for this center (every qualification), not just
              this one
            </label>
          )}

          {linkError && <p className="text-sm text-clay">{linkError}</p>}

          <div className="flex gap-3">
            <button disabled={linkBusy} onClick={handleLink} className="btn-primary">
              {linkBusy ? "Linking…" : "Link account"}
            </button>
            <button type="button" onClick={() => setLinkingCenter(null)} className="btn-secondary">
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="card overflow-x-auto">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <input
            className="input-field max-w-sm"
            placeholder="Search by center, qualification, or certificate no…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <label className="flex items-center gap-2 text-sm text-ink/70">
            <input type="checkbox" checked={unclaimedOnly} onChange={(e) => setUnclaimedOnly(e.target.checked)} />
            Unclaimed only
          </label>
        </div>

        {filtered.length === 0 ? (
          <p className="text-sm text-ink/50">
            {centers.length === 0
              ? "No centers on record yet — they're created automatically once an application is approved."
              : "No centers match."}
          </p>
        ) : (
          <table className="w-full min-w-[900px] text-sm">
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
                    {!c.user_id && (
                      <span className="status-pill mt-1 border-ink/15 bg-ink/5 text-ink/50">Unclaimed</span>
                    )}
                  </td>
                  <td className="py-3 pr-4 text-ink/70">{c.qualifications?.name}</td>
                  <td className="py-3 pr-4 font-mono text-xs text-ink/70">{c.cert_number}</td>
                  <td className="py-3 pr-4 text-ink/50">{c.issuance_date}</td>
                  <td className="py-3 pr-4">
                    <StatusPill status={c.status} />
                  </td>
                  <td className="py-3 text-right">
                    <div className="flex items-center justify-end gap-3">
                      {c.user_id ? (
                        <button
                          disabled={busyId === c.id}
                          onClick={() => handleUnlink(c)}
                          className="text-xs font-medium text-ink/50 hover:text-clay"
                        >
                          Unlink
                        </button>
                      ) : (
                        <button
                          onClick={() => openLinkPanel(c)}
                          className="text-sm font-medium text-seal hover:text-brass"
                        >
                          Link account
                        </button>
                      )}
                      <button
                        disabled={busyId === c.id}
                        onClick={() => toggleStatus(c)}
                        className="text-sm font-medium text-seal hover:text-brass"
                      >
                        {c.status === "active" ? "Deactivate" : "Reactivate"}
                      </button>
                    </div>
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
