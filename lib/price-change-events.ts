import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type PriceChangeType = "all" | "sale" | "buy";

export type PriceChangeFilters = {
  type: PriceChangeType;
  brand: string;
  query: string;
};

export type PriceChangeEvent = {
  id: number;
  productId: number;
  title: string;
  imageUrl: string | null;
  manufacturer: string | null;
  type: Exclude<PriceChangeType, "all">;
  previousPrice: number | null;
  currentPrice: number | null;
  changedAt: Date;
};

export function buildPriceChangeWhere(
  filters: PriceChangeFilters,
): Prisma.PriceChangeWhereInput {
  const productWhere: Prisma.ProductWhereInput = {};

  if (filters.brand) {
    productWhere.manufacturer = filters.brand;
  }
  if (filters.query) {
    productWhere.title = { contains: filters.query };
  }

  return {
    ...(filters.type === "all" ? {} : { type: filters.type }),
    ...(Object.keys(productWhere).length > 0
      ? { product: { is: productWhere } }
      : {}),
  };
}

export async function getPriceChangeEvents(
  filters: PriceChangeFilters,
  skip: number,
  take: number,
): Promise<{ events: PriceChangeEvent[]; total: number }> {
  const where = buildPriceChangeWhere(filters);
  const [rows, total] = await Promise.all([
    prisma.priceChange.findMany({
      where,
      orderBy: [{ changedAt: "desc" }, { id: "desc" }],
      skip,
      take,
      include: {
        product: {
          select: { title: true, imageUrl: true, manufacturer: true },
        },
      },
    }),
    prisma.priceChange.count({ where }),
  ]);

  return {
    events: rows.map((row) => ({
      id: row.id,
      productId: row.productId,
      title: row.product.title,
      imageUrl: row.product.imageUrl,
      manufacturer: row.product.manufacturer,
      type: row.type === "buy" ? "buy" : "sale",
      previousPrice: row.previousPrice,
      currentPrice: row.currentPrice,
      changedAt: row.changedAt,
    })),
    total,
  };
}

export async function getPriceChangeBrands(): Promise<string[]> {
  const products = await prisma.product.findMany({
    where: {
      manufacturer: { not: null },
      priceChanges: { some: {} },
    },
    select: { manufacturer: true },
    distinct: ["manufacturer"],
  });

  const brands = products
    .map((product) => product.manufacturer?.trim() ?? "")
    .filter(Boolean);

  return [...new Set(brands)].sort((left, right) =>
    left.localeCompare(right, "ja", { numeric: true, sensitivity: "base" }),
  );
}
