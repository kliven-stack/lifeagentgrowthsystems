// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

const SITE = process.env.PUBLIC_SITE_URL || 'https://lifeagentgrowthsystems.com';

export default defineConfig({
  site: SITE,

  // Fully static: the one lead form posts straight from the browser to the
  // Growthmap endpoint, so nothing needs a server runtime (playbook §4b).
  output: 'static',

  trailingSlash: 'always',
  build: { format: 'directory' },

  integrations: [
    sitemap({
      // Advertise exactly what production advertises. Yoast serves one child map
      // here, page-sitemap.xml, and it lists nine of the ten published pages:
      // /google-my-business-walkthrough/ is orphaned out of it, and there is no
      // post or category map because the site has no posts. Both of those URLs are
      // still built — they resolve on WordPress, so they have to keep resolving —
      // they are just kept out of the sitemap, as production keeps them out.
      // The theme's 404 template is a route, not a page.
      filter: (page) =>
        !/\/404\//.test(page)
        && !/\/category\//.test(page)
        && !/\/google-my-business-walkthrough\//.test(page),
    }),
  ],

  vite: { plugins: [tailwindcss()] },
});
