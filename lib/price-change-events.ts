import { Prisma } from "@prisma/client";
import {
  buildProductFilterCatalog,
  normalizeFilterChoiceValue,
  type RankedFilterOptions,
} from "@/lib/product-filter-options";
import { prisma } from "@/lib/prisma";

export type PriceChangeType = "all" | "sale" | "buy";
export type PriceChangeDirection = "all" | "up" | "down";

export type PriceChangeFilters = {
  type: PriceChangeType;
  direction: PriceChangeDirection;
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

const PRICE_CHANGE_INCLUDE = {
  product: {
    select: { title: true, imageUrl: true, manufacturer: true },
  },
} satisfies Prisma.PriceChangeInclude;

type PriceChangeRow = Prisma.PriceChangeGetPayload<{
  include: typeof PRICE_CHANGE_INCLUDE;
}>;

function mapPriceChangeRow(row: PriceChangeRow): PriceChangeEvent {
  return {
    id: row.id,
    productId: row.productId,
    title: row.product.title,
    imageUrl: row.product.imageUrl,
    manufacturer: row.product.manufacturer,
    type: row.type === "buy" ? "buy" : "sale",
    previousPrice: row.previousPrice,
    currentPrice: row.currentPrice,
    changedAt: row.changedAt,
  };
}

export function matchesPriceChangeDirection(
  previousPrice: number | null,
  currentPrice: number | null,
  direction: PriceChangeDirection,
): boolean {
  if (direction === "all") return true;
  if (previousPrice === null || currentPrice === null) return false;
  return direction === "up"
    ? currentPrice > previousPrice
    : currentPrice < previousPrice;
}

export function buildPriceChangeWhere(
  filters: PriceChangeFilters,
  brandProductIds?: number[],
): Prisma.PriceChangeWhereInput {
  const productWhere: Prisma.ProductWhereInput = {};

  if (filters.brand) {
    if (brandProductIds) {
      productWhere.id = { in: brandProductIds };
    } else {
      productWhere.manufacturer = filters.brand;
    }
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

async function getPriceChangeBrandIndex() {
  const products = await prisma.product.findMany({
    where: {
      manufacturer: { not: null },
      priceChanges: { some: {} },
    },
    select: {
      id: true,
      manufacturer: true,
      releaseDate: true,
      category: true,
      detailsJson: true,
    },
  });

  return buildProductFilterCatalog(products).brands;
}

export async function getPriceChangeEvents(
  filters: PriceChangeFilters,
  skip: number,
  take: number,
): Promise<{ events: PriceChangeEvent[]; total: number }> {
  let brandProductIds: number[] | undefined;
  if (filters.brand) {
    const brandIndex = await getPriceChangeBrandIndex();
    brandProductIds =
      brandIndex.productIds.get(normalizeFilterChoiceValue(filters.brand)) ?? [];
  }

  const where = buildPriceChangeWhere(filters, brandProductIds);

  if (filters.direction === "all") {
    const [rows, total] = await Promise.all([
      prisma.priceChange.findMany({
        where,
        orderBy: [{ changedAt: "desc" }, { id: "desc" }],
        skip,
        take,
        include: PRICE_CHANGE_INCLUDE,
      }),
      prisma.priceChange.count({ where }),
    ]);

    return {
      events: rows.map(mapPriceChangeRow),
      total,
    };
  }

  const rows = await prisma.priceChange.findMany({
    where,
    orderBy: [{ changedAt: "desc" }, { id: "desc" }],
    include: PRICE_CHANGE_INCLUDE,
  });
  const directionalRows = rows.filter((row) =>
    matchesPriceChangeDirection(
      row.previousPrice,
      row.currentPrice,
      filters.direction,
    ),
  );

  return {
    events: directionalRows.slice(skip, skip + take).map(mapPriceChangeRow),
    total: directionalRows.length,
  };
}

export async function getPriceChangeBrands(): Promise<RankedFilterOptions> {
  return (await getPriceChangeBrandIndex()).options;
}
