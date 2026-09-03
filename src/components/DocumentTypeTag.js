const KIND_STYLES = {
  "Application document": "border-seal/20 bg-seal/5 text-seal/80",
  "Pre-notification letter": "border-seal/30 bg-seal/10 text-seal",
  "Inspection report": "border-brass/30 bg-brass-light/40 text-brass",
  "Receipt of payment": "border-moss/30 bg-moss/10 text-moss",
  AOU: "border-moss/30 bg-moss/10 text-moss",
};

export default function DocumentTypeTag({ kind }) {
  return (
    <span className={`status-pill ${KIND_STYLES[kind] || "border-ink/15 bg-ink/5 text-ink/60"}`}>{kind}</span>
  );
}
