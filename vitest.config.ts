import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@/lib/financial/entitlement-trust-roots.server": fileURLToPath(new URL("./lib/financial/testing/entitlement-trust-roots.ts", import.meta.url)),
      "@/lib/research/synthetic-evidence-policy.server": fileURLToPath(new URL("./lib/research/testing/synthetic-evidence-policy.ts", import.meta.url)),
      "@": root,
      "server-only": fileURLToPath(new URL("./node_modules/next/dist/compiled/server-only/empty.js", import.meta.url))
    }
  },
  test: {
    environment: "node",
    include: ["**/*.test.ts", "**/*.test.tsx"],
    coverage: {
      reporter: ["text", "html"],
      include: ["lib/**/*.ts"]
    }
  }
});
