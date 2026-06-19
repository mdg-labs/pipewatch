type WebpackRequireContext = {
  keys(): string[];
  (id: string): string;
};

type WebpackRequire = {
  context(
    directory: string,
    useSubdirectories: boolean,
    regExp: RegExp,
  ): WebpackRequireContext;
};

const webpackRequire = require as unknown as WebpackRequire;

function loadContentDirectory(context: WebpackRequireContext): Record<string, string> {
  const sources: Record<string, string> = {};

  for (const key of context.keys()) {
    const normalizedKey = key.replace(/^\.\//, "");
    sources[normalizedKey] = context(key);
  }

  return sources;
}

export const changelogSources = loadContentDirectory(
  webpackRequire.context("../../content/changelog", false, /\.md$/),
);

export const legalSources = loadContentDirectory(
  webpackRequire.context("../../content/legal", false, /\.mdx$/),
);
