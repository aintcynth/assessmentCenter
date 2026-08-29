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

// Generates the Affidavit of Undertaking (TESDA-OP-CO-03-F10) — a legal
// jurat-style document the AC manager signs and has notarized, listing the
// twelve standard undertakings. AC name, address, manager, and qualification
// are filled in; everything else follows the official template verbatim.
export function generateAouPdf({ acName, address, acManager, qualificationName }) {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  const margin = 50;
  const contentWidth = w - margin * 2;
  let y = margin;

  function ensureSpace(next) {
    if (y + next > h - margin) {
      doc.addPage();
      y = margin;
    }
  }

  function paragraph(text, { size = 9.5, bold = false, gapAfter = 12, lineHeight = 13 } = {}) {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    const lines = doc.splitTextToSize(text, contentWidth);
    lines.forEach((line) => {
      ensureSpace(lineHeight);
      doc.text(line, margin, y);
      y += lineHeight;
    });
    y += gapAfter;
  }

  // Form code, above the content, right-aligned.
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.text("TESDA-OP-CO-03-F10", w - margin, margin - 24, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.text("Rev. No.00-03/08/17", w - margin, margin - 14, { align: "right" });

  // Jurat heading, right-aligned.
  doc.setFontSize(9.5);
  doc.text("Republic of the Philippines)", w - margin, y, { align: "right" });
  y += 13;
  doc.text("In the City of _________)      s.s.", w - margin, y, { align: "right" });
  y += 26;

  // Title.
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("AFFIDAVIT OF UNDERTAKING", w / 2, y, { align: "center" });
  y += 16;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("(Assessment Center)", w / 2, y, { align: "center" });
  y += 26;

  const blank = "____________________";

  paragraph(
    `${acName || blank}, ${address || blank}, represented by its Assessment Center Manager, ${acManager || blank}, ` +
      `having been sworn to in accordance with law, do hereby depose and state that:`,
    { gapAfter: 16 }
  );

  paragraph(
    `The Competency Assessment Center shall comply with the following terms and conditions, violations of any of ` +
      `those mentioned below shall be ground for the cancellation/revocation/withdrawal of accreditation:`,
    { gapAfter: 10 }
  );

  const items = [
    `Provide quality assessment in ${qualificationName || blank};`,
    `Maintain facilities of the Assessment Center as prescribed by TESDA;`,
    `Ensure that the conduct of competency assessment is strictly in accordance with the provisions on the ` +
      `Procedures Manual on Competency Assessment and other assessment-related issuances;`,
    `Collect competency assessment fees prescribed by TESDA;`,
    `Sustain compliance with accreditation requirements;`,
    `Notify TESDA of any change that directly or indirectly affect assessment conditions in relation to the ` +
      `conditions existing during the original accreditation;`,
    `Safeguard/Ensure the authenticity, validity and confidentiality of all documents relative to the conduct of ` +
      `competency assessment;`,
    `Assume full responsibility for ensuring the objectivity and integrity of assessment conducted in the ` +
      `Assessment Center and by the Competency Assessor;`,
    `Submit schedule of assessment to Provincial Office;`,
    `Submit post assessment results and reports immediately after the conduct of assessment;`,
    `Ensure that assessors listed in the Registry of Accredited Competency Assessors are assigned on a rotation ` +
      `basis and are given equal number of assignment; and`,
    `No involvement with any "Conflict of Interest" activity related to assessment and certification program ` +
      `e.g., Placement/Recruitment Agency, Review Center, among others.`,
  ];

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  const indent = 16;
  items.forEach((item, i) => {
    const wrapped = doc.splitTextToSize(item, contentWidth - indent);
    wrapped.forEach((line, li) => {
      ensureSpace(13);
      doc.text(li === 0 ? `${i + 1}. ${line}` : line, margin + (li === 0 ? 0 : indent), y);
      y += 13;
    });
    y += 4;
  });

  y += 8;
  const year = new Date().getFullYear();
  paragraph(
    `IN WITNESS WHEREOF, I have hereunto affixed my signature this ____ day of ________, ${year} at ` +
      `_______________, Cagayan, Philippines.`,
    { gapAfter: 34 }
  );

  // Signature block, centered.
  ensureSpace(40);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(acManager || blank, w / 2, y, { align: "center" });
  y += 13;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.text("Affiant", w / 2, y, { align: "center" });
  y += 24;

  ensureSpace(40);
  doc.text("Government Issued ID No: ________________", margin, y);
  y += 16;
  doc.text("Date Issued: ___________________________", margin, y);
  y += 28;

  paragraph(
    `SUBSCRIBED AND SWORN to before me, this ____ day of _________, 20____, affiant exhibiting to me the ` +
      `above-stated government-issued identification card.`,
    { gapAfter: 18 }
  );

  // Doc/Page/Book/Series (left) and notary signature line (right).
  ensureSpace(80);
  const leftX = margin;
  const rightX = w / 2 + 30;
  const rightLineWidth = w - margin - rightX;

  doc.line(rightX, y, rightX + rightLineWidth, y);
  doc.setFontSize(9.5);
  doc.text("Doc. No.: ____________", leftX, y + 14);
  doc.setFont("helvetica", "bold");
  doc.text("NOTARY PUBLIC", rightX + rightLineWidth / 2, y + 14, { align: "center" });
  doc.setFont("helvetica", "normal");

  doc.text("Page No.: ___________", leftX, y + 30);
  doc.text("Book No.: ___________", leftX, y + 46);
  doc.text("Series No.: ___________", leftX, y + 62);

  return doc.output("blob");
}
