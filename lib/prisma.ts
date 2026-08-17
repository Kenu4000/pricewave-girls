import { PrismaClient } from "@prisma/client";

function createPrismaClient() {
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  }).$extends({
    query: {
      product: {
        async findMany({ args, query }) {
          const selection = args.select as Record<string, unknown> | undefined;
          const priceChanges = selection?.priceChanges;

          if (priceChanges && typeof priceChanges === "object" && !Array.isArray(priceChanges)) {
            const relation = priceChanges as Record<string, unknown>;
            const where = relation.where;

            if (where && typeof where === "object" && !Array.isArray(where)) {
              const relationWhere = where as Record<string, unknown>;
              const previousPrice = relationWhere.previousPrice;
              const currentPrice = relationWhere.currentPrice;
              const type = relationWhere.type;
              const hasNotNull = (value: unknown) =>
                value !== null &&
                typeof value === "object" &&
                !Array.isArray(value) &&
                (value as Record<string, unknown>).not === null;
              const isSaleBuyFilter =
                type !== null &&
                typeof type === "object" &&
                !Array.isArray(type) &&
                Array.isArray((type as Record<string, unknown>).in) &&
                ((type as Record<string, unknown>).in as unknown[]).includes("sale") &&
                ((type as Record<string, unknown>).in as unknown[]).includes("buy");

              if (isSaleBuyFilter && hasNotNull(previousPrice) && hasNotNull(currentPrice)) {
                const { where: _ignoredWhere, ...relationWithoutWhere } = relation;
                args = {
                  ...args,
                  select: {
                    ...args.select,
                    priceChanges: relationWithoutWhere,
                  },
                };
              }
            }
          }

          return query(args);
        },
      },
    },
  });
}

type AppPrismaClient = ReturnType<typeof createPrismaClient>;

const globalForPrisma = globalThis as unknown as {
  prisma?: AppPrismaClient;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
