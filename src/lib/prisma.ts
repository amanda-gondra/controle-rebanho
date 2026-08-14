import { PrismaClient } from "@prisma/client";

// A single database connection reused across the whole app.
// One connection per request would overload Postgres — this is for performance.
export const prisma = new PrismaClient();