import { CrawlIntervalReview } from "@/components/CrawlIntervalReview";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function CrawlReviewPage() {
  const products = await prisma.product.findMany({
    where: {
      crawlIntervalDays: 1,
      crawlIntervalReviewedAt: null,
    },
    orderBy: [{ id: "asc" }],
    select: {
      id: true,
      title: true,
      imageUrl: true,
      latestSalePrice: true,
      latestBuyPrice: true,
      manufacturer: true,
      releaseDate: true,
      stockStatus: true,
    },
  });

  return (
    <section>
      <CrawlIntervalReview initialProducts={products} />
    </section>
  );
}
