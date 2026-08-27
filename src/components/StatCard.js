export default function StatCard({ icon: Icon, label, value, delta, deltaTone = "positive" }) {
  const deltaColor =
    deltaTone === "positive" ? "text-moss" : deltaTone === "negative" ? "text-clay" : "text-ink/40";

  return (
    <div className="card flex items-start gap-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-seal text-parchment">
        <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-ink/50">{label}</p>
        <p className="mt-1 font-display text-2xl font-semibold text-ink">{value}</p>
        {delta && <p className={`mt-1 text-xs font-medium ${deltaColor}`}>{delta}</p>}
      </div>
    </div>
  );
}
