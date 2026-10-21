import type { FarmDb } from "./tenant.js";
import { classifyReapplication, isReminderOpen } from "../services/sanitary.service.js";

// Lembretes de reaplicação em aberto (D-40), usados por GET /alerts e pelo
// painel: dentro da antecedência da fazenda (ou vencidos), não dispensados,
// sem reaplicação registrada a partir deles e com pelo menos um animal ativo.
export async function openReminders(
  db: FarmDb,
  farm: { timezone: string; settings: { reapplyAlertDays: number } },
  now: Date = new Date(),
) {
  const applications = await db.application.findMany({
    where: { reapplyDate: { not: null }, reminderDismissedAt: null, reappliedBy: { none: {} } },
    orderBy: { reapplyDate: "asc" },
    include: {
      product: true,
      _count: { select: { animals: true } },
      animals: { where: { animal: { status: "ACTIVE" } }, select: { animalId: true } },
    },
  });

  return applications
    .map(({ animals, ...application }) => {
      const { isAlert, overdue } = classifyReapplication(application, now, farm.timezone, farm.settings.reapplyAlertDays);
      const open = isReminderOpen({ dismissed: false, reapplied: false, activeAnimals: animals.length });
      return {
        ...application,
        overdue,
        isAlert: isAlert && open,
        activeAnimalIds: animals.map((link) => link.animalId),
        activeAnimalsCount: animals.length,
      };
    })
    .filter((application) => application.isAlert)
    .map(({ isAlert: _isAlert, ...application }) => application);
}
