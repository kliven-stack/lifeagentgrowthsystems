// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

const SITE = process.env.PUBLIC_SITE_URL || 'https://lifeagentgrowthsystems.com';

export default defineConfig({
  site: SITE,

  // Fully static: both forms post straight from the browser to the Growthmap
  // endpoint, so nothing needs a server runtime (playbook §4b).
  output: 'static',

  trailingSlash: 'always',
  build: { format: 'directory' },

  integrations: [
    sitemap({
      // Match what Yoast listed: pages, posts and the category archive. The theme's
      // 404 template is a route, not a page, and the date archives are `noindex,
      // follow` on the WordPress site — cloned so their URLs keep resolving, kept
      // out of the sitemap so the clone advertises exactly what production does.
      filter: (page) => !/\/404\//.test(page) && !/\/\d{4}\/(\d{2}\/)*$/.test(page),
    }),
  ],

  vite: { plugins: [tailwindcss()] },
});
