import eslint from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

/** @type {import("typescript-eslint").Config} */
export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        ...globals.node,
      },
    },
    rules: {
      "no-console": "error",
    },
  },
);
