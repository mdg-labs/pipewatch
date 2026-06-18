/** Monotonic counter to disambiguate IDs created in the same millisecond. */
let seq = 0n;

/** Unique GitHub user id for integration test seeds — fits PostgreSQL signed bigint. */
export function uniqueGithubId(): bigint {
  seq = (seq + 1n) % 1_000_000n;
  return BigInt(Date.now()) * 1_000_000n + seq;
}
