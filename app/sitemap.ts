import type { MetadataRoute } from "next";
import { getCategories } from "@/lib/content";

export const dynamic = "force-static";

const siteRoot = "https://dipeshsukhia.github.io/interview";

export default function sitemap(): MetadataRoute.Sitemap {
  const categories = getCategories();

  return [
    { url: `${siteRoot}/`, changeFrequency: "monthly", priority: 1 },
    { url: `${siteRoot}/all-questions/`, changeFrequency: "monthly", priority: 0.9 },
    ...categories.flatMap((category) => [
      { url: `${siteRoot}/${category.slug}/`, changeFrequency: "monthly" as const, priority: 0.8 },
      ...category.tips.map((question) => ({
        url: `${siteRoot}/${category.slug}/${question.slug}/`,
        changeFrequency: "yearly" as const,
        priority: 0.6,
      })),
    ]),
  ];
}
