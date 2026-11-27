import { createTestSyntheticEntitlementIssuer } from "@/lib/financial/testing/synthetic-entitlement-issuer";
import { resolveTrustedResearchRequestContext } from "@/lib/research/request-context.server";
import type { FundamentalsProvider, FinancialDataProvenance, FinancialObservation, TechnicalEntitlementRecord } from "@/types/financial";
import type { NewsArticle } from "@/types/news";
import type { TrustedResearchRequestContext } from "@/types/research-context";

const issuer = createTestSyntheticEntitlementIssuer();
const contexts = new Map<string, TrustedResearchRequestContext>();

export async function testResearchContext(securityId: string): Promise<TrustedResearchRequestContext> {
  const prior = contexts.get(securityId);
  if (prior) return prior;
  const previous = process.env.AYNOX_DEPLOYMENT_ENV;
  process.env.AYNOX_DEPLOYMENT_ENV = "test";
  try {
    const resolved = await resolveTrustedResearchRequestContext(new Request("http://localhost/test"), { securityId });
    if (!resolved.ok) throw new Error("Test request context could not be resolved.");
    contexts.set(securityId, resolved.context);
    return resolved.context;
  } finally {
    if (previous === undefined) delete process.env.AYNOX_DEPLOYMENT_ENV;
    else process.env.AYNOX_DEPLOYMENT_ENV = previous;
  }
}

function signedRecord(source: Pick<FinancialDataProvenance, "providerId" | "dataset" | "market" | "sourceRecordId">, securityId: string, contractId: string, deniedOperation?: keyof NonNullable<TechnicalEntitlementRecord["allowedOperations"]>): TechnicalEntitlementRecord {
  const now = new Date();
  return issuer.issue({
    recordId: `fixture-${source.providerId}-${source.sourceRecordId}`,
    providerId: source.providerId,
    dataset: source.dataset,
    market: source.market,
    securityId,
    sourceRecordId: source.sourceRecordId,
    contractId,
    contractVersion: "1",
    environment: "synthetic",
    audience: "demo-only",
    allowedOperations: {
      retrieval: { state: "allowed" },
      derivation: { state: "allowed" },
      "ai-processing": { state: "allowed" },
      display: { state: "allowed" },
      storage: { state: "allowed" },
      retention: { state: "allowed" },
      redistribution: { state: "denied" },
      ...(deniedOperation ? { [deniedOperation]: { state: "denied" as const } } : {})
    },
    effectiveFrom: "2020-01-01T00:00:00.000Z",
    expiresAt: "2035-01-01T00:00:00.000Z",
    issuedAt: new Date(Math.min(now.getTime(), Date.parse("2030-01-01T00:00:00.000Z"))).toISOString()
  });
}

function addTechnicalRecord(source: FinancialDataProvenance, securityId: string, contractId: string, deniedOperation?: keyof NonNullable<TechnicalEntitlementRecord["allowedOperations"]>): FinancialDataProvenance {
  return { ...source, technicalEntitlements: [signedRecord(source, securityId, contractId, deniedOperation)] };
}

function mapObservation<T extends FinancialObservation>(observation: T, securityId: string): T {
  return { ...observation, source: addTechnicalRecord(observation.source, securityId, "aynox-synthetic-fundamentals-fixture") } as T;
}

type FixtureDeniedOperation = keyof NonNullable<TechnicalEntitlementRecord["allowedOperations"]>;
type FixturePermissionOverride = FixtureDeniedOperation | ((sourceRecordId: string) => FixtureDeniedOperation | undefined);

export function withSignedSyntheticFundamentals(provider: FundamentalsProvider, deniedOperation?: FixturePermissionOverride, preflightExpiresAt = "2035-01-01T00:00:00.000Z"): FundamentalsProvider {
  const contract = { dataset: "synthetic-company-financials", contractId: "aynox-synthetic-fundamentals-fixture", contractVersion: "1", retrievalScope: "dataset" as const };
  return {
    providerId: provider.providerId,
    providerName: provider.providerName,
    isDemo: provider.isDemo,
    resolveSecurity: (identity) => provider.resolveSecurity(identity),
    getResearchEntitlementContract: () => contract,
    async getResearchRetrievalPreflight(identity) {
      const now = new Date();
      return {
        ...contract,
        retrievalScope: "dataset" as const,
        record: issuer.issue({
          recordId: `preflight-${identity.securityId}`,
          providerId: provider.providerId,
          dataset: contract.dataset,
          market: identity.exchange,
          securityId: identity.securityId,
          sourceRecordId: null,
          contractId: contract.contractId,
          contractVersion: contract.contractVersion,
          environment: "synthetic",
          audience: "demo-only",
          allowedOperations: { retrieval: { state: "allowed" } },
          effectiveFrom: "2020-01-01T00:00:00.000Z",
          expiresAt: preflightExpiresAt,
          issuedAt: new Date(Math.min(now.getTime(), Date.parse("2030-01-01T00:00:00.000Z"))).toISOString()
        })
      };
    },
    async getCompanyProfile(identity) {
      const result = await provider.getCompanyProfile(identity);
      if (!result.data) return result;
      return { ...result, data: { ...result.data, source: addTechnicalRecord(result.data.source, identity.securityId, contract.contractId, typeof deniedOperation === "function" ? deniedOperation(result.data.source.sourceRecordId) : deniedOperation) } };
    },
    async getFinancialStatements(identity) {
      const result = await provider.getFinancialStatements(identity);
      if (!result.data) return result;
      const bundle = result.data;
      return { ...result, data: {
        ...bundle,
        incomeStatement: { ...bundle.incomeStatement, observations: bundle.incomeStatement.observations.map((item) => ({ ...mapObservation(item, identity.securityId), source: addTechnicalRecord(item.source, identity.securityId, contract.contractId, typeof deniedOperation === "function" ? deniedOperation(item.source.sourceRecordId) : deniedOperation) })) },
        balanceSheet: { ...bundle.balanceSheet, observations: bundle.balanceSheet.observations.map((item) => ({ ...mapObservation(item, identity.securityId), source: addTechnicalRecord(item.source, identity.securityId, contract.contractId, typeof deniedOperation === "function" ? deniedOperation(item.source.sourceRecordId) : deniedOperation) })) },
        cashFlow: { ...bundle.cashFlow, observations: bundle.cashFlow.observations.map((item) => ({ ...mapObservation(item, identity.securityId), source: addTechnicalRecord(item.source, identity.securityId, contract.contractId, typeof deniedOperation === "function" ? deniedOperation(item.source.sourceRecordId) : deniedOperation) })) }
      } };
    }
  };
}

export function signedSyntheticNewsRecord(article: NewsArticle, market: string, deniedOperation?: keyof NonNullable<TechnicalEntitlementRecord["allowedOperations"]>): TechnicalEntitlementRecord {
  return signedRecord({ providerId: "aynox-synthetic-news", dataset: "synthetic-company-news", market, sourceRecordId: article.id }, article.securityId, "aynox-synthetic-news-fixture", deniedOperation);
}

export function signedSyntheticNewsRetrievalPreflight(identity: { securityId: string; exchange: string }, expiresAt = "2035-01-01T00:00:00.000Z") {
  return issuer.issue({
    recordId: `news-preflight-${identity.securityId}`,
    providerId: "aynox-synthetic-news", dataset: "synthetic-company-news", market: identity.exchange,
    securityId: identity.securityId, sourceRecordId: null,
    contractId: "aynox-synthetic-news-fixture", contractVersion: "1",
    environment: "synthetic", audience: "demo-only",
    allowedOperations: { retrieval: { state: "allowed" } },
    effectiveFrom: "2020-01-01T00:00:00.000Z", expiresAt,
    issuedAt: new Date(Math.min(Date.now(), Date.parse("2030-01-01T00:00:00.000Z"))).toISOString()
  });
}
