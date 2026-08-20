import { chromium } from 'playwright';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
page.on('requestfailed', (r) => { if (r.url().includes('trustymail')) console.log('FAILED', r.url(), r.failure()?.errorText); });
await page.goto('https://lifeagentgrowthsystems.com/', { waitUntil: 'load', timeout: 90000 });
await page.waitForTimeout(3000);
await page.click('.contact-form > a');
await page.waitForTimeout(6000);

const info = await page.evaluate(() => {
  const f = document.querySelector('iframe[src*="trustymail"]');
  if (!f) return { none: true };
  const r = f.getBoundingClientRect();
  const w = f.closest('.elementor-widget-container');
  const wr = w?.getBoundingClientRect();
  return { src: f.src, box: { w: r.width, h: r.height }, style: f.getAttribute('style'),
           widgetBox: wr ? { w: wr.width, h: wr.height } : null,
           parentHtml: f.parentElement.outerHTML.slice(0, 1200) };
});
console.log(JSON.stringify(info, null, 2));

// Try to read inside the iframe
for (const fr of page.frames()) {
  if (!fr.url().includes('trustymail')) continue;
  console.log('FRAME', fr.url());
  try {
    const fields = await fr.evaluate(() => {
      const out = [];
      for (const el of document.querySelectorAll('input, textarea, select, button, label, .form-btn, h1,h2,h3,p')) {
        const cs = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        out.push({ tag: el.tagName, type: el.type || null, name: el.name || null, id: el.id || null,
          ph: el.placeholder || null, text: (el.innerText||'').trim().slice(0,60),
          box: { x: +r.x.toFixed(1), y: +r.y.toFixed(1), w: +r.width.toFixed(1), h: +r.height.toFixed(1) },
          bg: cs.backgroundColor, color: cs.color, font: `${cs.fontFamily.split(',')[0]} ${cs.fontSize} ${cs.fontWeight}`,
          radius: cs.borderRadius, pad: cs.padding, margin: cs.margin, required: el.required ?? null });
      }
      return { docH: document.documentElement.scrollHeight, els: out };
    });
    console.log(JSON.stringify(fields, null, 1).slice(0, 12000));
  } catch (e) { console.log('frame read failed:', String(e).slice(0,200)); }
}
await b.close();
