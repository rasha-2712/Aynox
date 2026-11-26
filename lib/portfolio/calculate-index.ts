import type { ConstituentPriceSeries, IndexPoint, MembershipInterval } from "@/types/market";

function observationTime(date: string): number {
  const value = /^\d{4}-\d{2}-\d{2}$/.test(date) ? `${date}T23:59:59.999Z` : date;
  return Date.parse(value);
}

function membershipAt(intervals: MembershipInterval[], securityId: string, timestamp: number): MembershipInterval | undefined {
  return intervals.find((membership) => {
    if (membership.securityId !== securityId) return false;
    const start = Date.parse(membership.effectiveFrom);
    const end = membership.effectiveTo ? Date.parse(membership.effectiveTo) : Number.POSITIVE_INFINITY;
    return start <= timestamp && timestamp < end;
  });
}

interface IntervalObservation {
  returns: number[];
  eligible: number;
  total: number;
  baselineEligible: number;
  baselineTotal: number;
}

/**
 * Builds an equally weighted daily price-return index from timestamped membership intervals.
 * Each series contributes only its own consecutive observed sessions. For date-only demo points,
 * the observation is treated as a close at 23:59:59.999 UTC; exact exchange close times are not modeled.
 */
export function calculateEqualWeightedIndex(
  series: ConstituentPriceSeries[],
  memberships: MembershipInterval[],
  baseValue = 100
): IndexPoint[] {
  if (series.length === 0) return [];

  const observations = new Map<string, IntervalObservation>();
  const getObservation = (date: string) => {
    let record = observations.get(date);
    if (!record) {
      record = { returns: [], eligible: 0, total: 0, baselineEligible: 0, baselineTotal: 0 };
      observations.set(date, record);
    }
    return record;
  };

  for (const constituent of series) {
    const points = [...constituent.points].sort((a, b) => a.date.localeCompare(b.date));
    points.forEach((point, index) => {
      const currentTime = observationTime(point.date);
      const activeAtObservation = membershipAt(memberships, constituent.securityId, currentTime);
      if (activeAtObservation) {
        const baseline = getObservation(point.date);
        baseline.baselineTotal += 1;
        if (typeof point.price === "number" && Number.isFinite(point.price) && point.price > 0) baseline.baselineEligible += 1;
      }
      if (index === 0) return;

      const previous = points[index - 1];
      const previousTime = observationTime(previous.date);
      const activeAtIntervalStart = membershipAt(memberships, constituent.securityId, previousTime);
      if (!activeAtIntervalStart) return;

      const interval = getObservation(point.date);
      interval.total += 1;
      const membershipContinuesThroughEnd = Date.parse(activeAtIntervalStart.effectiveFrom) <= previousTime
        && (!activeAtIntervalStart.effectiveTo || currentTime < Date.parse(activeAtIntervalStart.effectiveTo));
      if (!membershipContinuesThroughEnd
        || typeof previous.price !== "number" || !Number.isFinite(previous.price) || previous.price <= 0
        || typeof point.price !== "number" || !Number.isFinite(point.price) || point.price <= 0) return;

      interval.returns.push(point.price / previous.price - 1);
      interval.eligible += 1;
    });
  }

  const dates = [...observations.keys()].sort();
  let indexValue = baseValue;
  let initialized = false;
  return dates.map((date) => {
    const observation = observations.get(date)!;
    if (!initialized && observation.baselineEligible > 0) {
      initialized = true;
      return { date, value: baseValue, eligible: observation.baselineEligible, total: observation.baselineTotal };
    }
    if (observation.returns.length === 0) {
      return { date, value: null, eligible: 0, total: observation.total };
    }

    initialized = true;
    const meanReturn = observation.returns.reduce((sum, value) => sum + value, 0) / observation.returns.length;
    indexValue *= 1 + meanReturn;
    return {
      date,
      value: Number(indexValue.toFixed(4)),
      eligible: observation.eligible,
      total: observation.total
    };
  });
}
