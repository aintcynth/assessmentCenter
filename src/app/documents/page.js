"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import ClientShell from "@/components/ClientShell";
import DocumentTypeTag from "@/components/DocumentTypeTag";
import StatusPill from "@/components/StatusPill";

// Client-only Supabase calls happen at render time, so skip static
// prerendering (which runs at build time, before env vars may be wired up).
export const dynamic = "force-dynamic";

export default function DocumentsPage() {
  const supabase = createClient();
  const [profile, setProfile] = useState(null);
  const [applications, setApplications] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data: p } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      setProfile(p);

      const { data: apps } = await supabase
        .from("assessment_applications")
        .select("id, status, qualifications:qualification_id(name, code)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      const appIds = (apps || []).map((a) => a.id);
      const filesByApp = {};
      appIds.forEach((id) => (filesByApp[id] = []));

      if (appIds.length) {
        const [{ data: docs }, { data: inspections }, { data: payments }] = await Promise.all([
          supabase
            .from("assessment_application_documents")
            .select("*")
            .in("application_id", appIds)
            .order("requirement_index"),
          supabase
            .from("inspections")
            .select("*")
            .in("application_id", appIds)
            .or("report_url.not.is.null,notification_pdf_url.not.is.null")
            .order("created_at", { ascending: false }),
          supabase.from("payment_submissions").select("*").in("application_id", appIds),
        ]);

        (docs || []).forEach((d) => {
          filesByApp[d.application_id]?.push({
            id: `doc-${d.id}`,
            kind: "Application document",
            label: `Req. ${d.requirement_index}: ${d.filename_original}`,
            url: d.file_url,
            uploaded_at: d.uploaded_at,
          });
        });

        (inspections || []).forEach((insp) => {
          if (insp.notification_pdf_url) {
            filesByApp[insp.application_id]?.push({
              id: `notif-${insp.id}`,
              kind: "Pre-notification letter",
              label: `Pre-inspection notification — ${insp.inspection_date || "inspection"}`,
              url: insp.notification_pdf_url,
              uploaded_at: insp.created_at,
            });
          }
          if (insp.report_url) {
            filesByApp[insp.application_id]?.push({
              id: `insp-${insp.id}`,
              kind: "Inspection report",
              label: `Signed report — ${insp.inspection_date || "inspection"}`,
              url: insp.report_url,
              uploaded_at: insp.updated_at || insp.created_at,
            });
          }
        });

        (payments || []).forEach((pay) => {
          if (pay.receipt_url) {
            filesByApp[pay.application_id]?.push({
              id: `receipt-${pay.id}`,
              kind: "Receipt of payment",
              label: "Receipt of payment",
              url: pay.receipt_url,
              uploaded_at: pay.receipt_uploaded_at,
            });
          }
          if (pay.aou_url) {
            filesByApp[pay.application_id]?.push({
              id: `aou-${pay.id}`,
              kind: "AOU",
              label: "AOU",
              url: pay.aou_url,
              uploaded_at: pay.aou_uploaded_at,
            });
          }
        });

        Object.keys(filesByApp).forEach((id) => {
          filesByApp[id].sort((a, b) => new Date(b.uploaded_at || 0) - new Date(a.uploaded_at || 0));
        });
      }

      setApplications((apps || []).map((a) => ({ ...a, files: filesByApp[a.id] || [] })));
      setLoaded(true);
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalFiles = applications.reduce((sum, a) => sum + a.files.length, 0);

  return (
    <ClientShell acName={profile?.ac_name}>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-brass">Documents</p>
          <h1 className="font-display text-3xl font-semibold text-seal">All submitted documents</h1>
        </div>
        {loaded && <p className="text-sm text-ink/50">{totalFiles} file(s) across {applications.length} application(s)</p>}
      </div>

      {applications.length === 0 ? (
        <div className="card text-center text-sm text-ink/60">
          Documents you upload while applying — application files, inspection reports, receipts, and AOUs — will
          appear here, grouped by application.
        </div>
      ) : (
        <div className="space-y-6">
          {applications.map((app) => (
            <div key={app.id} className="card">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <p className="font-display text-lg font-semibold text-seal">{app.qualifications?.name}</p>
                  <p className="text-xs text-ink/50">{app.qualifications?.code}</p>
                </div>
                <StatusPill status={app.status} />
              </div>
              {app.files.length === 0 ? (
                <p className="text-sm text-ink/50">No documents uploaded for this application.</p>
              ) : (
                <ul className="divide-y divide-seal/10">
                  {app.files.map((f) => (
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
          ))}
        </div>
      )}
    </ClientShell>
  );
}
