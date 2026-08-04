import { prisma } from "@/lib/prisma";

export type PriceChangeType = "all" | "sale" | "buy";

export type PriceChangeEvent = {
  id: number;
  productId: number;
  title: string;
  imageUrl: string | null;
  type: Exclude<PriceChangeType, "all">;
  previousPrice: number | null;
  currentPrice: number | null;
  changedAt: Date;
};

export async function getPriceChangeEvents(
  type: PriceChangeType,
  skip: number,
  take: number,
): Promise<{ events: PriceChangeEvent[]; total: number }> {
  const where = type === "all" ? {} : { type };
  const [rows, total] = await Promise.all([
    prisma.priceChange.findMany({
      where,
      orderBy: [{ changedAt: "desc" }, { id: "desc" }],
      skip,
      take,
      include: { product: { select: { title: true, imageUrl: true } } },
    }),
    prisma.priceChange.count({ where }),
  ]);

  return {
    events: rows.map((row) => ({
      id: row.id,
      productId: row.productId,
      title: row.product.title,
      imageUrl: row.product.imageUrl,
      type: row.type === "buy" ? "buy" : "sale",
      previousPrice: row.previousPrice,
      currentPrice: row.currentPrice,
      changedAt: row.changedAt,
    })),
    total,
  };
}
