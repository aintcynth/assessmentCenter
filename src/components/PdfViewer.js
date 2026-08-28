export default function PdfViewer({ url, title, height = 480 }) {
  if (!url) {
    return <p className="text-sm text-ink/50">Not generated yet.</p>;
  }

  return (
    <div className="overflow-hidden rounded-xl border border-black/10">
      <div className="flex items-center justify-between border-b border-black/10 bg-mist/60 px-3 py-2">
        <p className="truncate text-xs font-semibold text-ink/70">{title}</p>
        <a href={url} target="_blank" className="shrink-0 text-xs font-medium text-seal hover:text-brass">
          Open in new tab ↗
        </a>
      </div>
      <iframe src={url} title={title} style={{ height }} className="w-full bg-white" />
    </div>
  );
}
