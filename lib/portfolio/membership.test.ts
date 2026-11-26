import { describe, expect, it } from "vitest";
import { demoSecurities, trackedDefaults } from "@/lib/data/demo-data";
import { createInitialTrackingState, getMembershipIntervals, getTrackedSecurityIds, loadTrackingState, recordMembershipEvent, saveTrackingState, type StorageLike, type TrackingState } from "@/lib/portfolio/membership";

class MemoryStorage implements StorageLike {
  values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

describe("tracked membership history", () => {
  it("records effective add timestamps and prevents duplicate additions", () => {
    const security = demoSecurities[0];
    const initial: TrackingState = { version: 2, events: [] };
    const added = recordMembershipEvent(initial, security.id, "added", "2026-01-02T10:00:00.000Z", "add-1");
    const duplicate = recordMembershipEvent(added, security.id, "added", "2026-01-03T10:00:00.000Z", "add-2");
    expect(added.events[0]).toMatchObject({ securityId: security.id, type: "added", effectiveAt: "2026-01-02T10:00:00.000Z" });
    expect(duplicate).toBe(added);
    expect(getTrackedSecurityIds(duplicate.events)).toEqual([security.id]);
  });

  it("records removal without deleting the previous membership event", () => {
    const security = demoSecurities[0];
    const added = recordMembershipEvent({ version: 2, events: [] }, security.id, "added", "2026-01-02T10:00:00.000Z", "add");
    const removed = recordMembershipEvent(added, security.id, "removed", "2026-01-03T10:00:00.000Z", "remove");
    expect(removed.events.map((event) => event.type)).toEqual(["added", "removed"]);
    expect(removed.events[1].effectiveAt).toBe("2026-01-03T10:00:00.000Z");
    expect(getTrackedSecurityIds(removed.events)).toEqual([]);
  });

  it("reconstructs closed and current membership intervals", () => {
    const security = demoSecurities[0];
    const added = recordMembershipEvent({ version: 2, events: [] }, security.id, "added", "2026-01-02T10:00:00.000Z", "add");
    const removed = recordMembershipEvent(added, security.id, "removed", "2026-01-03T10:00:00.000Z", "remove");
    const reAdded = recordMembershipEvent(removed, security.id, "added", "2026-01-04T10:00:00.000Z", "re-add");
    expect(getMembershipIntervals(reAdded.events)).toEqual([
      { securityId: security.id, effectiveFrom: "2026-01-02T10:00:00.000Z", effectiveTo: "2026-01-03T10:00:00.000Z" },
      { securityId: security.id, effectiveFrom: "2026-01-04T10:00:00.000Z", effectiveTo: null }
    ]);
  });

  it("saves and restores the membership event history from local storage", () => {
    const storage = new MemoryStorage();
    const security = demoSecurities[0];
    const state = recordMembershipEvent({ version: 2, events: [] }, security.id, "added", "2026-01-02T10:00:00.000Z", "add");
    saveTrackingState(storage, "tracking", state);
    const restored = loadTrackingState(storage, "tracking", "legacy", demoSecurities, [], "2025-01-01T00:00:00.000Z", "2026-01-05T00:00:00.000Z");
    expect(restored).toEqual(state);
  });

  it("migrates the prior symbol-list format without inventing earlier membership", () => {
    const storage = new MemoryStorage();
    storage.setItem("legacy", JSON.stringify([trackedDefaults[0]]));
    const restored = loadTrackingState(storage, "tracking", "legacy", demoSecurities, [], "2025-01-01T00:00:00.000Z", "2026-01-05T00:00:00.000Z");
    expect(restored.events).toHaveLength(1);
    expect(restored.events[0]).toMatchObject({ securityId: demoSecurities[0].id, effectiveAt: "2026-01-05T00:00:00.000Z", type: "added" });
  });

  it("starts with seeded members before the synthetic history begins", () => {
    const state = createInitialTrackingState(demoSecurities, trackedDefaults, "2025-11-25T00:00:00.000Z");
    expect(state.events).toHaveLength(trackedDefaults.length);
    expect(getTrackedSecurityIds(state.events)).toHaveLength(trackedDefaults.length);
  });
});
