/** Sensitive data: SSNs, bank/account numbers, IP PINs. Masked for staff without clearance; every unmasked view is logged. */
export const SENSITIVE_TYPES = new Set(["ssn", "account_number"]);
export const SENSITIVE_FIELD = /ssn|account|routing|ip_pin|license_no|iban/i;

export function maskValue(v: unknown): string {
  const str = String(v ?? "");
  if (str.length <= 4) return "••••";
  return "•".repeat(Math.max(0, str.length - 4)).replace(/•{4}(?=•)/g, "•••• ") + str.slice(-4);
}

/** Mask SSN-like and long digit runs inside free text (page content, notes). */
export function maskText(t: string): string {
  return t
    .replace(/\b\d{3}-\d{2}-(\d{4})\b/g, "•••-••-$1")
    .replace(/\b(SE\d{2}(?: ?\d{4}){5})\b/g, (m) => "SE•• •••• •••• " + m.slice(-9))
    .replace(/\b(\d{6})\b(?=[^\n]*(?:PIN|pin))/g, "••••••")
    .replace(/license no\. (\d+)/g, (_, n) => `license no. ${maskValue(n)}`)
    .replace(/\b(IP PIN|PIN)\s*:?\s*(\d{6})\b/g, "$1 ••••••")
    .replace(/\b(account(?: number)?|routing(?: number)?)\s*:?\s*(\d{6,})\b/gi, (_, k, n) => `${k} ${maskValue(n)}`);
}
