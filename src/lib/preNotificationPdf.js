import { jsPDF } from "jspdf";

// Edit these to match your actual issuing office/signatory. Deliberately
// separate from certificatePdf.js's signatory — pre-inspection letters
// come from the Provincial Office, certificates from the Regional Office.
const FORM_CODE = "TESDA-OP-CO-03-F06";
const FORM_REV = "Rev. No.00-03/08/17";
const SIGNATORY_NAME = "GENARO RONALD C. IBAY";
const SIGNATORY_TITLE = "Provincial Director";

function formatDate(d) {
  if (!d) return "—";
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatTime(t) {
  if (!t) return "—";
  const [h, m] = t.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

// Draws a small checkbox; fills it with a tick mark when checked. Drawn as
// vector shapes rather than a Unicode glyph since jsPDF's built-in fonts
// don't support ballot-box characters.
function checkbox(doc, x, y, checked) {
  const size = 9;
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.8);
  doc.rect(x, y - size + 2, size, size);
  if (checked) {
    doc.setLineWidth(1);
    doc.line(x + 1.5, y - 2.5, x + 3.5, y - 0.5);
    doc.line(x + 3.5, y - 0.5, x + 7.5, y - 6.5);
  }
}

// Generates the Letter of Notification (Pre-Inspection) as a PDF Blob,
// following TESDA-OP-CO-03-F06: sent once an inspection date, time, and
// (internally) an expert have been set for an application.
export function generatePreNotificationPdf({
  acManager,
  centerName,
  address,
  qualificationName,
  inspectionDate,
  inspectionTime,
}) {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const w = doc.internal.pageSize.getWidth();
  const margin = 56;
  const contentWidth = w - margin * 2;
  let y = margin;

  // Form code, above the content, right-aligned.
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(FORM_CODE, w - margin, margin - 24, { align: "right" });
  doc.text(FORM_REV, w - margin, margin - 13, { align: "right" });

  // Title.
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("LETTER OF NOTIFICATION", w / 2, y, { align: "center" });
  y += 18;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text("(Pre-Inspection)", w / 2, y, { align: "center" });
  y += 40;

  // Date.
  doc.setFontSize(10.5);
  doc.text(formatDate(new Date().toISOString().slice(0, 10)), margin, y);
  y += 32;

  // Addressee block.
  doc.setFont("helvetica", "bold");
  doc.text(acManager || "—", margin, y);
  y += 14;
  doc.setFont("helvetica", "normal");
  doc.text("Assessment Center Manager", margin, y);
  y += 14;
  doc.setFont("helvetica", "bold");
  doc.text(centerName || "—", margin, y);
  y += 14;
  const addrLines = doc.splitTextToSize(address || "—", contentWidth);
  addrLines.forEach((line) => {
    doc.text(line, margin, y);
    y += 14;
  });
  y += 20;

  // Salutation.
  doc.setFont("helvetica", "normal");
  doc.text("Dear Sir/Madam:", margin, y);
  y += 26;

  // Opening paragraph.
  const opening = doc.splitTextToSize(
    `In connection with your application as assessment center for ${qualificationName || "—"}, ` +
      `we would like to inform you that:`,
    contentWidth
  );
  opening.forEach((line) => {
    doc.text(line, margin, y);
    y += 15;
  });
  y += 12;

  // Checkbox lines.
  const boxX = margin + 20;
  const textX = boxX + 18;

  checkbox(doc, boxX, y, true);
  doc.text("all your documents are in order", textX, y);
  y += 26;

  checkbox(doc, boxX, y, true);
  const schedLines = doc.splitTextToSize(
    `schedule of ocular inspection/re-inspection is on ${formatDate(inspectionDate)} at ${formatTime(inspectionTime)}`,
    contentWidth - (textX - margin)
  );
  schedLines.forEach((line, i) => {
    doc.text(line, textX, y + i * 15);
  });
  y += schedLines.length * 15 + 11;

  checkbox(doc, boxX, y, false);
  doc.text("the following documents are lacking:", textX, y);
  y += 20;
  doc.setDrawColor(120, 120, 120);
  doc.line(textX, y, w - margin, y);
  y += 16;
  doc.line(margin, y, w - margin, y);
  y += 26;

  // Closing paragraph (italic, matching the source template).
  doc.setFont("helvetica", "italic");
  doc.setFontSize(10);
  const closing = doc.splitTextToSize(
    `Please visit our office on (indicate date and time) for the completion of the lacking requirements for ` +
      `accreditation. Failure to submit the required documents within 15 working days from the receipt of this ` +
      `letter shall mean automatic forfeiture of the initial 50% accreditation fee.`,
    contentWidth
  );
  closing.forEach((line) => {
    doc.text(line, margin, y, { align: "justify", maxWidth: contentWidth });
    y += 14;
  });
  y += 24;

  // Sign-off.
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  doc.text("Thank you very much.", margin, y);
  y += 30;
  doc.text("Very truly yours,", margin, y);
  y += 44;

  doc.setFont("helvetica", "bold");
  doc.text(SIGNATORY_NAME, margin, y);
  y += 14;
  doc.setFont("helvetica", "normal");
  doc.text(SIGNATORY_TITLE, margin, y);

  return doc.output("blob");
}
