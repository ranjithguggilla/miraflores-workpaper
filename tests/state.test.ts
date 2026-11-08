import { describe, it, expect } from "vitest";
import { adjustmentsFromEvents, liveEvents, type Event } from "@/lib/state";

const ev = (id: number, kind: Event["kind"], targetRef: string, payload: Record<string, unknown>, extra: Partial<Event> = {}): Event =>
  ({ id, at: new Date(2026, 2, id), actorId: "st-01", actorRole: "preparer", kind, targetRef, payload, batchId: null, reversesEventId: null, scenarioId: null, ...extra }) as Event;

describe("adjustment lifecycle derived from events", () => {
  it("is proposed while a partner approval is required and absent", () => {
    const [a] = adjustmentsFromEvents([ev(1, "adjust", "line:Sch1.17", { old: 14400, new: 0, delta: -14400, taxEffectFed: 4464, taxEffectCa: 605, requiresPartner: true, reason: "not eligible" })]);
    expect(a.status).toBe("proposed");
    expect(a.approvedBy).toBeUndefined();
  });
  it("becomes approved once a sign_off event references it", () => {
    const events = [
      ev(1, "adjust", "line:Sch1.17", { old: 14400, new: 0, delta: -14400, taxEffectFed: 4464, taxEffectCa: 605, requiresPartner: true, reason: "r" }),
      ev(2, "sign_off", "line:Sch1.17", { level: "partner", approvesAdjustment: 1 }, { actorId: "st-03", actorRole: "partner" }),
    ];
    const [a] = adjustmentsFromEvents(events);
    expect(a.status).toBe("approved");
    expect(a.approvedBy).toBe("st-03");
  });
  it("is effective immediately when under the threshold", () => {
    const [a] = adjustmentsFromEvents([ev(1, "adjust", "line:SchC.27a.1", { old: 6850, new: 6634, delta: -216, taxEffectFed: 77, taxEffectCa: 7, requiresPartner: false, reason: "Spotify is personal" })]);
    expect(a.status).toBe("approved");
  });
  it("an undo removes the adjustment from the live set without deleting the event", () => {
    const events = [ev(1, "adjust", "line:SchC.9", { old: 8260, new: 5670, delta: -2590, taxEffectFed: 919, taxEffectCa: 80, requiresPartner: false }), ev(2, "undo", "line:SchC.9", { kind: "adjust" }, { reversesEventId: 1 })];
    expect(liveEvents(events)).toHaveLength(0);
    expect(adjustmentsFromEvents(events)).toHaveLength(0);
    expect(events).toHaveLength(2);
  });
  it("a text-line adjustment records delta 0 and still appears", () => {
    const [a] = adjustmentsFromEvents([ev(1, "adjust", "line:SchE.1A", { old: "1450 Fremont Way, Sacramento CA", new: "1450 Fremont Way, Sacramento, CA 95818", delta: 0, taxEffectFed: 0, taxEffectCa: 0, requiresPartner: false, reason: "zip" })]);
    expect(a.delta).toBe(0);
    expect(a.taxEffectFed).toBe(0);
  });
});

describe("undo is visible to every derived view", () => {
  it("a verify followed by its undo leaves no live verification, even when the undo row is a different kind", () => {
    const events = [
      ev(1, "verify", "line:SchC.8", { type: "agreed_to_source_document" }, { batchId: "b-1" }),
      ev(2, "verify", "line:SchC.15", { type: "agreed_to_source_document" }, { batchId: "b-1" }),
      ev(3, "undo", "line:SchC.8", { kind: "verify" }, { reversesEventId: 1 }),
      ev(4, "undo", "line:SchC.15", { kind: "verify" }, { reversesEventId: 2 }),
    ];
    expect(liveEvents(events).filter((e) => e.kind === "verify")).toHaveLength(0);
    // the bug this guards against: filtering to verify rows before calling liveEvents hides the undo rows
    expect(liveEvents(events.filter((e) => e.kind === "verify"))).toHaveLength(2);
  });
});

describe("rate categories", () => {
  it("treats payment lines as balance, not income", async () => {
    const { rateCategoryForLine } = await import("@/lib/areas");
    expect(rateCategoryForLine("F1040.26")).toBe("payments_federal");
    expect(rateCategoryForLine("F1040.25a")).toBe("payments_federal");
    expect(rateCategoryForLine("F540NR.72")).toBe("payments_california");
    expect(rateCategoryForLine("F1040.1a")).toBe("wages");
    expect(rateCategoryForLine("Sch1.17")).toBe("adjustment");
    expect(rateCategoryForLine("SchA.5b")).toBe("salt");
    expect(rateCategoryForLine("SchC.44a")).toBe("count");
  });
});

describe("summary exposes proposed adjustments without applying them", () => {
  it("adjustmentsFromEvents keeps proposed and approved side by side", () => {
    const events = [
      ev(1, "adjust", "line:F8949.B.N3", { old: 18480, new: -620, delta: -19100, taxEffectFed: -6647, taxEffectCa: -1180, requiresPartner: true, reason: "basis per D11" }),
      ev(2, "adjust", "line:SchC.27a.1", { old: 6850, new: 6634, delta: -216, taxEffectFed: 77, taxEffectCa: 7, requiresPartner: false, reason: "Spotify is personal" }),
    ];
    const all = adjustmentsFromEvents(events);
    expect(all.map((a) => a.status)).toEqual(["proposed", "approved"]);
    expect(all.filter((a) => a.status === "approved").reduce((s, a) => s + a.taxEffectFed, 0)).toBe(77);
  });
});
