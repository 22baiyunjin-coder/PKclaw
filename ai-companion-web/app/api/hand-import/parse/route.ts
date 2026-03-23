import { NextResponse } from "next/server"

import { generateStructuredHandImport } from "@/lib/hand-import-parser"

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { input?: unknown }
    const input = typeof body.input === "string" ? body.input.trim() : ""

    if (!input) {
      return NextResponse.json(
        { error: "A non-empty hand description is required." },
        { status: 400 },
      )
    }

    const result = await generateStructuredHandImport(input)

    return NextResponse.json(result)
  } catch (error) {
    console.error("[/api/hand-import/parse] Failed to structure hand input", error)

    return NextResponse.json(
      { error: "Failed to structure the hand input." },
      { status: 500 },
    )
  }
}
