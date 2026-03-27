import { NextRequest, NextResponse } from "next/server"

const PKCLAW_BACKEND_URL = process.env.PKCLAW_BACKEND_URL || "http://192.144.205.163:8000"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    const response = await fetch(`${PKCLAW_BACKEND_URL}/api/decision`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      return NextResponse.json(
        { error: `PKclaw backend error: ${response.status}` },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json(
      { error: `Failed to proxy to PKclaw: ${error instanceof Error ? error.message : "Unknown error"}` },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const response = await fetch(`${PKCLAW_BACKEND_URL}/health`)
    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json(
      { error: "PKclaw backend unavailable" },
      { status: 500 }
    )
  }
}