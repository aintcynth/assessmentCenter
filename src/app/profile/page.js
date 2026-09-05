"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import ClientShell from "@/components/ClientShell";
import Toast from "@/components/Toast";
import { useToast } from "@/lib/useToast";

// Client-only Supabase calls happen at render time, so skip static
// prerendering (which runs at build time, before env vars may be wired up).
export const dynamic = "force-dynamic";

export default function ProfilePage() {
  const supabase = createClient();
  const { toast, showSuccess, showError, closeToast } = useToast();
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState({ ac_name: "", phone: "", address: "", ac_manager: "", ac_type: "" });
  const [saving, setSaving] = useState(false);

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
        ac_manager: p?.ac_manager || "",
        ac_type: p?.ac_type || "",
      });
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const { error } = await supabase.from("profiles").update(form).eq("id", profile.id);
      if (error) throw error;
      showSuccess("Profile updated successfully");
    } catch (err) {
      showError(err.message || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ClientShell acName={profile?.email}>
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
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">AC Manager</label>
            <input
              className="input-field"
              value={form.ac_manager}
              onChange={(e) => setForm({ ...form, ac_manager: e.target.value })}
              placeholder="Manager's full name"
            />
          </div>
          <div>
            <label className="label">AC Type</label>
            <select
              className="input-field"
              value={form.ac_type}
              onChange={(e) => setForm({ ...form, ac_type: e.target.value })}
            >
              <option value="">Select…</option>
              <option value="TTI">TTI</option>
              <option value="TVI">TVI</option>
            </select>
          </div>
        </div>
        <div className="flex justify-end">
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>

      <Toast
        isOpen={toast.isOpen}
        type={toast.type}
        message={toast.message}
        onClose={closeToast}
        duration={toast.duration}
      />
    </ClientShell>
  );
}
