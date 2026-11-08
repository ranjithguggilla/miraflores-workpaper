import { describe, it, expect } from "vitest";
import { can, type Actor } from "@/lib/session";

const actor = (role: string, clearance = true): Actor => ({ id: "x", name: "x", role, credential: null, sensitiveClearance: clearance, activeFrom: null, note: null });
const roles = ["preparer", "reviewer", "partner", "quality_reviewer", "firm_administrator", "client"];
const actions = ["verify", "adjust", "approve_adjustment", "sign_off_reviewer", "resolve", "freeze", "standards", "unmask", "client_approve", "whatif"];

describe("role matrix", () => {
  it("clients can only approve their return (and see their own data)", () => {
    const c = actor("client");
    for (const a of actions) expect(can(c, a)).toBe(a === "client_approve" || a === "unmask");
  });
  it("only the administrator edits standards; only partners freeze", () => {
    for (const r of roles) {
      expect(can(actor(r), "standards")).toBe(r === "firm_administrator");
      expect(can(actor(r), "freeze")).toBe(r === "partner");
    }
  });
  it("adjustments are approved by a partner or the quality reviewer, not by preparers or reviewers", () => {
    expect(can(actor("partner"), "approve_adjustment")).toBe(true);
    expect(can(actor("quality_reviewer"), "approve_adjustment")).toBe(true);
    for (const r of ["preparer", "reviewer", "firm_administrator", "client"]) expect(can(actor(r), "approve_adjustment")).toBe(false);
  });
  it("unmasking follows clearance, not role", () => {
    expect(can(actor("preparer", false), "unmask")).toBe(false);
    expect(can(actor("preparer", true), "unmask")).toBe(true);
  });
  it("prints the full matrix for the report", () => {
    const rows = roles.map((r) => [r, ...actions.map((a) => (can(actor(r, r !== "preparer-noclear"), a) ? "✓" : "✗"))].join(" | "));
    console.log(["role | " + actions.join(" | "), ...rows].join("\n"));
    expect(rows).toHaveLength(6);
  });
});
