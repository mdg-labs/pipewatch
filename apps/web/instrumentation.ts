export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { parseWebEnv } = await import("@pipewatch/config/env");
    parseWebEnv();
    const { initSentry } = await import("./src/lib/sentry");
    initSentry();
  }
}
