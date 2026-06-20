import { generateKeyPairSync } from "node:crypto";

import { decodeJwt } from "jose";
import { beforeAll, describe, expect, it } from "vitest";

import {
  createAppJwt,
  GitHubAppJwtError,
  normalizePrivateKey,
  type GitHubAppJwtConfig,
} from "./create-app-jwt.js";

let privateKeyPem: string;
let appConfig: GitHubAppJwtConfig;

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
  };
});

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
      }),
    ).rejects.toBeInstanceOf(GitHubAppJwtError);

    await expect(
      createAppJwt({
        appId: "123456",
        privateKey: "-----BEGIN RSA PRIVATE KEY-----\nnot-valid\n-----END RSA PRIVATE KEY-----",
      }),
    ).rejects.toMatchObject({
      code: "INVALID_GITHUB_APP_PRIVATE_KEY",
      status: 500,
    });
  });
});
