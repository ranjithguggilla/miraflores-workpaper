/** Human names for every internal code the UI used to leak. */
export const RATE_CATEGORY_LABELS: Record<string, string> = { wages: "Wages", interest: "Interest", schc_profit: "Schedule C profit", stcg: "Short-term gain", ltcg: "Long-term gain", ordinary_income: "Ordinary income", adjustment: "Adjustment to income", salt: "State and local tax", itemized: "Itemized deduction", ca_source_income: "California-source income", payments_federal: "Federal payment (balance, not tax)", payments_california: "California payment (balance, not tax)" };

export const CHECK_LABELS: Record<string, string> = {
  DUP_PAGE: "Duplicate page", DUP_DOC: "Duplicate document", SAME_MONEY: "Same money on two documents", INCLUDES_OVERLAP: "Overlapping amounts",
  SUMMARY_VS_DETAIL: "Summary ≠ detail", ZERO_BASIS: "Zero basis", PAYMENTS_VS_IRS: "Payments vs IRS transcript", PAYMENTS_VS_FTB: "Payments vs FTB account",
  RECORD_BEATS_ESTIMATE: "Record beats estimate", SSN_MISMATCH: "SSN mismatch", QA_CONFLICT: "Questionnaire conflict", SEHI_ELIGIBILITY: "SE health insurance eligibility",
  ID_NOT_ON_PAGE: "ID not on page", LABEL_VS_DOC: "Name differs from document", LOW_CONFIDENCE: "Low-confidence read", CLOSING_PRORATION: "Closing proration",
  REPAIR_VS_IMPROVEMENT: "Repair or improvement", PERSONAL_USE: "Personal use percentage", PERSONAL_IN_BOOKS: "Personal item in books", GROSS_RECEIPTS_RECON: "Gross receipts reconciliation",
  WAGE_SOURCING: "Wage sourcing", STALE_PARAMETER: "Stale parameter", PRIOR_OPEN_ITEM: "Prior-year open item", VARIANCE: "Swing from last year",
  MESSAGE_EVIDENCE: "Message with evidence", DOC_UNUSED: "Document not used", OUTSIDE_SCOPE: "Outside engagement", REVIEW_NOTE: "Review note", QUESTION: "Question",
  DIGITAL_ASSET_BASIS_MISSING: "Digital asset basis missing", AMT_CREDIT_CARRYFORWARD: "AMT credit carryforward", AOTC_PHASED_OUT: "AOTC phased out",
  FBAR_OUTSIDE_RETURN: "FBAR outside return", FORM_1099_FILING: "Forms 1099 not filed", DUE_DILIGENCE_REQUIRED: "Due diligence required", CA_AMT_NOT_COMPUTED: "California AMT not computed",
  HOME_OFFICE_AREA_CHANGE: "Home office area changed", QUESTIONNAIRE_SALES_CONFLICT: "Questionnaire vs sales", LOW_CONFIDENCE_READ: "Low-confidence read", BROKER_SUMMARY_DETAIL_MISMATCH: "Broker summary mismatch",
};
export const checkLabel = (code?: string | null) => (code ? CHECK_LABELS[code] ?? code.toLowerCase().replace(/_/g, " ") : "");

export const KIND_LABELS: Record<string, string> = { check: "Check", diagnostic: "Engine", variance: "Variance", review_note: "Review note", client_question: "Question", low_confidence: "Low confidence", judgment: "Judgment call", completeness: "Completeness" };
export const kindLabel = (k: string) => KIND_LABELS[k] ?? k.replace(/_/g, " ");

export const ROLE_LABELS: Record<string, string> = { preparer: "Preparer", reviewer: "Reviewer", partner: "Partner", quality_reviewer: "Quality reviewer", firm_administrator: "Administrator", client: "Client" };
export const roleLabel = (r: string) => ROLE_LABELS[r] ?? r.replace(/_/g, " ");

export const humanize = (s: string) => s.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
export const initials = (name: string) => name.split(/\s+/).map((x) => x[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();

export const VERIFICATION_LABELS: Record<string, string> = { agreed_to_source_document: "Agreed to source", recalculated: "Recalculated", confirmed_with_client: "Confirmed with client", agreed_to_prior_year: "Agreed to prior year", agreed_to_third_party_record: "Agreed to third-party record" };
export const verificationLabel = (t: string) => VERIFICATION_LABELS[t] ?? humanize(t);

export const DOC_TYPE_LABELS: Record<string, string> = { "W-2": "W-2", "1099-composite": "1099 composite", "1099-INT": "1099-INT", "1099-NEC": "1099-NEC", "1099-K": "1099-K", "1099-DA": "1099-DA", "1099-R": "1099-R", "1099-SA": "1099-SA", "1099-S": "1099-S", "1098": "1098", "1098-T": "1098-T", "1098-C": "1098-C", "K-1": "Schedule K-1", books_profit_loss: "Books: P&L", books_transaction_detail: "Books: transactions", mileage_log: "Mileage log", closing_statement_buyer: "Closing statement (buyer)", closing_statement_seller: "Closing statement (seller)", identity_document: "Identity document", paystub: "Paystub", invoice: "Invoice", engagement_letter: "Engagement letter" };
export const docTypeLabel = (t: string) => DOC_TYPE_LABELS[t] ?? humanize(t);
