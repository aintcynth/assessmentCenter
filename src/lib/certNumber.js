const LEVEL_CODES = { I: "01", II: "02", III: "03", IV: "04", V: "05" };

export function levelToCode(level) {
  return LEVEL_CODES[level?.trim()?.toUpperCase()] || "00";
}

// The sequence starts at 101 and increments by 1 for every certificate
// issued in the same calendar year (by issuance date), shared across every
// qualification — not reset per qualification.
export async function nextSequenceForYear(supabase, year) {
  const { data } = await supabase
    .from("assessment_applications")
    .select("cert_number")
    .gte("issuance_date", `${year}-01-01`)
    .lte("issuance_date", `${year}-12-31`)
    .not("cert_number", "is", null);

  let max = 100;
  (data || []).forEach((row) => {
    const match = row.cert_number?.match(/(\d{3})$/);
    if (match) {
      const n = parseInt(match[1], 10);
      if (n > max) max = n;
    }
  });
  return max + 1;
}

// Builds AC-{code}{levelNN}0215{yyIssue}{yyExpiry}{seq}, e.g.
// AC-DRV0202152628101 for Driving NC II issued 2026, expiring 2028, the
// 1st certificate issued that year.
export async function generateCertNumber(supabase, { code, level, issuanceDate, expirationDate }) {
  const issued = new Date(issuanceDate + "T00:00:00");
  const expiry = new Date(expirationDate + "T00:00:00");
  const yyIssue = String(issued.getFullYear()).slice(-2);
  const yyExpiry = String(expiry.getFullYear()).slice(-2);
  const seq = await nextSequenceForYear(supabase, issued.getFullYear());
  return `AC-${(code || "GEN").toUpperCase()}${levelToCode(level)}0215${yyIssue}${yyExpiry}${String(seq).padStart(3, "0")}`;
}

function ordinal(n) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// Preview-only variant: returns the number plus a human label ("1st
// certificate issued in 2026") without writing anything, so the admin can
// see what number will be assigned before committing to it.
export async function previewCertNumber(supabase, { code, level, issuanceDate, expirationDate }) {
  const issued = new Date(issuanceDate + "T00:00:00");
  const expiry = new Date(expirationDate + "T00:00:00");
  const seq = await nextSequenceForYear(supabase, issued.getFullYear());
  const yyIssue = String(issued.getFullYear()).slice(-2);
  const yyExpiry = String(expiry.getFullYear()).slice(-2);
  const certNumber = `AC-${(code || "GEN").toUpperCase()}${levelToCode(level)}0215${yyIssue}${yyExpiry}${String(seq).padStart(3, "0")}`;
  const label = `${ordinal(seq - 100)} certificate issued in ${issued.getFullYear()}`;
  return { certNumber, label };
}
