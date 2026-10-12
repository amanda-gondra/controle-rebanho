import { defineConfig } from "vitest/config";

// Dois grupos de teste:
// - unit: funções puras em src/ (rápidos, sem banco)
// - integration: rotas da API contra um banco de TESTE real (tests/integration)
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "unit",
          include: ["src/**/*.test.ts"],
        },
      },
      {
        test: {
          name: "integration",
          include: ["tests/integration/**/*.test.ts"],
          setupFiles: ["tests/setup/integration.ts"],
          // um arquivo por vez: todos compartilham o mesmo banco de teste
          fileParallelism: false,
          testTimeout: 15000,
        },
      },
    ],
  },
});
