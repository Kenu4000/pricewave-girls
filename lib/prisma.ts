import { Prisma, PrismaClient } from "@prisma/client";
import { includesSearchText } from "@/lib/search-text";

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

async function matchingProductTitleIds(
  client: PrismaClient,
  query: string,
): Promise<number[]> {
  const products = await client.product.findMany({
    select: { id: true, title: true },
  });
  return products
    .filter((product) => includesSearchText(product.title, query))
    .map((product) => product.id);
}

async function rewriteProductWhereTitleContains(
  client: PrismaClient,
  where: Prisma.ProductWhereInput,
): Promise<Prisma.ProductWhereInput> {
  const next: Prisma.ProductWhereInput = { ...where };
  const titleFilter = isRecord(next.title) ? next.title : null;
  const contains = titleFilter?.contains;

  if (typeof contains === "string") {
    const ids = await matchingProductTitleIds(client, contains);
    const { contains: _ignoredContains, ...remainingTitleFilter } = titleFilter;
    delete next.title;
    if (Object.keys(remainingTitleFilter).length > 0) {
      next.title = remainingTitleFilter as Prisma.ProductWhereInput["title"];
    }
    return {
      AND: [next, { id: { in: ids } }],
    };
  }

  if (Array.isArray(next.AND)) {
    next.AND = await Promise.all(
      next.AND.map((item) => rewriteProductWhereTitleContains(client, item)),
    );
  } else if (next.AND && isRecord(next.AND)) {
    next.AND = await rewriteProductWhereTitleContains(
      client,
      next.AND as Prisma.ProductWhereInput,
    );
  }

  if (Array.isArray(next.OR)) {
    next.OR = await Promise.all(
      next.OR.map((item) => rewriteProductWhereTitleContains(client, item)),
    );
  }

  if (Array.isArray(next.NOT)) {
    next.NOT = await Promise.all(
      next.NOT.map((item) => rewriteProductWhereTitleContains(client, item)),
    );
  } else if (next.NOT && isRecord(next.NOT)) {
    next.NOT = await rewriteProductWhereTitleContains(
      client,
      next.NOT as Prisma.ProductWhereInput,
    );
  }

  return next;
}

async function rewritePriceChangeWhereTitleContains(
  client: PrismaClient,
  where: Prisma.PriceChangeWhereInput,
): Promise<Prisma.PriceChangeWhereInput> {
  const next: Prisma.PriceChangeWhereInput = { ...where };
  if (isRecord(next.product)) {
    const relation = { ...next.product } as Record<string, unknown>;
    if (isRecord(relation.is)) {
      relation.is = await rewriteProductWhereTitleContains(
        client,
        relation.is as Prisma.ProductWhereInput,
      );
      next.product = relation as Prisma.PriceChangeWhereInput["product"];
    }
  }

  return next;
}

function createPrismaClient() {
  const base = new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

  return base.$extends({
    query: {
      product: {
        async findMany({ args, query }) {
          if (args.where) {
            args = {
              ...args,
              where: await rewriteProductWhereTitleContains(base, args.where),
            };
          }

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
        async count({ args, query }) {
          if (args.where) {
            args = {
              ...args,
              where: await rewriteProductWhereTitleContains(base, args.where),
            };
          }
          return query(args);
        },
      },
      priceChange: {
        async findMany({ args, query }) {
          if (args.where) {
            args = {
              ...args,
              where: await rewritePriceChangeWhereTitleContains(base, args.where),
            };
          }
          return query(args);
        },
        async count({ args, query }) {
          if (args.where) {
            args = {
              ...args,
              where: await rewritePriceChangeWhereTitleContains(base, args.where),
            };
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
