"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import AdminShell from "@/components/AdminShell";
import DocumentTypeTag from "@/components/DocumentTypeTag";

// Client-only Supabase calls happen at render time, so skip static
// prerendering (which runs at build time, before env vars may be wired up).
export const dynamic = "force-dynamic";

const KIND_OPTIONS = ["All types", "Application document", "Pre-notification letter", "Post-notification letter", "Inspection report", "Receipt of payment", "AOU"];

export default function AdminDocumentsPage() {
  const supabase = createClient();
  const [profile, setProfile] = useState(null);
  const [files, setFiles] = useState([]);
  const [search, setSearch] = useState("");
  const [kindFilter, setKindFilter] = useState("All types");

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { data: p } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      setProfile(p);

      const { data: apps } = await supabase
        .from("assessment_applications")
        .select("id, application_no, profiles:user_id(ac_name, email), qualifications:qualification_id(name, code)");

      const appById = {};
      (apps || []).forEach((a) => (appById[a.id] = a));
      const appIds = (apps || []).map((a) => a.id);
      if (!appIds.length) {
        setFiles([]);
        return;
      }

      const [{ data: docs }, { data: inspections }, { data: payments }] = await Promise.all([
        supabase.from("assessment_application_documents").select("*").in("application_id", appIds),
        supabase
          .from("inspections")
          .select("*")
          .in("application_id", appIds)
          .or(
            "report_url.not.is.null,notification_pdf_url.not.is.null,signed_notification_pdf_url.not.is.null,post_notification_pdf_url.not.is.null,signed_post_notification_pdf_url.not.is.null"
          ),
        supabase.from("payment_submissions").select("*").in("application_id", appIds),
      ]);

      const all = [];

      (docs || []).forEach((d) => {
        const app = appById[d.application_id];
        all.push({
          id: `doc-${d.id}`,
          kind: "Application document",
          label: `Req. ${d.requirement_index}: ${d.filename_original}`,
          url: d.file_url,
          uploaded_at: d.uploaded_at,
          applicant: app?.profiles?.ac_name,
          qualification: app?.qualifications?.name,
        });
      });

      (inspections || []).forEach((insp) => {
        const app = appById[insp.application_id];
        if (insp.notification_pdf_url) {
          all.push({
            id: `notif-${insp.id}`,
            kind: "Pre-notification letter",
            label: `Pre-inspection notification (unsigned draft) — ${insp.inspection_date || "inspection"}`,
            url: insp.notification_pdf_url,
            uploaded_at: insp.created_at,
            applicant: app?.profiles?.ac_name,
            qualification: app?.qualifications?.name,
          });
        }
        if (insp.signed_notification_pdf_url) {
          all.push({
            id: `notif-signed-${insp.id}`,
            kind: "Pre-notification letter",
            label: `Pre-inspection notification (signed) — ${insp.inspection_date || "inspection"}`,
            url: insp.signed_notification_pdf_url,
            uploaded_at: insp.updated_at || insp.created_at,
            applicant: app?.profiles?.ac_name,
            qualification: app?.qualifications?.name,
          });
        }
        if (insp.post_notification_pdf_url) {
          all.push({
            id: `postnotif-${insp.id}`,
            kind: "Post-notification letter",
            label: `Post-inspection notification (unsigned draft) — ${insp.inspection_date || "inspection"}`,
            url: insp.post_notification_pdf_url,
            uploaded_at: insp.created_at,
            applicant: app?.profiles?.ac_name,
            qualification: app?.qualifications?.name,
          });
        }
        if (insp.signed_post_notification_pdf_url) {
          all.push({
            id: `postnotif-signed-${insp.id}`,
            kind: "Post-notification letter",
            label: `Post-inspection notification (signed) — ${insp.inspection_date || "inspection"}`,
            url: insp.signed_post_notification_pdf_url,
            uploaded_at: insp.updated_at || insp.created_at,
            applicant: app?.profiles?.ac_name,
            qualification: app?.qualifications?.name,
          });
        }
        if (insp.report_url) {
          all.push({
            id: `insp-${insp.id}`,
            kind: "Inspection report",
            label: `Signed report — ${insp.inspection_date || "inspection"}`,
            url: insp.report_url,
            uploaded_at: insp.updated_at || insp.created_at,
            applicant: app?.profiles?.ac_name,
            qualification: app?.qualifications?.name,
          });
        }
      });

      (payments || []).forEach((pay) => {
        const app = appById[pay.application_id];
        if (pay.receipt_url) {
          all.push({
            id: `receipt-${pay.id}`,
            kind: "Receipt of payment",
            label: "Receipt of payment",
            url: pay.receipt_url,
            uploaded_at: pay.receipt_uploaded_at,
            applicant: app?.profiles?.ac_name,
            qualification: app?.qualifications?.name,
          });
        }
        if (pay.aou_url) {
          all.push({
            id: `aou-${pay.id}`,
            kind: "AOU",
            label: "AOU",
            url: pay.aou_url,
            uploaded_at: pay.aou_uploaded_at,
            applicant: app?.profiles?.ac_name,
            qualification: app?.qualifications?.name,
          });
        }
      });

      all.sort((a, b) => new Date(b.uploaded_at || 0) - new Date(a.uploaded_at || 0));
      setFiles(all);
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    return files.filter((f) => {
      if (kindFilter !== "All types" && f.kind !== kindFilter) return false;
      const haystack = `${f.applicant || ""} ${f.qualification || ""} ${f.label}`.toLowerCase();
      return haystack.includes(search.toLowerCase());
    });
  }, [files, search, kindFilter]);

  return (
    <AdminShell acName={profile?.ac_name}>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-brass">Documents</p>
          <h1 className="font-display text-3xl font-semibold text-seal">All uploaded documents</h1>
        </div>
        <p className="text-sm text-ink/50">{filtered.length} file(s)</p>
      </div>

      <div className="card">
        <div className="mb-4 flex flex-wrap gap-3">
          <input
            className="input-field max-w-xs"
            placeholder="Search by applicant or qualification…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select className="input-field max-w-xs" value={kindFilter} onChange={(e) => setKindFilter(e.target.value)}>
            {KIND_OPTIONS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </div>

        {filtered.length === 0 ? (
          <p className="text-sm text-ink/50">No documents match.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-seal/10 text-left text-xs uppercase tracking-wider text-ink/50">
                  <th className="pb-3 pr-4 font-medium">Type</th>
                  <th className="pb-3 pr-4 font-medium">File</th>
                  <th className="pb-3 pr-4 font-medium">Applicant</th>
                  <th className="pb-3 pr-4 font-medium">Qualification</th>
                  <th className="pb-3 pr-4 font-medium">Uploaded</th>
                  <th className="pb-3 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-seal/10">
                {filtered.map((f) => (
                  <tr key={f.id}>
                    <td className="py-2.5 pr-4">
                      <DocumentTypeTag kind={f.kind} />
                    </td>
                    <td className="py-2.5 pr-4 text-ink">{f.label}</td>
                    <td className="py-2.5 pr-4 text-ink/70">{f.applicant || "—"}</td>
                    <td className="py-2.5 pr-4 text-ink/70">{f.qualification || "—"}</td>
                    <td className="py-2.5 pr-4 text-ink/50">
                      {f.uploaded_at ? new Date(f.uploaded_at).toLocaleDateString() : "—"}
                    </td>
                    <td className="py-2.5 text-right">
                      <a href={f.url} target="_blank" className="font-medium text-seal hover:text-brass">
                        View →
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminShell>
  );
}
