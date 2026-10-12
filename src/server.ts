import { buildApp } from "./app.js";
import { loadConfig } from "./config/env.js";
import { prisma } from "./lib/prisma.js";

// Ponto de entrada: lê a configuração, monta a aplicação e sobe o servidor.
// Se a configuração estiver errada, o processo para aqui com uma mensagem clara.
const config = loadConfig();
const app = await buildApp(config);

// Desligamento limpo: termina as requisições em andamento e fecha o banco.
// (A hospedagem manda SIGTERM antes de trocar de versão.)
async function shutdown(signal: string) {
  app.log.info({ signal }, "Encerrando o servidor...");
  try {
    await app.close();
    await prisma.$disconnect();
    process.exit(0);
  } catch (error) {
    app.log.error(error, "Falha ao encerrar o servidor.");
    process.exit(1);
  }
}

process.once("SIGTERM", () => void shutdown("SIGTERM"));
process.once("SIGINT", () => void shutdown("SIGINT"));

try {
  await app.listen({ host: config.host, port: config.port });
} catch (error) {
  app.log.error(error, "Não foi possível subir o servidor.");
  await prisma.$disconnect();
  process.exit(1);
}
