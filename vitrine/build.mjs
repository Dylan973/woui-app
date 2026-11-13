import { createHash } from 'node:crypto';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { nav, footer, pages } from './src/pages.mjs';

const productionDomain = process.env.VERCEL_PROJECT_PRODUCTION_URL;
const origin = new URL(process.env.WOUI_SITE_URL || (productionDomain ? `https://${productionDomain}` : 'https://woui-vitrine.vercel.app')).origin;
const isPreview = process.env.VERCEL_ENV === 'preview';
const dist = new URL('./dist/', import.meta.url);
const css = await readFile(new URL('./src/assets/site.css', import.meta.url));
const cssVersion = createHash('sha256').update(css).digest('hex').slice(0, 12);
const js = await readFile(new URL('./src/assets/site.js', import.meta.url));
const jsVersion = createHash('sha256').update(js).digest('hex').slice(0, 12);
const escape = (value) => value.replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const absolute = (path) => new URL(path, origin).href;
const schema = {
  '@context':'https://schema.org',
  '@graph':[
    { '@type':'Organization', '@id':absolute('/#woui'), name:'Woui', url:origin, logo:absolute('/assets/icon.png') },
    { '@type':'WebSite', '@id':absolute('/#website'), name:'Woui', url:origin, inLanguage:'fr', publisher:{ '@id':absolute('/#woui') } },
    { '@type':'SoftwareApplication', name:'Woui', applicationCategory:'BusinessApplication', operatingSystem:'Navigateur web', url:origin, publisher:{ '@id':absolute('/#woui') }, description:pages[0].description },
  ],
};

function render(page) {
  return `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#c6dafa">
  <title>${escape(page.title)}</title>
  <meta name="description" content="${escape(page.description)}">
  <meta name="robots" content="${page.noindex || isPreview ? 'noindex, follow' : 'index, follow'}">
  ${page.noindex ? '' : `<link rel="canonical" href="${absolute(page.path)}">`}
  <meta property="og:type" content="website">
  <meta property="og:locale" content="fr_FR">
  <meta property="og:site_name" content="Woui">
  <meta property="og:title" content="${escape(page.title)}">
  <meta property="og:description" content="${escape(page.description)}">
  <meta property="og:url" content="${absolute(page.path)}">
  <meta property="og:image" content="${absolute('/assets/og.jpg')}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="Woui, le consentement éclairé numérique pour les cabinets dentaires">
  <meta name="twitter:card" content="summary_large_image">
  <link rel="icon" href="/assets/icon.png" type="image/png">
  <link rel="preload" href="/assets/poppins-latin-500-normal.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="stylesheet" href="/assets/site.css?v=${cssVersion}">
  <script>document.documentElement.classList.add('js')</script>
  <script src="/assets/lenis.min.js" defer></script>
  <script src="/assets/site.js?v=${jsVersion}" defer></script>
  ${page.path === '/' ? `<script type="application/ld+json">${JSON.stringify(schema)}</script>` : ''}
</head>
<body>
  <a class="skip" href="#contenu">Aller au contenu</a>
  ${nav}
  <main id="contenu">${page.body}</main>
  ${footer}
</body>
</html>`;
}

await rm(dist, { recursive:true, force:true });
await mkdir(dist, { recursive:true });
await cp(new URL('./src/assets/', import.meta.url), new URL('assets/', dist), { recursive:true });
for (const page of pages) {
  const filename = page.path === '/' ? 'index.html' : `${page.path.slice(1)}.html`;
  await writeFile(new URL(filename, dist), render(page));
}

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pages.filter(page => !page.noindex).map(page => `  <url><loc>${absolute(page.path)}</loc></url>`).join('\n')}\n</urlset>\n`;
await writeFile(new URL('sitemap.xml', dist), sitemap);
await writeFile(new URL('robots.txt', dist), `User-agent: *\nAllow: /\nSitemap: ${absolute('/sitemap.xml')}\n`);
console.log(`Woui • ${pages.length} pages statiques • ${origin}`);
