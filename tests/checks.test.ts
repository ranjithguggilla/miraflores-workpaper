import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { runChecks } from "@/lib/checks";

const packet = JSON.parse(readFileSync("data/packet.json", "utf8"));
const out = runChecks(packet);

describe("independent checks over the packet", () => {
  it("produces the 101 findings the import seeds", () => {
    expect(out).toHaveLength(101);
  });
  it("finds the duplicate mileage page, the SSN mismatch, the zero-basis RSU lot and the payments mismatch", () => {
    const codes = out.map((i) => i.code);
    expect(codes).toContain("DUP_PAGE");
    expect(codes).toContain("SSN_MISMATCH");
    expect(codes).toContain("PAYMENTS_VS_IRS");
    expect(codes).toContain("PAYMENTS_VS_FTB");
    expect(out.find((i) => i.code === "DUP_PAGE")!.refs).toContain("doc:D23#p3");
    expect(out.filter((i) => i.code === "ZERO_BASIS").some((i) => i.refs.includes("line:F8949.B.N1"))).toBe(true);
  });
  it("flags the transposed EIN on D62 as not on the page", () => {
    const ein = out.find((i) => i.code === "ID_NOT_ON_PAGE");
    expect(ein).toBeDefined();
    expect(ein!.title).toContain("74-3829516");
    expect(ein!.refs).toContain("doc:D62#p1");
  });
  it("marks the SSN mismatch and payment reconciliations as blocking filing", () => {
    for (const code of ["SSN_MISMATCH", "PAYMENTS_VS_IRS", "PAYMENTS_VS_FTB"]) expect(out.find((i) => i.code === code)!.blocksFiling).toBe(true);
  });
  it("carries the engine's 11 diagnostics through as issues", () => {
    expect(out.filter((i) => i.kind === "diagnostic")).toHaveLength(11);
  });
});
