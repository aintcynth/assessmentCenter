"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { logActivity } from "@/lib/activity";
import AdminShell from "@/components/AdminShell";
import StatusPill from "@/components/StatusPill";
import Trailsheet from "@/components/Trailsheet";
import DocumentTypeTag from "@/components/DocumentTypeTag";
import PdfViewer from "@/components/PdfViewer";
import { notifyUser } from "@/lib/notifications";
import { generateCertificatePdf, generateAouPdf } from "@/lib/certificatePdf";
import { loadImageAsPngDataUrl } from "@/lib/loadImage";
import { generateCertNumber, previewCertNumber } from "@/lib/certNumber";

// Client-only Supabase calls happen at render time, so skip static
// prerendering (which runs at build time, before env vars may be wired up).
export const dynamic = "force-dynamic";

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

  const [issuanceDate, setIssuanceDate] = useState("");
  const [certPreview, setCertPreview] = useState(null);
  const [certPreviewLoading, setCertPreviewLoading] = useState(false);
  const [signedCertFile, setSignedCertFile] = useState(null);
  const [rejectingKind, setRejectingKind] = useState(null); // "receipt" | "aou" | null
  const [rejectReason, setRejectReason] = useState("");

  async function load() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data: p } = await supabase.from("profiles").select("*").eq("id", user.id).single();
    setProfile(p);

    const { data: application } = await supabase
      .from("assessment_applications")
      .select("*, profiles:user_id(ac_name, email, phone, address, ac_manager, ac_type), qualifications:qualification_id(*)")
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

  // Live preview of the certificate number as the admin picks an issuance
  // date, before actually generating anything.
  useEffect(() => {
    if (!issuanceDate || !app) {
      setCertPreview(null);
      return;
    }
    let cancelled = false;
    setCertPreviewLoading(true);
    const issued = new Date(issuanceDate + "T00:00:00");
    const expiry = new Date(issued);
    expiry.setFullYear(expiry.getFullYear() + 2);
    const expirationDate = expiry.toISOString().slice(0, 10);

    previewCertNumber(supabase, {
      code: app.qualifications?.code,
      level: app.qualifications?.level,
      issuanceDate,
      expirationDate,
    })
      .then((result) => {
        if (!cancelled) setCertPreview(result);
      })
      .finally(() => {
        if (!cancelled) setCertPreviewLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [issuanceDate, app]);

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

      const { error: appUpdateError } = await supabase
        .from("assessment_applications")
        .update({ status: "certificate_processing" })
        .eq("id", id);
      if (appUpdateError) throw appUpdateError;

      await logActivity(supabase, {
        applicationId: id,
        actorId: user.id,
        actorName: profile?.ac_name,
        action: "Marked compliant",
      });

      setReportFile(null);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  // Set issuance date (expiry auto = +2 years) and generate the draft
  // certificate + AOU PDFs for the admin to review before notifying.
  async function handleGenerateCertificate(e) {
    e.preventDefault();
    if (!issuanceDate) return;
    setBusy(true);
    setError("");
    try {
      const user = await currentAdmin();
      const issued = new Date(issuanceDate + "T00:00:00");
      const expiry = new Date(issued);
      expiry.setFullYear(expiry.getFullYear() + 2);
      const expirationDate = expiry.toISOString().slice(0, 10);

      const { data: settings } = await supabase.from("app_settings").select("logo_url").eq("id", 1).maybeSingle();
      const logo = await loadImageAsPngDataUrl(settings?.logo_url);

      const certNumber = await generateCertNumber(supabase, {
        code: app.qualifications?.code,
        level: app.qualifications?.level,
        issuanceDate,
        expirationDate,
      });

      const certBlob = generateCertificatePdf({
        acName: app.profiles?.ac_name,
        address: app.profiles?.address,
        qualificationName: app.qualifications?.name,
        certNumber,
        issuanceDate,
        expirationDate,
        logo,
      });
      const aouBlob = generateAouPdf({
        acName: app.profiles?.ac_name,
        address: app.profiles?.address,
        acManager: app.profiles?.ac_manager,
        qualificationName: app.qualifications?.name,
      });

      const certPath = `${user.id}/${id}/certificate-draft-${Date.now()}.pdf`;
      const aouPath = `${user.id}/${id}/aou-draft-${Date.now()}.pdf`;

      const { error: certUploadError } = await supabase.storage
        .from("accreditation-files")
        .upload(certPath, certBlob, { contentType: "application/pdf" });
      if (certUploadError) throw certUploadError;
      const { error: aouUploadError } = await supabase.storage
        .from("accreditation-files")
        .upload(aouPath, aouBlob, { contentType: "application/pdf" });
      if (aouUploadError) throw aouUploadError;

      const certUrl = supabase.storage.from("accreditation-files").getPublicUrl(certPath).data.publicUrl;
      const aouUrl = supabase.storage.from("accreditation-files").getPublicUrl(aouPath).data.publicUrl;

      const { error: updateError } = await supabase
        .from("assessment_applications")
        .update({
          issuance_date: issuanceDate,
          expiration_date: expirationDate,
          cert_number: certNumber,
          cert_pdf_url: certUrl,
          aou_pdf_url: aouUrl,
        })
        .eq("id", id);
      if (updateError) throw updateError;

      await logActivity(supabase, {
        applicationId: id,
        actorId: user.id,
        actorName: profile?.ac_name,
        action: "Certificate & AOU generated",
        notes: `${certNumber} — issued ${issuanceDate}, expires ${expirationDate}`,
      });

      setIssuanceDate("");
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  // Notify the client that their draft certificate and AOU are ready and
  // that payment + a signed AOU are needed next.
  async function handleNotifyClient() {
    setBusy(true);
    setError("");
    try {
      const user = await currentAdmin();
      await notifyUser(supabase, {
        userId: app.user_id,
        applicationId: id,
        title: "Payment and AOU required",
        message: `Your certificate for ${app.qualifications?.name} is ready for review. Please upload your receipt of payment and signed AOU.`,
      });

      const { error: updateError } = await supabase
        .from("assessment_applications")
        .update({ notified_at: new Date().toISOString() })
        .eq("id", id);
      if (updateError) throw updateError;

      await logActivity(supabase, {
        applicationId: id,
        actorId: user.id,
        actorName: profile?.ac_name,
        action: "Client notified",
        notes: "Payment and AOU required",
      });

      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  // Acknowledge or reject the uploaded receipt of payment / AOU
  // independently of each other.
  async function handleAcknowledge(kind) {
    setBusy(true);
    setError("");
    try {
      const user = await currentAdmin();
      const patch =
        kind === "receipt"
          ? { receipt_status: "acknowledged", receipt_reject_reason: null }
          : { aou_status: "acknowledged", aou_reject_reason: null };
      const { error: updateError } = await supabase.from("payment_submissions").update(patch).eq("id", payment.id);
      if (updateError) throw updateError;

      await logActivity(supabase, {
        applicationId: id,
        actorId: user.id,
        actorName: profile?.ac_name,
        action: kind === "receipt" ? "Receipt of payment acknowledged" : "AOU acknowledged",
      });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleReject(kind) {
    if (!rejectReason.trim()) {
      setError("Add a reason so the applicant knows what to fix.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const user = await currentAdmin();
      const patch =
        kind === "receipt"
          ? { receipt_status: "rejected", receipt_reject_reason: rejectReason }
          : { aou_status: "rejected", aou_reject_reason: rejectReason };
      const { error: updateError } = await supabase.from("payment_submissions").update(patch).eq("id", payment.id);
      if (updateError) throw updateError;

      await notifyUser(supabase, {
        userId: app.user_id,
        applicationId: id,
        title: kind === "receipt" ? "Receipt of payment rejected" : "AOU rejected",
        message: rejectReason,
      });

      await logActivity(supabase, {
        applicationId: id,
        actorId: user.id,
        actorName: profile?.ac_name,
        action: kind === "receipt" ? "Receipt of payment rejected" : "AOU rejected",
        notes: rejectReason,
      });

      setRejectingKind(null);
      setRejectReason("");
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  // Admin uploads the final, signed certificate ahead of release.
  async function handleUploadSignedCert(e) {
    e.preventDefault();
    if (!signedCertFile) return;
    setBusy(true);
    setError("");
    try {
      const user = await currentAdmin();
      const stored = `${user.id}/${id}/signed-certificate-${Date.now()}-${signedCertFile.name}`;
      const { error: uploadError } = await supabase.storage.from("accreditation-files").upload(stored, signedCertFile);
      if (uploadError) throw uploadError;
      const signedUrl = supabase.storage.from("accreditation-files").getPublicUrl(stored).data.publicUrl;

      const { error: updateError } = await supabase
        .from("assessment_applications")
        .update({ signed_cert_url: signedUrl })
        .eq("id", id);
      if (updateError) throw updateError;

      await logActivity(supabase, {
        applicationId: id,
        actorId: user.id,
        actorName: profile?.ac_name,
        action: "Signed certificate uploaded",
      });

      setSignedCertFile(null);
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

      const { error: centerError } = await supabase.from("assessment_centers").insert({
        user_id: app.user_id,
        qualification_id: app.qualification_id,
        application_id: app.id,
        cert_number: app.cert_number || "AC-UNSET",
        issuance_date: app.issuance_date,
        expiration_date: app.expiration_date,
        cert_url: app.signed_cert_url,
        status: "active",
      });
      if (centerError) throw centerError;

      const { error: updateError } = await supabase
        .from("assessment_applications")
        .update({ status: "accredited" })
        .eq("id", id);
      if (updateError) throw updateError;

      await notifyUser(supabase, {
        userId: app.user_id,
        applicationId: id,
        title: "Certificate released",
        message: `Your certificate ${app.cert_number} for ${app.qualifications?.name} has been released.`,
      });

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
  const isCertificateStage = app.status === "awaiting_payment" || app.status === "certificate_processing";
  const allAcknowledged = payment?.receipt_status === "acknowledged" && payment?.aou_status === "acknowledged";

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

          {isCertificateStage && !app.issuance_date && (
            <form onSubmit={handleGenerateCertificate} className="card space-y-4">
              <h2 className="font-display text-lg font-semibold text-seal">Set issuance date</h2>
              <p className="text-sm text-ink/60">
                The certificate number is generated automatically once you pick an issuance date.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="label">Issuance date</label>
                  <input
                    type="date"
                    required
                    className="input-field"
                    value={issuanceDate}
                    onChange={(e) => setIssuanceDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="label">Expiration date (auto)</label>
                  <input
                    className="input-field bg-mist/50"
                    disabled
                    value={
                      issuanceDate
                        ? (() => {
                            const d = new Date(issuanceDate + "T00:00:00");
                            d.setFullYear(d.getFullYear() + 2);
                            return d.toISOString().slice(0, 10);
                          })()
                        : ""
                    }
                    placeholder="Pick an issuance date"
                  />
                </div>
              </div>
              {issuanceDate && (
                <p className="text-sm text-ink/60">
                  {certPreviewLoading ? (
                    "Calculating certificate number…"
                  ) : certPreview ? (
                    <>
                      This will be the <span className="font-medium text-ink">{certPreview.label}</span> —{" "}
                      <span className="font-mono font-medium text-ink">{certPreview.certNumber}</span>
                    </>
                  ) : null}
                </p>
              )}
              <button type="submit" disabled={busy || !issuanceDate} className="btn-primary">
                Generate certificate &amp; AOU
              </button>
            </form>
          )}

          {isCertificateStage && app.issuance_date && !app.notified_at && (
            <div className="card space-y-4">
              <h2 className="font-display text-lg font-semibold text-seal">Review generated documents</h2>
              <p className="text-sm text-ink/60">
                <span className="font-mono font-medium text-ink">{app.cert_number}</span> · Issued {app.issuance_date}{" "}
                · Expires {app.expiration_date}
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <PdfViewer url={app.cert_pdf_url} title="Certificate of Accreditation (draft)" />
                <PdfViewer url={app.aou_pdf_url} title="AOU (template)" />
              </div>
              <button disabled={busy} onClick={handleNotifyClient} className="btn-primary">
                Notify client — payment &amp; AOU required
              </button>
            </div>
          )}

          {isCertificateStage && app.notified_at && !allAcknowledged && (
            <div className="card space-y-4">
              <h2 className="font-display text-lg font-semibold text-seal">Receipt of payment / AOU</h2>
              <p className="text-sm text-ink/60">Client notified {new Date(app.notified_at).toLocaleString()}</p>

              <div className="grid gap-4 sm:grid-cols-2 text-sm">
                <div className="rounded-seal border border-seal/10 p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="font-medium text-ink">Receipt of payment</p>
                    {payment?.receipt_status && <StatusPill status={payment.receipt_status} />}
                  </div>
                  {payment?.receipt_url ? (
                    <>
                      <a href={payment.receipt_url} target="_blank" className="font-medium text-moss">
                        View →
                      </a>
                      {payment.receipt_status === "pending" && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            disabled={busy}
                            onClick={() => handleAcknowledge("receipt")}
                            className="btn-secondary !px-3 !py-1.5 text-xs"
                          >
                            Acknowledge
                          </button>
                          <button
                            disabled={busy}
                            onClick={() => {
                              setRejectingKind("receipt");
                              setRejectReason("");
                            }}
                            className="btn-secondary !px-3 !py-1.5 text-xs !text-clay"
                          >
                            Reject
                          </button>
                        </div>
                      )}
                      {payment.receipt_status === "rejected" && (
                        <p className="mt-2 text-xs text-clay">Reason: {payment.receipt_reject_reason}</p>
                      )}
                    </>
                  ) : (
                    <p className="text-ink/50">Not yet uploaded</p>
                  )}
                </div>

                <div className="rounded-seal border border-seal/10 p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="font-medium text-ink">AOU</p>
                    {payment?.aou_status && <StatusPill status={payment.aou_status} />}
                  </div>
                  {payment?.aou_url ? (
                    <>
                      <a href={payment.aou_url} target="_blank" className="font-medium text-moss">
                        View →
                      </a>
                      {payment.aou_status === "pending" && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            disabled={busy}
                            onClick={() => handleAcknowledge("aou")}
                            className="btn-secondary !px-3 !py-1.5 text-xs"
                          >
                            Acknowledge
                          </button>
                          <button
                            disabled={busy}
                            onClick={() => {
                              setRejectingKind("aou");
                              setRejectReason("");
                            }}
                            className="btn-secondary !px-3 !py-1.5 text-xs !text-clay"
                          >
                            Reject
                          </button>
                        </div>
                      )}
                      {payment.aou_status === "rejected" && (
                        <p className="mt-2 text-xs text-clay">Reason: {payment.aou_reject_reason}</p>
                      )}
                    </>
                  ) : (
                    <p className="text-ink/50">Not yet uploaded</p>
                  )}
                </div>
              </div>

              {rejectingKind && (
                <div className="rounded-seal border border-clay/30 bg-clay/5 p-4">
                  <label className="label">
                    Reason for rejecting the {rejectingKind === "receipt" ? "receipt of payment" : "AOU"}
                  </label>
                  <textarea
                    className="input-field mb-3"
                    rows={2}
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                  />
                  <div className="flex gap-3">
                    <button disabled={busy} onClick={() => handleReject(rejectingKind)} className="btn-primary !bg-clay hover:!bg-clay/90">
                      Confirm reject
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setRejectingKind(null);
                        setRejectReason("");
                      }}
                      className="btn-secondary"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {(!payment?.receipt_url || !payment?.aou_url) && (
                <p className="text-xs text-ink/50">Waiting for the applicant to upload both documents.</p>
              )}
            </div>
          )}

          {isCertificateStage && allAcknowledged && !app.signed_cert_url && (
            <form onSubmit={handleUploadSignedCert} className="card space-y-4">
              <h2 className="font-display text-lg font-semibold text-seal">Upload signed certificate</h2>
              <p className="text-sm text-ink/60">
                Both the receipt of payment and AOU have been acknowledged. Upload the signed certificate to
                proceed to release.
              </p>
              <input
                type="file"
                accept="application/pdf,image/*"
                required
                className="input-field"
                onChange={(e) => setSignedCertFile(e.target.files?.[0] || null)}
              />
              <button type="submit" disabled={busy || !signedCertFile} className="btn-primary">
                Upload signed certificate
              </button>
            </form>
          )}

          {isCertificateStage && allAcknowledged && app.signed_cert_url && (
            <div className="card space-y-4">
              <h2 className="font-display text-lg font-semibold text-seal">Release</h2>
              <PdfViewer url={app.signed_cert_url} title="Signed certificate" />
              <button disabled={busy} onClick={handleReleaseCertificate} className="btn-primary">
                Release approved certificate
              </button>
            </div>
          )}

          {app.status === "accredited" && (
            <div className="card border-moss/30 bg-moss/5 space-y-3">
              <p className="font-display text-lg font-semibold text-moss">
                Accredited — certificate {app.cert_number} released
              </p>
              <PdfViewer url={app.signed_cert_url || app.cert_pdf_url} title="Certificate of Accreditation" />
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
            {(app.profiles?.ac_manager || app.profiles?.ac_type) && (
              <div className="mt-3 space-y-1 border-t border-seal/10 pt-3 text-sm">
                {app.profiles?.ac_manager && (
                  <p className="text-ink/60">
                    <span className="text-ink/40">AC Manager:</span> {app.profiles.ac_manager}
                  </p>
                )}
                {app.profiles?.ac_type && (
                  <p className="text-ink/60">
                    <span className="text-ink/40">AC Type:</span> {app.profiles.ac_type}
                  </p>
                )}
              </div>
            )}
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
