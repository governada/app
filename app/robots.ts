import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/admin/', '/my-gov/', '/claim/'],
      },
    ],
    sitemap: 'https://drepscore.io/sitemap.xml',
  };
}
