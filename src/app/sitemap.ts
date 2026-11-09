import type { MetadataRoute } from 'next';
export const dynamic = 'force-static';
export default function sitemap(): MetadataRoute.Sitemap { return ['/', '/evaluate/', '/experiments/'].map(path => ({ url: 'https://eigenbench.github.io' + path })); }
