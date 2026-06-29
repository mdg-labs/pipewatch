#!/usr/bin/env node
/**
 * Create a draft GitHub Release after api/web production deploy.
 * Title from apps/api and apps/web package.json versions; body from git log since last release-* tag.
 */
import { execFileSync, execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const API_DIR = "apps/api";
export const WEB_DIR = "apps/web";

const REPO_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");

/**
 * @param {string | undefined} value
 * @returns {boolean}
 */
export function parseDeployFlag(value) {
  return value === "true";
}

/**
 * @param {boolean} deployApi
 * @param {boolean} deployWeb
 * @returns {boolean}
 */
export function shouldSkipDraftRelease(deployApi, deployWeb) {
  return !deployApi && !deployWeb;
}

/**
 * @param {string} pkgDir
 * @returns {string}
 */
export function readPackageVersion(pkgDir, repoRoot = REPO_ROOT) {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(repoRoot, pkgDir, "package.json"), "utf8"),
  );
  return manifest.version;
}

/**
 * @param {{
 *   deployApi: boolean;
 *   deployWeb: boolean;
 *   apiVersion: string;
 *   webVersion: string;
 * }} input
 * @returns {string}
 */
export function buildReleaseTitle({ deployApi, deployWeb, apiVersion, webVersion }) {
  /** @type {string[]} */
  const titleParts = [];
  if (deployApi) {
    titleParts.push(`API ${apiVersion}`);
  }
  if (deployWeb) {
    titleParts.push(`Web ${webVersion}`);
  }
  return `PipeWatch ${titleParts.join(" · ")}`;
}

/**
 * @param {string | null} lastTag
 * @param {string} gitLogBody
 * @param {string} title
 * @returns {string}
 */
export function buildReleaseNotesBody(lastTag, gitLogBody, title) {
  const trimmed = gitLogBody.trim();
  if (trimmed.length > 0) {
    return `## Changes since ${lastTag ?? "initial release"}\n\n${trimmed}`;
  }
  return `Packages: ${title}`;
}

/**
 * @param {string} dateIsoDay
 * @param {(tag: string) => boolean} tagExists
 * @returns {string}
 */
export function nextReleaseTagName(dateIsoDay, tagExists) {
  let tag = `release-${dateIsoDay}`;
  let suffix = 1;
  while (tagExists(tag)) {
    suffix += 1;
    tag = `release-${dateIsoDay}-${suffix}`;
  }
  return tag;
}

/**
 * @returns {string | null}
 */
export function findLastReleaseTag() {
  try {
    const output = execFileSync(
      "git",
      ["tag", "--list", "release-*", "--sort=-creatordate"],
      { encoding: "utf8" },
    ).trim();
    if (!output) {
      return null;
    }
    return output.split("\n")[0] ?? null;
  } catch {
    return null;
  }
}

/**
 * @param {string | null} lastTag
 * @returns {string}
 */
export function gitLogSinceLastRelease(lastTag) {
  const logRange = lastTag ? `${lastTag}..HEAD` : "HEAD";
  return execFileSync(
    "git",
    ["log", logRange, "--pretty=format:- %s (%h)", "--no-merges"],
    { encoding: "utf8" },
  ).trim();
}

/**
 * @param {string} tag
 */
export function tagExistsLocally(tag) {
  try {
    execSync(`git rev-parse ${shellQuote(`refs/tags/${tag}`)}`, {
      stdio: "pipe",
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * @param {string} value
 */
export function shellQuote(value) {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

/**
 * @param {{
 *   deployApi: boolean;
 *   deployWeb: boolean;
 *   repoRoot?: string;
 *   date?: Date;
 *   tagExists?: (tag: string) => boolean;
 *   findLastTag?: () => string | null;
 *   gitLog?: (lastTag: string | null) => string;
 *   execTag?: (tag: string, title: string) => void;
 *   execPushTag?: (tag: string) => void;
 *   execGhRelease?: (tag: string, title: string, notesBody: string) => void;
 *   log?: (message: string) => void;
 * }} options
 */
export function createDraftRelease(options) {
  const {
    deployApi,
    deployWeb,
    repoRoot = REPO_ROOT,
    date = new Date(),
    tagExists = tagExistsLocally,
    findLastTag = findLastReleaseTag,
    gitLog = gitLogSinceLastRelease,
    execTag = (tag, title) => {
      execSync(`git tag -a ${shellQuote(tag)} -m ${shellQuote(title)}`, {
        stdio: "inherit",
      });
    },
    execPushTag = (tag) => {
      execSync(`git push origin ${shellQuote(tag)}`, { stdio: "inherit" });
    },
    execGhRelease = (tag, title, notesBody) => {
      const notesFile = path.join(repoRoot, ".draft-release-notes.md");
      fs.writeFileSync(notesFile, notesBody);
      try {
        execFileSync(
          "gh",
          [
            "release",
            "create",
            tag,
            "--title",
            title,
            "--draft",
            "--notes-file",
            notesFile,
          ],
          { stdio: "inherit", env: process.env },
        );
      } finally {
        fs.rmSync(notesFile, { force: true });
      }
    },
    log = (message) => {
      process.stdout.write(`${message}\n`);
    },
  } = options;

  if (shouldSkipDraftRelease(deployApi, deployWeb)) {
    log("Neither api nor web deployed — skipping draft release");
    return { skipped: true };
  }

  const apiVersion = readPackageVersion(API_DIR, repoRoot);
  const webVersion = readPackageVersion(WEB_DIR, repoRoot);
  const title = buildReleaseTitle({
    deployApi,
    deployWeb,
    apiVersion,
    webVersion,
  });

  const lastTag = findLastTag();
  const notesBody = buildReleaseNotesBody(lastTag, gitLog(lastTag), title);
  const dateIsoDay = date.toISOString().slice(0, 10);
  const tag = nextReleaseTagName(dateIsoDay, tagExists);

  execTag(tag, title);
  execPushTag(tag);
  execGhRelease(tag, title, notesBody);
  log(`Created draft release ${tag}: ${title}`);

  return { skipped: false, tag, title };
}

const isMain =
  process.argv[1] !== undefined &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isMain) {
  const deployApi = parseDeployFlag(process.env.DEPLOY_API);
  const deployWeb = parseDeployFlag(process.env.DEPLOY_WEB);
  createDraftRelease({ deployApi, deployWeb });
}
