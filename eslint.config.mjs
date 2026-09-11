import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Unzipped design-system export kept for visual reference only. It is not
    // app code, it is not shipped, and it is gitignored — linting it just
    // reports other people's style choices as errors in our runs.
    "design-reference/**",
  ]),
]);

export default eslintConfig;
