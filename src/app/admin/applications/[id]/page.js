"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { logActivity } from "@/lib/activity";
import AdminShell from "@/components/AdminShell";
import StatusPill from "@/components/StatusPill";
import Trailsheet from "@/components/Trailsheet";
import DocumentTypeTag from "@/components/DocumentTypeTag";

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
  const [inspections, setInspections] = useState([]);
  const [payment, setPayment] = useState(null);
  const [activity, setActivity] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [reason, setReason] = useState("");
  const [inspectorName, setInspectorName] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [reportFile, setReportFile] = useState(null);
  const [lackings, setLackings] = useState("");

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

    const { data: insp } = await supabase
      .from("inspections")
      .select("*")
      .eq("application_id", id)
      .order("created_at", { ascending: false });
    setInspections(insp || []);

    const { data: pay } = await supabase
      .from("payment_submissions")
      .select("*")
      .eq("application_id", id)
      .maybeSingle();
    setPayment(pay);

    const { data: log } = await supabase
      .from("application_activity_log")
      .select("*")
      .eq("application_id", id)
      .order("created_at", { ascending: false });
    setActivity(log || []);
  }

  useEffect(() => {
    if (id) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function currentAdmin() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user;
  }

  async function handleApproveDocs() {
    setBusy(true);
    setError("");
    try {
      const user = await currentAdmin();
      const { error: updateError } = await supabase
        .from("assessment_applications")
        .update({ status: "inspection_scheduled", admin_reason: null })
        .eq("id", id);
      if (updateError) throw updateError;

      await logActivity(supabase, {
        applicationId: id,
        actorId: user.id,
        actorName: profile?.ac_name,
        action: "Documents approved",
      });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleDeny() {
    if (!reason.trim()) {
      setError("Add remarks so the applicant knows what's lacking.");
      return;
    }
    setBusy(true);
    setError("");
    const user = await currentAdmin();
    const { error: updateError } = await supabase
      .from("assessment_applications")
      .update({ status: "denied", admin_reason: reason })
      .eq("id", id);
    if (updateError) {
      setError(updateError.message);
      setBusy(false);
      return;
    }
    await logActivity(supabase, {
      applicationId: id,
      actorId: user.id,
      actorName: profile?.ac_name,
      action: "Documents declined",
      notes: reason,
    });
    await load();
    setBusy(false);
  }

  async function handleScheduleInspection(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const user = await currentAdmin();
      const isReinspection = inspections.length > 0;

      const { error: insertError } = await supabase.from("inspections").insert({
        application_id: id,
        inspection_date: scheduledDate,
        expert_name: inspectorName,
      });
      if (insertError) throw insertError;

      const { error: updateError } = await supabase
        .from("assessment_applications")
        .update({ status: "inspection_scheduled" })
        .eq("id", id);
      if (updateError) throw updateError;

      await logActivity(supabase, {
        applicationId: id,
        actorId: user.id,
        actorName: profile?.ac_name,
        action: isReinspection ? "Reinspection scheduled" : "Inspection scheduled",
        notes: `${scheduledDate} with ${inspectorName}`,
      });

      setInspectorName("");
      setScheduledDate("");
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleMarkNonCompliant() {
    if (!lackings.trim()) {
      setError("Describe what's lacking so the applicant knows what to fix.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const user = await currentAdmin();
      let reportUrl = null;
      if (reportFile) {
        const stored = `${user.id}/${id}/report-${Date.now()}-${reportFile.name}`;
        const { error: uploadError } = await supabase.storage.from("accreditation-files").upload(stored, reportFile);
        if (uploadError) throw uploadError;
        reportUrl = supabase.storage.from("accreditation-files").getPublicUrl(stored).data.publicUrl;
      }

      const latest = inspections[0];
      const { error: updateError } = await supabase
        .from("inspections")
        .update({ compliant: false, lackings, report_url: reportUrl || latest?.report_url })
        .eq("id", latest.id);
      if (updateError) throw updateError;

      await logActivity(supabase, {
        applicationId: id,
        actorId: user.id,
        actorName: profile?.ac_name,
        action: "Marked non-compliant",
        notes: lackings,
      });

      setLackings("");
      setReportFile(null);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleMarkCompliant() {
    setBusy(true);
    setError("");
    try {
      const user = await currentAdmin();
      let reportUrl = null;
      if (reportFile) {
        const stored = `${user.id}/${id}/report-${Date.now()}-${reportFile.name}`;
        const { error: uploadError } = await supabase.storage.from("accreditation-files").upload(stored, reportFile);
        if (uploadError) throw uploadError;
        reportUrl = supabase.storage.from("accreditation-files").getPublicUrl(stored).data.publicUrl;
      }

      const latest = inspections[0];
      const { error: inspUpdateError } = await supabase
        .from("inspections")
        .update({ compliant: true, report_url: reportUrl || latest?.report_url })
        .eq("id", latest.id);
      if (inspUpdateError) throw inspUpdateError;

      const certNumber = generateCertNumber(app.qualifications?.code);
      const { error: appUpdateError } = await supabase
        .from("assessment_applications")
        .update({ status: "awaiting_payment", cert_number: certNumber })
        .eq("id", id);
      if (appUpdateError) throw appUpdateError;

      await logActivity(supabase, {
        applicationId: id,
        actorId: user.id,
        actorName: profile?.ac_name,
        action: "Marked compliant",
        notes: `Certificate number ${certNumber} reserved`,
      });

      setReportFile(null);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleReleaseCertificate() {
    setBusy(true);
    setError("");
    try {
      const user = await currentAdmin();
      const today = new Date();
      const expiry = new Date(today);
      expiry.setFullYear(expiry.getFullYear() + 2);

      const { error: centerError } = await supabase.from("assessment_centers").insert({
        user_id: app.user_id,
        qualification_id: app.qualification_id,
        application_id: app.id,
        cert_number: app.cert_number || generateCertNumber(app.qualifications?.code),
        issuance_date: today.toISOString().slice(0, 10),
        expiration_date: expiry.toISOString().slice(0, 10),
        status: "active",
      });
      if (centerError) throw centerError;

      const { error: updateError } = await supabase
        .from("assessment_applications")
        .update({ status: "accredited" })
        .eq("id", id);
      if (updateError) throw updateError;

      await logActivity(supabase, {
        applicationId: id,
        actorId: user.id,
        actorName: profile?.ac_name,
        action: "Certificate released",
        notes: app.cert_number,
      });

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

  const latestInspection = inspections[0];

  // Every file tied to this application, in one place: the original
  // application documents plus any inspection reports and payment/AOU
  // uploads that have come in since.
  const allFiles = [
    ...documents.map((d) => ({
      id: `doc-${d.id}`,
      kind: "Application document",
      label: `Req. ${d.requirement_index}: ${d.filename_original}`,
      url: d.file_url,
      uploaded_at: d.uploaded_at,
    })),
    ...inspections
      .filter((insp) => insp.report_url)
      .map((insp) => ({
        id: `insp-${insp.id}`,
        kind: "Inspection report",
        label: `Signed report — ${insp.inspection_date || "inspection"}`,
        url: insp.report_url,
        uploaded_at: insp.updated_at || insp.created_at,
      })),
    ...(payment?.receipt_url
      ? [
          {
            id: `receipt-${payment.id}`,
            kind: "Receipt of payment",
            label: "Receipt of payment",
            url: payment.receipt_url,
            uploaded_at: payment.receipt_uploaded_at,
          },
        ]
      : []),
    ...(payment?.aou_url
      ? [
          {
            id: `aou-${payment.id}`,
            kind: "AOU",
            label: "AOU",
            url: payment.aou_url,
            uploaded_at: payment.aou_uploaded_at,
          },
        ]
      : []),
  ].sort((a, b) => new Date(b.uploaded_at || 0) - new Date(a.uploaded_at || 0));

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
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold text-seal">Application documents</h2>
              <span className="text-xs text-ink/40">{allFiles.length} file(s)</span>
            </div>
            {allFiles.length === 0 ? (
              <p className="text-sm text-ink/50">No documents uploaded.</p>
            ) : (
              <ul className="divide-y divide-seal/10">
                {allFiles.map((f) => (
                  <li key={f.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <div className="flex min-w-0 items-center gap-3">
                      <DocumentTypeTag kind={f.kind} />
                      <span className="truncate text-ink">{f.label}</span>
                    </div>
                    <a href={f.url} target="_blank" className="shrink-0 font-medium text-seal hover:text-brass">
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
              <label className="label">Remarks (required if declining)</label>
              <textarea
                className="input-field mb-4"
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Shared with the applicant if declined…"
              />
              <div className="flex gap-3">
                <button disabled={busy} onClick={handleApproveDocs} className="btn-primary">
                  Approve → set inspection date
                </button>
                <button disabled={busy} onClick={handleDeny} className="btn-secondary">
                  Decline
                </button>
              </div>
            </div>
          )}

          {app.status === "denied" && (
            <div className="card border-clay/30 bg-clay/5">
              <h2 className="mb-2 font-display text-lg font-semibold text-clay">Declined</h2>
              <p className="text-sm text-ink/70">{app.admin_reason}</p>
              <p className="mt-2 text-xs text-ink/50">Waiting for the applicant to add documents and resubmit.</p>
            </div>
          )}

          {app.status === "inspection_scheduled" && !latestInspection && (
            <form onSubmit={handleScheduleInspection} className="card space-y-4">
              <h2 className="font-display text-lg font-semibold text-seal">Set inspection date</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="label">Expert</label>
                  <input
                    required
                    className="input-field"
                    value={inspectorName}
                    onChange={(e) => setInspectorName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="label">Inspection date</label>
                  <input
                    type="date"
                    required
                    className="input-field"
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                  />
                </div>
              </div>
              <button type="submit" disabled={busy} className="btn-primary">
                Schedule inspection
              </button>
            </form>
          )}

          {app.status === "inspection_scheduled" && latestInspection && latestInspection.compliant === null && (
            <div className="card space-y-4">
              <h2 className="font-display text-lg font-semibold text-seal">Compliant?</h2>
              <p className="text-sm text-ink/60">
                Inspected {latestInspection.inspection_date} by {latestInspection.expert_name}
              </p>
              <label className="label">Inspection report (optional)</label>
              <input
                type="file"
                className="input-field"
                onChange={(e) => setReportFile(e.target.files?.[0] || null)}
              />
              <label className="label">Lackings (required if non-compliant)</label>
              <textarea
                className="input-field"
                rows={2}
                value={lackings}
                onChange={(e) => setLackings(e.target.value)}
              />
              <div className="flex gap-3">
                <button type="button" disabled={busy} onClick={handleMarkCompliant} className="btn-primary">
                  Yes, compliant
                </button>
                <button type="button" disabled={busy} onClick={handleMarkNonCompliant} className="btn-secondary">
                  No, non-compliant
                </button>
              </div>
            </div>
          )}

          {app.status === "inspection_scheduled" && latestInspection?.compliant === false && (
            <form onSubmit={handleScheduleInspection} className="card space-y-4">
              <h2 className="font-display text-lg font-semibold text-seal">Lackings</h2>
              <div className="rounded-seal border border-clay/30 bg-clay/10 px-4 py-3 text-sm text-clay">
                {latestInspection.lackings}
              </div>
              <h3 className="font-medium text-seal">Schedule reinspection</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="label">Expert</label>
                  <input
                    required
                    className="input-field"
                    value={inspectorName}
                    onChange={(e) => setInspectorName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="label">Reinspection date</label>
                  <input
                    type="date"
                    required
                    className="input-field"
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                  />
                </div>
              </div>
              <button type="submit" disabled={busy} className="btn-primary">
                Schedule reinspection
              </button>
            </form>
          )}

          {app.status === "awaiting_payment" && (
            <div className="card space-y-4">
              <h2 className="font-display text-lg font-semibold text-seal">Receipt of payment / AOU</h2>
              <p className="text-sm text-ink/60">
                Certificate number reserved: <span className="font-mono font-medium text-ink">{app.cert_number}</span>
              </p>
              <div className="grid gap-4 sm:grid-cols-2 text-sm">
                <div className="rounded-seal border border-seal/10 p-4">
                  <p className="mb-1 font-medium text-ink">Receipt of payment</p>
                  {payment?.receipt_url ? (
                    <a href={payment.receipt_url} target="_blank" className="font-medium text-moss">
                      View →
                    </a>
                  ) : (
                    <p className="text-ink/50">Not yet uploaded</p>
                  )}
                </div>
                <div className="rounded-seal border border-seal/10 p-4">
                  <p className="mb-1 font-medium text-ink">AOU</p>
                  {payment?.aou_url ? (
                    <a href={payment.aou_url} target="_blank" className="font-medium text-moss">
                      View →
                    </a>
                  ) : (
                    <p className="text-ink/50">Not yet uploaded</p>
                  )}
                </div>
              </div>
              {payment?.receipt_url && payment?.aou_url ? (
                <button disabled={busy} onClick={handleReleaseCertificate} className="btn-primary">
                  Release approved certificate
                </button>
              ) : (
                <p className="text-xs text-ink/50">Waiting for the applicant to upload both documents.</p>
              )}
            </div>
          )}

          {app.status === "accredited" && (
            <div className="card border-moss/30 bg-moss/5 text-center">
              <p className="font-display text-lg font-semibold text-moss">
                Accredited — certificate {app.cert_number} released
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

          <div className="card">
            <h2 className="mb-3 font-display text-sm font-semibold uppercase tracking-wider text-seal/70">
              Trailsheet
            </h2>
            <Trailsheet entries={activity} />
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
