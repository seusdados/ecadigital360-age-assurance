import type { MetadataRoute } from 'next';
import { siteCopy } from '@/content/site';

const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://agekey.com.br';

export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes = [
    '/',
    '/como-funciona',
    '/solucoes',
    '/privacidade',
    '/desenvolvedores',
    '/compliance',
    '/precos',
    '/contato',
    '/demo',
  ];
  const solutionRoutes = siteCopy.solutions.items.map(
    (i) => `/solucoes/${i.slug}`,
  );
  const now = new Date();
  return [...staticRoutes, ...solutionRoutes].map((path) => ({
    url: `${base}${path}`,
    lastModified: now,
    changeFrequency: 'weekly',
    priority: path === '/' ? 1 : 0.7,
  }));
}
