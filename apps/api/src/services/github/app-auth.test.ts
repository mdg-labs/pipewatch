import { generateKeyPairSync } from "node:crypto";

import { decodeJwt } from "jose";
import { beforeAll, describe, expect, it, vi } from "vitest";

import type { Db } from "@pipewatch/db";
import { decrypt, encrypt } from "@pipewatch/utils";

import {
  GitHubAppAuthError,
  TOKEN_REFRESH_BUFFER_MS,
  createAppJwt,
  exchangeInstallationToken,
  getInstallationToken,
  gitHubAppConfigFromEnv,
  isInstallationTokenExpired,
  normalizePrivateKey,
  type GitHubAppConfig,
  type IntegrationRecord,
} from "./app-auth.js";
import { githubFetch } from "./github-fetch.js";

const encryptionKey = "a".repeat(32);
let privateKeyPem: string;
let appConfig: GitHubAppConfig;

beforeAll(() => {
  const { privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
    publicKeyEncoding: { type: "spki", format: "pem" },
  });

  privateKeyPem = privateKey;
  appConfig = {
    appId: "123456",
    privateKey: privateKeyPem,
    encryptionKey,
  };
});

function createIntegration(overrides: Partial<IntegrationRecord> = {}): IntegrationRecord {
  return {
    id: "integration-1",
    workspaceId: "workspace-1",
    externalInstallationId: "98765",
    accessToken: encrypt("ghs_cached_token", encryptionKey),
    tokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
    ...overrides,
  };
}

function createMockDb(
  integration: IntegrationRecord | null,
  onUpdate?: (values: { accessToken: string; tokenExpiresAt: Date }) => void,
): Db {
  const updateSet = vi.fn((values: { accessToken: string; tokenExpiresAt: Date }) => {
    onUpdate?.(values);
    return {
      where: vi.fn().mockResolvedValue(undefined),
    };
  });

  return {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue(integration ? [integration] : []),
        }),
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: updateSet,
    }),
  } as unknown as Db;
}

describe("normalizePrivateKey", () => {
  it("accepts PEM with escaped newlines", () => {
    const escaped = privateKeyPem.replace(/\n/g, "\\n");
    expect(normalizePrivateKey(escaped)).toBe(privateKeyPem);
  });

  it("decodes base64-encoded PEM", () => {
    const encoded = Buffer.from(privateKeyPem, "utf8").toString("base64");
    expect(normalizePrivateKey(encoded).trim()).toBe(privateKeyPem.trim());
  });
});

describe("createAppJwt", () => {
  it("signs an RS256 JWT with the GitHub App ID as issuer", async () => {
    const jwt = await createAppJwt(appConfig);
    const payload = decodeJwt(jwt);

    expect(payload.iss).toBe(appConfig.appId);
    expect(typeof payload.iat).toBe("number");
    expect(typeof payload.exp).toBe("number");
    expect((payload.exp ?? 0) - (payload.iat ?? 0)).toBeLessThanOrEqual(9 * 60);
  });

  it("signs JWT with PKCS#1 RSA PEM (GitHub download format)", async () => {
    const { privateKey } = generateKeyPairSync("rsa", {
      modulusLength: 2048,
      privateKeyEncoding: { type: "pkcs1", format: "pem" },
      publicKeyEncoding: { type: "spki", format: "pem" },
    });

    expect(privateKey).toContain("BEGIN RSA PRIVATE KEY");

    const jwt = await createAppJwt({
      appId: "123456",
      privateKey,
      encryptionKey,
    });
    const payload = decodeJwt(jwt);

    expect(payload.iss).toBe("123456");
    expect(typeof payload.iat).toBe("number");
    expect(typeof payload.exp).toBe("number");
  });

  it("throws INVALID_GITHUB_APP_PRIVATE_KEY for malformed PEM", async () => {
    await expect(
      createAppJwt({
        appId: "123456",
        privateKey: "-----BEGIN RSA PRIVATE KEY-----\nnot-valid\n-----END RSA PRIVATE KEY-----",
        encryptionKey,
      }),
    ).rejects.toBeInstanceOf(GitHubAppAuthError);

    await expect(
      createAppJwt({
        appId: "123456",
        privateKey: "-----BEGIN RSA PRIVATE KEY-----\nnot-valid\n-----END RSA PRIVATE KEY-----",
        encryptionKey,
      }),
    ).rejects.toMatchObject({
      code: "INVALID_GITHUB_APP_PRIVATE_KEY",
      status: 500,
    });
  });
});

describe("exchangeInstallationToken", () => {
  it("posts to GitHub with a Bearer App JWT and returns the token payload", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          token: "ghs_new_token",
          expires_at: "2030-01-01T00:00:00Z",
        }),
        { status: 201 },
      ),
    );

    const result = await exchangeInstallationToken("98765", appConfig, fetchImpl);

    expect(result.token).toBe("ghs_new_token");
    expect(result.expires_at).toBe("2030-01-01T00:00:00Z");
    expect(fetchImpl).toHaveBeenCalledOnce();

    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.github.com/app/installations/98765/access_tokens");
    expect(init.method).toBe("POST");
    const headers = new Headers(init.headers);
    expect(headers.get("Authorization")).toMatch(/^Bearer /);
  });
});

describe("isInstallationTokenExpired", () => {
  it("treats tokens inside the refresh buffer as expired", () => {
    const expiresAt = new Date(Date.now() + TOKEN_REFRESH_BUFFER_MS - 1_000);
    expect(isInstallationTokenExpired(expiresAt)).toBe(true);
  });

  it("keeps tokens that expire after the refresh buffer", () => {
    const expiresAt = new Date(Date.now() + TOKEN_REFRESH_BUFFER_MS + 60_000);
    expect(isInstallationTokenExpired(expiresAt)).toBe(false);
  });
});

describe("getInstallationToken", () => {
  it("returns a cached decrypted token when still valid", async () => {
    const integration = createIntegration();
    const database = createMockDb(integration);
    const fetchImpl = vi.fn();

    const token = await getInstallationToken(database, "98765", appConfig, fetchImpl);

    expect(token).toBe("ghs_cached_token");
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(database.update).not.toHaveBeenCalled();
  });

  it("refreshes, encrypts, and persists when the cached token is near expiry", async () => {
    const integration = createIntegration({
      tokenExpiresAt: new Date(Date.now() + 60_000),
    });

    let persisted: { accessToken: string; tokenExpiresAt: Date } | undefined;
    const database = createMockDb(integration, (values) => {
      persisted = values;
    });

    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          token: "ghs_refreshed",
          expires_at: "2030-06-01T12:00:00Z",
        }),
        { status: 201 },
      ),
    );

    const token = await getInstallationToken(database, "98765", appConfig, fetchImpl);

    expect(token).toBe("ghs_refreshed");
    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(persisted).toBeDefined();
    expect(decrypt(persisted?.accessToken ?? "", encryptionKey)).toBe("ghs_refreshed");
    expect(persisted?.tokenExpiresAt.toISOString()).toBe("2030-06-01T12:00:00.000Z");
  });
});

describe("getInstallationToken errors", () => {
  it("throws when the integration row is missing", async () => {
    const database = createMockDb(null);

    await expect(getInstallationToken(database, "missing", appConfig)).rejects.toMatchObject({
      code: "INTEGRATION_NOT_FOUND",
      status: 404,
    });
  });
});

describe("gitHubAppConfigFromEnv", () => {
  it("maps API env vars into GitHub App config", () => {
    const config = gitHubAppConfigFromEnv({
      GITHUB_APP_ID: "42",
      GITHUB_APP_PRIVATE_KEY: privateKeyPem,
      ENCRYPTION_KEY: encryptionKey,
    } as never);

    expect(config.appId).toBe("42");
    expect(config.privateKey).toBe(privateKeyPem);
    expect(config.encryptionKey).toBe(encryptionKey);
  });
});

describe("githubFetch", () => {
  it("retries on rate-limit responses with backoff", async () => {
    vi.useFakeTimers();

    const integration = createIntegration();
    const database = createMockDb(integration);

    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(null, {
          status: 403,
          headers: {
            "x-ratelimit-remaining": "0",
            "retry-after": "1",
          },
        }),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));

    const promise = githubFetch(
      "https://api.github.com/repos/acme/demo/actions/runs",
      { method: "GET" },
      {
        database,
        config: appConfig,
        integration,
        fetchImpl,
        maxRetries: 2,
      },
    );

    await vi.advanceTimersByTimeAsync(1_000);
    const response = await promise;

    expect(response.status).toBe(200);
    expect(fetchImpl).toHaveBeenCalledTimes(2);

    const [, firstInit] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(firstInit.headers).toBeDefined();
    const headers = new Headers(firstInit.headers);
    expect(headers.get("Authorization")).toBe("Bearer ghs_cached_token");

    vi.useRealTimers();
  });

  it("rejects disallowed hosts", async () => {
    const integration = createIntegration();
    const database = createMockDb(integration);

    await expect(
      githubFetch(
        "https://evil.com/repos/acme/demo/actions/runs",
        { method: "GET" },
        {
          database,
          config: appConfig,
          integration,
        },
      ),
    ).rejects.toMatchObject({
      name: "GitHubFetchError",
      status: 400,
      code: "GITHUB_FETCH_HOST_NOT_ALLOWED",
    });
  });
});
