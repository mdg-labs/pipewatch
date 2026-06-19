import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Db } from "@pipewatch/db";
import { sha256, timingSafeCompare } from "@pipewatch/utils";

import { compareApiKeyDigests, lookupApiKey } from "./api-key.js";

vi.mock("@pipewatch/utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@pipewatch/utils")>();
  return {
    ...actual,
    timingSafeCompare: vi.fn(actual.timingSafeCompare),
  };
});

const mockedTimingSafeCompare = vi.mocked(timingSafeCompare);

function createLookupDb(rows: Array<{
  id: string;
  workspaceId: string;
  createdBy: string;
  keyHash: string;
}>): Db {
  return {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(rows),
      }),
    }),
  } as unknown as Db;
}

describe("compareApiKeyDigests", () => {
  it("returns true when digests match", () => {
    const digest = sha256("pw_test_key_value");
    expect(compareApiKeyDigests(digest, digest)).toBe(true);
  });

  it("returns false when digests differ", () => {
    expect(compareApiKeyDigests(sha256("pw_one"), sha256("pw_two"))).toBe(false);
  });
});

describe("lookupApiKey", () => {
  beforeEach(async () => {
    mockedTimingSafeCompare.mockClear();
    const actual = await vi.importActual<typeof import("@pipewatch/utils")>("@pipewatch/utils");
    mockedTimingSafeCompare.mockImplementation(actual.timingSafeCompare);
  });

  it("matches active keys via constant-time digest compare", async () => {
    const rawKey = "pw_known_api_key_value";
    const database = createLookupDb([
      {
        id: "key-1",
        workspaceId: "workspace-1",
        createdBy: "user-1",
        keyHash: sha256(rawKey),
      },
    ]);

    const row = await lookupApiKey(database, rawKey);

    expect(row).toEqual({
      id: "key-1",
      workspaceId: "workspace-1",
      createdBy: "user-1",
    });
    expect(mockedTimingSafeCompare).toHaveBeenCalledWith(sha256(rawKey), sha256(rawKey));
    expect(mockedTimingSafeCompare).not.toHaveBeenCalledWith(
      sha256(rawKey),
      sha256("__pipewatch_api_key_timing_normalization__"),
    );
  });

  it("compares against a dummy digest when no key matches", async () => {
    const rawKey = "pw_missing_api_key";
    const database = createLookupDb([]);

    const row = await lookupApiKey(database, rawKey);

    expect(row).toBeNull();
    expect(mockedTimingSafeCompare).toHaveBeenCalledWith(
      sha256(rawKey),
      sha256("__pipewatch_api_key_timing_normalization__"),
    );
  });

  it("compares against a dummy digest when prefix matches but hash does not", async () => {
    const rawKey = "pw_prefix_match_only";
    const database = createLookupDb([
      {
        id: "key-1",
        workspaceId: "workspace-1",
        createdBy: "user-1",
        keyHash: sha256("pw_prefix_other_suffix"),
      },
    ]);

    const row = await lookupApiKey(database, rawKey);

    expect(row).toBeNull();
    expect(mockedTimingSafeCompare).toHaveBeenCalledWith(
      sha256(rawKey),
      sha256("pw_prefix_other_suffix"),
    );
    expect(mockedTimingSafeCompare).toHaveBeenCalledWith(
      sha256(rawKey),
      sha256("__pipewatch_api_key_timing_normalization__"),
    );
  });
});
