// Mirror every asset the pages reference into public/, preserving the original
// path so srcset entries and CSS url() references keep working unchanged.
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import path from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const PUB = path.join(ROOT, 'public');
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

const localPath = (u) => {
  const url = new URL(u);
  return url.host === 'lifeagentgrowthsystems.com'
    ? path.join(PUB, url.pathname)
    : path.join(PUB, 'wp/ext', url.host, url.pathname);
};

/**
 * Files the markup never links but the site still serves. `/top-8-things-to-grow/`
 * is a WordPress page that 301s straight to this PDF — it is the lead magnet the
 * "Top 8 Things" campaign points at, and vercel.json reproduces the redirect.
 */
const EXTRA = [
  'https://lifeagentgrowthsystems.com/wp-content/uploads/2021/07/Top_8_Things_To_Grow_Your_Roofing_Business.pdf',
];

const urls = [...JSON.parse(await readFile(path.join(ROOT, '_extract/assets.json'), 'utf8')), ...EXTRA];
let ok = 0, cached = 0, failed = [];
const queue = [...urls];
const workers = Array.from({ length: 8 }, async () => {
  while (queue.length) {
    const u = queue.pop();
    const out = localPath(u);
    try { if ((await stat(out)).size > 0) { cached++; continue; } } catch { /* not cached */ }
    try {
      const res = await fetch(u, { headers: { 'user-agent': UA, referer: 'https://lifeagentgrowthsystems.com/' } });
      if (!res.ok) { failed.push([res.status, u]); continue; }
      await mkdir(path.dirname(out), { recursive: true });
      await writeFile(out, Buffer.from(await res.arrayBuffer()));
      ok++;
    } catch (e) { failed.push([String(e), u]); }
  }
});
await Promise.all(workers);
console.log(`downloaded ${ok}, cached ${cached}, failed ${failed.length}`);
for (const [s, u] of failed) console.log('  FAIL', s, u);
