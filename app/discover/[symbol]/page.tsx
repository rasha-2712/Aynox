import { notFound } from "next/navigation";
import { CompanyDetail } from "@/components/company-detail";
import { demoSecurities } from "@/lib/data/demo-data";
import { discoveryReturnHref } from "@/lib/discovery/routes";

export function generateStaticParams() {
  return demoSecurities.map((security) => ({ symbol: security.symbol }));
}

export default async function SecurityPage({ params, searchParams }: { params: Promise<{ symbol: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { symbol } = await params;
  const query = await searchParams;
  const security = demoSecurities.find((item) => item.symbol === symbol.toUpperCase());
  if (!security) notFound();
  return <CompanyDetail security={security} backHref={discoveryReturnHref(query)} />;
}
