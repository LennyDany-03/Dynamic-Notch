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
    // The Tauri app is a separate project with its own toolchain. Linting it
    // from here also drags in its minified `dist/` bundle, which produces
    // enough findings in one line to crash ESLint's formatter outright.
    "product/**",
  ]),
]);

export default eslintConfig;
