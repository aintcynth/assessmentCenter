import { jsPDF } from "jspdf";

// Edit these to match your actual issuing office/signatory.
const FORM_CODE = "TESDA-OP-CO-03-F12";
const FORM_REV = "Rev. No. 01-09/02/22";
const AUTHORITY_NAME = "TECHNICAL EDUCATION AND SKILLS DEVELOPMENT AUTHORITY";
const SIGNATORY_NAME = "ASHARY A. BANTO, JD., CESE";
const SIGNATORY_TITLE = "Regional Director, TESDA Region 2";

function formatDate(d) {
  if (!d) return "—";
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

// Draws a line made of alternating normal/bold segments, centered on the
// page at the given y. Used for lines like "Accreditation No.: **1234**"
// where only part of the line should be bold.
function centeredMixedLine(doc, y, segments, { size = 11, pageWidth }) {
  doc.setFontSize(size);
  let total = 0;
  segments.forEach((seg) => {
    doc.setFont("helvetica", seg.bold ? "bold" : "normal");
    total += doc.getTextWidth(seg.text);
  });
  let x = pageWidth / 2 - total / 2;
  segments.forEach((seg) => {
    doc.setFont("helvetica", seg.bold ? "bold" : "normal");
    doc.text(seg.text, x, y);
    x += doc.getTextWidth(seg.text);
  });
}

// Same idea, but left-aligned starting at x (or right-aligned ending at x
// when align: "right" is passed).
function mixedLine(doc, x, y, segments, { size = 11, align = "left" } = {}) {
  doc.setFontSize(size);
  if (align === "right") {
    let total = 0;
    segments.forEach((seg) => {
      doc.setFont("helvetica", seg.bold ? "bold" : "normal");
      total += doc.getTextWidth(seg.text);
    });
    x = x - total;
  }
  segments.forEach((seg) => {
    doc.setFont("helvetica", seg.bold ? "bold" : "normal");
    doc.text(seg.text, x, y);
    x += doc.getTextWidth(seg.text);
  });
}

// Generates the Certificate of Accreditation as a PDF Blob, following the
// TESDA-OP-CO-03-F12 layout: bordered portrait page, seal, authority name,
// centered AC name/address, qualification, accreditation number, and
// issuance/expiry dates side by side, signed off by the regional director.
export function generateCertificatePdf({
  acName,
  address,
  qualificationName,
  certNumber,
  issuanceDate,
  expirationDate,
  logo, // optional { dataUrl, width, height } from loadImageAsPngDataUrl
}) {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const w = doc.internal.pageSize.getWidth();
  const margin = 42;
  const innerLeft = margin + 32;
  const innerRight = w - margin - 32;

  // Form code, above the border, right-aligned.
  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(FORM_CODE, w - margin, margin - 20, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.text(FORM_REV, w - margin, margin - 9, { align: "right" });

  // Border.
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(1.3);
  doc.rect(margin, margin, w - margin * 2, doc.internal.pageSize.getHeight() - margin * 2);

  // Seal — a real logo if one's been uploaded in Admin > Settings,
  // otherwise a vector placeholder so the certificate still looks complete.
  const sealY = margin + 78;
  if (logo?.dataUrl) {
    const maxSize = 68;
    const scale = Math.min(maxSize / logo.width, maxSize / logo.height);
    const dw = logo.width * scale;
    const dh = logo.height * scale;
    doc.addImage(logo.dataUrl, "PNG", w / 2 - dw / 2, sealY - dh / 2, dw, dh);
  } else {
    doc.setDrawColor(12, 46, 78);
    doc.setLineWidth(1.4);
    doc.circle(w / 2, sealY, 30, "S");
    doc.setDrawColor(200, 160, 40);
    doc.setLineWidth(0.8);
    doc.circle(w / 2, sealY, 24, "S");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(12, 46, 78);
    doc.text("TESDA", w / 2, sealY + 3, { align: "center" });
  }

  // Authority name.
  doc.setFont("helvetica", "normal");
  doc.setFontSize(12.5);
  doc.setTextColor(0, 0, 0);
  doc.text(AUTHORITY_NAME, w / 2, sealY + 55, { align: "center", maxWidth: innerRight - innerLeft });

  // Title.
  doc.setFont("helvetica", "bold");
  doc.setFontSize(21);
  doc.text("CERTIFICATE OF ACCREDITATION", w / 2, sealY + 100, { align: "center" });

  // "This is to certify that"
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text("This is to certify that", w / 2, sealY + 140, { align: "center" });

  // AC Name
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text(acName || "—", w / 2, sealY + 172, { align: "center" });

  // Address
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  doc.text(address || "—", w / 2, sealY + 190, { align: "center" });

  // "is an Accredited Competency Assessment Center for"
  centeredMixedLine(
    doc,
    sealY + 226,
    [
      { text: "is an ", bold: false },
      { text: "Accredited Competency Assessment Center", bold: true },
      { text: " for", bold: false },
    ],
    { size: 11.5, pageWidth: w }
  );

  // Qualification
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(qualificationName || "—", w / 2, sealY + 256, { align: "center", maxWidth: innerRight - innerLeft });

  // Accreditation No.
  centeredMixedLine(
    doc,
    sealY + 292,
    [
      { text: "Accreditation No.:  ", bold: false },
      { text: certNumber || "—", bold: true },
    ],
    { size: 11, pageWidth: w }
  );

  // Date Accredited / Expiration Date, side by side.
  const dateY = sealY + 326;
  mixedLine(
    doc,
    innerLeft,
    dateY,
    [
      { text: "Date Accredited: ", bold: false },
      { text: formatDate(issuanceDate), bold: true },
    ],
    { size: 10.5, align: "left" }
  );
  mixedLine(
    doc,
    innerRight,
    dateY,
    [
      { text: "Expiration Date: ", bold: false },
      { text: formatDate(expirationDate), bold: true },
    ],
    { size: 10.5, align: "right" }
  );

  // Approved by / signatory.
  const approvedY = sealY + 400;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text("Approved by:", innerLeft, approvedY);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(SIGNATORY_NAME, w / 2, approvedY + 60, { align: "center" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.text(SIGNATORY_TITLE, w / 2, approvedY + 74, { align: "center" });

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
