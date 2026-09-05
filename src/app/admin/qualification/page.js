"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import AdminShell from "@/components/AdminShell";
import Modal from "@/components/Modal";
import Toast from "@/components/Toast";
import { useModal } from "@/lib/useModal";
import { useToast } from "@/lib/useToast";

// Client-only Supabase calls happen at render time, so skip static
// prerendering (which runs at build time, before env vars may be wired up).
export const dynamic = "force-dynamic";

export default function AdminQualificationPage() {
  const supabase = createClient();
  const { modal, showSuccess, showError, closeModal } = useModal();
  const { toast, showSuccess: toastSuccess, closeToast } = useToast();
  
  const [profile, setProfile] = useState(null);
  const [qualifications, setQualifications] = useState([]);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ name: "", description: "", level: "", code: "" });
  const [saving, setSaving] = useState(false);

  async function load() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data: p } = await supabase.from("profiles").select("*").eq("id", user.id).single();
    setProfile(p);

    const { data } = await supabase.from("qualifications").select("*").order("name");
    setQualifications(data || []);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleAdd(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const nextId = qualifications.length ? Math.max(...qualifications.map((q) => q.id)) + 1 : 1;
      const { error: insertError } = await supabase.from("qualifications").insert({ id: nextId, ...form });
      if (insertError) throw insertError;
      setForm({ name: "", description: "", level: "", code: "" });
      await load();
      toastSuccess(`${form.name} added successfully`);
    } catch (err) {
      showError("Failed to Add", err.message || "Could not add qualification", "Try Again");
    } finally {
      setSaving(false);
    }
  }

  const filtered = qualifications.filter((q) =>
    (q.name + " " + q.code + " " + (q.description || "")).toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AdminShell acName={profile?.ac_name}>
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-wider text-brass">Qualification</p>
        <h1 className="font-display text-3xl font-semibold text-seal">NC qualification catalog</h1>
      </div>

      <form onSubmit={handleAdd} className="card mb-8 grid gap-4 sm:grid-cols-2">
        <h2 className="font-display text-lg font-semibold text-seal sm:col-span-2">Add qualification</h2>
        <div>
          <label className="label">Name</label>
          <input required className="input-field" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. COOKERY NC II" />
        </div>
        <div>
          <label className="label">Code</label>
          <input required className="input-field" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="e.g. COK" />
        </div>
        <div>
          <label className="label">Sector / description</label>
          <input className="input-field" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="e.g. Tourism (Hotel and Restaurant)" />
        </div>
        <div>
          <label className="label">Level</label>
          <input required className="input-field" value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })} placeholder="e.g. II" />
        </div>

        <div className="sm:col-span-2 flex justify-end">
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? "Adding…" : "Add qualification"}
          </button>
        </div>
      </form>

      <div className="card">
        <input
          className="input-field mb-4"
          placeholder="Search qualifications…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="max-h-[32rem] overflow-y-auto">
          <table className="w-full min-w-[600px] text-sm">
            <thead>
              <tr className="border-b border-seal/10 text-left text-xs uppercase tracking-wider text-ink/50">
                <th className="pb-3 pr-4 font-medium">Name</th>
                <th className="pb-3 pr-4 font-medium">Code</th>
                <th className="pb-3 font-medium">Level</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-seal/10">
              {filtered.map((q) => (
                <tr key={q.id}>
                  <td className="py-2.5 pr-4">
                    <p className="font-medium text-ink">{q.name}</p>
                    <p className="text-xs text-ink/50">{q.description}</p>
                  </td>
                  <td className="py-2.5 pr-4 font-mono text-xs text-ink/70">{q.code}</td>
                  <td className="py-2.5 text-ink/70">{q.level}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        isOpen={modal.isOpen}
        type={modal.type}
        title={modal.title}
        message={modal.message}
        actionLabel={modal.actionLabel}
        onClose={closeModal}
      />

      <Toast
        isOpen={toast.isOpen}
        type={toast.type}
        message={toast.message}
        onClose={closeToast}
        duration={toast.duration}
      />
    </AdminShell>
  );
}
