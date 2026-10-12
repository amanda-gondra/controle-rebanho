import { z } from "zod";

// Configuração da aplicação, lida das variáveis de ambiente e VALIDADA na subida.
// Se faltar algo obrigatório ou vier um valor inválido, o servidor não sobe e
// diz QUAL variável está errada (nunca o valor, para não vazar segredo em log).

const booleanFlag = z
  .enum(["true", "false"])
  .transform((value) => value === "true");

// "http://a.com, http://b.com" → ["http://a.com", "http://b.com"]
const originList = z
  .string()
  .transform((value) =>
    value
      .split(",")
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0),
  )
  .pipe(z.array(z.url()).min(1, "Informe pelo menos uma origem."));

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  HOST: z.string().min(1).default("127.0.0.1"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3333),
  DATABASE_URL: z.url(),
  CORS_ORIGINS: originList.default(["http://localhost:5173"]),
  API_DOCS_ENABLED: booleanFlag.optional(),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
});

export type AppConfig = {
  nodeEnv: "development" | "test" | "production";
  host: string;
  port: number;
  corsOrigins: string[];
  apiDocsEnabled: boolean;
  logLevel: "fatal" | "error" | "warn" | "info" | "debug" | "trace" | "silent";
  rateLimitMax: number;
};

export class InvalidConfigError extends Error {
  constructor(public readonly variables: string[]) {
    super(
      `Configuração inválida. Verifique as variáveis de ambiente: ${variables.join(", ")}.`,
    );
    this.name = "InvalidConfigError";
  }
}

export function loadConfig(
  source: Record<string, string | undefined> = process.env,
): AppConfig {
  const parsed = envSchema.safeParse(source);

  if (!parsed.success) {
    const variables = [
      ...new Set(parsed.error.issues.map((issue) => String(issue.path[0]))),
    ];
    throw new InvalidConfigError(variables);
  }

  const env = parsed.data;

  return {
    nodeEnv: env.NODE_ENV,
    host: env.HOST,
    port: env.PORT,
    corsOrigins: env.CORS_ORIGINS,
    // Documentação da API: ligada por padrão, menos em produção (F-20).
    apiDocsEnabled: env.API_DOCS_ENABLED ?? env.NODE_ENV !== "production",
    logLevel: env.LOG_LEVEL,
    rateLimitMax: env.RATE_LIMIT_MAX,
  };
}
