import { notFound } from "next/navigation";
import { CompanyDetail } from "@/components/company-detail";
import { demoSecurities } from "@/lib/data/demo-data";

export function generateStaticParams() {
  return demoSecurities.map((security) => ({ symbol: security.symbol }));
}

export default async function SecurityPage({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params;
  const security = demoSecurities.find((item) => item.symbol === symbol.toUpperCase());
  if (!security) notFound();
  return <CompanyDetail security={security} />;
}
