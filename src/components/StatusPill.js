const STATUS_STYLES = {
  pending: "border-brass/40 bg-brass-light/40 text-brass",
  approved: "border-moss/40 bg-moss/10 text-moss",
  denied: "border-clay/30 bg-clay/10 text-clay",
  active: "border-moss/40 bg-moss/10 text-moss",
  inactive: "border-ink/20 bg-ink/5 text-ink/60",
};

const STATUS_LABELS = {
  pending: "Pending",
  approved: "Approved",
  denied: "Denied",
  active: "Active",
  inactive: "Inactive",
};

export default function StatusPill({ status }) {
  const style = STATUS_STYLES[status] || STATUS_STYLES.pending;
  const label = STATUS_LABELS[status] || status;
  return <span className={`status-pill ${style}`}>{label}</span>;
}
