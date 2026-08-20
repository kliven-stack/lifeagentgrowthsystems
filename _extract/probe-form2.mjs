import { chromium } from 'playwright';
const b = await chromium.launch();
for (const width of [1440, 900, 390]) {
  const ctx = await b.newContext({ viewport: { width, height: 900 } });
  const page = await ctx.newPage();
  await page.goto('https://lifeagentgrowthsystems.com/', { waitUntil: 'load', timeout: 90000 });
  await page.waitForTimeout(3000);
  await page.evaluate(() => {
    const li = [...document.querySelectorAll('.contact-form')].find((n) => n.offsetParent !== null)
      || document.querySelector('.contact-form');
    li.querySelector('a').click();
  });
  await page.waitForTimeout(7000);
  const info = await page.evaluate(() => {
    const f = document.querySelector('iframe[src*="trustymail"]');
    const w = f?.closest('.elementor-widget-container');
    const el = f?.closest('.elementor-element[data-id]');
    const card = document.querySelector('.dialog-widget-content');
    const bx = (n) => { if (!n) return null; const r = n.getBoundingClientRect(); return { x: +r.x.toFixed(1), y: +r.y.toFixed(1), w: +r.width.toFixed(1), h: +r.height.toFixed(1) }; };
    return { dataHeight: f?.getAttribute('data-height'), iframe: bx(f), widget: bx(w), element: bx(el),
             elementId: el?.dataset.id, card: bx(card), cardStyle: card?.getAttribute('style') };
  });
  const frame = page.frames().find((f) => f.url().includes('trustymail'));
  let inner = null;
  if (frame) {
    try {
      inner = await frame.evaluate(() => {
        const body = document.body;
        const form = document.querySelector('form');
        const cs = getComputedStyle(body);
        const consent = [...document.querySelectorAll('label')].map((l) => l.innerText.trim()).filter(Boolean);
        return { docH: document.documentElement.scrollHeight, bodyBg: cs.backgroundColor,
                 formPad: form ? getComputedStyle(form).padding : null,
                 formW: form ? +form.getBoundingClientRect().width.toFixed(1) : null,
                 consent, submitBg: getComputedStyle(document.querySelector('button[type=submit]')).backgroundColor,
                 links: [...document.querySelectorAll('a')].map((a) => [a.innerText.trim(), a.href]) };
      });
    } catch (e) { inner = { err: String(e).slice(0, 120) }; }
  }
  console.log(width, JSON.stringify({ ...info, inner }, null, 1));
  await ctx.close();
}
await b.close();
