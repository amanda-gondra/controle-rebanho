// Proteção para os testes NUNCA apagarem o banco de desenvolvimento ou de
// produção: o banco de teste vem de TEST_DATABASE_URL (separada da
// DATABASE_URL) e o nome dele tem que terminar em "_test".

export function readTestDatabaseUrl(
  env: Record<string, string | undefined> = process.env,
): string {
  const raw = env.TEST_DATABASE_URL;
  if (!raw) {
    throw new Error(
      "TEST_DATABASE_URL não definida. Os testes de integração precisam de um banco de teste separado (veja docs/testing.md).",
    );
  }

  let databaseName: string;
  try {
    databaseName = new URL(raw).pathname.replace(/^\//, "");
  } catch {
    throw new Error("TEST_DATABASE_URL não é uma URL válida.");
  }

  if (!databaseName.endsWith("_test")) {
    throw new Error(
      'O banco de TEST_DATABASE_URL precisa ter nome terminado em "_test". Por segurança, os testes não rodam em outro banco.',
    );
  }

  if (raw === env.DATABASE_URL) {
    throw new Error("TEST_DATABASE_URL não pode ser igual à DATABASE_URL.");
  }

  return raw;
}

// Lê o arquivo .env, se existir (Node 22+), sem sobrescrever o que já está no ambiente.
export function loadDotEnvIfPresent() {
  try {
    process.loadEnvFile();
  } catch {
    // sem .env: segue só com as variáveis do ambiente (caso do CI)
  }
}
