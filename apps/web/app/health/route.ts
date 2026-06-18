import { flags } from "@pipewatch/config/edition";
import { NextResponse } from "next/server";

/** Public liveness probe — no authentication required. */
export function GET(): NextResponse {
  return NextResponse.json({
    status: "ok" as const,
    edition: flags.IS_CE ? ("ce" as const) : ("cloud" as const),
  });
}
