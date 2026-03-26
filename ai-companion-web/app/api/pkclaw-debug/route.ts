import { NextResponse } from "next/server"

import { getDecisionBackendStatus } from "@/app/actions/poker-ai"

export async function GET() {
  try {
    const status = await getDecisionBackendStatus()

    return NextResponse.json(
      {
        ok: true,
        timestamp: new Date().toISOString(),
        runtime: process.env.NODE_ENV || "unknown",
        pkclawApiBaseUrlEnv: process.env.PKCLAW_API_BASE_URL || null,
        status,
      },
      { status: 200 },
    )
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        timestamp: new Date().toISOString(),
        runtime: process.env.NODE_ENV || "unknown",
        pkclawApiBaseUrlEnv: process.env.PKCLAW_API_BASE_URL || null,
        error: error instanceof Error ? error.message : "Unknown debug route error",
      },
      { status: 500 },
    )
  }
}
