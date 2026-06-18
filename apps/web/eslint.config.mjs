import baseConfig from "@pipewatch/config/eslint";

/** @type {import("eslint").Linter.Config[]} */
export default [
  ...baseConfig,
  {
    ignores: ["dist/**", ".next/**", ".open-next/**", "next-env.d.ts"],
  },
];
