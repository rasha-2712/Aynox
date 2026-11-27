import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = [
  ...nextVitals,
  ...nextTypescript,
  {
    files: ["app/**/*.{js,jsx,ts,tsx}", "lib/**/*.{js,jsx,ts,tsx}"],
    ignores: ["**/*.test.{js,jsx,ts,tsx}", "**/*.spec.{js,jsx,ts,tsx}", "lib/financial/testing/**", "lib/research/testing/**"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [{
          group: ["**/financial/testing/**", "**/research/testing/**"],
          message: "Test-only modules must not be imported by application runtime code."
        }]
      }]
    }
  },
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "app/generated/prisma/**",
      "coverage/**"
    ]
  }
];

export default eslintConfig;
