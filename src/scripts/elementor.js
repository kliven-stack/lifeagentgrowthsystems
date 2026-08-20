/**
 * Runtime for the cloned Elementor markup.
 *
 * The pages ship Elementor's compiled CSS verbatim, so the job here is to reproduce
 * the *DOM contract* the WordPress JS created — the classes, inline styles and
 * injected nodes the stylesheets and the layout depend on — not to re-invent the
 * behaviour (playbook §3.12, §7.3). Every contract below was read off the live
 * site's post-init DOM with scripts/inspect-live.mjs.
 *
 * Replaces: elementor-frontend, elementor-pro-frontend, smartmenus, e-sticky,
 * jquery-numerator, Swiper, the YouTube iframe API shim and jQuery.
 */

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const onReady = (fn) =>
  document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', fn, { once: true })
    : fn();

const settingsOf = (el) => {
  try { return JSON.parse(el.getAttribute('data-settings') || '{}'); } catch { return {}; }
};

/* ------------------------------------------------------------------ *
 * Environment classes
 *
 * Elementor stamps the browser/OS onto <body>; its stylesheets key rules off
 * `.e--ua-appleWebkit`, so Safari renders differently without them.
 * ------------------------------------------------------------------ */
function initEnvironment() {
  const ua = navigator.userAgent;
  const isSafari = /^((?!chrome|android).)*safari/i.test(ua);
  const flags = {
    webkit: /AppleWebKit/i.test(ua),
    blink: /Chrome/i.test(ua) && !/Edge/i.test(ua),
    safari: isSafari,
    appleWebkit: isSafari,
    firefox: /Firefox/i.test(ua),
    gecko: /Gecko\//i.test(ua) && /Firefox/i.test(ua),
    edge: /Edg\//i.test(ua),
    mac: /Mac/i.test(navigator.platform || ua),
    windows: /Win/i.test(navigator.platform || ua),
    linux: /Linux/i.test(navigator.platform || ua) && !/Android/i.test(ua),
  };
  for (const [key, on] of Object.entries(flags)) {
    if (on) document.body.classList.add(`e--ua-${key}`);
  }
}

/* ------------------------------------------------------------------ *
 * Background lazy-load
 *
 * Elementor prints a stylesheet that blanks background images on the 4th and later
 * top-level containers until JS marks them `.e-lazyloaded`. Without this the guard
 * never lifts and those sections lose their backgrounds entirely.
 * ------------------------------------------------------------------ */
function initLazyBackgrounds() {
  const targets = document.querySelectorAll('.e-con.e-parent:not(.e-no-lazyload)');
  if (!targets.length) return;
  const reveal = (el) => el.classList.add('e-lazyloaded');
  if (!('IntersectionObserver' in window)) {
    targets.forEach(reveal);
    return;
  }
  const io = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      reveal(entry.target);
      io.unobserve(entry.target);
    }
  }, { rootMargin: '200px 0px' });
  targets.forEach((el) => io.observe(el));
}

/* ------------------------------------------------------------------ *
 * Sticky sections (e-sticky)
 *
 * Contract, off the live header: the section gains `elementor-sticky
 * elementor-sticky--active elementor-section--handles-inside`, is pinned with
 * inline `position: fixed; width: <spacer width>px; margin-top: 0px;
 * margin-bottom: 0px; top: 0px`, and a visibility-hidden clone
 * (`elementor-sticky__spacer`) is inserted after it to hold the space. Past
 * `sticky_effects_offset` it also gains `elementor-sticky--effects`, which the
 * compiled CSS animates.
 * ------------------------------------------------------------------ */
function initSticky() {
  const els = [...document.querySelectorAll('[data-settings]')].filter((el) => {
    const s = settingsOf(el);
    return s.sticky === 'top' || s.sticky === 'bottom';
  });

  for (const el of els) {
    const s = settingsOf(el);
    const effectsOffset = Number(s.sticky_effects_offset) || 0;
    const offset = Number(s.sticky_offset) || 0;

    const spacer = el.cloneNode(true);
    spacer.classList.add('elementor-sticky__spacer');
    spacer.classList.remove('elementor-sticky--active', 'elementor-sticky--effects');
    spacer.removeAttribute('data-settings');
    spacer.setAttribute('style', 'visibility: hidden; transition: none; animation: auto ease 0s 1 normal none running none;');
    spacer.querySelectorAll('[id]').forEach((n) => n.removeAttribute('id'));
    el.after(spacer);

    el.classList.add('elementor-sticky', 'elementor-sticky--active', 'elementor-section--handles-inside');

    const pin = () => {
      const width = spacer.getBoundingClientRect().width;
      el.style.cssText = `position: fixed; width: ${width}px; margin-top: 0px; margin-bottom: 0px; ${s.sticky === 'bottom' ? 'bottom' : 'top'}: ${offset}px;`;
    };
    const sync = () => {
      el.classList.toggle('elementor-sticky--effects', window.scrollY > effectsOffset);
    };

    pin();
    sync();
    window.addEventListener('scroll', sync, { passive: true });
    window.addEventListener('resize', () => { pin(); sync(); });
  }
}

/** Height of whatever sticky header is currently pinned, for anchor offsets. */
const stickyHeight = () => {
  const pinned = document.querySelector('.elementor-sticky--active');
  return pinned ? pinned.getBoundingClientRect().height : 0;
};

/* ------------------------------------------------------------------ *
 * Nav menu
 *
 * This site's menu is two items deep — no submenus anywhere — so all SmartMenus
 * ever did here was annotate the lists and drive the burger. Reproduced:
 *
 *   * the toggle gets `role="button"`, `tabindex="0"`, `aria-label="Menu Toggle"`
 *     and `aria-expanded`, and `elementor-active` while open;
 *   * the dropdown nav is stretched to the viewport with inline `width`/`left`, is
 *     placed under the widget with inline `top`, and carries `aria-hidden`;
 *   * on open Elementor writes `--menu-height` = the space left below the panel
 *     (`innerHeight - panel top`), which the compiled CSS uses as the panel's
 *     `max-height` — that, plus `transform: scaleY()`, is the whole animation.
 * ------------------------------------------------------------------ */
function initNavMenu(widget) {
  const dropdownNav = widget.querySelector('nav.elementor-nav-menu--dropdown');
  const toggle = widget.querySelector('.elementor-menu-toggle');
  const stretch = settingsOf(widget).full_width === 'stretch';
  if (!toggle || !dropdownNav) return;

  // Elementor stamps the toggle's button semantics from JS, not from PHP.
  toggle.setAttribute('role', 'button');
  toggle.setAttribute('tabindex', '0');
  toggle.setAttribute('aria-label', 'Menu Toggle');

  /** Elementor's "stretch" option pins the panel to the viewport width. */
  const place = () => {
    const widgetRect = widget.getBoundingClientRect();
    dropdownNav.style.top = `${Math.round(widgetRect.height * 2) / 2}px`;
    if (!stretch) return;
    const left = dropdownNav.getBoundingClientRect().left - parseFloat(dropdownNav.style.left || '0');
    dropdownNav.style.width = `${document.documentElement.clientWidth}px`;
    dropdownNav.style.left = `${-left}px`;
  };

  const setOpen = (open) => {
    toggle.classList.toggle('elementor-active', open);
    toggle.setAttribute('aria-expanded', String(open));
    dropdownNav.setAttribute('aria-hidden', String(!open));
    if (open) {
      const top = dropdownNav.getBoundingClientRect().top;
      dropdownNav.style.setProperty('--menu-height', `${window.innerHeight - top}px`);
    } else {
      dropdownNav.style.removeProperty('--menu-height');
    }
  };

  place();
  setOpen(false);
  window.addEventListener('resize', () => {
    place();
    if (toggle.classList.contains('elementor-active')) setOpen(true);
  });

  const flip = () => setOpen(!toggle.classList.contains('elementor-active'));
  toggle.addEventListener('click', flip);
  toggle.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); flip(); }
  });
  // Following a link closes the panel; so does Escape.
  dropdownNav.addEventListener('click', (e) => {
    if (e.target.closest('a')) setOpen(false);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && toggle.classList.contains('elementor-active')) setOpen(false);
  });
}

/* ------------------------------------------------------------------ *
 * Menu anchors
 *
 * The header's "Contact Us" item points at `/#contact-us`, a `menu-anchor` widget
 * near the foot of the home page. Elementor scrolls to it smoothly and subtracts
 * the pinned header's height, or the target lands underneath it.
 * ------------------------------------------------------------------ */
function initAnchors() {
  document.addEventListener('click', (event) => {
    const link = event.target.closest('a[href*="#"]');
    if (!link || link.target === '_blank') return;
    const url = new URL(link.href, location.href);
    if (url.origin !== location.origin || url.pathname !== location.pathname) return;
    const id = url.hash.slice(1);
    if (!id || id === 'content') return;
    const target = document.getElementById(id);
    if (!target) return;

    event.preventDefault();
    const top = target.getBoundingClientRect().top + window.scrollY - stickyHeight();
    window.scrollTo({ top, behavior: reduceMotion ? 'auto' : 'smooth' });
    history.pushState(null, '', url.hash);
  });
}

/* ------------------------------------------------------------------ *
 * Counters (jquery-numerator)
 *
 * `<span class="elementor-counter-number" data-duration data-from-value
 * data-to-value data-delimiter>` counts up once, when it first scrolls into view.
 * The server renders the from-value — which is the empty string on one of the home
 * page's three counters, so that one shows nothing at all until this runs.
 * ------------------------------------------------------------------ */
function initCounters() {
  const numbers = document.querySelectorAll('.elementor-counter-number');
  if (!numbers.length) return;

  /** Numerator keeps the to-value's decimal places and groups with the delimiter. */
  const format = (value, decimals, delimiter) => {
    const fixed = value.toFixed(decimals);
    const [whole, fraction] = fixed.split('.');
    const grouped = delimiter ? whole.replace(/\B(?=(\d{3})+(?!\d))/g, delimiter) : whole;
    return fraction ? `${grouped}.${fraction}` : grouped;
  };

  const run = (el) => {
    const to = parseFloat(el.dataset.toValue) || 0;
    const from = parseFloat(el.dataset.fromValue) || 0;
    const duration = Number(el.dataset.duration) || 0;
    const delimiter = el.dataset.delimiter || '';
    const decimals = (String(el.dataset.toValue).split('.')[1] || '').length;

    if (reduceMotion || !duration) { el.textContent = format(to, decimals, delimiter); return; }

    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      // jQuery's default `swing` easing, which is what numerator animates with.
      const eased = 0.5 - Math.cos(t * Math.PI) / 2;
      el.textContent = format(from + (to - from) * eased, decimals, delimiter);
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };

  const io = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      io.unobserve(entry.target);
      run(entry.target);
    }
  }, { rootMargin: '0px 0px -50px 0px' });
  for (const el of numbers) io.observe(el);
}

/* ------------------------------------------------------------------ *
 * Video widget
 *
 * Elementor renders an empty `<div class="elementor-video">` and its JS *replaces*
 * that node with the iframe — it does not nest one inside it. Nesting breaks the
 * aspect-ratio height chain the wrapper's CSS depends on (playbook §3.12), so the
 * placeholder is swapped, attribute for attribute, for what production ends up with.
 * ------------------------------------------------------------------ */
let videoUid = 0;

function initVideo(widget) {
  const placeholder = widget.querySelector('div.elementor-video');
  if (!placeholder) return;
  const s = settingsOf(widget);
  if (s.video_type !== 'youtube' || !s.youtube_url) return;

  const id = /(?:v=|youtu\.be\/|embed\/)([\w-]{6,})/.exec(s.youtube_url)?.[1];
  if (!id) return;

  const params = new URLSearchParams({
    controls: s.controls === 'yes' ? '1' : '0',
    rel: '0',
    playsinline: '0',
    cc_load_policy: '0',
    autoplay: '0',
    enablejsapi: '1',
    origin: location.origin,
    widgetid: String(++videoUid),
  });

  const iframe = document.createElement('iframe');
  iframe.className = 'elementor-video';
  iframe.setAttribute('frameborder', '0');
  iframe.setAttribute('allowfullscreen', '');
  iframe.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share');
  iframe.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
  iframe.setAttribute('title', 'Video Placeholder');
  iframe.width = '640';
  iframe.height = '360';
  iframe.id = `widget${videoUid}`;
  iframe.src = `https://www.youtube.com/embed/${id}?${params}`;

  placeholder.replaceWith(iframe);
}

/* ------------------------------------------------------------------ *
 * Media carousel (Swiper)
 *
 * The logo strip on /about/. Swiper's markup is load-bearing here: without it the
 * five `.swiper-slide` children stay at their CSS width and only the first is
 * visible, so the strip renders as one logo instead of five.
 *
 * Contract read off the live DOM at 1440 / 900 / 390 (scripts/probe-slides):
 *
 *   container   + `swiper-initialized swiper-horizontal swiper-pointer-events`,
 *                 and `swiper-backface-hidden` while the total slide count is under
 *                 Swiper's `maxBackfaceHiddenSlides` (10)
 *   wrapper       `cursor: grab; transition-duration: <ms>; transform: translate3d(x,0,0)`
 *                 plus an id and `aria-live="off"`
 *   loop          `slidesPerView` duplicates on each side — the last N slides
 *                 prepended, the first N appended — each keeping the source's
 *                 `data-swiper-slide-index` and `aria-label="n / total"`
 *   slides        inline `width` = (containerWidth - space*(spv-1)) / spv, and
 *                 `margin-right` = spaceBetween when that is non-zero
 *   classes       active / next / prev on the real run, and duplicate-active /
 *                 duplicate-next / duplicate-prev on the elements that mirror them
 *
 * Elementor's own responsive defaults for this widget are not serialised into
 * `data-settings`; the measured values are 5 slides / 0px at ≥1025, 2 / 10px at
 * 768–1024 and 1 / 10px below that.
 * ------------------------------------------------------------------ */
const CAROUSEL_BREAKPOINTS = [
  { min: 1025, key: '' },
  { min: 768, key: '_tablet', fallbackPerView: 2, fallbackSpace: 10 },
  { min: 0, key: '_mobile', fallbackPerView: 1, fallbackSpace: 10 },
];

function initMediaCarousel(widget) {
  const container = widget.querySelector('.elementor-main-swiper');
  const wrapper = container?.querySelector('.swiper-wrapper');
  if (!wrapper) return;

  const s = settingsOf(widget);
  const originals = [...wrapper.children];
  const total = originals.length;
  if (!total) return;

  originals.forEach((slide, i) => {
    slide.dataset.swiperSlideIndex = String(i);
    slide.setAttribute('aria-label', `${i + 1} / ${total}`);
  });

  const speed = Number(s.speed) || 300;
  const loop = s.loop === 'yes';
  const autoplayDelay = s.autoplay === 'yes' ? Number(s.autoplay_speed) || 5000 : 0;

  container.classList.add('swiper-initialized', 'swiper-horizontal', 'swiper-pointer-events');
  wrapper.id = `swiper-wrapper-${Math.random().toString(16).slice(2, 19)}`;
  wrapper.setAttribute('aria-live', 'off');

  const settingFor = (name, bp, fallback) => {
    const value = s[`${name}${bp.key}`] ?? (bp.key ? undefined : s[name]);
    const size = value && typeof value === 'object' ? value.size : value;
    return size === undefined || size === '' ? fallback : Number(size);
  };

  const config = () => {
    const width = window.innerWidth;
    const bp = CAROUSEL_BREAKPOINTS.find((b) => width >= b.min);
    return {
      perView: settingFor('slides_per_view', bp, bp.fallbackPerView ?? 3),
      space: settingFor('space_between', bp, bp.fallbackSpace ?? 0),
    };
  };

  let slides = originals;
  let activeIndex = 0;
  let realIndex = 0;
  let step = 0;
  let animating = false;
  let autoplayTimer = null;
  let autoplayStopped = false;

  const setTranslate = (x, ms) => {
    wrapper.style.cssText = `cursor: grab; transition-duration: ${ms}ms; transform: translate3d(${x}px, 0px, 0px);`;
  };

  const markClasses = () => {
    for (const slide of slides) {
      slide.classList.remove('swiper-slide-active', 'swiper-slide-next', 'swiper-slide-prev',
        'swiper-slide-duplicate-active', 'swiper-slide-duplicate-next', 'swiper-slide-duplicate-prev');
    }
    const active = slides[activeIndex];
    active?.classList.add('swiper-slide-active');
    slides[activeIndex + 1]?.classList.add('swiper-slide-next');
    slides[activeIndex - 1]?.classList.add('swiper-slide-prev');
    if (!loop) return;

    // Swiper mirrors the active/next/prev marks onto the matching duplicate — or
    // onto the real slide, when the marked one is itself a duplicate.
    const mirror = (index, cls, source) => {
      const wanted = source?.classList.contains('swiper-slide-duplicate')
        ? ':not(.swiper-slide-duplicate)'
        : '.swiper-slide-duplicate';
      wrapper.querySelectorAll(`.swiper-slide${wanted}[data-swiper-slide-index="${index}"]`)
        .forEach((el) => el.classList.add(cls));
    };
    mirror(realIndex, 'swiper-slide-duplicate-active', active);
    mirror((realIndex + 1) % total, 'swiper-slide-duplicate-next', slides[activeIndex + 1]);
    mirror((realIndex - 1 + total) % total, 'swiper-slide-duplicate-prev', slides[activeIndex - 1]);
  };

  const layout = () => {
    const { perView, space } = config();

    // Rebuild the loop copies whenever the count changes with the breakpoint.
    if (loop) {
      for (const el of [...wrapper.children]) {
        if (el.classList.contains('swiper-slide-duplicate')) el.remove();
      }
      const before = originals.slice(total - perView).map((el) => duplicate(el));
      const after = originals.slice(0, perView).map((el) => duplicate(el));
      wrapper.prepend(...before);
      wrapper.append(...after);
      activeIndex = perView + realIndex;
    } else {
      activeIndex = realIndex;
    }
    slides = [...wrapper.children];

    container.classList.toggle('swiper-backface-hidden', slides.length < 10);

    const width = container.clientWidth;
    const slideWidth = Math.round(((width - space * (perView - 1)) / perView) * 1000) / 1000;
    step = slideWidth + space;
    for (const slide of slides) {
      slide.style.width = `${slideWidth}px`;
      if (space) slide.style.marginRight = `${space}px`;
      else slide.style.removeProperty('margin-right');
    }

    setTranslate(-step * activeIndex, 0);
    markClasses();
  };

  const duplicate = (el) => {
    const copy = el.cloneNode(true);
    copy.classList.add('swiper-slide-duplicate');
    return copy;
  };

  const slideBy = (delta) => {
    if (animating) return;
    const target = activeIndex + delta;
    if (!loop && (target < 0 || target >= slides.length)) return;
    animating = true;
    activeIndex = target;
    realIndex = (realIndex + delta % total + total) % total;
    setTranslate(-step * activeIndex, speed);
    markClasses();
    setTimeout(() => {
      animating = false;
      if (!loop) return;
      // Loop fix: hop back onto the real run without a transition, exactly as
      // Swiper does once the duplicate has scrolled into place.
      const perView = config().perView;
      if (activeIndex >= perView + total || activeIndex < perView) {
        activeIndex = perView + realIndex;
        setTranslate(-step * activeIndex, 0);
        markClasses();
      }
    }, speed);
  };

  const stopAutoplay = () => { clearInterval(autoplayTimer); autoplayTimer = null; };
  const startAutoplay = () => {
    if (!autoplayDelay || autoplayStopped || reduceMotion || autoplayTimer) return;
    autoplayTimer = setInterval(() => slideBy(1), autoplayDelay);
  };

  widget.querySelector('.elementor-swiper-button-next')?.addEventListener('click', () => {
    // Swiper's `disableOnInteraction: true` — a manual move ends autoplay for good.
    if (s.pause_on_interaction === 'yes') { autoplayStopped = true; stopAutoplay(); }
    slideBy(1);
  });
  widget.querySelector('.elementor-swiper-button-prev')?.addEventListener('click', () => {
    if (s.pause_on_interaction === 'yes') { autoplayStopped = true; stopAutoplay(); }
    slideBy(-1);
  });

  if (s.pause_on_hover === 'yes') {
    container.addEventListener('mouseenter', stopAutoplay);
    container.addEventListener('mouseleave', startAutoplay);
  }

  layout();
  window.addEventListener('resize', layout);
  startAutoplay();

  /** Lets scripts/compare.mjs pin the carousel to a deterministic first slide. */
  container.eCarousel = {
    reset() { autoplayStopped = true; stopAutoplay(); realIndex = 0; layout(); },
  };
}

/* ------------------------------------------------------------------ */
onReady(() => {
  initEnvironment();
  initLazyBackgrounds();
  initSticky();
  initAnchors();
  initCounters();

  for (const widget of document.querySelectorAll('[data-widget_type]')) {
    // The sticky spacer is a visibility-hidden clone; wiring its widgets up would
    // duplicate every document-level listener for no visible effect.
    if (widget.closest('.elementor-sticky__spacer')) continue;
    const type = widget.getAttribute('data-widget_type');
    if (type === 'nav-menu.default') initNavMenu(widget);
    else if (type === 'video.default') initVideo(widget);
    else if (type === 'media-carousel.default') initMediaCarousel(widget);
  }
});
