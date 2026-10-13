import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { prisma } from "../lib/prisma.js";
import { FARM_DEFAULTS, FARM_SELECT, toFarmView } from "../lib/farm.js";
import { updateFarmSchema } from "../schemas/farm.schema.js";

// Configurações da fazenda (G2).
//
// Não existe `:id` na rota: a fazenda é SEMPRE a da sessão (RN-CFG-010).
// `Farm` não está no filtro automático de request.db (é a própria fazenda, não
// um dado "dentro" dela), então aqui o id vem explicitamente de request.auth.
export async function farmRoutes(app: FastifyInstance) {
  const r = app.withTypeProvider<ZodTypeProvider>();

  // GET /farm — dados e configurações da fazenda logada (+ os padrões, para a
  // tela mostrar "padrão: 30 kg" sem repetir os valores no frontend)
  r.get(
    "/farm",
    { schema: { tags: ["Fazenda"], summary: "Dados e configurações da fazenda" } },
    async (request) => ({ ...request.auth.farm, defaults: FARM_DEFAULTS.settings }),
  );

  // PATCH /farm — altera só os campos enviados
  r.patch(
    "/farm",
    {
      schema: {
        tags: ["Fazenda"],
        summary: "Altera dados e configurações da fazenda",
        body: updateFarmSchema,
      },
    },
    async (request) => {
      const farm = await prisma.farm.update({
        where: { id: request.auth.farm.id },
        data: request.body,
        select: FARM_SELECT,
      });

      return { ...toFarmView(farm), defaults: FARM_DEFAULTS.settings };
    },
  );
}
