import tseslint from "typescript-eslint";

/**
 * Backend lint is intentionally syntax/type-aware only for now. Domain rules
 * belong in the backend's existing test and RLS checks; this keeps CI
 * deterministic without inventing a second style contract for the legacy
 * service.
 */
export default tseslint.config(
  {
    ignores: ["dist/**", "coverage/**"],
  },
  {
    files: ["src/**/*.ts"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {},
  },
);
