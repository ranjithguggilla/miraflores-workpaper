/** The nine work areas mirror the firm's budget lines. Every return line maps to exactly one. */
export const AREAS = [
  { id: "intake_and_engagement", name: "Intake, identity & payments" },
  { id: "wages_and_stock_compensation", name: "Wages & stock compensation" },
  { id: "investments_and_digital_assets", name: "Investments & digital assets" },
  { id: "business", name: "Business (Lindqvist Studio)" },
  { id: "rentals_and_sale", name: "Rentals & the condo sale" },
  { id: "pass_throughs_and_basis", name: "Pass-throughs & basis" },
  { id: "deductions_and_credits", name: "Deductions & credits" },
  { id: "california", name: "California" },
  { id: "partner_review", name: "Tax computation & filing" },
] as const;
export type AreaId = (typeof AREAS)[number]["id"];

export function areaName(id: string) {
  return AREAS.find((a) => a.id === id)?.name ?? id;
}

export function areaForLine(key: string): AreaId {
  const [form, ...rest] = key.split(".");
  const line = rest.join(".");
  if (form === "F8949") {
    if (line.startsWith("F.")) return "pass_throughs_and_basis";
    if (/^[BE]\.N/.test(line) || line.startsWith("A.N")) return "wages_and_stock_compensation";
    return "investments_and_digital_assets";
  }
  if (form === "F1040") {
    if (/^(1a|1z|25a|25d)$/.test(line)) return "wages_and_stock_compensation";
    if (/^(2b|3a|3b|7)$/.test(line)) return "investments_and_digital_assets";
    if (/^(26|31|33|34|35a|37|38)$/.test(line)) return "intake_and_engagement";
    return "partner_review";
  }
  if (form === "SchB") return line.startsWith("1.7") || line.startsWith("1.8") ? "pass_throughs_and_basis" : "investments_and_digital_assets";
  if (["SchD", "F8960", "F8938"].includes(form)) return "investments_and_digital_assets";
  if (["SchC", "SchSE", "F4562-C"].includes(form)) return "business";
  if (form === "Sch1") {
    if (/^(3|15|16|17)$/.test(line)) return "business";
    if (line === "5") return "rentals_and_sale";
    if (line === "13") return "deductions_and_credits";
    return "partner_review";
  }
  if (form === "SchE") return /^(28|32|41)/.test(line) ? "pass_throughs_and_basis" : "rentals_and_sale";
  if (["F4797", "F4562-E", "F8582"].includes(form)) return "rentals_and_sale";
  if (form === "F7203") return "pass_throughs_and_basis";
  if (form === "F8995") return line.endsWith(".2") ? "pass_throughs_and_basis" : line.endsWith(".1") ? "business" : "partner_review";
  if (["SchA", "F8283", "F8606", "F8889", "F2441", "F8812", "F8863", "F8867"].includes(form)) return "deductions_and_credits";
  if (form === "Sch3") return line === "1" ? "investments_and_digital_assets" : line === "11" ? "wages_and_stock_compensation" : line === "10" ? "intake_and_engagement" : "partner_review";
  if (form === "F8959") return "wages_and_stock_compensation";
  if (form === "F6251" && line === "2i") return "wages_and_stock_compensation";
  if (["F540NR", "SchCA540NR", "FTB3885A", "FTB5805", "ScheduleS"].includes(form)) return "california";
  if (form === "F2210") return "intake_and_engagement";
  return "partner_review";
}

/** Which tax_effect_rates category a line belongs to, for live tax effect of adjustments. */
export function rateCategoryForLine(key: string): string {
  const [form, ...rest] = key.split(".");
  const line = rest.join(".");
  if (form === "F1040" && /^1/.test(line)) return "wages";
  if (form === "SchB" && line.startsWith("1")) return "interest";
  if (form === "SchB") return "ordinary_income";
  if (form === "SchC" || form === "F4562-C") return "schc_profit";
  if (form === "F8949") return /^[ABCH]\./.test(line) ? "stcg" : "ltcg";
  if (form === "SchD") return /^(1|2|3|6|7)/.test(line) ? "stcg" : "ltcg";
  if (form === "F4797") return "ltcg";
  if (form === "F7203") return "ltcg";
  if (form === "Sch1" && /^(1[0-9]|2[0-9])$/.test(line)) return "adjustment";
  if (form === "SchA" && /^5/.test(line)) return "salt";
  if (form === "SchA" || form === "F8283") return "itemized";
  if (form === "SchCA540NR" || form === "F540NR") return "ca_source_income";
  return "ordinary_income";
}
