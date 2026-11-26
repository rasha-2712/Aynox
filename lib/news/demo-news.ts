import type { NewsArticleInput } from "@/types/news";
import { demoSecurities } from "@/lib/data/demo-data";

const sourceName = "Aynox Synthetic News Lab";
const contentKind = "demo" as const;
const disclaimer = "Fictional scenario for the Aynox interface demonstration. This is not a report of a real event and has no external source.";

const demoNewsScenarios: Omit<NewsArticleInput, "securityId">[] = [
  {
    id: "scenario-nvda-001", symbol: "NVDA", companyName: "NVIDIA Corporation", sourceName,
    headline: "DEMO SCENARIO: Data center buyers discuss orders for accelerator capacity expansion",
    summary: "A fictional buyer-planning scenario describes broader accelerator capacity requests and improved delivery coordination.",
    body: `${disclaimer} In this invented scenario, several unnamed data-center buyers discuss expanding accelerator capacity plans. The scenario describes improved delivery coordination and stronger planning visibility. No named customer, order, shipment, quotation, financial result, or company announcement is represented.`,
    publishedAt: "2026-11-24T14:20:00.000Z", category: "Markets", contentKind,
    scenarioStatement: "The fictional scenario describes buyers discussing broader accelerator capacity plans and improved delivery coordination.",
    possibleImplication: "If a similar pattern were independently verified, capacity planning and delivery commitments could merit monitoring. This is a hypothetical question, not a forecast."
  },
  {
    id: "scenario-nvda-002", symbol: "NVDA", companyName: "NVIDIA Corporation", sourceName,
    headline: "DEMO SCENARIO: Data center buyers discuss orders for accelerator capacity expansion",
    summary: "A fictional buyer-planning scenario describes broader accelerator capacity requests and improved delivery coordination.",
    body: `${disclaimer} This intentionally near-duplicate scenario rephrases the buyer-planning example in a separate demo record. It describes capacity growth discussions and improved coordination, not an actual customer order or company disclosure.`,
    publishedAt: "2026-11-24T09:10:00.000Z", category: "Markets", contentKind,
    scenarioStatement: "A second fictional record repeats the accelerator capacity-planning scenario with slightly different wording.",
    possibleImplication: "Repeated coverage of a verified topic could affect how analysts prioritize follow-up questions; this duplicate demo record is not independent corroboration."
  },
  {
    id: "scenario-nvda-003", symbol: "NVDA", companyName: "NVIDIA Corporation", sourceName,
    headline: "DEMO SCENARIO: Packaging capacity remains a planning constraint",
    summary: "An invented operations scenario describes delivery delays and uncertainty in advanced packaging capacity planning.",
    body: `${disclaimer} In this fictional scenario, a hypothetical packaging constraint introduces possible delays and uncertainty into production planning. It does not describe an actual supplier, shipment, production result, or NVIDIA statement.`,
    publishedAt: "2026-11-21T11:30:00.000Z", category: "Operations", contentKind,
    scenarioStatement: "The scenario describes a hypothetical advanced-packaging constraint that could cause delivery delays.",
    possibleImplication: "A verified constraint could be relevant to supply planning and delivery expectations; the example provides no evidence that such a constraint exists."
  },
  {
    id: "scenario-msft-001", symbol: "MSFT", companyName: "Microsoft Corporation", sourceName,
    headline: "DEMO SCENARIO: Cloud customers test efficiency commitments",
    summary: "A fictional customer-planning example describes improved workload efficiency and broader cloud service trials.",
    body: `${disclaimer} The invented scenario describes customers testing efficiency measures and expanding cloud-service trials. It contains no real customer, contract, usage metric, or Microsoft announcement.`,
    publishedAt: "2026-11-24T08:00:00.000Z", category: "Products", contentKind,
    scenarioStatement: "The fictional scenario describes cloud customers testing efficiency measures and considering broader service trials.",
    possibleImplication: "If independently confirmed, sustained efficiency gains might be relevant to cloud adoption discussions; this demo does not establish customer behavior or revenue impact."
  },
  {
    id: "scenario-msft-002", symbol: "MSFT", companyName: "Microsoft Corporation", sourceName,
    headline: "DEMO SCENARIO: Enterprise software planning remains steady",
    summary: "A fictional planning brief presents a neutral scenario of stable enterprise renewal discussions.",
    body: `${disclaimer} This scenario describes steady hypothetical renewal planning with no material change in the assumptions presented. It is not based on actual customer conversations, bookings, or company guidance.`,
    publishedAt: "2026-11-20T12:15:00.000Z", category: "Earnings", contentKind,
    scenarioStatement: "The invented brief presents steady hypothetical renewal planning without an indicated direction of change.",
    possibleImplication: "Analysts could compare renewal assumptions with verified disclosures if such evidence becomes available; no financial conclusion follows from this scenario."
  },
  {
    id: "scenario-aapl-001", symbol: "AAPL", companyName: "Apple Inc.", sourceName,
    headline: "DEMO SCENARIO: Component sourcing scenarios highlight cost pressure",
    summary: "An invented supplier-planning example describes rising component costs and sourcing uncertainty.",
    body: `${disclaimer} The fictional scenario models higher component costs and sourcing uncertainty. It does not identify a supplier, product, contract, or real Apple supply-chain event.`,
    publishedAt: "2026-11-23T16:40:00.000Z", category: "Operations", contentKind,
    scenarioStatement: "The scenario explores hypothetical component cost pressure and sourcing uncertainty.",
    possibleImplication: "If verified, persistent input-cost changes could be a topic for margin sensitivity analysis; this story is not evidence of actual costs or margins."
  },
  {
    id: "scenario-aapl-002", symbol: "AAPL", companyName: "Apple Inc.", sourceName,
    headline: "DEMO SCENARIO: Device demand assumptions remain unchanged",
    summary: "A fictional market-planning note presents stable assumptions with no clear positive or negative direction.",
    body: `${disclaimer} In this neutral scenario, hypothetical device-demand assumptions remain unchanged from a prior planning baseline. No shipment, sales, or market-share data is asserted.`,
    publishedAt: "2026-11-18T10:05:00.000Z", category: "Markets", contentKind,
    scenarioStatement: "The invented note describes unchanged demand assumptions and no clear directional development.",
    possibleImplication: "Stable assumptions could reduce the need to revise a scenario model, but the example is not a measurement of actual demand."
  },
  {
    id: "scenario-asml-001", symbol: "ASML", companyName: "ASML Holding N.V.", sourceName,
    headline: "DEMO SCENARIO: Customers model longer equipment delivery windows",
    summary: "A fictional planning scenario introduces delivery delays and timing uncertainty for complex equipment programs.",
    body: `${disclaimer} This invented scenario models longer delivery windows and uncertainty for hypothetical equipment programs. It does not describe an ASML backlog, customer order, shipment, or company communication.`,
    publishedAt: "2026-11-24T07:25:00.000Z", category: "Operations", contentKind,
    scenarioStatement: "The scenario describes hypothetical delivery delays and timing uncertainty in complex equipment programs.",
    possibleImplication: "If a similar issue were verified, analysts might examine delivery schedules and customer timing assumptions; this demo does not establish an actual delay."
  },
  {
    id: "scenario-asml-002", symbol: "ASML", companyName: "ASML Holding N.V.", sourceName,
    headline: "DEMO SCENARIO: Service backlog planning remains stable",
    summary: "A neutral fictional operations example describes unchanged service-capacity assumptions.",
    body: `${disclaimer} The scenario presents steady hypothetical service-capacity planning without asserting a real backlog level or customer event.`,
    publishedAt: "2026-11-19T09:45:00.000Z", category: "Operations", contentKind,
    scenarioStatement: "The fictional scenario describes unchanged service-capacity planning assumptions.",
    possibleImplication: "Stable assumptions could be carried into scenario analysis pending verified data; no actual service performance is reported."
  },
  {
    id: "scenario-nvo-001", symbol: "NVO", companyName: "Novo Nordisk A/S", sourceName,
    headline: "DEMO SCENARIO: Capacity planning supports a hypothetical product launch",
    summary: "An invented planning example describes improved manufacturing readiness for a hypothetical launch scenario.",
    body: `${disclaimer} In this fictional example, improved capacity planning supports a hypothetical product-launch schedule. No actual medicine, regulatory approval, production volume, or Novo Nordisk announcement is involved.`,
    publishedAt: "2026-11-22T13:10:00.000Z", category: "Products", contentKind,
    scenarioStatement: "The scenario describes improved planning readiness for a hypothetical product-launch schedule.",
    possibleImplication: "If confirmed in real reporting, manufacturing readiness and launch timing could warrant follow-up; this fictional example is not evidence of either."
  },
  {
    id: "scenario-nvo-002", symbol: "NVO", companyName: "Novo Nordisk A/S", sourceName,
    headline: "DEMO SCENARIO: Trial timing assumptions introduce uncertainty",
    summary: "A fictional research-planning example describes uncertainty around a hypothetical trial timeline.",
    body: `${disclaimer} The invented scenario explores a possible delay in a hypothetical research timeline and notes uncertainty. It does not refer to an actual trial, participant, product, or regulatory filing.`,
    publishedAt: "2026-11-18T15:50:00.000Z", category: "Markets", contentKind,
    scenarioStatement: "A fictional research-planning timeline includes uncertainty and a possible delay.",
    possibleImplication: "If verified, timeline changes could affect scenario assumptions; this article does not describe a real study or outcome."
  },
  {
    id: "scenario-tsm-001", symbol: "TSM", companyName: "Taiwan Semiconductor Manufacturing Company", sourceName,
    headline: "DEMO SCENARIO: Foundry customers discuss broader capacity plans",
    summary: "A fictional market scenario describes stronger planning demand and a possible capacity expansion discussion.",
    body: `${disclaimer} This invented scenario describes customers discussing broader foundry capacity plans and improved demand visibility. No actual order, utilization rate, expansion decision, or TSMC disclosure is asserted.`,
    publishedAt: "2026-11-21T08:35:00.000Z", category: "Markets", contentKind,
    scenarioStatement: "The fictional scenario describes stronger planning demand and broader capacity discussions.",
    possibleImplication: "Verified demand changes could be relevant to capacity planning analysis; this scenario is not evidence of customer orders or utilization."
  },
  {
    id: "scenario-bhp-001", symbol: "BHP", companyName: "BHP Group Limited", sourceName,
    headline: "DEMO SCENARIO: Weather disruption adds uncertainty to mine operations",
    summary: "A fictional operations scenario describes disruption risk and possible delays in an unnamed mining plan.",
    body: `${disclaimer} The invented scenario models weather disruption, operational risk, and possible delays. It does not identify a mine, commodity, location, or real BHP operating event.`,
    publishedAt: "2026-11-23T05:55:00.000Z", category: "Operations", contentKind,
    scenarioStatement: "The fictional scenario describes operational disruption risk and possible schedule delays.",
    possibleImplication: "If verified, disruptions could be relevant to production and logistics assumptions; no actual mine impact is reported here."
  },
  {
    id: "scenario-amzn-001", symbol: "AMZN", companyName: "Amazon.com, Inc.", sourceName,
    headline: "DEMO SCENARIO: Fulfillment cost assumptions move higher",
    summary: "A fictional operating model explores cost pressure and uncertainty in hypothetical fulfillment planning.",
    body: `${disclaimer} The demo scenario models higher fulfillment costs and uncertainty under a hypothetical operating plan. It is not a report of Amazon expenses, efficiency, or guidance.`,
    publishedAt: "2026-11-20T17:00:00.000Z", category: "Operations", contentKind,
    scenarioStatement: "The fictional model explores rising fulfillment cost assumptions and operating uncertainty.",
    possibleImplication: "A verified cost trend could be relevant to operating-margin scenarios; this example provides no evidence of actual costs or margins."
  },
  {
    id: "scenario-googl-001", symbol: "GOOGL", companyName: "Alphabet Inc.", sourceName,
    headline: "DEMO SCENARIO: Privacy review timeline remains under discussion",
    summary: "A neutral fictional policy-planning example presents an unresolved review timeline without a directional outcome.",
    body: `${disclaimer} This scenario describes a hypothetical privacy review timeline that remains under discussion. It does not refer to a real regulator, proceeding, policy decision, or Alphabet product change.`,
    publishedAt: "2026-11-19T11:20:00.000Z", category: "Regulation", contentKind,
    scenarioStatement: "The invented scenario describes an unresolved policy-review timeline with no stated outcome.",
    possibleImplication: "If applicable to a verified development, timeline changes could inform compliance planning; this demo does not indicate a real review."
  },
  {
    id: "scenario-orcl-001", symbol: "ORCL", companyName: "Oracle Corporation", sourceName,
    headline: "DEMO SCENARIO: Renewal planning includes broader cloud adoption",
    summary: "A fictional enterprise-planning example describes improved adoption assumptions and a broader cloud evaluation.",
    body: `${disclaimer} In this invented scenario, renewal planning includes improved adoption assumptions and a broader cloud-service evaluation. It does not describe an actual customer, contract, booking, or Oracle statement.`,
    publishedAt: "2026-11-17T14:00:00.000Z", category: "Strategy", contentKind,
    scenarioStatement: "The fictional scenario describes improved enterprise adoption assumptions and broader service evaluation.",
    possibleImplication: "If independently verified, adoption changes could merit analysis alongside disclosed customer and financial data; no such evidence is supplied here."
  }
 ];

export const demoNewsArticles: NewsArticleInput[] = demoNewsScenarios.map((article) => {
  const security = demoSecurities.find((candidate) => candidate.symbol === article.symbol);
  if (!security) throw new Error(`Demo news references unknown ticker ${article.symbol}`);
  return { ...article, securityId: security.id };
});
