// Fetches an image (e.g. from Supabase Storage) and normalizes it to a PNG
// data URL via an offscreen canvas, so jsPDF can embed it regardless of the
// original format. Returns null (never throws) if it can't be loaded, so
// callers can fall back to a placeholder without extra error handling.
export async function loadImageAsPngDataUrl(url) {
  if (!url) return null;
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(bitmap, 0, 0);
    return {
      dataUrl: canvas.toDataURL("image/png"),
      width: bitmap.width,
      height: bitmap.height,
    };
  } catch {
    return null;
  }
}
