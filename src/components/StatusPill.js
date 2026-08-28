const STATUS_STYLES = {
  pending: "border-brass/40 bg-brass-light/40 text-brass",
  denied: "border-clay/30 bg-clay/10 text-clay",
  inspection_scheduled: "border-seal/30 bg-seal/10 text-seal",
  awaiting_payment: "border-brass/40 bg-brass-light/40 text-brass",
  certificate_processing: "border-brass/40 bg-brass-light/40 text-brass",
  accredited: "border-moss/40 bg-moss/10 text-moss",
  active: "border-moss/40 bg-moss/10 text-moss",
  inactive: "border-ink/20 bg-ink/5 text-ink/60",
  compliant: "border-moss/40 bg-moss/10 text-moss",
  non_compliant: "border-clay/30 bg-clay/10 text-clay",
  acknowledged: "border-moss/40 bg-moss/10 text-moss",
  rejected: "border-clay/30 bg-clay/10 text-clay",
};

const STATUS_LABELS = {
  pending: "Pending review",
  denied: "Documents declined",
  inspection_scheduled: "Inspection scheduled",
  awaiting_payment: "Certificate processing",
  certificate_processing: "Certificate processing",
  accredited: "Accredited",
  active: "Active",
  inactive: "Inactive",
  compliant: "Compliant",
  non_compliant: "Non-compliant",
  acknowledged: "Acknowledged",
  rejected: "Rejected",
};

export default function StatusPill({ status }) {
  const style = STATUS_STYLES[status] || STATUS_STYLES.pending;
  const label = STATUS_LABELS[status] || status;
  return <span className={`status-pill ${style}`}>{label}</span>;
}
