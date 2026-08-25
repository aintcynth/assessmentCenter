"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import AdminShell from "@/components/AdminShell";

// Client-only Supabase calls happen at render time, so skip static
// prerendering (which runs at build time, before env vars may be wired up).
export const dynamic = "force-dynamic";

export default function AdminUsersPage() {
  const supabase = createClient();
  const [profile, setProfile] = useState(null);
  const [users, setUsers] = useState([]);
  const [busyId, setBusyId] = useState(null);

  async function load() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data: p } = await supabase.from("profiles").select("*").eq("id", user.id).single();
    setProfile(p);

    const { data } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
    setUsers(data || []);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function toggleRole(userRow) {
    setBusyId(userRow.id);
    const nextRole = userRow.role === "admin" ? "user" : "admin";
    await supabase.from("profiles").update({ role: nextRole }).eq("id", userRow.id);
    await load();
    setBusyId(null);
  }

  return (
    <AdminShell acName={profile?.ac_name}>
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-wider text-brass">Users</p>
        <h1 className="font-display text-3xl font-semibold text-seal">All accounts</h1>
      </div>
      <div className="card overflow-x-auto">
        {users.length === 0 ? (
          <p className="text-sm text-ink/50">No users yet.</p>
        ) : (
          <table className="w-full min-w-[600px] text-sm">
            <thead>
              <tr className="border-b border-seal/10 text-left text-xs uppercase tracking-wider text-ink/50">
                <th className="pb-3 pr-4 font-medium">Name</th>
                <th className="pb-3 pr-4 font-medium">Email</th>
                <th className="pb-3 pr-4 font-medium">Role</th>
                <th className="pb-3 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-seal/10">
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="py-3 pr-4 font-medium text-ink">{u.ac_name || "—"}</td>
                  <td className="py-3 pr-4 text-ink/70">{u.email}</td>
                  <td className="py-3 pr-4">
                    <span
                      className={`status-pill ${
                        u.role === "admin"
                          ? "border-brass/40 bg-brass-light/40 text-brass"
                          : "border-seal/20 bg-seal/5 text-seal/70"
                      }`}
                    >
                      {u.role}
                    </span>
                  </td>
                  <td className="py-3 text-right">
                    <button
                      disabled={busyId === u.id}
                      onClick={() => toggleRole(u)}
                      className="text-sm font-medium text-seal hover:text-brass"
                    >
                      {u.role === "admin" ? "Revoke admin" : "Make admin"}
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
