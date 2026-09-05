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

export default function AdminSettingsPage() {
  const supabase = createClient();
  const { modal, showSuccess, showError, closeModal } = useModal();
  const { toast, showSuccess: toastSuccess, showError: toastError, closeToast } = useToast();
  
  const [profile, setProfile] = useState(null);
  const [logoUrl, setLogoUrl] = useState(null);
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data: p } = await supabase.from("profiles").select("*").eq("id", user.id).single();
    setProfile(p);

    const { data: settings } = await supabase.from("app_settings").select("*").eq("id", 1).maybeSingle();
    setLogoUrl(settings?.logo_url || null);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleUpload(e) {
    e.preventDefault();
    if (!file) return;
    setBusy(true);
    try {
      const stored = `branding/logo-${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage.from("accreditation-files").upload(stored, file);
      if (uploadError) throw uploadError;
      const publicUrl = supabase.storage.from("accreditation-files").getPublicUrl(stored).data.publicUrl;

      const { error: upsertError } = await supabase
        .from("app_settings")
        .upsert({ id: 1, logo_url: publicUrl, updated_at: new Date().toISOString() });
      if (upsertError) throw upsertError;

      setLogoUrl(publicUrl);
      setFile(null);
      toastSuccess("Logo uploaded successfully");
    } catch (err) {
      showError("Upload Failed", err.message || "Failed to upload logo", "Retry");
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove() {
    setBusy(true);
    try {
      const { error: upsertError } = await supabase
        .from("app_settings")
        .upsert({ id: 1, logo_url: null, updated_at: new Date().toISOString() });
      if (upsertError) throw upsertError;
      setLogoUrl(null);
      toastSuccess("Logo removed successfully");
    } catch (err) {
      toastError(err.message || "Failed to remove logo");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminShell acName={profile?.ac_name}>
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-wider text-brass">Settings</p>
        <h1 className="font-display text-3xl font-semibold text-seal">Certificate logo</h1>
      </div>

      <div className="card max-w-lg space-y-4">
        <p className="text-sm text-ink/60">
          Upload the official seal/logo to use on generated certificates. If none is set, a plain placeholder seal
          is drawn instead.
        </p>

        {logoUrl ? (
          <div className="flex items-center gap-4 rounded-seal border border-seal/10 p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logoUrl} alt="Certificate logo" className="h-20 w-20 rounded-full border border-black/10 object-contain bg-white" />
            <div>
              <p className="text-sm font-medium text-ink">Current logo</p>
              <button onClick={handleRemove} disabled={busy} className="mt-1 text-xs font-medium text-clay hover:underline">
                Remove
              </button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-ink/50">No logo uploaded yet — using the placeholder seal.</p>
        )}

        <form onSubmit={handleUpload} className="space-y-3">
          <div>
            <label className="label">{logoUrl ? "Replace logo" : "Upload logo"}</label>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="input-field"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
          </div>
          <button type="submit" disabled={busy || !file} className="btn-primary">
            {busy ? "Saving…" : "Save logo"}
          </button>
        </form>
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
