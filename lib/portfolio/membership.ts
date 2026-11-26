import type { MembershipEvent, MembershipInterval, MembershipEventType, Security } from "@/types/market";

export interface TrackingState {
  version: 2;
  events: MembershipEvent[];
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function createInitialTrackingState(
  securities: Security[],
  defaultSymbols: string[],
  effectiveAt: string
): TrackingState {
  return {
    version: 2,
    events: securities
      .filter((security) => defaultSymbols.includes(security.symbol))
      .map((security, index) => ({
        id: `seed-${security.id}-${index}`,
        securityId: security.id,
        type: "added",
        effectiveAt
      }))
  };
}

function validTimestamp(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function isTrackingEvent(value: unknown, knownIds: Set<string>): value is MembershipEvent {
  if (!value || typeof value !== "object") return false;
  const event = value as Record<string, unknown>;
  return typeof event.id === "string"
    && knownIds.has(String(event.securityId))
    && (event.type === "added" || event.type === "removed")
    && validTimestamp(event.effectiveAt);
}

export function restoreTrackingState(
  serialized: string | null,
  securities: Security[],
  defaultSymbols: string[],
  defaultEffectiveAt: string,
  migrationEffectiveAt: string
): TrackingState {
  const fallback = () => createInitialTrackingState(securities, defaultSymbols, defaultEffectiveAt);
  if (!serialized) return fallback();

  try {
    const parsed: unknown = JSON.parse(serialized);
    const knownIds = new Set(securities.map((security) => security.id));
    if (parsed && typeof parsed === "object" && "version" in parsed && "events" in parsed) {
      const stored = parsed as { version?: unknown; events?: unknown };
      if (stored.version === 2 && Array.isArray(stored.events) && stored.events.every((event) => isTrackingEvent(event, knownIds))) {
        return { version: 2, events: [...stored.events].sort((a, b) => a.effectiveAt.localeCompare(b.effectiveAt)) };
      }
    }

    if (Array.isArray(parsed) && parsed.every((symbol) => typeof symbol === "string")) {
      return {
        version: 2,
        events: securities
          .filter((security) => parsed.includes(security.symbol))
          .map((security, index) => ({
            id: `migration-${security.id}-${index}`,
            securityId: security.id,
            type: "added" as const,
            effectiveAt: migrationEffectiveAt
          }))
      };
    }
  } catch {
    return fallback();
  }

  return fallback();
}

export function getMembershipIntervals(events: MembershipEvent[]): MembershipInterval[] {
  const intervals: MembershipInterval[] = [];
  const open = new Map<string, MembershipEvent>();
  const ordered = events
    .map((event, index) => ({ event, index }))
    .sort((a, b) => a.event.effectiveAt.localeCompare(b.event.effectiveAt) || a.index - b.index)
    .map(({ event }) => event);

  for (const event of ordered) {
    if (event.type === "added") {
      if (!open.has(event.securityId)) open.set(event.securityId, event);
      continue;
    }

    const start = open.get(event.securityId);
    if (start) {
      intervals.push({ securityId: event.securityId, effectiveFrom: start.effectiveAt, effectiveTo: event.effectiveAt });
      open.delete(event.securityId);
    }
  }

  for (const [securityId, start] of open) {
    intervals.push({ securityId, effectiveFrom: start.effectiveAt, effectiveTo: null });
  }
  return intervals.sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));
}

export function getTrackedSecurityIds(events: MembershipEvent[]): string[] {
  const status = new Map<string, boolean>();
  const ordered = [...events].sort((a, b) => a.effectiveAt.localeCompare(b.effectiveAt));
  for (const event of ordered) status.set(event.securityId, event.type === "added");
  return [...status].filter(([, tracked]) => tracked).map(([securityId]) => securityId);
}

export function isTrackedSecurity(events: MembershipEvent[], securityId: string): boolean {
  return getTrackedSecurityIds(events).includes(securityId);
}

export function recordMembershipEvent(
  state: TrackingState,
  securityId: string,
  type: MembershipEventType,
  effectiveAt: string,
  id: string
): TrackingState {
  if (isTrackedSecurity(state.events, securityId) === (type === "added")) return state;
  const latestForSecurity = [...state.events]
    .filter((event) => event.securityId === securityId)
    .map((event) => Date.parse(event.effectiveAt))
    .reduce((latest, value) => Math.max(latest, value), Number.NEGATIVE_INFINITY);
  const requested = Date.parse(effectiveAt);
  const safeTimestamp = Number.isFinite(requested) ? Math.max(requested, latestForSecurity + 1) : Date.now();
  return {
    version: 2,
    events: [...state.events, { id, securityId, type, effectiveAt: new Date(safeTimestamp).toISOString() }]
      .sort((a, b) => a.effectiveAt.localeCompare(b.effectiveAt))
  };
}

export function loadTrackingState(
  storage: StorageLike,
  key: string,
  legacyKey: string,
  securities: Security[],
  defaultSymbols: string[],
  defaultEffectiveAt: string,
  migrationEffectiveAt: string
): TrackingState {
  return restoreTrackingState(
    storage.getItem(key) ?? storage.getItem(legacyKey),
    securities,
    defaultSymbols,
    defaultEffectiveAt,
    migrationEffectiveAt
  );
}

export function saveTrackingState(storage: StorageLike, key: string, state: TrackingState): void {
  storage.setItem(key, JSON.stringify(state));
}
