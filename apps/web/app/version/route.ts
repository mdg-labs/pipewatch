import packageJson from "../../package.json" with { type: "json" };
import { NextResponse } from "next/server";

/** Public semver probe for deploy planning — no authentication required. */
export function GET(): NextResponse {
  return NextResponse.json({
    version: packageJson.version,
  });
}
