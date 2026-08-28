// Writes one row to the notifications table — the in-app inbox used to
// tell the client (or the admin) that something needs their attention.
export async function notifyUser(supabase, { userId, applicationId, title, message }) {
  await supabase.from("notifications").insert({
    user_id: userId,
    application_id: applicationId || null,
    title,
    message: message || null,
  });
}
