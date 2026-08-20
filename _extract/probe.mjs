import { chromium } from 'playwright';
import { writeFile } from 'node:fs/promises';

const LIVE = 'https://lifeagentgrowthsystems.com';
const browser = await chromium.launch();
const out = {};

for (const width of [1440, 900, 390]) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 } });
  await ctx.route('**/*.{mp4,mov,webm}', (r) => r.abort());
  const page = await ctx.newPage();
  await page.goto(LIVE + '/', { waitUntil: 'load', timeout: 90000 });
  await page.waitForTimeout(5000);

  out[width] = await page.evaluate(() => {
    const res = {};
    const box = (el) => { const r = el.getBoundingClientRect(); return { x: +r.x.toFixed(2), y: +r.y.toFixed(2), w: +r.width.toFixed(2), h: +r.height.toFixed(2) }; };

    // --- swipers
    res.swipers = [...document.querySelectorAll('.swiper, .swiper-container')].map((c) => {
      const w = c.querySelector('.swiper-wrapper');
      const slides = [...w.children];
      return {
        cls: c.className,
        widget: c.closest('[data-widget_type]')?.getAttribute('data-widget_type'),
        containerW: c.clientWidth,
        wrapperStyle: w.getAttribute('style'),
        wrapperId: w.id, ariaLive: w.getAttribute('aria-live'),
        count: slides.length,
        slides: slides.map((s) => ({ cls: s.className, idx: s.dataset.swiperSlideIndex, aria: s.getAttribute('aria-label'), style: s.getAttribute('style') })),
      };
    });

    // --- jet timeline line
    const line = document.querySelector('.jet-hor-timeline__line');
    if (line) {
      const mid = line.parentElement;
      const pts = [...mid.querySelectorAll('.jet-hor-timeline-item')];
      res.timeline = {
        lineStyle: line.getAttribute('style'),
        track: box(line.closest('.jet-hor-timeline-track')),
        mid: box(mid),
        pts: pts.map((p) => ({ id: p.dataset.itemId, box: box(p), hasPoint: !!p.querySelector('.jet-hor-timeline-item__point'), pointBox: p.querySelector('.jet-hor-timeline-item__point') ? box(p.querySelector('.jet-hor-timeline-item__point')) : null })),
      };
    }

    // --- jet parallax sections
    res.parallax = [...document.querySelectorAll('.jet-parallax-section')].map((s) => s.dataset.id);

    // --- sticky
    res.sticky = [...document.querySelectorAll('.elementor-sticky, .elementor-sticky__spacer')].map((el) => ({ cls: el.className, style: el.getAttribute('style'), id: el.dataset.id }));

    // --- body classes
    res.bodyClass = document.body.className;

    // --- jet brands
    const jb = document.querySelector('[data-widget_type="jet-brands.default"]');
    res.jetBrands = jb ? { html: jb.querySelector('.elementor-widget-container').innerHTML.slice(0, 600), cls: jb.className } : null;

    return res;
  });

  // --- popup: click the header's .contact-form item and record the DOM
  try {
    await page.click('.contact-form > a', { timeout: 5000 });
    await page.waitForTimeout(2500);
    out[width].popup = await page.evaluate(() => {
      const p = document.querySelector('[data-elementor-type="popup"]');
      const modal = document.querySelector('.dialog-widget, .dialog-lightbox-widget, #elementor-popup-modal-394');
      const pick = (el) => el ? {
        tag: el.tagName, cls: el.className, id: el.id, style: el.getAttribute('style'),
        attrs: Object.fromEntries([...el.attributes].map((a) => [a.name, a.value.slice(0, 300)])),
      } : null;
      return {
        bodyClass: document.body.className,
        popup: pick(p),
        popupParent: pick(p?.parentElement),
        modal: pick(modal),
        modalOuter: modal ? modal.outerHTML.slice(0, 4000) : null,
        htmlStyle: document.documentElement.getAttribute('style'),
        bodyStyle: document.body.getAttribute('style'),
      };
    });
  } catch (e) { out[width].popupError = String(e).slice(0, 200); }

  await ctx.close();
  console.log('done', width);
}
await browser.close();
await writeFile(new URL('./probe-out.json', import.meta.url), JSON.stringify(out, null, 2));
console.log('written');
