"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { logActivity } from "@/lib/activity";
import ClientShell from "@/components/ClientShell";
import StatusPill from "@/components/StatusPill";
import Trailsheet from "@/components/Trailsheet";
import DocumentTypeTag from "@/components/DocumentTypeTag";
import PdfViewer from "@/components/PdfViewer";

// Client-only Supabase calls happen at render time, so skip static
// prerendering (which runs at build time, before env vars may be wired up).
export const dynamic = "force-dynamic";

export default function ApplicationDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const supabase = createClient();

  const [profile, setProfile] = useState(null);
  const [app, setApp] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [inspections, setInspections] = useState([]);
  const [payment, setPayment] = useState(null);
  const [center, setCenter] = useState(null);
  const [activity, setActivity] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Edit & resubmit (denied applications)
  const [newDocLabel, setNewDocLabel] = useState("");
  const [newDocFile, setNewDocFile] = useState(null);

  // Payment / AOU uploads (awaiting_payment applications)
  const [receiptFile, setReceiptFile] = useState(null);
  const [aouFile, setAouFile] = useState(null);

  async function load() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { data: p } = await supabase.from("profiles").select("*").eq("id", user.id).single();
    setProfile(p);

    const { data: application } = await supabase
      .from("assessment_applications")
      .select("*, qualifications:qualification_id(*)")
      .eq("id", id)
      .single();
    setApp(application);

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

    const { data: c } = await supabase
      .from("assessment_centers")
      .select("*")
      .eq("application_id", id)
      .maybeSingle();
    setCenter(c);

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

  async function handleAddDocument(e) {
    e.preventDefault();
    if (!newDocFile) return;
    setBusy(true);
    setError("");
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const nextIndex = documents.length + 1;
      const stored = `${user.id}/${id}/${Date.now()}-req${nextIndex}-${newDocFile.name}`;
      const { error: uploadError } = await supabase.storage.from("accreditation-files").upload(stored, newDocFile);
      if (uploadError) throw uploadError;
      const { data: publicUrl } = supabase.storage.from("accreditation-files").getPublicUrl(stored);

      const { error: insertError } = await supabase.from("assessment_application_documents").insert({
        application_id: id,
        requirement_index: nextIndex,
        filename_original: newDocFile.name,
        filename_stored: stored,
        file_url: publicUrl.publicUrl,
        mime_type: newDocFile.type,
        size_bytes: newDocFile.size,
      });
      if (insertError) throw insertError;

      await logActivity(supabase, {
        applicationId: id,
        actorId: user.id,
        actorName: profile?.ac_name,
        action: "Document added",
        notes: newDocLabel || newDocFile.name,
      });

      setNewDocLabel("");
      setNewDocFile(null);
      e.target.reset();
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleResubmit() {
    setBusy(true);
    setError("");
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { error: updateError } = await supabase
        .from("assessment_applications")
        .update({ status: "pending" })
        .eq("id", id);
      if (updateError) throw updateError;

      await logActivity(supabase, {
        applicationId: id,
        actorId: user.id,
        actorName: profile?.ac_name,
        action: "Application resubmitted",
      });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function uploadPaymentFile(file, kind) {
    setBusy(true);
    setError("");
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const stored = `${user.id}/${id}/${kind}-${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage.from("accreditation-files").upload(stored, file);
      if (uploadError) throw uploadError;
      const { data: publicUrl } = supabase.storage.from("accreditation-files").getPublicUrl(stored);

      const patch =
        kind === "receipt"
          ? {
              receipt_url: publicUrl.publicUrl,
              receipt_uploaded_at: new Date().toISOString(),
              receipt_status: "pending",
              receipt_reject_reason: null,
            }
          : {
              aou_url: publicUrl.publicUrl,
              aou_uploaded_at: new Date().toISOString(),
              aou_status: "pending",
              aou_reject_reason: null,
            };

      const { error: upsertError } = await supabase
        .from("payment_submissions")
        .upsert({ application_id: id, ...patch }, { onConflict: "application_id" });
      if (upsertError) throw upsertError;

      await logActivity(supabase, {
        applicationId: id,
        actorId: user.id,
        actorName: profile?.ac_name,
        action: kind === "receipt" ? "Receipt of payment uploaded" : "AOU uploaded",
      });

      if (kind === "receipt") setReceiptFile(null);
      else setAouFile(null);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (!app) {
    return (
      <ClientShell acName={profile?.ac_name}>
        <p className="text-sm text-ink/50">Loading…</p>
      </ClientShell>
    );
  }

  const latestInspection = inspections[0];
  const isCertificateStage = app.status === "awaiting_payment" || app.status === "certificate_processing";

  const allFiles = [
    ...documents.map((d) => ({
      id: `doc-${d.id}`,
      kind: "Application document",
      label: `Req. ${d.requirement_index}: ${d.filename_original}`,
      url: d.file_url,
      uploaded_at: d.uploaded_at,
    })),
    ...inspections
      .filter((insp) => insp.notification_pdf_url)
      .map((insp) => ({
        id: `notif-${insp.id}`,
        kind: "Pre-notification letter",
        label: `Pre-inspection notification — ${insp.inspection_date || "inspection"}`,
        url: insp.notification_pdf_url,
        uploaded_at: insp.created_at,
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
    <ClientShell acName={profile?.ac_name}>
      <button onClick={() => router.push("/dashboard")} className="btn-ghost mb-4 !px-0">
        ← Back to dashboard
      </button>

      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-brass">
            {app.qualifications?.code} · NC {app.qualifications?.level}
          </p>
          <h1 className="font-display text-3xl font-semibold text-seal">{app.qualifications?.name}</h1>
        </div>
        <StatusPill status={app.status} />
      </div>

      {error && (
        <div className="mb-6 rounded-seal border border-clay/30 bg-clay/10 px-4 py-3 text-sm text-clay">{error}</div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {app.status === "pending" && (
            <div className="card">
              <h2 className="mb-2 font-display text-lg font-semibold text-seal">Under review</h2>
              <p className="text-sm text-ink/60">
                An admin is reviewing your submitted documents. You'll see an update here once they've made a
                decision.
              </p>
            </div>
          )}

          {app.status === "denied" && (
            <div className="card border-clay/30 bg-clay/5 space-y-4">
              <div>
                <h2 className="font-display text-lg font-semibold text-clay">Documents declined</h2>
                <p className="mt-1 text-sm text-ink/70">{app.admin_reason}</p>
              </div>
              <form onSubmit={handleAddDocument} className="grid gap-3 rounded-seal border border-seal/10 bg-white p-4 sm:grid-cols-[1fr_1fr_auto]">
                <input
                  className="input-field"
                  placeholder="Document label"
                  value={newDocLabel}
                  onChange={(e) => setNewDocLabel(e.target.value)}
                />
                <input
                  type="file"
                  className="input-field"
                  onChange={(e) => setNewDocFile(e.target.files?.[0] || null)}
                />
                <button type="submit" disabled={busy || !newDocFile} className="btn-secondary">
                  Add document
                </button>
              </form>
              <button disabled={busy} onClick={handleResubmit} className="btn-primary">
                Resubmit for review
              </button>
            </div>
          )}

          {app.status === "inspection_scheduled" && (
            <div className="card space-y-3">
              <h2 className="font-display text-lg font-semibold text-seal">Inspection</h2>
              {latestInspection ? (
                <>
                  <p className="text-sm text-ink/70">
                    Scheduled for <span className="font-medium text-ink">{latestInspection.inspection_date}</span>{" "}
                    at <span className="font-medium text-ink">{latestInspection.inspection_time}</span> with{" "}
                    <span className="font-medium text-ink">{latestInspection.expert_name}</span>.
                  </p>
                  {latestInspection.notification_pdf_url && (
                    <PdfViewer
                      url={latestInspection.notification_pdf_url}
                      title="Pre-inspection notification letter"
                      height={340}
                    />
                  )}
                  {latestInspection.compliant === false && (
                    <div className="rounded-seal border border-clay/30 bg-clay/10 px-4 py-3 text-sm text-clay">
                      <p className="font-medium">Non-compliant on last visit</p>
                      <p className="mt-1">{latestInspection.lackings}</p>
                      <p className="mt-1 text-xs">A reinspection date will be set by the admin.</p>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-ink/60">Waiting for the admin to set an inspection date.</p>
              )}
            </div>
          )}

          {isCertificateStage && !app.notified_at && (
            <div className="card">
              <h2 className="mb-2 font-display text-lg font-semibold text-seal">Compliant — certificate in progress</h2>
              <p className="text-sm text-ink/60">
                Your inspection passed. The admin is preparing your certificate and AOU — you'll be notified here
                once payment and AOU are needed.
              </p>
            </div>
          )}

          {isCertificateStage && app.notified_at && (
            <div className="card space-y-4">
              <h2 className="font-display text-lg font-semibold text-seal">Payment &amp; AOU required</h2>
              <p className="text-sm text-ink/60">
                Issued {app.issuance_date} · Expires {app.expiration_date}
              </p>

              <div className="grid gap-4 sm:grid-cols-2">
                <PdfViewer url={app.cert_pdf_url} title="Certificate of Accreditation (draft)" height={360} />
                <PdfViewer url={app.aou_pdf_url} title="AOU (template — print, sign, and upload below)" height={360} />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-seal border border-seal/10 p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-sm font-medium text-ink">Receipt of payment</p>
                    {payment?.receipt_status && <StatusPill status={payment.receipt_status} />}
                  </div>
                  {payment?.receipt_url && payment.receipt_status !== "rejected" ? (
                    <a href={payment.receipt_url} target="_blank" className="text-sm font-medium text-moss">
                      Uploaded — view →
                    </a>
                  ) : (
                    <>
                      {payment?.receipt_status === "rejected" && (
                        <p className="mb-2 text-xs text-clay">Rejected: {payment.receipt_reject_reason}</p>
                      )}
                      <div className="flex gap-2">
                        <input
                          type="file"
                          className="input-field"
                          onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
                        />
                        <button
                          disabled={busy || !receiptFile}
                          onClick={() => uploadPaymentFile(receiptFile, "receipt")}
                          className="btn-secondary shrink-0"
                        >
                          Upload
                        </button>
                      </div>
                    </>
                  )}
                </div>
                <div className="rounded-seal border border-seal/10 p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-sm font-medium text-ink">AOU</p>
                    {payment?.aou_status && <StatusPill status={payment.aou_status} />}
                  </div>
                  {payment?.aou_url && payment.aou_status !== "rejected" ? (
                    <a href={payment.aou_url} target="_blank" className="text-sm font-medium text-moss">
                      Uploaded — view →
                    </a>
                  ) : (
                    <>
                      {payment?.aou_status === "rejected" && (
                        <p className="mb-2 text-xs text-clay">Rejected: {payment.aou_reject_reason}</p>
                      )}
                      <div className="flex gap-2">
                        <input
                          type="file"
                          className="input-field"
                          onChange={(e) => setAouFile(e.target.files?.[0] || null)}
                        />
                        <button
                          disabled={busy || !aouFile}
                          onClick={() => uploadPaymentFile(aouFile, "aou")}
                          className="btn-secondary shrink-0"
                        >
                          Upload
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {payment?.receipt_status === "acknowledged" && payment?.aou_status === "acknowledged" && (
                <p className="text-sm text-moss">
                  Both documents acknowledged. Waiting for the admin to upload your signed certificate and release it.
                </p>
              )}
            </div>
          )}

          {app.status === "accredited" && (
            <div className="card border-moss/30 bg-moss/5 space-y-3">
              <h2 className="font-display text-lg font-semibold text-moss">Accredited</h2>
              {center ? (
                <div className="space-y-1 text-sm">
                  <p>
                    Certificate <span className="font-mono font-medium">{center.cert_number}</span>
                  </p>
                  <p className="text-ink/60">
                    Issued {center.issuance_date} · Expires {center.expiration_date}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-ink/60">Certificate details are being finalized.</p>
              )}
              <PdfViewer url={center?.cert_url || app.signed_cert_url || app.cert_pdf_url} title="Certificate of Accreditation" />
            </div>
          )}

          <div className="card">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold text-seal">Documents</h2>
              <span className="text-xs text-ink/40">{allFiles.length} file(s)</span>
            </div>
            {allFiles.length === 0 ? (
              <p className="text-sm text-ink/50">No documents on file.</p>
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
        </div>

        <div className="card">
          <h2 className="mb-4 font-display text-sm font-semibold uppercase tracking-wider text-seal/70">
            Trailsheet
          </h2>
          <Trailsheet entries={activity} />
        </div>
      </div>
    </ClientShell>
  );
}
