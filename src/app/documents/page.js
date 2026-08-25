"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import ClientShell from "@/components/ClientShell";
import StatusPill from "@/components/StatusPill";

// Client-only Supabase calls happen at render time, so skip static
// prerendering (which runs at build time, before env vars may be wired up).
export const dynamic = "force-dynamic";

export default function DocumentsPage() {
  const supabase = createClient();
  const [profile, setProfile] = useState(null);
  const [applications, setApplications] = useState([]);

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
      let docsByApp = {};
      if (appIds.length) {
        const { data: docs } = await supabase
          .from("assessment_application_documents")
          .select("*")
          .in("application_id", appIds)
          .order("requirement_index");
        (docs || []).forEach((d) => {
          docsByApp[d.application_id] = [...(docsByApp[d.application_id] || []), d];
        });
      }

      setApplications((apps || []).map((a) => ({ ...a, documents: docsByApp[a.id] || [] })));
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <ClientShell acName={profile?.ac_name}>
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-wider text-brass">Documents</p>
        <h1 className="font-display text-3xl font-semibold text-seal">Submitted documents</h1>
      </div>

      {applications.length === 0 ? (
        <div className="card text-center text-sm text-ink/60">
          Documents you upload while applying will appear here, grouped by application.
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
              {app.documents.length === 0 ? (
                <p className="text-sm text-ink/50">No documents uploaded for this application.</p>
              ) : (
                <ul className="divide-y divide-seal/10">
                  {app.documents.map((doc) => (
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
          ))}
        </div>
      )}
    </ClientShell>
  );
}
