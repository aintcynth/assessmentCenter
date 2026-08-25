"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import AdminShell from "@/components/AdminShell";
import StatusPill from "@/components/StatusPill";

// Client-only Supabase calls happen at render time, so skip static
// prerendering (which runs at build time, before env vars may be wired up).
export const dynamic = "force-dynamic";

function generateCertNumber(code) {
  const year = new Date().getFullYear();
  const random = Math.floor(Math.random() * 999999)
    .toString()
    .padStart(6, "0");
  return `AC-${code || "GEN"}${year}${random}`;
}

export default function AdminApplicationDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const supabase = createClient();

  const [profile, setProfile] = useState(null);
  const [app, setApp] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data: p } = await supabase.from("profiles").select("*").eq("id", user.id).single();
    setProfile(p);

    const { data: application } = await supabase
      .from("assessment_applications")
      .select("*, profiles:user_id(ac_name, email, phone, address), qualifications:qualification_id(*)")
      .eq("id", id)
      .single();
    setApp(application);
    setReason(application?.admin_reason || "");

    const { data: docs } = await supabase
      .from("assessment_application_documents")
      .select("*")
      .eq("application_id", id)
      .order("requirement_index");
    setDocuments(docs || []);
  }

  useEffect(() => {
    if (id) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Approved? -> No -> denied, applicant can revise and resubmit
  async function handleDeny() {
    if (!reason.trim()) {
      setError("Add a reason so the applicant knows what to fix.");
      return;
    }
    setBusy(true);
    setError("");
    const { error: updateError } = await supabase
      .from("assessment_applications")
      .update({ status: "denied", admin_reason: reason })
      .eq("id", id);
    if (updateError) setError(updateError.message);
    await load();
    setBusy(false);
  }

  // Approved? -> Yes -> issue certificate, create assessment_centers row
  async function handleApprove() {
    setBusy(true);
    setError("");
    try {
      const today = new Date();
      const expiry = new Date(today);
      expiry.setFullYear(expiry.getFullYear() + 2);

      const { error: certError } = await supabase.from("assessment_centers").insert({
        user_id: app.user_id,
        qualification_id: app.qualification_id,
        application_id: app.id,
        cert_number: generateCertNumber(app.qualifications?.code),
        issuance_date: today.toISOString().slice(0, 10),
        expiration_date: expiry.toISOString().slice(0, 10),
        status: "active",
      });
      if (certError) throw certError;

      const { error: updateError } = await supabase
        .from("assessment_applications")
        .update({ status: "approved", admin_reason: null })
        .eq("id", id);
      if (updateError) throw updateError;

      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (!app) {
    return (
      <AdminShell acName={profile?.ac_name}>
        <p className="text-sm text-ink/50">Loading…</p>
      </AdminShell>
    );
  }

  return (
    <AdminShell acName={profile?.ac_name}>
      <button onClick={() => router.push("/admin/applications")} className="btn-ghost mb-4 !px-0">
        ← Back to applications
      </button>

      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-brass">
            {app.qualifications?.code} · NC {app.qualifications?.level}
          </p>
          <h1 className="font-display text-3xl font-semibold text-seal">{app.qualifications?.name}</h1>
          <p className="mt-1 text-sm text-ink/60">
            {app.profiles?.ac_name} · {app.profiles?.email}
          </p>
        </div>
        <StatusPill status={app.status} />
      </div>

      {error && (
        <div className="mb-6 rounded-seal border border-clay/30 bg-clay/10 px-4 py-3 text-sm text-clay">{error}</div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="card">
            <h2 className="mb-3 font-display text-lg font-semibold text-seal">Documents</h2>
            {documents.length === 0 ? (
              <p className="text-sm text-ink/50">No documents uploaded.</p>
            ) : (
              <ul className="divide-y divide-seal/10">
                {documents.map((doc) => (
                  <li key={doc.id} className="flex items-center justify-between py-2 text-sm">
                    <span>
                      <span className="font-medium text-ink">Req. {doc.requirement_index}:</span>{" "}
                      {doc.filename_original}
                    </span>
                    <a href={doc.file_url} target="_blank" className="font-medium text-seal hover:text-brass">
                      View →
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {app.status === "pending" && (
            <div className="card">
              <h2 className="mb-3 font-display text-lg font-semibold text-seal">Approved?</h2>
              <label className="label">Reason (required if denying)</label>
              <textarea
                className="input-field mb-4"
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Shared with the applicant if the application is denied…"
              />
              <div className="flex gap-3">
                <button disabled={busy} onClick={handleApprove} className="btn-primary">
                  Approve → issue certificate
                </button>
                <button disabled={busy} onClick={handleDeny} className="btn-secondary">
                  Deny application
                </button>
              </div>
            </div>
          )}

          {app.status === "denied" && (
            <div className="card border-clay/30 bg-clay/5">
              <h2 className="mb-2 font-display text-lg font-semibold text-clay">Denied</h2>
              <p className="text-sm text-ink/70">{app.admin_reason}</p>
              <div className="mt-4">
                <button disabled={busy} onClick={handleApprove} className="btn-primary">
                  Reconsider → approve instead
                </button>
              </div>
            </div>
          )}

          {app.status === "approved" && (
            <div className="card border-moss/30 bg-moss/5 text-center">
              <p className="font-display text-lg font-semibold text-moss">
                Accredited — certificate issued
              </p>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="card">
            <h2 className="mb-3 font-display text-sm font-semibold uppercase tracking-wider text-seal/70">
              Applicant
            </h2>
            <p className="text-sm text-ink">{app.profiles?.ac_name}</p>
            <p className="text-sm text-ink/60">{app.profiles?.email}</p>
            <p className="text-sm text-ink/60">{app.profiles?.phone}</p>
            <p className="text-sm text-ink/60">{app.profiles?.address}</p>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
