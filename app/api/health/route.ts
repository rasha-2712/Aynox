import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({
    status: "ok",
    service: "aynox",
    dataMode: "synthetic-demo",
    database: "not-required-for-demo-ui",
    timestamp: new Date().toISOString()
  });
}
