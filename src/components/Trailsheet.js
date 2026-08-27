export default function Trailsheet({ entries }) {
  if (!entries || entries.length === 0) {
    return <p className="text-sm text-ink/50">No activity recorded yet.</p>;
  }

  return (
    <ol className="space-y-4">
      {entries.map((entry) => (
        <li key={entry.id} className="flex gap-3 text-sm">
          <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brass" />
          <div>
            <p className="font-medium text-ink">{entry.action}</p>
            {entry.notes && <p className="mt-0.5 text-ink/60">{entry.notes}</p>}
            <p className="mt-0.5 text-xs text-ink/40">
              {entry.actor_name ? `${entry.actor_name} · ` : ""}
              {new Date(entry.created_at).toLocaleString()}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
