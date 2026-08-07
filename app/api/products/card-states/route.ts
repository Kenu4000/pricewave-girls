import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const MAX_IDS = 200;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const ids = (url.searchParams.get("ids") ?? "")
    .split(",")
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value > 0)
    .slice(0, MAX_IDS);

  if (ids.length === 0) return NextResponse.json({ states: {} });

  const products = await prisma.product.findMany({
    where: { id: { in: [...new Set(ids)] } },
    select: {
      id: true,
      condition: true,
      conditionRank: true,
      isTimeSale: true,
      latestRegularSalePrice: true,
      timeSaleStartedAt: true,
      timeSaleEndsAt: true,
    },
  });

  return NextResponse.json({
    states: Object.fromEntries(
      products.map((product) => [
        product.id,
        {
          condition: product.condition,
          conditionRank: product.conditionRank,
          isTimeSale: product.isTimeSale,
          regularSalePrice: product.latestRegularSalePrice,
          timeSaleStartedAt: product.timeSaleStartedAt?.toISOString() ?? null,
          timeSaleEndsAt: product.timeSaleEndsAt?.toISOString() ?? null,
        },
      ]),
    ),
  });
}
