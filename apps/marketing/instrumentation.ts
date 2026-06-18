export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { parseMarketingEnv } = await import("@pipewatch/config/env");
    parseMarketingEnv();
    const { initSentry } = await import("./src/lib/sentry");
    initSentry();
  }
}
