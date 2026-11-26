# Aynox

Aynox is an AI-powered investment research and portfolio intelligence platform. This repository now contains the first runnable frontend and technical foundation, using clearly labeled synthetic demonstration data.

## Current development status

- Responsive dashboard, discovery, tracked portfolio, company research, and settings pages are scaffolded.
- Market data is synthetic/mock only; no external market, news, sentiment, ESG, or forecast provider is connected.
- Portfolio interactions are stored in browser local storage for demo purposes.
- PostgreSQL and Prisma schema are configured, but no database server is required to open the frontend.
- Authentication, production provider integrations, forecasting, ESG scoring, and community are not implemented.

## Technology stack

Next.js 16 App Router, React 19, TypeScript strict mode, Tailwind CSS 4, Next.js Route Handlers, PostgreSQL, Prisma ORM 7, Recharts, Lucide React, npm, ESLint, and Vitest.

## Prerequisites

- Node.js 22.12+ (Node.js 24.11+ recommended for Prisma ORM 7).
- npm 10 or newer.
- PostgreSQL only when applying database migrations or using persistent database features.

## Installation

```bash
npm install
```

## Environment configuration

Copy `.env.example` to `.env.local` for the Next.js app. If you use Prisma CLI commands, also make `DATABASE_URL` available to dotenv (for example in a root `.env` file). Replace the placeholder URL with your local PostgreSQL connection string. Never commit real credentials.

The frontend uses mock data and can run without `DATABASE_URL` or a running database.

## Run locally

```bash
npm run dev
```

Open http://localhost:3000. The API health check is available at http://localhost:3000/api/health.

## PostgreSQL and Prisma

The Prisma schema is in `prisma/schema.prisma`. Generate the client without requiring a database server:

```bash
npm run db:generate
npm run db:validate
```

Configure PostgreSQL in `DATABASE_URL`, then create/apply a development migration:

```bash
npm run db:migrate -- --name init
```

No migration is applied automatically. The initial app does not use the database for its mock UI.

## Checks

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Mock-data disclaimer

All displayed prices, movements, charts, news, sentiment, and ESG examples are synthetic and labeled **DEMO**. They are not live quotes, investment research, forecasts, or advice, and must not be interpreted as real performance. Tracked stocks are not user holdings. The portfolio index is a synthetic local-currency, equal-weighted daily return series, excludes FX and cash dividends, and is not actual personal investment performance.

## Current limitations

- No sign-in, account persistence, brokerage integration, trading, or actual holdings accounting.
- No live market-data, news, ESG, sentiment, or forecasting integration.
- Portfolio selections are local to the browser and resettable.
- Provider adapter and data rights must be validated before any production customer display.
- The six-market proof of concept remains deferred.
- Community remains a later product phase.
