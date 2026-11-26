import type {
  CompanyProfileRecord,
  FinancialStatementBundle,
  FundamentalsProvider,
  ProviderResult,
  SecurityIdentity
} from "@/types/financial";

export interface FundamentalsProviderContract extends FundamentalsProvider {
  getCompanyProfile(identity: SecurityIdentity): Promise<ProviderResult<CompanyProfileRecord>>;
  getFinancialStatements(identity: SecurityIdentity): Promise<ProviderResult<FinancialStatementBundle>>;
}

export type { FundamentalsProvider };
export type { SecurityIdentity, SecurityMappingResolution } from "@/types/financial";
