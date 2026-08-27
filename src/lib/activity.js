// Writes one row to application_activity_log — the "trailsheet" of what
// happened and when, requested on the admin flowchart. Used from both the
// client and admin sides via the browser Supabase client.
export async function logActivity(supabase, { applicationId, actorId, actorName, action, notes }) {
  await supabase.from("application_activity_log").insert({
    application_id: applicationId,
    actor_id: actorId || null,
    actor_name: actorName || null,
    action,
    notes: notes || null,
  });
}
