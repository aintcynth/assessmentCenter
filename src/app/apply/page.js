"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { logActivity } from "@/lib/activity";
import ClientShell from "@/components/ClientShell";
import Modal from "@/components/Modal";
import Toast from "@/components/Toast";
import { LoadingSpinner, FullPageLoader } from "@/components/LoadingSpinner";
import { useModal } from "@/lib/useModal";
import { useToast } from "@/lib/useToast";

// Client-only Supabase calls happen at render time, so skip static
// prerendering (which runs at build time, before env vars may be wired up).
export const dynamic = "force-dynamic";

const STEPS = ["Apply?", "Qualification", "Documents required", "Application"];

export default function ApplyPage() {
  return (
    <Suspense fallback={null}>
      <ApplyWizard />
    </Suspense>
  );
}

function ApplyWizard() {
  const router = useRouter();
  const supabase = createClient();

  const { modal, showSuccess: showModal, showError: showModalError, closeModal } = useModal();
  const { toast, showSuccess: toastSuccess, showError: toastError, closeToast } = useToast();

  const [profile, setProfile] = useState(null);
  const [step, setStep] = useState(0);
  const [qualifications, setQualifications] = useState([]);
  const [search, setSearch] = useState("");
  const [qualificationId, setQualificationId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Staged documents: uploaded to storage immediately, persisted to the DB
  // only once the application itself is created on final submit.
  const [stagedDocs, setStagedDocs] = useState([]);
  const [docLabel, setDocLabel] = useState("");
  const [docFile, setDocFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    async function init() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data: p } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      setProfile(p);

      const { data: quals } = await supabase.from("qualifications").select("*").order("name");
      setQualifications(quals || []);
      setLoading(false);
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Apply? -> No -> back to Dashboard, Yes -> Qualification
  function handleApplyDecision(yes) {
    if (!yes) {
      router.push("/dashboard");
      return;
    }
    setStep(1);
  }

  function handleQualificationSubmit(e) {
    e.preventDefault();
    if (!qualificationId) return;
    setStep(2);
  }

  async function handleDocUpload(e) {
    e.preventDefault();
    if (!docFile) return;
    setUploading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const stored = `${user.id}/${Date.now()}-req${stagedDocs.length + 1}-${docFile.name}`;
      const { error: uploadError } = await supabase.storage.from("accreditation-files").upload(stored, docFile);
      if (uploadError) throw uploadError;
      const { data: publicUrl } = supabase.storage.from("accreditation-files").getPublicUrl(stored);

      setStagedDocs((prev) => [
        ...prev,
        {
          requirement_index: prev.length + 1,
          filename_original: docFile.name,
          filename_stored: stored,
          file_url: publicUrl.publicUrl,
          mime_type: docFile.type,
          size_bytes: docFile.size,
          label: docLabel || docFile.name,
        },
      ]);
      setDocLabel("");
      setDocFile(null);
      e.target.reset();
      toastSuccess("Document uploaded successfully");
    } catch (err) {
      toastError(err.message || "Failed to upload document");
    } finally {
      setUploading(false);
    }
  }

  function removeStagedDoc(index) {
    setStagedDocs((prev) => prev.filter((_, i) => i !== index).map((d, i) => ({ ...d, requirement_index: i + 1 })));
  }

  async function handleFinalSubmit() {
    setSaving(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { data: application, error: insertError } = await supabase
        .from("assessment_applications")
        .insert({ user_id: user.id, qualification_id: Number(qualificationId), status: "pending" })
        .select()
        .single();
      if (insertError) throw insertError;

      if (stagedDocs.length) {
        const rows = stagedDocs.map((d) => ({
          application_id: application.id,
          requirement_index: d.requirement_index,
          filename_original: d.filename_original,
          filename_stored: d.filename_stored,
          file_url: d.file_url,
          mime_type: d.mime_type,
          size_bytes: d.size_bytes,
        }));
        const { error: docsError } = await supabase.from("assessment_application_documents").insert(rows);
        if (docsError) throw docsError;
      }

      await logActivity(supabase, {
        applicationId: application.id,
        actorId: user.id,
        actorName: profile?.ac_name,
        action: "Application submitted",
        notes: `${selectedQualification?.name || "Qualification"} · ${stagedDocs.length} document(s) attached`,
      });

      // Show success modal with action to go to dashboard
      showModal(
        "Application Submitted",
        "Your accreditation application has been successfully submitted. You will receive updates via email.",
        "View Dashboard",
        () => router.push("/dashboard")
      );
    } catch (err) {
      showModalError(
        "Submission Failed",
        err.message || "Unable to submit application. Please try again.",
        "Retry",
        handleFinalSubmit
      );
    } finally {
      setSaving(false);
    }
  }

  const filteredQualifications = qualifications.filter((q) =>
    (q.name + " " + q.code).toLowerCase().includes(search.toLowerCase())
  );
  const selectedQualification = qualifications.find((q) => String(q.id) === String(qualificationId));

  if (loading) {
    return (
      <ClientShell acName={profile?.email}>
        <FullPageLoader message="Loading your application..." />
      </ClientShell>
    );
  }

  return (
    <ClientShell acName={profile?.email}>
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-wider text-brass">Apply for scholarship</p>
        <h1 className="font-display text-3xl font-semibold text-seal">Center accreditation application</h1>
      </div>

      <ol className="mb-8 flex flex-wrap gap-2 text-xs">
        {STEPS.map((label, i) => (
          <li
            key={label}
            className={`rounded-full border px-3 py-1.5 font-medium ${
              i === step
                ? "border-seal bg-seal text-parchment"
                : i < step
                ? "border-moss/40 bg-moss/10 text-moss"
                : "border-seal/15 text-ink/40"
            }`}
          >
            {i + 1}. {label}
          </li>
        ))}
      </ol>

      {step === 0 && (
        <div className="card">
          <h2 className="font-display text-xl font-semibold text-seal">Apply?</h2>
          <p className="mt-2 text-sm text-ink/60">
            Would you like to start a new assessment center accreditation application?
          </p>
          <div className="mt-6 flex gap-3">
            <button className="btn-primary" onClick={() => handleApplyDecision(true)}>
              Yes, start application
            </button>
            <button className="btn-secondary" onClick={() => handleApplyDecision(false)}>
              No, not now
            </button>
          </div>
        </div>
      )}

      {step === 1 && (
        <form onSubmit={handleQualificationSubmit} className="card space-y-4">
          <h2 className="font-display text-xl font-semibold text-seal">Qualification</h2>
          <p className="text-sm text-ink/60">Choose the National Certificate (NC) you're seeking accreditation for.</p>
          <input
            className="input-field"
            placeholder="Search qualifications (e.g. Cookery, Welding, ATS)…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="max-h-72 overflow-y-auto rounded-seal border border-seal/10">
            {filteredQualifications.map((q) => (
              <label
                key={q.id}
                className={`flex cursor-pointer items-center justify-between border-b border-seal/5 px-4 py-2.5 text-sm last:border-b-0 ${
                  String(qualificationId) === String(q.id) ? "bg-seal/5" : "hover:bg-seal/5"
                }`}
              >
                <span>
                  <span className="font-medium text-ink">{q.name}</span>
                  <span className="ml-2 text-xs text-ink/50">{q.description}</span>
                </span>
                <input
                  type="radio"
                  name="qualification"
                  value={q.id}
                  checked={String(qualificationId) === String(q.id)}
                  onChange={(e) => setQualificationId(e.target.value)}
                />
              </label>
            ))}
            {filteredQualifications.length === 0 && (
              <p className="px-4 py-3 text-sm text-ink/50">No qualifications match your search.</p>
            )}
          </div>
          <div className="flex justify-between">
            <button type="button" className="btn-secondary" onClick={() => setStep(0)}>
              Back
            </button>
            <button type="submit" disabled={!qualificationId} className="btn-primary">
              Continue to documents
            </button>
          </div>
        </form>
      )}

      {step === 2 && (
        <div className="card space-y-4">
          <h2 className="font-display text-xl font-semibold text-seal">Documents required</h2>
          <p className="text-sm text-ink/60">
            Upload the required documents for your accreditation(e.g Letter of Intent, SEC Registration, Financial Statement, Business Permit , etc.).
          </p>

          <form onSubmit={handleDocUpload} className="grid gap-3 rounded-seal border border-seal/10 p-4 sm:grid-cols-[1fr_1fr_auto]">
            <input
              className="input-field"
              placeholder="Document label (e.g. Letter of Intent)"
              value={docLabel}
              onChange={(e) => setDocLabel(e.target.value)}
            />
            <input
              type="file"
              required
              className="input-field"
              onChange={(e) => setDocFile(e.target.files?.[0] || null)}
            />
            <button type="submit" disabled={uploading} className="btn-secondary">
              {uploading ? (
                <LoadingSpinner size="sm" message={null} />
              ) : (
                "Add document"
              )}
            </button>
          </form>

          {stagedDocs.length > 0 && (
            <ul className="divide-y divide-seal/10 rounded-seal border border-seal/10">
              {stagedDocs.map((d, i) => (
                <li key={d.filename_stored} className="flex items-center justify-between px-4 py-2.5 text-sm">
                  <span>
                    <span className="font-medium text-ink">Req. {d.requirement_index}:</span> {d.label}
                  </span>
                  <button type="button" onClick={() => removeStagedDoc(i)} className="text-xs font-medium text-clay hover:underline">
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="flex justify-between">
            <button type="button" className="btn-secondary" onClick={() => setStep(1)}>
              Back
            </button>
            <button type="button" className="btn-primary" onClick={() => setStep(3)}>
              Continue to application
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="card">
          <h2 className="font-display text-xl font-semibold text-seal">Application</h2>
          <p className="mt-2 text-sm text-ink/60">
            Review your details, then submit. Your application will move into the admin review queue with status
            "pending".
          </p>
          <dl className="mt-6 grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs uppercase tracking-wider text-ink/50">Qualification</dt>
              <dd className="mt-1 text-sm font-medium text-ink">{selectedQualification?.name}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wider text-ink/50">Code / Level</dt>
              <dd className="mt-1 text-sm font-medium text-ink">
                {selectedQualification?.code} · NC {selectedQualification?.level}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs uppercase tracking-wider text-ink/50">Documents attached</dt>
              <dd className="mt-1 text-sm font-medium text-ink">
                {stagedDocs.length ? `${stagedDocs.length} document(s)` : "None yet"}
              </dd>
            </div>
          </dl>
          <div className="mt-6 flex justify-between gap-3">
            <button className="btn-secondary" onClick={() => setStep(2)}>
              Back to documents
            </button>
            <button className="btn-primary" disabled={saving} onClick={handleFinalSubmit}>
              {saving ? (
                <span className="flex items-center gap-2">
                  <LoadingSpinner size="sm" message={null} />
                  Submitting…
                </span>
              ) : (
                "Submit application"
              )}
            </button>
          </div>
        </div>
      )}

      {/* Modal for success/error messages */}
      <Modal
        isOpen={modal.isOpen}
        type={modal.type}
        title={modal.title}
        message={modal.message}
        actionLabel={modal.actionLabel}
        onAction={modal.onAction}
        onClose={closeModal}
      />

      {/* Toast for quick notifications */}
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
