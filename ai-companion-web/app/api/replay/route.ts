import { NextResponse } from "next/server";

import { buildReplayPreview } from "@/lib/replayPreview";

export async function GET() {
  return NextResponse.json({
    replay: buildReplayPreview(),
  });
}
