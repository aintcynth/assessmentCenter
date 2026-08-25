"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import ClientShell from "@/components/ClientShell";

// Client-only Supabase calls happen at render time, so skip static
// prerendering (which runs at build time, before env vars may be wired up).
export const dynamic = "force-dynamic";

export default function ProfilePage() {
  const supabase = createClient();
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState({ ac_name: "", phone: "", address: "" });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data: p } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      setProfile(p);
      setForm({
        ac_name: p?.ac_name || "",
        phone: p?.phone || "",
        address: p?.address || "",
      });
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    await supabase.from("profiles").update(form).eq("id", profile.id);
    setSaving(false);
    setSaved(true);
  }

  return (
    <ClientShell acName={profile?.ac_name}>
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-wider text-brass">Profile</p>
        <h1 className="font-display text-3xl font-semibold text-seal">Your details</h1>
      </div>

      <form onSubmit={handleSubmit} className="card max-w-xl space-y-4">
        <div>
          <label className="label">Assessment center / applicant name</label>
          <input
            className="input-field"
            value={form.ac_name}
            onChange={(e) => setForm({ ...form, ac_name: e.target.value })}
          />
        </div>
        <div>
          <label className="label">Email</label>
          <input className="input-field bg-mist/50" value={profile?.email || ""} disabled />
        </div>
        <div>
          <label className="label">Phone</label>
          <input
            className="input-field"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
        </div>
        <div>
          <label className="label">Address</label>
          <textarea
            className="input-field"
            rows={2}
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
          />
        </div>
        {saved && <p className="text-sm text-moss">Profile updated.</p>}
        <div className="flex justify-end">
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>
    </ClientShell>
  );
}
