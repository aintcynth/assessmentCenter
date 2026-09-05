import { jsPDF } from "jspdf";

// Same signatory as the pre-inspection letter — both come from the
// Provincial Office. Kept as a separate constant here (not imported from
// preNotificationPdf.js) so either can be edited independently later.
const FORM_CODE = "TESDA-OP-CO-03-F09";
const FORM_REV = "Rev. No. 00-03/08/17";
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

// Draws a small checkbox; fills it with a tick mark when checked. Vector
// shapes rather than a Unicode glyph, since jsPDF's built-in fonts don't
// support ballot-box characters.
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

// Generates the Letter of Notification (Post-Inspection) as a PDF Blob,
// following TESDA-OP-CO-03-F09: sent once the admin marks an inspection
// compliant or non-compliant. Branches on `compliant` to tick the right
// checkbox and, when non-compliant, list the actual lackings.
export function generatePostNotificationPdf({
  acManager,
  centerName,
  address,
  qualificationName,
  compliant,
  lackings,
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
  doc.text("(Post-Inspection)", w / 2, y, { align: "center" });
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
    `As a result of the ocular inspection, in connection with your application as assessment center for ` +
      `${qualificationName || "—"}, we would like to inform you that:`,
    contentWidth
  );
  opening.forEach((line) => {
    doc.text(line, margin, y);
    y += 15;
  });
  y += 12;

  // Checkbox 1: lacking requirements.
  const boxX = margin + 20;
  const textX = boxX + 18;

  checkbox(doc, boxX, y, !compliant);
  doc.text("The following are lacking based on the result of the ocular inspection:", textX, y, {
    maxWidth: contentWidth - (textX - margin),
  });
  y += 22;

  if (!compliant && lackings) {
    const lackLines = doc.splitTextToSize(lackings, contentWidth - (textX - margin));
    lackLines.forEach((line) => {
      doc.text(line, textX, y);
      y += 14;
    });
  } else {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.text("Use additional sheet when necessary", textX, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10.5);
    y += 14;
  }
  doc.setDrawColor(120, 120, 120);
  doc.line(textX, y, w - margin, y);
  y += 24;

  // Fine-print paragraph (always shown, matching the source template).
  doc.setFont("helvetica", "italic");
  doc.setFontSize(9.5);
  const comply = doc.splitTextToSize(
    `Please comply the lacking requirements for accreditation. Failure to comply within 15 working days upon ` +
      `receipt of this letter shall mean automatic forfeiture of the initial 50% accreditation fee.`,
    contentWidth
  );
  comply.forEach((line) => {
    doc.text(line, margin, y);
    y += 13;
  });
  y += 18;

  // Checkbox 2: for processing of accreditation.
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  checkbox(doc, boxX, y, !!compliant);
  doc.text("For processing of accreditation", textX, y);
  y += 24;

  // AOU paragraph (always shown, matching the source template).
  const aouPara = doc.splitTextToSize(
    `Enclosed is the Affidavit of Undertaking (AOU) for the signature of the Assessment Center Manager. Please ` +
      `return the notarized AOU together with the remaining 50% of the accreditation fee on ________ for the ` +
      `training on Assessment Center Operations.`,
    contentWidth
  );
  aouPara.forEach((line) => {
    doc.text(line, margin, y);
    y += 15;
  });
  y += 20;

  // Sign-off.
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
