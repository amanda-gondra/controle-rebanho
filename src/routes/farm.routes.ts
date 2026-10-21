import { AuditAction } from "../lib/history.js";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { prisma } from "../lib/prisma.js";
import { FARM_DEFAULTS, FARM_SELECT, toFarmView } from "../lib/farm.js";
import { updateFarmSchema } from "../schemas/farm.schema.js";
import {
  duplicatedLabelKeys,
  mergeCategoryLabels,
  resolveCategoryLabels,
} from "../lib/categories.js";
import { ErrorCode, ruleError } from "../lib/errors.js";

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
      const { categoryLabels: labelChanges, ...rest } = request.body;

      // Nomes das categorias (G4): junta com os atuais, guarda só o que difere
      // do padrão e recusa nomes repetidos (confundiriam lista e filtro).
      let categoryLabels: Record<string, string> | undefined;
      if (labelChanges) {
        const { labels, overrides } = mergeCategoryLabels(
          resolveCategoryLabels(request.auth.farm.settings.categoryLabels),
          labelChanges,
        );
        const duplicated = duplicatedLabelKeys(labels);
        if (duplicated.length > 0) {
          const message = "Cada categoria precisa de um nome diferente.";
          throw ruleError(
            ErrorCode.DUPLICATE_CATEGORY_LABEL,
            message,
            duplicated.map((key) => ({
              field: `categoryLabels.${key}`,
              code: ErrorCode.DUPLICATE_CATEGORY_LABEL,
              error: message,
            })),
          );
        }
        categoryLabels = overrides;
      }

      // Configuração muda o que vem marcado em compras, vendas e lembretes:
      // fica na trilha (D-51) com os campos alterados
      const farm = await prisma.$transaction(async (tx) => {
        const updated = await tx.farm.update({
          where: { id: request.auth.farm.id },
          data: { ...rest, ...(categoryLabels ? { categoryLabels } : {}) },
          select: FARM_SELECT,
        });
        await tx.auditLog.create({
          data: {
            farmId: request.auth.farm.id,
            userId: request.auth.user.id,
            action: AuditAction.FARM_SETTINGS_CHANGED,
            entityType: "Farm",
            entityId: request.auth.farm.id,
            details: { fields: Object.keys(request.body) },
          },
        });
        return updated;
      });

      return { ...toFarmView(farm), defaults: FARM_DEFAULTS.settings };
    },
  );
}
