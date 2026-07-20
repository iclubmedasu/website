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
  ]),
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": [
        "warn",
        {
          selector: 'CallExpression[callee.property.name="toLocaleDateString"]',
          message: "Use formatDate from @iclub/shared/utils or ClientFormattedDate instead of toLocaleDateString.",
        },
        {
          selector: 'CallExpression[callee.property.name="toLocaleString"][arguments.length>0]',
          message: "Use formatDateTime from @iclub/shared/utils instead of toLocaleString.",
        },
      ],
    },
  },
]);

export default eslintConfig;
