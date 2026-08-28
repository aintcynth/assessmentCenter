import { jsPDF } from "jspdf";

function formatDate(d) {
  if (!d) return "—";
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

// Generates a simple, presentable Certificate of Accreditation as a PDF
// Blob. Landscape, bordered, centered text — no external assets needed so
// it renders identically wherever it's generated.
export function generateCertificatePdf({ acName, qualificationName, qualificationCode, certNumber, issuanceDate, expirationDate }) {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();

  doc.setDrawColor(12, 46, 78);
  doc.setLineWidth(3);
  doc.rect(24, 24, w - 48, h - 48);
  doc.setLineWidth(0.75);
  doc.rect(34, 34, w - 68, h - 68);

  doc.setTextColor(12, 46, 78);
  doc.setFont("times", "bold");
  doc.setFontSize(30);
  doc.text("CERTIFICATE OF ACCREDITATION", w / 2, 110, { align: "center" });

  doc.setFont("times", "normal");
  doc.setFontSize(13);
  doc.setTextColor(60, 60, 60);
  doc.text("This is to certify that", w / 2, 160, { align: "center" });

  doc.setFont("times", "bolditalic");
  doc.setFontSize(24);
  doc.setTextColor(12, 46, 78);
  doc.text(acName || "—", w / 2, 195, { align: "center" });

  doc.setFont("times", "normal");
  doc.setFontSize(13);
  doc.setTextColor(60, 60, 60);
  const body = `has been assessed and accredited as an Assessment Center authorized to conduct competency assessments for`;
  doc.text(body, w / 2, 230, { align: "center", maxWidth: w - 160 });

  doc.setFont("times", "bold");
  doc.setFontSize(18);
  doc.setTextColor(12, 46, 78);
  doc.text(`${qualificationName || "—"} (${qualificationCode || ""})`, w / 2, 260, { align: "center" });

  doc.setFont("times", "normal");
  doc.setFontSize(12);
  doc.setTextColor(60, 60, 60);
  doc.text(
    `Certificate No. ${certNumber || "—"}   |   Issued ${formatDate(issuanceDate)}   |   Valid until ${formatDate(expirationDate)}`,
    w / 2,
    300,
    { align: "center" }
  );

  doc.setDrawColor(140, 140, 140);
  doc.line(w / 2 - 110, h - 110, w / 2 + 110, h - 110);
  doc.setFontSize(10);
  doc.text("Authorized Signatory", w / 2, h - 92, { align: "center" });

  return doc.output("blob");
}

// Generates a blank Affidavit of Undertaking template (portrait) with the
// applicant's details pre-filled and signature lines for them to sign and
// upload back.
export function generateAouPdf({ acName, qualificationName, qualificationCode, certNumber }) {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const w = doc.internal.pageSize.getWidth();
  const margin = 60;

  doc.setFont("times", "bold");
  doc.setFontSize(18);
  doc.setTextColor(12, 46, 78);
  doc.text("AFFIDAVIT OF UNDERTAKING", w / 2, 80, { align: "center" });

  doc.setFont("times", "normal");
  doc.setFontSize(11);
  doc.setTextColor(30, 30, 30);

  const paragraph =
    `I, the undersigned, representing ${acName || "the applicant"}, in connection with the application for ` +
    `accreditation as an Assessment Center for ${qualificationName || "the qualification"} (${qualificationCode || ""}, ` +
    `Certificate No. ${certNumber || "pending"}), do hereby undertake and commit to the following:\n\n` +
    `1. To comply with all applicable rules, regulations, and standards governing accredited assessment centers.\n\n` +
    `2. To maintain the facilities, equipment, and qualified personnel represented in this application throughout ` +
    `the period of accreditation.\n\n` +
    `3. To submit to periodic monitoring and re-inspection as may be required.\n\n` +
    `4. To immediately report any material change in the center's operations, ownership, or qualified personnel.\n\n` +
    `5. To use the accreditation and certificate solely for the qualification and center named above.\n\n` +
    `IN WITNESS WHEREOF, I have hereunto set my hand this ____ day of ______________, 20____.`;

  const lines = doc.splitTextToSize(paragraph, w - margin * 2);
  doc.text(lines, margin, 130);

  const sigY = 130 + lines.length * 15 + 60;
  doc.setDrawColor(80, 80, 80);
  doc.line(margin, sigY, margin + 220, sigY);
  doc.setFontSize(10);
  doc.text("Signature over printed name", margin, sigY + 16);

  doc.line(w - margin - 180, sigY, w - margin, sigY);
  doc.text("Date signed", w - margin - 180, sigY + 16);

  return doc.output("blob");
}
