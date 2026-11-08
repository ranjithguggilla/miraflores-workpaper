import {
  pgTable, text, integer, real, boolean, jsonb, timestamp, serial, index, primaryKey,
} from "drizzle-orm/pg-core";

/* ------------------------------------------------------------------ */
/*  IMMUTABLE PACKET LAYER — loaded as delivered, never edited          */
/* ------------------------------------------------------------------ */

export const documents = pgTable("documents", {
  id: text("id").primaryKey(),               // D01..D74
  title: text("title").notNull(),
  documentType: text("document_type").notNull(),
  issuer: text("issuer"),
  belongsTo: text("belongs_to").notNull(),   // taxpayer | spouse | joint | dependent:<id>
  taxYear: integer("tax_year"),
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull(),
  uploadedBy: text("uploaded_by"),
  fileName: text("file_name"),
  pageCount: integer("page_count").notNull(),
  markedCorrected: boolean("marked_corrected"),
  extractionStatus: text("extraction_status").notNull(), // extracted | partial | not_extracted
  extractionReason: text("extraction_reason"),
});

export const pages = pgTable("pages", {
  docId: text("doc_id").notNull().references(() => documents.id),
  n: integer("n").notNull(),
  printedContent: text("printed_content").notNull(),
  contentHash: text("content_hash").notNull(),
}, (t) => [primaryKey({ columns: [t.docId, t.n] }), index("pages_hash").on(t.contentHash)]);

export const extractedValues = pgTable("extracted_values", {
  id: text("id").primaryKey(),               // ev-0001
  docId: text("doc_id").notNull().references(() => documents.id),
  page: integer("page").notNull(),
  field: text("field").notNull(),
  label: text("label").notNull(),
  value: jsonb("value"),
  valueType: text("value_type").notNull(),
  textAsRead: text("text_as_read"),
  position: jsonb("position").$type<{ x0: number; y0: number; x1: number; y1: number } | null>(),
  confidence: real("confidence").notNull(),
}, (t) => [index("ev_doc").on(t.docId), index("ev_doc_page").on(t.docId, t.page)]);

export const returnLines = pgTable("return_lines", {
  version: text("version").notNull(),         // v1 | v2 | v3
  key: text("key").notNull(),                 // F1040.1a
  jurisdiction: text("jurisdiction").notNull(),
  form: text("form").notNull(),
  line: text("line").notNull(),
  label: text("label").notNull(),
  value: jsonb("value"),
  rule: text("rule"),
  inputs: jsonb("inputs").$type<string[]>().notNull(),
  sources: jsonb("sources").$type<string[]>().notNull(),
  note: text("note"),
}, (t) => [primaryKey({ columns: [t.version, t.key] })]);

export const returnVersions = pgTable("return_versions", {
  version: text("version").primaryKey(),
  computedAt: timestamp("computed_at", { withTimezone: true }).notNull(),
  trigger: text("trigger").notNull(),
  documentsUsed: jsonb("documents_used").$type<string[]>().notNull(),
  documentsSuperseded: jsonb("documents_superseded").$type<string[]>().notNull(),
  summary: jsonb("summary").notNull(),
  taxEffectRates: jsonb("tax_effect_rates").notNull(),
  carryoversOut: jsonb("carryovers_out"),
  assets: jsonb("assets"),
  diagnostics: jsonb("diagnostics").$type<{ code: string; severity: string; message: string; refs: string[] }[]>().notNull(),
  changesFromPrevious: jsonb("changes_from_previous").notNull(),
});

export const staff = pgTable("staff", {
  id: text("id").primaryKey(),               // st-01, cu-01
  name: text("name").notNull(),
  role: text("role").notNull(),              // preparer|reviewer|partner|quality_reviewer|firm_administrator|client
  credential: text("credential"),
  sensitiveClearance: boolean("sensitive_clearance").notNull(),
  activeFrom: text("active_from"),
  note: text("note"),
});

/** Everything else in the packet that we keep as JSON blobs, keyed by section. */
export const packetSections = pgTable("packet_sections", {
  key: text("key").primaryKey(),             // household | client | firm | prior_years | tax_agency_records | timeline | engine_reference | what_if | planning_reference_2026 | post_filing_rates | fx_rates | readme | packet
  data: jsonb("data").notNull(),
});

/* ------------------------------------------------------------------ */
/*  WORKPAPER LAYER — append-only events; everything else is derived   */
/* ------------------------------------------------------------------ */

export type EventKind =
  | "verify" | "adjust" | "note" | "question" | "answer" | "assign" | "sign_off"
  | "attach" | "resolve" | "reopen" | "view_sensitive" | "time" | "link"
  | "whatif_create" | "whatif_adjust" | "whatif_close"
  | "freeze" | "amend" | "efile_result" | "standard_change" | "issue_open" | "undo";

export const events = pgTable("events", {
  id: serial("id").primaryKey(),
  at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  actorId: text("actor_id").notNull(),
  actorRole: text("actor_role").notNull(),
  kind: text("kind").$type<EventKind>().notNull(),
  targetRef: text("target_ref").notNull(),   // typed URI: line:F1040.1a | ev:0493 | doc:D11#p2 | issue:12 | area:business | return
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
  batchId: text("batch_id"),
  reversesEventId: integer("reverses_event_id"),
  scenarioId: integer("scenario_id"),        // null = the real workpaper; otherwise a what-if branch
}, (t) => [index("events_target").on(t.targetRef), index("events_kind").on(t.kind), index("events_batch").on(t.batchId), index("events_scenario").on(t.scenarioId)]);

/** Issues are the only derived table we persist (they have identity: assignment, threads). Open/closed state is still event-driven. */
export const issues = pgTable("issues", {
  id: serial("id").primaryKey(),
  kind: text("kind").notNull(),              // check | diagnostic | variance | review_note | client_question | low_confidence | judgment | completeness
  code: text("code"),                        // rule code for checks, e.g. DUP_PAGE
  severity: text("severity").notNull(),      // blocker | warning | info
  blocksFiling: boolean("blocks_filing").notNull().default(false),
  area: text("area").notNull(),
  title: text("title").notNull(),
  detail: text("detail").notNull(),
  refs: jsonb("refs").$type<string[]>().notNull(),
  assignedTo: text("assigned_to"),
  due: text("due"),
  status: text("status").notNull().default("open"), // open | resolved | wont_fix
  resolvedBy: text("resolved_by"),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  resolution: text("resolution"),
  createdBy: text("created_by").notNull(),   // staff id or "system:<rule>"
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("issues_area").on(t.area), index("issues_status").on(t.status)]);

export const scenarios = pgTable("scenarios", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  baseVersion: text("base_version").notNull(),
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  closed: boolean("closed").notNull().default(false),
});

/** Sealed snapshots: filing freeze and amendments. */
export const snapshots = pgTable("snapshots", {
  id: serial("id").primaryKey(),
  kind: text("kind").notNull(),              // freeze | amendment
  label: text("label").notNull(),
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  atEventId: integer("at_event_id").notNull(),
  lines: jsonb("lines").notNull(),           // key -> value (the return as sealed)
  summary: jsonb("summary").notNull(),
  hash: text("hash").notNull(),
});

/** Firm standards are data, editable by the administrator role. */
export const standards = pgTable("standards", {
  id: text("id").primaryKey().default("current"),
  data: jsonb("data").notNull(),
  updatedBy: text("updated_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

/** Last-seen cursor per actor: "what changed since I last looked". */
export const cursors = pgTable("cursors", {
  actorId: text("actor_id").primaryKey(),
  lastSeenEventId: integer("last_seen_event_id").notNull(),
  at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
});
