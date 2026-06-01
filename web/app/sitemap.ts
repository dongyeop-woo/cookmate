import type { MetadataRoute } from 'next';
import { CATEGORIES, fetchAllRecipes } from '@/lib/api';

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = 'https://yojalal.com';
  const now = new Date();

  const staticPaths: MetadataRoute.Sitemap = [
    { url: `${base}/`, lastModified: now, changeFrequency: 'daily', priority: 1.0 },
    { url: `${base}/privacy`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${base}/terms`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
  ];

  const categories: MetadataRoute.Sitemap = CATEGORIES.map((c) => ({
    url: `${base}/category/${encodeURIComponent(c.name)}`,
    lastModified: now,
    changeFrequency: 'daily',
    priority: 0.9,
  }));

  let recipes: MetadataRoute.Sitemap = [];
  try {
    const all = await fetchAllRecipes();
    recipes = all
      .filter((r) => !!r.id)
      .map((r) => ({
        url: `${base}/recipe/${r.id}`,
        lastModified: now,
        changeFrequency: 'weekly' as const,
        priority: 0.8,
      }));
  } catch {}

  return [...staticPaths, ...categories, ...recipes];
}
