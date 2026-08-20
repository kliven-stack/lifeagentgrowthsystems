/**
 * Functional tests against the built clone (playbook §2: "plus functional tests").
 *
 * Everything the replaced WordPress JS used to do is exercised here — the parts a
 * computed-style diff cannot see. Run `node scripts/serve.mjs` first.
 *
 *   node scripts/functional.mjs
 */
import { chromium } from 'playwright';

const ORIGIN = process.env.CLONE_ORIGIN || 'http://localhost:4321';

const results = [];
const check = (name, pass, detail = '') => {
  results.push({ name, pass, detail });
  console.log(`${pass ? ' ok ' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
};

const browser = await chromium.launch();

const open = async (path, width = 1440, height = 900) => {
  const ctx = await browser.newContext({ viewport: { width, height } });
  await ctx.route('**://verified.trustymail.co/**', (r) => r.abort());
  await ctx.route('**://*.leadconnectorhq.com/**', (r) => r.abort());
  await ctx.route('**://www.youtube.com/**', (r) => r.abort());
  await ctx.route('**://links.sybrware.com/**', (r) => r.abort());
  const page = await ctx.newPage();
  await page.bringToFront();
  await page.goto(ORIGIN + path, { waitUntil: 'load' });
  await page.waitForTimeout(600);
  return { ctx, page };
};

/**
 * The sticky header leaves a visibility-hidden clone of itself in the DOM (see
 * initSticky), so every header selector has to name the live copy.
 */
const HEADER = 'header .elementor-sticky--active';

/* ---------------------------------------------------------------- desktop nav */
// The widget is `--dropdown-mobile`: the horizontal menu shows at tablet and up,
// and the burger only takes over at ≤767.
for (const width of [1440, 900]) {
  const { ctx, page } = await open('/', width, 900);
  const items = await page.$$eval(`${HEADER} .elementor-nav-menu--main .elementor-item`,
    (els) => els.map((a) => `${a.textContent.trim()}→${a.getAttribute('href')}`));
  check(`nav @${width}: desktop menu renders both items`, items.length === 2, items.join(', '));
  check(`nav @${width}: current page is marked active`, await page.$eval(
    `${HEADER} .elementor-nav-menu--main .elementor-item`,
    (a) => a.classList.contains('elementor-item-active')));
  check(`nav @${width}: horizontal menu is visible`,
    await page.locator(`${HEADER} .elementor-nav-menu--main`).first().isVisible());
  check(`nav @${width}: burger is hidden`,
    !(await page.locator(`${HEADER} .elementor-menu-toggle`).first().isVisible()));
  // This menu has no submenus at all — SmartMenus only ever annotated it here.
  check(`nav @${width}: no submenu parents to open`, (await page.$$('header .menu-item-has-children')).length === 0);
  check(`nav @${width}: the header CTA points at the booking page`, await page.$eval(
    `${HEADER} a.elementor-button`, (a) => a.getAttribute('href') === '/schedule-a-call/'));
  await ctx.close();
}

/* ---------------------------------------------------------------- burger menu */
for (const width of [767, 390]) {
  const { ctx, page } = await open('/', width, 844);
  const toggle = `${HEADER} .elementor-menu-toggle`;
  const panel = `${HEADER} nav.elementor-nav-menu--dropdown`;

  const height = () => page.$eval(panel, (n) => Math.round(n.getBoundingClientRect().height));
  check(`burger @${width}: toggle is visible`, await page.locator(toggle).first().isVisible());
  check(`burger @${width}: toggle carries its button semantics`, await page.$eval(toggle,
    (t) => t.getAttribute('role') === 'button' && t.tabIndex === 0 && t.getAttribute('aria-expanded') === 'false'));
  check(`burger @${width}: panel starts collapsed`, (await height()) === 0);

  await page.locator(toggle).first().click();
  await page.waitForTimeout(600);
  const openHeight = await height();
  check(`burger @${width}: opens`, openHeight > 40, `${openHeight}px`);
  check(`burger @${width}: toggle marked active and expanded`, await page.$eval(toggle,
    (t) => t.classList.contains('elementor-active') && t.getAttribute('aria-expanded') === 'true'));
  check(`burger @${width}: --menu-height is the space left below the panel`, await page.$eval(panel, (n) => {
    const declared = parseFloat(getComputedStyle(n).getPropertyValue('--menu-height'));
    return Math.abs(declared - (window.innerHeight - n.getBoundingClientRect().top)) < 2;
  }));
  check(`burger @${width}: panel stretches to the viewport`, await page.$eval(panel,
    (n) => Math.abs(n.getBoundingClientRect().width - document.documentElement.clientWidth) < 2
      && Math.abs(n.getBoundingClientRect().x) < 2));

  await page.locator(toggle).first().click();
  await page.waitForTimeout(600);
  check(`burger @${width}: closes`, (await height()) === 0);
  await ctx.close();
}

/* ---------------------------------------------------------------- sticky header */
{
  const { ctx, page } = await open('/');
  check('sticky: pinned and spacer inserted', await page.evaluate((s) => {
    const el = document.querySelector(s);
    const spacer = document.querySelector('header .elementor-sticky__spacer');
    return !!el && !!spacer && getComputedStyle(el).position === 'fixed'
      && Math.abs(el.getBoundingClientRect().height - spacer.getBoundingClientRect().height) < 2;
  }, HEADER));
  check('sticky: no effects class at rest', !(await page.$eval(HEADER,
    (el) => el.classList.contains('elementor-sticky--effects'))));
  await page.evaluate(() => window.scrollTo(0, 600));
  await page.waitForTimeout(400);
  check('sticky: effects class past the 5px offset', await page.$eval(HEADER,
    (el) => el.classList.contains('elementor-sticky--effects')));
  check('sticky: header stays at the top of the viewport', await page.$eval(HEADER,
    (el) => Math.round(el.getBoundingClientRect().top) === 0));
  await ctx.close();
}

/* ---------------------------------------------------------------- device mode */
for (const [width, mode] of [[1440, 'desktop'], [900, 'tablet'], [390, 'mobile']]) {
  const { ctx, page } = await open('/', width, 900);
  check(`device @${width}: body is marked ${mode}`,
    (await page.$eval('body', (b) => b.dataset.elementorDeviceMode)) === mode);
  await ctx.close();
}

/* ---------------------------------------------------------------- popup */
// The site's only contact form lives in Elementor popup 394, opened by the header's
// "Contact Us" item on every page. Elementor keeps the popup out of the document
// until then, so the pre-open DOM has to be empty of it.
for (const [width, trigger] of [[1440, 'desktop'], [390, 'burger']]) {
  const { ctx, page } = await open('/about/', width, 900);

  check(`popup @${width}: absent from the document before opening`, await page.evaluate(() =>
    document.querySelectorAll('[data-elementor-type="popup"]').length === 0
    && document.querySelectorAll('.elementor-popup-modal').length === 0));
  check(`popup @${width}: parked in a template instead`,
    (await page.$$('template.gm-popup')).length === 1);

  // Two parallel menus exist, desktop and dropdown; the CSS shows one per
  // breakpoint, so the trigger has to be the one that is actually on screen.
  const CONTACT = trigger === 'burger'
    ? `${HEADER} nav.elementor-nav-menu--dropdown li.contact-form > a`
    : `${HEADER} nav.elementor-nav-menu--main li.contact-form > a`;
  const openPopup = async () => {
    if (trigger === 'burger') {
      await page.locator(`${HEADER} .elementor-menu-toggle`).first().click();
      await page.waitForTimeout(600);
    }
    await page.locator(CONTACT).first().click();
    await page.waitForTimeout(700);
  };

  await openPopup();

  check(`popup @${width}: opens`, await page.locator('#elementor-popup-modal-394').isVisible());
  check(`popup @${width}: builds the dialog wrapper the compiled CSS expects`, await page.evaluate(() => {
    const modal = document.querySelector('#elementor-popup-modal-394');
    if (!modal) return false;
    const content = modal.querySelector(':scope > .dialog-widget-content.dialog-lightbox-widget-content');
    const message = content?.querySelector(':scope > .dialog-message.dialog-lightbox-message');
    const popup = message?.querySelector(':scope > [data-elementor-type="popup"]');
    return modal.classList.contains('elementor-popup-modal')
      && modal.getAttribute('aria-modal') === 'true'
      && !!content?.querySelector(':scope > .dialog-close-button')
      && !!content?.querySelector(':scope > .dialog-header')
      && !!popup && popup.style.display === 'block';
  }));
  check(`popup @${width}: body carries the dialog classes`, await page.$eval('body', (b) =>
    ['dialog-body', 'dialog-lightbox-body', 'dialog-container', 'dialog-lightbox-container']
      .every((c) => b.classList.contains(c))));
  check(`popup @${width}: the card is the size its CSS asks for`, await page.evaluate((w) => {
    const r = document.querySelector('#elementor-popup-modal-394 .dialog-message').getBoundingClientRect();
    return Math.abs(r.width - (w <= 767 ? 360 : 640)) < 2;
  }, width));
  // The dialog library's stylesheet is a conditional asset Elementor only fetches on
  // first open; without it the modal lays out in flow instead of covering the page.
  check(`popup @${width}: the overlay covers the viewport`, await page.evaluate(() => {
    const m = document.querySelector('#elementor-popup-modal-394');
    const r = m.getBoundingClientRect();
    return getComputedStyle(m).position === 'fixed'
      && r.x === 0 && r.y === 0
      && Math.abs(r.width - window.innerWidth) < 2 && Math.abs(r.height - window.innerHeight) < 2;
  }));
  check(`popup @${width}: the heading came through`, await page.evaluate(() =>
    /right for you/i.test(document.querySelector('#elementor-popup-modal-394 h2')?.textContent || '')));
  check(`popup @${width}: the trigger link does not navigate`,
    new URL(page.url()).pathname === '/about/', page.url());

  // Escape, the close button and a backdrop click all dismiss it.
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  check(`popup @${width}: Escape closes it and cleans up <body>`, await page.evaluate(() =>
    !document.querySelector('#elementor-popup-modal-394')
    && !document.body.classList.contains('dialog-body')));

  await openPopup();
  await page.locator('#elementor-popup-modal-394 .dialog-close-button').click();
  await page.waitForTimeout(400);
  check(`popup @${width}: the close button closes it`,
    (await page.$$('#elementor-popup-modal-394')).length === 0);

  await openPopup();
  await page.mouse.click(4, 4);   // the backdrop, outside the card
  await page.waitForTimeout(400);
  check(`popup @${width}: a backdrop click closes it`,
    (await page.$$('#elementor-popup-modal-394')).length === 0);
  await ctx.close();
}

/* ---------------------------------------------------------------- counters */
// /home-2/'s three counters. Two render their from-value server-side; the third
// renders nothing at all, so without this one of them reads "$ B+".
{
  const { ctx, page } = await open('/home-2/');
  const served = await (await fetch(ORIGIN + '/home-2/')).text();
  const rendered = [...served.matchAll(/class="elementor-counter-number"[^>]*>([^<]*)</g)].map((m) => m[1]);
  check('counter: served markup holds the from-values',
    JSON.stringify(rendered) === JSON.stringify(['', '0', '0']), JSON.stringify(rendered));

  await page.evaluate(() => document.querySelector('.elementor-counter').scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(2600);
  const done = await page.$$eval('.elementor-counter-number', (els) => els.map((e) => e.textContent));
  check('counter: counts up to the to-value',
    JSON.stringify(done) === JSON.stringify(['19.9', '58', '75']), JSON.stringify(done));
  await ctx.close();
}

/* ---------------------------------------------------------------- menu anchor */
// Nothing in the header points at it any more — the "Contact Us" item opens the
// popup instead — but /home-2/ still has a button that does, and the widget has to
// keep working for it (see the README: those buttons point at a dead host).
{
  const { ctx, page } = await open('/home-2/');
  check('anchor: the menu-anchor target exists', (await page.$$('#contact-us')).length === 1);
  // Settle the layout first. Elementor computes the anchor offset once, at click
  // time, from wherever the target is then — so a page still growing as its images
  // decode lands short by however much it grew. The clone repairs seven broken
  // images on this page, which is 59px of growth, so measuring before it settles
  // reports an offset error that a real visitor never sees.
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(2000);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(800);
  await page.evaluate(() => {
    const a = [...document.querySelectorAll('a')].find((n) => n.getAttribute('href') === '#contact-us');
    a.click();
  });
  await page.waitForTimeout(1800);
  const landed = await page.evaluate(() => {
    const target = document.getElementById('contact-us');
    const header = document.querySelector('.elementor-sticky--active');
    return {
      y: Math.round(window.scrollY),
      clearance: Math.round(target.getBoundingClientRect().top - header.getBoundingClientRect().height),
    };
  });
  check('anchor: scrolls to the target', landed.y > 100, `scrollY ${landed.y}`);
  check('anchor: target clears the pinned header',
    landed.clearance >= -2 && landed.clearance < 40, `${landed.clearance}px below it`);
  await ctx.close();
}

/* ---------------------------------------------------------------- video widget */
{
  const { ctx, page } = await open('/google-my-business-walkthrough/');
  check('video: the placeholder div is replaced by the iframe, not wrapped',
    (await page.$$('div.elementor-video')).length === 0 && (await page.$$('iframe.elementor-video')).length === 1);
  const src = await page.$eval('iframe.elementor-video', (f) => f.getAttribute('src'));
  check('video: embeds the YouTube id from data-settings',
    src.startsWith('https://www.youtube.com/embed/G_VTzLj5ksI?') && src.includes('controls=1'), src.slice(0, 70));
  check('video: keeps the wrapper aspect-ratio chain', await page.$eval('iframe.elementor-video', (f) => {
    const r = f.getBoundingClientRect();
    return r.height > 100 && Math.abs(r.width / r.height - 16 / 9) < 0.2;
  }));
  await ctx.close();
}

/* ---------------------------------------------------------------- media carousel */
for (const [width, perView, space] of [[1440, 5, 0], [900, 2, 10], [390, 1, 10]]) {
  const { ctx, page } = await open('/about/', width, 900);
  await page.waitForTimeout(500);
  const state = await page.evaluate(() => {
    const el = document.querySelector('.elementor-main-swiper');
    const wrap = el.querySelector('.swiper-wrapper');
    const slides = [...wrap.children];
    return {
      classes: el.className,
      count: slides.length,
      duplicates: slides.filter((s) => s.classList.contains('swiper-slide-duplicate')).length,
      widths: [...new Set(slides.map((s) => Math.round(s.getBoundingClientRect().width * 10) / 10))],
      gap: parseFloat(slides[0].style.marginRight || '0'),
      active: slides.findIndex((s) => s.classList.contains('swiper-slide-active')),
      activeIndex: slides.find((s) => s.classList.contains('swiper-slide-active'))?.dataset.swiperSlideIndex,
      containerW: Math.round(el.getBoundingClientRect().width),
      visible: slides.filter((s) => {
        const r = s.getBoundingClientRect(), c = el.getBoundingClientRect();
        return r.right > c.left + 1 && r.left < c.right - 1;
      }).length,
    };
  });
  check(`carousel @${width}: initialised classes`,
    /swiper-initialized/.test(state.classes) && /swiper-horizontal/.test(state.classes));
  check(`carousel @${width}: ${perView} duplicates each side`,
    state.count === 5 + perView * 2 && state.duplicates === perView * 2, `${state.count} slides`);
  check(`carousel @${width}: slide width fills the track`, state.widths.length === 1
    && Math.abs(state.widths[0] - (state.containerW - space * (perView - 1)) / perView) < 1, `${state.widths[0]}px`);
  check(`carousel @${width}: ${space}px between slides`, state.gap === space, `${state.gap}px`);
  check(`carousel @${width}: opens on the first real slide`,
    state.active === perView && state.activeIndex === '0', `active at ${state.active}`);
  check(`carousel @${width}: shows ${perView} slide(s) at a time`, state.visible === perView, `${state.visible}`);

  const before = await page.$eval('.swiper-wrapper', (w) => w.style.transform);
  await page.locator('.elementor-swiper-button-next').click();
  await page.waitForTimeout(900);
  const after = await page.evaluate(() => {
    const wrap = document.querySelector('.swiper-wrapper');
    const slides = [...wrap.children];
    return { transform: wrap.style.transform,
      activeIndex: slides.find((s) => s.classList.contains('swiper-slide-active'))?.dataset.swiperSlideIndex };
  });
  check(`carousel @${width}: the next arrow advances one slide`,
    after.activeIndex === '1' && after.transform !== before, `${before} → ${after.transform}`);
  await ctx.close();
}

/* ------------------------------------------------- Essential Addons testimonials */
// Four testimonials, 3 / 2 / 1 per view on Swiper's own breakpoints, 10px gaps.
for (const [width, perView] of [[1440, 3], [900, 2], [390, 1]]) {
  const { ctx, page } = await open('/', width, 900);
  await page.waitForTimeout(500);
  const state = await page.evaluate(() => {
    const el = document.querySelector('.eael-testimonial-slider-main');
    const wrap = el.querySelector('.swiper-wrapper');
    const slides = [...wrap.children];
    return {
      classes: el.className,
      count: slides.length,
      duplicates: slides.filter((s) => s.classList.contains('swiper-slide-duplicate')).length,
      widths: [...new Set(slides.map((s) => Math.round(s.getBoundingClientRect().width * 10) / 10))],
      gap: parseFloat(slides[0].style.marginRight || '0'),
      wrapperHeight: wrap.style.height,
      containerW: Math.round(el.getBoundingClientRect().width),
      activeIndex: slides.find((s) => s.classList.contains('swiper-slide-active'))?.dataset.swiperSlideIndex,
    };
  });
  check(`testimonials @${width}: autoHeight class and wrapper height`,
    /swiper-autoheight/.test(state.classes) && /^\d+px$/.test(state.wrapperHeight), state.wrapperHeight);
  check(`testimonials @${width}: 4 slides + ${perView} duplicates each side`,
    state.count === 4 + perView * 2 && state.duplicates === perView * 2, `${state.count} slides`);
  check(`testimonials @${width}: slide width fills the track`, state.widths.length === 1
    && Math.abs(state.widths[0] - (state.containerW - 10 * (perView - 1)) / perView) < 1, `${state.widths[0]}px`);
  check(`testimonials @${width}: 10px between slides`, state.gap === 10, `${state.gap}px`);
  check(`testimonials @${width}: opens on the first real slide`, state.activeIndex === '0');
  await ctx.close();
}

/* ------------------------------------------------------- reviews widget (hidden) */
// Elementor Pro's reviews widget is `elementor-hidden-desktop/-tablet/-mobile`, so
// it never paints — but Swiper still runs on it, and its loop clones sit in document
// order. One duplicate per side, as production has, or everything after it shifts.
{
  const { ctx, page } = await open('/');
  check('reviews: hidden at every breakpoint, as authored', await page.$eval(
    '[data-widget_type="reviews.default"]',
    (el) => ['desktop', 'tablet', 'mobile'].every((d) => el.classList.contains(`elementor-hidden-${d}`))
      && getComputedStyle(el).display === 'none'));
  check('reviews: 3 slides plus one duplicate each side', await page.evaluate(() => {
    const wrap = document.querySelector('[data-widget_type="reviews.default"] .swiper-wrapper');
    const slides = [...wrap.children];
    return slides.length === 5
      && slides.filter((s) => s.classList.contains('swiper-slide-duplicate')).length === 2;
  }));
  // Swiper skips sizing a zero-width container; so do we.
  check('reviews: no inline widths on a zero-width container', await page.evaluate(() =>
    [...document.querySelectorAll('[data-widget_type="reviews.default"] .swiper-slide')]
      .every((s) => !s.style.width)));
  await ctx.close();
}

/* ------------------------------------------------------- JetElements timeline */
{
  const { ctx, page } = await open('/');
  check('timeline: the connecting line spans the numbered points', await page.evaluate(() => {
    const line = document.querySelector('.jet-hor-timeline__line');
    const pts = document.querySelectorAll('.jet-hor-timeline-item__point-content');
    if (!line || pts.length < 2) return false;
    const first = pts[0], last = pts[pts.length - 1];
    return Math.abs(parseFloat(line.style.left) - (first.offsetLeft + first.offsetWidth / 2)) < 1
      && Math.abs(parseFloat(line.style.width) - Math.abs(last.offsetLeft - first.offsetLeft)) < 1
      && parseFloat(line.style.width) > 100;
  }));
  check('timeline: hovering an item lights its card and its point together', await page.evaluate(async () => {
    const item = document.querySelector('.jet-hor-timeline-list--top .jet-hor-timeline-item[data-item-id]');
    item.dispatchEvent(new MouseEvent('mouseenter', { bubbles: false }));
    await new Promise((r) => setTimeout(r, 50));
    const twins = document.querySelectorAll(`.elementor-repeater-item-${item.dataset.itemId}`);
    return twins.length >= 2 && [...twins].every((t) => t.classList.contains('is-hover'));
  }));
  await ctx.close();
}

/* ------------------------------------------------------ JetElements parallax */
// Layers are built on desktop and tablet only, which is what each layer's own
// `jet_parallax_layout_on` says — so nothing at all below 768px.
for (const [width, expected] of [[1440, true], [900, true], [390, false]]) {
  const { ctx, page } = await open('/', width, 900);
  const state = await page.evaluate(() => ({
    sections: document.querySelectorAll('.jet-parallax-section').length,
    layers: document.querySelectorAll('.jet-parallax-section__layout').length,
    images: document.querySelectorAll('.jet-parallax-section__image').length,
  }));
  check(`parallax @${width}: layers ${expected ? 'built' : 'not built'}`,
    expected ? state.layers > 0 && state.layers === state.images : state.layers === 0,
    `${state.sections} sections, ${state.layers} layers`);
  if (expected) {
    check(`parallax @${width}: layers scroll-transform`, await page.evaluate(async () => {
      const img = document.querySelector('.jet-parallax-section__image');
      const before = img.style.transform;
      window.scrollTo(0, 1500);
      await new Promise((r) => setTimeout(r, 400));
      return img.style.transform !== before && /translateY/.test(img.style.transform);
    }));
  }
  await ctx.close();
}

/* ---------------------------------------------------------------- lead form */
{
  const { ctx, page } = await open('/');
  await page.locator(`${HEADER} nav.elementor-nav-menu--main li.contact-form > a`).first().click();
  await page.waitForTimeout(700);

  const own = await page.$$('#elementor-popup-modal-394 form.gm-form__form');
  if (own.length) {
    check('form: the popup carries exactly one replacement form', own.length === 1);
    // The same widget id is embedded in the home page's own contact section too, and
    // the footer's subscribe widget is on every page — three forms on this page.
    check('form: all three of the page\'s widgets are replaced',
      (await page.$$('form.gm-form__form')).length === 3,
      `${(await page.$$('form.gm-form__form')).length} forms`);
    check('form: the footer subscribe variant carries just Name and Email',
      await page.$$eval('.gm-form--subscribe .gm-form__field input',
        (els) => els.map((e) => e.getAttribute('name')).join(',') === 'full_name,email'));
    check('form: the subscribe variant has no consents and no terms line',
      (await page.$$('.gm-form--subscribe .gm-form__consent')).length === 0
      && (await page.$$('.gm-form--subscribe .gm-form__terms')).length === 0);
    check('form: every field id on the page is unique', await page.evaluate(() => {
      const ids = [...document.querySelectorAll('.gm-form input[id], .gm-form textarea[id]')]
        .map((e) => e.id);
      return ids.length > 0 && new Set(ids).size === ids.length;
    }));
    check('form: four fields, in the widget\'s order', await page.$$eval(
      '#elementor-popup-modal-394 .gm-form__field input, #elementor-popup-modal-394 .gm-form__field textarea',
      (els) => els.map((e) => e.getAttribute('name')).join(',') === 'full_name,email,phone,message'));
    check('form: both consent checkboxes are present and optional', await page.$$eval(
      '#elementor-popup-modal-394 .gm-form__consent input',
      (els) => els.length === 2 && els.every((e) => !e.required && e.type === 'checkbox')));
    check('form: the Growthmap terms links are intact', await page.$$eval(
      '#elementor-popup-modal-394 .gm-form__terms a',
      (els) => els.length === 2 && els.every((a) => a.href.startsWith('https://buildwithgrowthmap.com/'))));
    // The field itself keeps its intrinsic size; what hides it is the 1x1 clipped
    // wrapper around it. A bot filling the form by name still finds it.
    check('form: honeypot is hidden from people', await page.$eval(
      '#elementor-popup-modal-394 input[name="website"]', (hp) => {
        const wrap = hp.closest('.gm-form__hp');
        const r = wrap.getBoundingClientRect();
        const cs = getComputedStyle(wrap);
        return hp.tabIndex === -1 && r.width <= 1 && r.height <= 1
          && cs.overflow === 'hidden' && cs.clipPath !== 'none';
      }));
    check('form: required fields block submission', await page.$eval(
      '#elementor-popup-modal-394 form.gm-form__form', (f) => !f.checkValidity()));
    check('form: every field has a real label', await page.$$eval(
      '#elementor-popup-modal-394 .gm-form__field', (fields) => fields.every((f) => {
        const input = f.querySelector('input, textarea');
        return !!f.querySelector(`label[for="${input.id}"]`);
      })));
    // The form is cloned out of a <template> long after load, so a listener bound
    // per-form at load would never see it. The handler is delegated; prove it runs.
    check('form: the delegated submit handler is wired to the cloned form', await page.evaluate(async () => {
      const form = document.querySelector('#elementor-popup-modal-394 form.gm-form__form');
      form.querySelector('[name="full_name"]').value = 'Test Person';
      form.querySelector('[name="email"]').value = 'test@example.com';
      form.querySelector('[name="phone"]').value = '5555555555';
      form.querySelector('[name="message"]').value = 'Hello';
      form.querySelector('[name="website"]').value = 'spam';   // honeypot: silent success
      form.requestSubmit();
      await new Promise((r) => setTimeout(r, 400));
      const status = form.querySelector('.gm-form__status');
      return status.dataset.state === 'ok' && form.querySelector('[name="email"]').value === '';
    }));
  } else {
    check('form: the LeadConnector embeds are retained while no endpoint is configured',
      (await page.$$('#elementor-popup-modal-394 iframe[src*="vfrnMQAlDqN1xdt4Q60m"]')).length === 1
      && (await page.$$('iframe[src*="vfrnMQAlDqN1xdt4Q60m"]')).length === 2);
    check('form: the subscribe embed is on every page, via the footer',
      (await page.$$('footer iframe[src*="gc6zaq82dMr6CinO3VSX"]')).length === 1);
  }
  await ctx.close();
}

/* ------------------------------------------------------------- booking embeds */
// Never replaced: they are appointment calendars, not contact forms.
{
  const { ctx, page } = await open('/schedule-a-call/');
  check('booking: /schedule-a-call/ keeps its calendar embed',
    (await page.$$('iframe[src*="verified.trustymail.co/widget/booking/"]')).length === 1);
  check('booking: no replacement form was substituted for it',
    (await page.$$('main form.gm-form__form, [data-elementor-type="wp-page"] form.gm-form__form')).length === 0);
  await ctx.close();
}

/* ---------------------------------------------------------------- chat widget */
// Asserted against the served HTML, not the live DOM: the GoHighLevel loader deletes
// its own <script> tag once it has run, so by the time the page settles the element
// is gone. That is what production does too.
{
  const served = await (await fetch(ORIGIN + '/')).text();
  const tag = /<script[^>]*data-resources-url="[^"]*chat-widget[^"]*"[^>]*>/.exec(served)?.[0] || '';
  // The src differs by mode: WordPress serves a LiteSpeed-cached copy of the vendor
  // bundle (which is bug 9 — it resolves its own assets to a path that 404s), and
  // the fixed build points at GoHighLevel's own loader instead.
  const expectedSrc = process.env.PUBLIC_ORIGINAL_BUGS === 'keep'
    ? '/wp-content/litespeed/js/'
    : 'https://widgets.leadconnectorhq.com/loader.js';
  check('chat: every page serves the GoHighLevel loader with the account widget id',
    tag.includes('data-widget-id="67aeeea8a81d1c5690d7660c"')
    && tag.includes(expectedSrc), tag.slice(0, 90));
}

/* ---------------------------------------------------------------- images */
// LiteSpeed's lazy-load rewrite is undone at extract time, so nothing on the page
// should still be waiting for a data-src swap (playbook §3.10: visible images only).
{
  const { ctx, page } = await open('/');
  await page.waitForTimeout(800);
  check('images: no LiteSpeed placeholders survive', await page.evaluate(() =>
    document.querySelectorAll('img[data-lazyloaded], img[src^="data:image/gif"]').length === 0));
  check('images: every image above the fold has decoded', await page.evaluate(() =>
    [...document.images]
      .filter((i) => i.getBoundingClientRect().top < window.innerHeight && i.getBoundingClientRect().height > 0)
      .every((i) => i.complete && i.naturalWidth > 0)));
  await ctx.close();
}

/* ---------------------------------------------------------------- fonts */
// This install serves its Google fonts over https, so unlike the sibling
// roofinggrowthsystems site they actually arrive.
{
  const { ctx, page } = await open('/');
  await page.evaluate(() => document.fonts.ready);
  check('fonts: Inter and Roboto are loaded', await page.evaluate(() => {
    const families = new Set([...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family));
    return families.has('Inter') && families.has('Roboto');
  }));
  check('fonts: headings render in the kit family, not the system stack',
    await page.$eval('[data-id="7ecbbac"] .elementor-heading-title',
      (h) => getComputedStyle(h).fontFamily.includes('Roboto')));

  // Original-site bug, cloned faithfully (playbook §3.8) and NOT yet fixed, because
  // fixing it changes the typography of four fifths of the site and that is the
  // client's call: Elementor kit 11 sets no body and no heading font, so everything
  // the designer did not style per-widget inherits hello-elementor's system stack.
  // Pinned to production's number so the clone keeps matching it, and so turning the
  // kit fonts on is a deliberate change rather than a silent one. See the README.
  check('fonts: the site-wide fallback still matches production exactly',
    await page.evaluate(() => {
      const inSystemStack = (el) => /-apple-system/.test(getComputedStyle(el).fontFamily);
      const all = [...document.querySelectorAll('body *')].filter((el) =>
        el.offsetParent !== null
        && [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()));
      return all.filter(inSystemStack).length === 155 && all.length === 207;
    }));
  await ctx.close();
}

/* ------------------------------------------------------- original-bug fixes */
// Only meaningful on a normal build; `PUBLIC_ORIGINAL_BUGS=keep` turns them all off
// so the fidelity harness can still diff against the live WordPress site.
if (process.env.PUBLIC_ORIGINAL_BUGS !== 'keep') {
  {
    const served = await (await fetch(ORIGIN + '/')).text();
    check('fix: the chat loader points at the vendor, not the purged LiteSpeed copy',
      served.includes('https://widgets.leadconnectorhq.com/loader.js')
      && !served.includes('litespeed/js/3f6ed5ab'));
  }
  {
    const served = await (await fetch(ORIGIN + '/home-2/')).text();
    check('fix: no counter ships an empty from-value', !served.includes('data-from-value=""'));
    check('fix: only the one image with no replacement still points at the dead host',
      (served.match(/jeremyb126\.sg-host\.com/g) || []).length === 1
      && served.includes('sg-host.com/wp-content/uploads/2021/07/RoofHeader3.jpg'));
    check('fix: the #contact-us buttons point at their own page',
      !served.includes('sg-host.com/#contact-us'));
  }
  {
    const { ctx, page } = await open('/home-2/');
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1200);
    check('fix: the re-pointed images all decode', await page.evaluate(() =>
      [...document.images]
        .filter((i) => /Calendly|ClickFunnels|MailChimp|Reputation|Communication-Callout|GuaranteeBadage|Marketing-Callout|Scheduling/.test(i.src))
        .every((i) => i.complete && i.naturalWidth > 0)));
    await ctx.close();
  }
  {
    const served = await (await fetch(ORIGIN + '/')).text();
    check('fix: the home page snippet no longer sells roofing',
      !/grow roofing companies/.test(served)
      && /<meta name="description" content="[^"]*life insurance agents/.test(served));
  }
  {
    const served = await (await fetch(ORIGIN + '/privacy-policy/')).text();
    check('fix: the policy names this website, over https',
      served.includes('refers to Life Agent Growth Systems, accessible from')
      && !served.includes('href="www.roofinggrowthsystems.com"'));
  }
  {
    const g = await (await fetch(ORIGIN + '/guarantee/')).text();
    const w = await (await fetch(ORIGIN + '/google-my-business-walkthrough/')).text();
    check('fix: no "RGS" left on the guarantee or the onboarding page',
      !/\bRGS\b/.test(g) && !/\bRGS\b/.test(w));
  }
  {
    const served = await (await fetch(ORIGIN + '/category/uncategorized/')).text();
    check('fix: the empty archive is noindex', /content="noindex, follow/.test(served));
  }
  {
    const { ctx, page } = await open('/about/');
    check('fix: /about/ addresses life insurance agents, not concrete businesses',
      await page.evaluate(() => !/concrete business owner|Concrete Marketing/i.test(document.body.innerText)));
    await ctx.close();
  }
  {
    const { ctx, page } = await open('/');
    check('fix: the hidden placeholder reviews carousel is gone', await page.evaluate(() => {
      const el = document.querySelector('[data-widget_type="reviews.default"]');
      return !el || getComputedStyle(el).display === 'none';
    }));
    await ctx.close();
  }
  // The popup card was fixed at 800px with taller content and no way to scroll.
  for (const width of [1440, 390]) {
    const { ctx, page } = await open('/about/', width, 900);
    const CONTACT = width <= 767
      ? `${HEADER} nav.elementor-nav-menu--dropdown li.contact-form > a`
      : `${HEADER} nav.elementor-nav-menu--main li.contact-form > a`;
    if (width <= 767) {
      await page.locator(`${HEADER} .elementor-menu-toggle`).first().click();
      await page.waitForTimeout(500);
    }
    await page.locator(CONTACT).first().click();
    await page.waitForTimeout(800);
    check(`fix @${width}: the popup card can show or scroll to all of its content`,
      await page.evaluate(() => {
        const card = document.querySelector('#elementor-popup-modal-394 .dialog-message');
        const r = card.getBoundingClientRect();
        const fitsViewport = r.height <= window.innerHeight + 1;
        const reachable = card.scrollHeight <= card.clientHeight
          || getComputedStyle(card).overflowY === 'auto';
        return fitsViewport && reachable;
      }));
    await ctx.close();
  }
}

/* ---------------------------------------------------------------- 404 */
{
  const { ctx, page } = await open('/no-such-page-here/');
  check('404: unknown URLs get the theme\'s own page', await page.evaluate(() =>
    document.body.classList.contains('error404') && !!document.querySelector('header .elementor-nav-menu')));
  await ctx.close();
}

await browser.close();

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) {
  console.log('\nFailures:');
  for (const f of failed) console.log(`  - ${f.name}${f.detail ? ` (${f.detail})` : ''}`);
  process.exitCode = 1;
}
