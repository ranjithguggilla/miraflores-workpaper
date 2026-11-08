import { describe, it, expect } from "vitest";
import { maskText, maskValue } from "@/lib/mask";

describe("masking", () => {
  it("masks SSNs inside free text, keeping the last four", () => {
    expect(maskText("Theo Lindqvist-Okafor: SSN in the organizer (666-74-3309) differs")).toBe("Theo Lindqvist-Okafor: SSN in the organizer (•••-••-3309) differs");
  });
  it("masks IP PINs and long account numbers in text", () => {
    expect(maskText("IP PIN 482913 for Ngozi")).toContain("••••••");
    expect(maskText("IP PIN 482913 for Ngozi")).not.toContain("482913");
    expect(maskText("account 4483019276 at Austin CCU")).not.toContain("4483019276");
  });
  it("leaves EINs and ordinary numbers alone", () => {
    expect(maskText("EIN 74-3829156, proceeds 19,240.00")).toBe("EIN 74-3829156, proceeds 19,240.00");
  });
  it("maskValue shows only the last four characters", () => {
    expect(maskValue("4483019276")).toMatch(/•+ ?•*9276$/);
  });
});
