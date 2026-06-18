import baseConfig from "@pipewatch/config/eslint";

/** @type {import("eslint").Linter.Config[]} */
export default [
  ...baseConfig,
  {
    ignores: ["dist/**", "drizzle/**"],
  },
];
