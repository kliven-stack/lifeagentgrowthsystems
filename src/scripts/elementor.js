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
 * jquery-numerator, Swiper, the dialog library behind Elementor popups, the
 * Essential Addons and JetElements frontend bundles, the YouTube iframe API shim
 * and jQuery.
 */

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const onReady = (fn) =>
  document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', fn, { once: true })
    : fn();

const settingsOf = (el) => {
  try { return JSON.parse(el.getAttribute('data-settings') || '{}'); } catch { return {}; }
};

/**
 * Elementor's device mode, from the kit's active breakpoints (mobile ≤767, tablet
 * ≤1024, desktop above — the values `elementorFrontend.config.responsive` carries
 * on this site, and the ones the playbook pins the clone's breakpoints to).
 *
 * Several contracts below are gated on it: JetElements only builds its parallax
 * layers on the devices a layer lists, and Elementor writes the current mode onto
 * <body> where the compiled CSS can see it.
 */
const deviceMode = () => {
  const w = window.innerWidth;
  if (w <= 767) return 'mobile';
  if (w <= 1024) return 'tablet';
  return 'desktop';
};

/** Runs `fn` on load and on every resize that changes the device mode. */
function onDeviceModeChange(fn) {
  let last = deviceMode();
  fn(last);
  window.addEventListener('resize', () => {
    const now = deviceMode();
    if (now === last) return;
    last = now;
    fn(now);
  });
}

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
  // Elementor also stamps the current breakpoint onto <body>, and keeps it current.
  onDeviceModeChange((mode) => document.body.setAttribute('data-elementor-device-mode', mode));
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
 * Swiper
 *
 * Three widgets on this site are Swiper carousels: Elementor's media carousel
 * (the logo strip on /about/), Elementor Pro's reviews widget and Essential
 * Addons' testimonial slider (both on the home page, the second also on
 * /template/). One engine drives all three, because Swiper's markup — not just
 * its behaviour — is what the compiled CSS lays out against: without it the
 * `.swiper-slide` children keep their CSS width and only the first is visible.
 *
 * Contract read off the live DOM at 1440 / 900 / 390 (_extract/probe.mjs):
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
 *   autoHeight    `swiper-autoheight` on the container and the active slide's
 *                 height written onto the wrapper (Essential Addons only)
 *
 * A container that is `display:none` at every breakpoint measures 0 wide, and
 * Swiper then skips sizing entirely: it still duplicates the slides and indexes
 * them, but writes no width, no margin and no `aria-label`. That is exactly what
 * the hidden reviews widget looks like on production, so the zero-width case is
 * reproduced rather than papered over.
 * ------------------------------------------------------------------ */

/**
 * Elementor's own defaults are not serialised into `data-settings`, and they differ
 * per widget — so they are measured rather than assumed (the live slide counts, from
 * _extract/probe.mjs, give the loop's duplicate count away exactly).
 *
 *   media-carousel  the /about/ logo strip. It does serialise `slides_per_view: 5`,
 *                   so only the tablet/mobile fallbacks below are ever used: 2 and 1,
 *                   with 10px gaps.
 *   reviews         one review per slide at every width — 3 originals plus a single
 *                   duplicate on each side, 5 in the wrapper at 1440, 900 and 390
 *                   alike. Elementor Pro's default for this widget is 1, not 3, and
 *                   getting it wrong is not cosmetic: every extra loop clone shifts
 *                   the document order of everything after it.
 */
const CAROUSEL_BREAKPOINTS = [
  { min: 1025, key: '' },
  { min: 768, key: '_tablet', fallbackSpace: 10 },
  { min: 0, key: '_mobile', fallbackSpace: 10 },
];

/** Per-widget `slidesPerView` fallback, desktop / tablet / mobile. */
const CAROUSEL_DEFAULT_PER_VIEW = {
  'media-carousel.default': [3, 2, 1],
  'reviews.default': [1, 1, 1],
};

/**
 * Drive one `.swiper` container.
 *
 * `cfg.layout()` returns `{ perView, space }` for the current viewport; everything
 * else mirrors the Swiper options the original widget was initialised with.
 */
function initSwiper(container, cfg) {
  const wrapper = container.querySelector('.swiper-wrapper');
  if (!wrapper) return;

  const originals = [...wrapper.children];
  const total = originals.length;
  if (!total) return;

  const {
    speed = 300, loop = false, autoplayDelay = 0,
    pauseOnHover = false, pauseOnInteraction = false, autoHeight = false,
    next = null, prev = null,
  } = cfg;

  originals.forEach((slide, i) => { slide.dataset.swiperSlideIndex = String(i); });

  container.classList.add('swiper-initialized', 'swiper-horizontal', 'swiper-pointer-events');
  if (autoHeight) container.classList.add('swiper-autoheight');
  wrapper.id = `swiper-wrapper-${Math.random().toString(16).slice(2, 18)}`;
  wrapper.setAttribute('aria-live', 'off');

  let slides = originals;
  let activeIndex = 0;
  let realIndex = 0;
  let step = 0;
  let animating = false;
  let autoplayTimer = null;
  let autoplayStopped = false;

  const setTranslate = (x, ms) => {
    const height = autoHeight && slides[activeIndex] ? ` height: ${slides[activeIndex].offsetHeight}px;` : '';
    wrapper.style.cssText = `cursor: grab;${height} transform: translate3d(${x}px, 0px, 0px); transition-duration: ${ms}ms;`;
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

  const duplicate = (el) => {
    const copy = el.cloneNode(true);
    copy.classList.add('swiper-slide-duplicate');
    return copy;
  };

  const layout = () => {
    const { perView, space } = cfg.layout();

    // Rebuild the loop copies whenever the count changes with the breakpoint.
    if (loop) {
      for (const el of [...wrapper.children]) {
        if (el.classList.contains('swiper-slide-duplicate')) el.remove();
      }
      const before = originals.slice(total - perView).map(duplicate);
      const after = originals.slice(0, perView).map(duplicate);
      wrapper.prepend(...before);
      wrapper.append(...after);
      activeIndex = perView + realIndex;
    } else {
      activeIndex = realIndex;
    }
    slides = [...wrapper.children];

    container.classList.toggle('swiper-backface-hidden', slides.length < 10);

    const width = container.clientWidth;
    if (!width) {
      // Hidden container: Swiper indexes and duplicates but sizes nothing.
      markClasses();
      return;
    }
    const slideWidth = Math.round(((width - space * (perView - 1)) / perView) * 1000) / 1000;
    step = slideWidth + space;
    for (const slide of slides) {
      slide.style.width = `${slideWidth}px`;
      if (space) slide.style.marginRight = `${space}px`;
      else slide.style.removeProperty('margin-right');
      const index = Number(slide.dataset.swiperSlideIndex);
      slide.setAttribute('aria-label', `${index + 1} / ${total}`);
      if (!slide.hasAttribute('role')) slide.setAttribute('role', 'group');
    }

    setTranslate(-step * activeIndex, 0);
    markClasses();
  };

  const slideBy = (delta) => {
    if (animating || !step) return;
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
      const perView = cfg.layout().perView;
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

  const arrow = (el, delta) => el?.addEventListener('click', () => {
    // Swiper's `disableOnInteraction: true` — a manual move ends autoplay for good.
    if (pauseOnInteraction) { autoplayStopped = true; stopAutoplay(); }
    slideBy(delta);
  });
  arrow(next, 1);
  arrow(prev, -1);

  if (pauseOnHover) {
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

/** Elementor media carousel and Pro reviews — both read the widget's data-settings. */
function initElementorCarousel(widget) {
  const container = widget.querySelector('.elementor-main-swiper');
  if (!container) return;
  const s = settingsOf(widget);
  const perViewDefaults = CAROUSEL_DEFAULT_PER_VIEW[widget.getAttribute('data-widget_type')] || [3, 2, 1];

  const settingFor = (name, bp, fallback) => {
    const value = s[`${name}${bp.key}`] ?? (bp.key ? undefined : s[name]);
    const size = value && typeof value === 'object' ? value.size : value;
    return size === undefined || size === '' ? fallback : Number(size);
  };

  initSwiper(container, {
    speed: Number(s.speed) || 300,
    loop: s.loop === 'yes',
    autoplayDelay: s.autoplay === 'yes' ? Number(s.autoplay_speed) || 5000 : 0,
    pauseOnHover: s.pause_on_hover === 'yes',
    pauseOnInteraction: s.pause_on_interaction === 'yes',
    next: widget.querySelector('.elementor-swiper-button-next'),
    prev: widget.querySelector('.elementor-swiper-button-prev'),
    layout() {
      const width = window.innerWidth;
      const index = CAROUSEL_BREAKPOINTS.findIndex((b) => width >= b.min);
      const bp = CAROUSEL_BREAKPOINTS[index];
      return {
        perView: settingFor('slides_per_view', bp, perViewDefaults[index]),
        space: settingFor('space_between', bp, bp.fallbackSpace ?? 0),
      };
    },
  });
}

/**
 * Essential Addons testimonial slider.
 *
 * Its options come from `data-` attributes on the container rather than from
 * Elementor's settings blob, and its breakpoints are Swiper's own `min-width`
 * ones — 1024 / 768 / 320 — not Elementor's. Defaults (`spaceBetween: 10`,
 * `autoHeight: true`, `disableOnInteraction: false`) are the plugin's, read out
 * of its frontend bundle rather than guessed.
 */
function initEaelTestimonialSlider(widget) {
  const container = widget.querySelector('.eael-testimonial-slider-main');
  if (!container) return;
  const data = container.dataset;
  const num = (v, fallback) => (v === undefined || v === '' ? fallback : Number(v));
  const id = (sel) => (sel ? widget.querySelector(sel) : null);

  initSwiper(container, {
    speed: num(data.speed, 400),
    loop: num(data.loop, 0) === 1,
    autoplayDelay: num(data.autoplay_speed, 999999),
    pauseOnHover: data.pauseOnHover === 'true',
    pauseOnInteraction: false,
    autoHeight: true,
    next: id(data.arrowNext),
    prev: id(data.arrowPrev),
    layout() {
      const width = window.innerWidth;
      const perView = width >= 1024 ? num(data.items, 3)
        : width >= 768 ? num(data.itemsTablet, 3)
          : num(data.itemsMobile, 3);
      return { perView, space: 10 };
    },
  });
}

/* ------------------------------------------------------------------ *
 * JetElements: section parallax
 *
 * Every section on this site carries a `jet_parallax_layout_list`, and 65 of them
 * carry one layer. JetElements does two things with it, both of which the
 * compiled CSS and the stacking order depend on:
 *
 *   * adds `jet-parallax-section` to the section, and
 *   * prepends `<div class="jet-parallax-section__layout elementor-repeater-item-<id>
 *     jet-parallax-section__<type>-layout[ is-mac]"><div class="jet-parallax-section__image">`,
 *     the inner div carrying the layer's background and its scroll transform.
 *
 * Both are gated on the layer's own `jet_parallax_layout_on` list, which is
 * `["desktop","tablet"]` here — so nothing is built at ≤767px, exactly as
 * production renders it.
 *
 * The scroll maths is the plugin's, transcribed rather than approximated:
 *
 *   speed    = (layout_speed.size || 50) / 100 * 2
 *   progress = (scrollY - layoutTop + viewportHeight) / layoutHeight * 100,
 *              clamped to 0 before the section and 200 after it
 *   translateY(progress * speed * direction px)
 *
 * Every layer on this site has an empty image, so the layers paint nothing; they
 * are still built because production builds them, and an extra positioned child
 * with a `z-index` is not nothing to the stacking context around it.
 * ------------------------------------------------------------------ */
function initJetParallax() {
  const sections = [...document.querySelectorAll('[data-settings]')]
    .map((el) => ({ el, layers: settingsOf(el).jet_parallax_layout_list }))
    .filter((s) => Array.isArray(s.layers) && s.layers.length && !s.el.closest('.elementor-sticky__spacer'));
  if (!sections.length) return;

  const isMac = /Mac/.test(navigator.platform || navigator.userAgent);
  let active = [];

  const build = (mode) => {
    for (const { el } of sections) {
      el.querySelectorAll(':scope > .jet-parallax-section__layout').forEach((n) => n.remove());
    }
    active = [];

    for (const { el, layers } of sections) {
      for (const layer of layers) {
        const on = layer.jet_parallax_layout_on || ['desktop', 'tablet'];
        if (!on.includes(mode)) continue;

        const type = layer.jet_parallax_layout_type || 'none';
        el.classList.add('jet-parallax-section');

        const layout = document.createElement('div');
        layout.className = `jet-parallax-section__layout elementor-repeater-item-${layer._id} jet-parallax-section__${type}-layout${isMac ? ' is-mac' : ''}`;
        if (layer.jet_parallax_layout_z_index !== '') layout.style.zIndex = layer.jet_parallax_layout_z_index;

        const image = document.createElement('div');
        image.className = 'jet-parallax-section__image';
        const x = layer.jet_parallax_layout_bg_x ?? 0;
        const y = layer.jet_parallax_layout_bg_y ?? 0;
        image.style.backgroundPositionX = `${x}%`;
        image.style.backgroundPositionY = `${y}%`;
        image.style.backgroundImage = `url(${layer.jet_parallax_layout_image?.url || ''})`;
        layout.append(image);
        el.prepend(layout);

        if (type === 'scroll' && (layer.jet_parallax_layout_animation_prop || 'bgposition') === 'transform') {
          active.push({
            layout,
            image,
            speed: (layer.jet_parallax_layout_speed?.size || 50) / 100 * 2,
            direction: Number(layer.jet_parallax_layout_direction || 1),
          });
        }
      }
    }
  };

  const update = () => {
    const scrollTop = window.scrollY;
    const viewport = window.innerHeight;
    for (const { layout, image, speed, direction } of active) {
      const top = layout.getBoundingClientRect().top + scrollTop;
      const height = layout.offsetHeight;
      if (!height) continue;
      let progress = (scrollTop - top + viewport) / height * 100;
      if (scrollTop < top - viewport) progress = 0;
      if (scrollTop > top + height) progress = 200;
      image.style.transform = `translateY(${(speed * progress).toFixed(1) * direction}px)`;
    }
  };

  onDeviceModeChange((mode) => { build(mode); update(); });
  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update);
}

/* ------------------------------------------------------------------ *
 * JetElements: horizontal timeline
 *
 * The "How It Works" strip on the home page. Its item widths come from the
 * compiled CSS, so the only thing its JS contributes is the connecting line's
 * geometry — which the CSS cannot express, because it spans from the centre of
 * the first numbered point to the centre of the last:
 *
 *   left  = firstPoint.offsetLeft + firstPoint.offsetWidth / 2
 *   width = |lastPoint.offsetLeft - firstPoint.offsetLeft|
 *
 * (`.jet-hor-timeline-item__point-content`, the circle — not the item that holds
 * it. jQuery's `.position().left + marginLeft` is `offsetLeft`.) Without it the
 * line has no width at all and the steps read as four unconnected cards.
 *
 * Hovering an item also toggles `is-hover` on every element sharing its repeater
 * id, which is how the card above and the point below light up together.
 * ------------------------------------------------------------------ */
function initJetTimeline(widget) {
  const root = widget.querySelector('.jet-hor-timeline');
  const line = widget.querySelector('.jet-hor-timeline__line');
  if (!root) return;

  if (line) {
    const points = widget.querySelectorAll('.jet-hor-timeline-item__point-content');
    const place = () => {
      const first = points[0];
      const last = points[points.length - 1];
      if (!first || !last) return;
      line.style.left = `${first.offsetLeft + first.offsetWidth / 2}px`;
      line.style.width = `${Math.abs(last.offsetLeft - first.offsetLeft)}px`;
    };
    place();
    window.addEventListener('resize', place);
    // The cards are laid out from the same fonts the page is still loading.
    document.fonts?.ready.then(place);
  }

  for (const item of widget.querySelectorAll('.jet-hor-timeline-item')) {
    const id = item.dataset.itemId;
    if (!id) continue;
    const twins = () => widget.querySelectorAll(`.elementor-repeater-item-${id}`);
    item.addEventListener('mouseenter', () => twins().forEach((el) => el.classList.add('is-hover')));
    item.addEventListener('mouseleave', () => twins().forEach((el) => el.classList.remove('is-hover')));
  }
}

/* ------------------------------------------------------------------ *
 * Popups
 *
 * This site's only contact form lives in Elementor popup 394, which the header's
 * "Contact Us" menu item opens on every page — its `open_selector` is
 * `.contact-form`, the class on that `<li>` in both the desktop and the mobile
 * menu. Unlike the popup on the sibling roofinggrowthsystems site, this one is
 * wired up and works, so the clone has to open it too.
 *
 * Elementor removes the popup markup from the document until it is opened, then
 * builds the dialog library's wrapper around it and appends the result to
 * `<body>` (contract read off the live DOM, _extract/probe.mjs):
 *
 *   <div class="dialog-widget dialog-lightbox-widget dialog-type-buttons
 *               dialog-type-lightbox elementor-popup-modal"
 *        id="elementor-popup-modal-<id>" aria-modal="true" role="document" tabindex="0">
 *     <div class="dialog-widget-content dialog-lightbox-widget-content animated">
 *       <a role="button" tabindex="0" aria-label="Close" href="#"
 *          class="dialog-close-button dialog-lightbox-close-button"><i class="eicon-close"></i></a>
 *       <div class="dialog-header dialog-lightbox-header"></div>
 *       <div class="dialog-message dialog-lightbox-message">…the popup, display:block…</div>
 *
 * and adds `dialog-body dialog-lightbox-body dialog-container dialog-lightbox-container`
 * to `<body>`. The compiled e-popup stylesheet hangs everything off those names —
 * a wrapper that is almost right renders as an empty overlay (playbook §3.12).
 * ------------------------------------------------------------------ */
/**
 * Elementor's dialog library stylesheet.
 *
 * It is a *conditional* asset: absent from every page's <link> list, fetched by
 * elementor-pro only when a popup is first opened. It is also load-bearing — it
 * carries `.dialog-type-lightbox { position: fixed; inset: 0; z-index: 9999 }`,
 * without which the modal lays out in flow at the foot of the page instead of
 * covering the viewport. Injected here at the same moment, and into <head> after
 * the compiled sheets, which is where Elementor puts it too.
 */
const DIALOG_CSS = '/wp-content/plugins/elementor/assets/css/conditionals/dialog.min.css';

function loadDialogCss() {
  if (document.querySelector(`link[href="${DIALOG_CSS}"]`)) return Promise.resolve();
  return new Promise((resolve) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = DIALOG_CSS;
    link.addEventListener('load', resolve, { once: true });
    link.addEventListener('error', resolve, { once: true });
    document.head.append(link);
  });
}

function initPopups() {
  // BaseLayout parks each popup in a <template>, whose content is not part of the
  // DOM tree — so the pre-open document matches production's, where the popup is
  // absent entirely.
  const holders = [...document.querySelectorAll('template.gm-popup')];
  if (!holders.length) return;

  for (const holder of holders) {
    const template = holder.content.querySelector('[data-elementor-type="popup"]');
    if (!template) continue;
    const id = template.getAttribute('data-elementor-id');
    const settings = (() => {
      try { return JSON.parse(template.getAttribute('data-elementor-settings') || '{}'); } catch { return {}; }
    })();
    const selector = settings.open_selector;
    if (!selector) continue;   // nothing on the page can open it — leave it unbuilt

    let modal = null;

    const close = () => {
      if (!modal) return;
      modal.remove();
      modal = null;
      document.body.classList.remove('dialog-body', 'dialog-lightbox-body', 'dialog-container', 'dialog-lightbox-container');
      document.removeEventListener('keydown', onKey);
    };

    const onKey = (event) => { if (event.key === 'Escape') close(); };

    const open = async () => {
      if (modal) return;
      // Elementor fetches the dialog stylesheet before it shows the modal; so do we,
      // or the first open paints one frame with the popup laid out in flow.
      await loadDialogCss();
      if (modal) return;
      modal = document.createElement('div');
      modal.className = 'dialog-widget dialog-lightbox-widget dialog-type-buttons dialog-type-lightbox elementor-popup-modal';
      modal.id = `elementor-popup-modal-${id}`;
      modal.setAttribute('aria-modal', 'true');
      modal.setAttribute('role', 'document');
      modal.setAttribute('tabindex', '0');

      const content = document.createElement('div');
      content.className = 'dialog-widget-content dialog-lightbox-widget-content animated';

      const closeButton = document.createElement('a');
      closeButton.className = 'dialog-close-button dialog-lightbox-close-button';
      closeButton.setAttribute('role', 'button');
      closeButton.setAttribute('tabindex', '0');
      closeButton.setAttribute('aria-label', 'Close');
      closeButton.href = '#';
      closeButton.innerHTML = '<i class="eicon-close"></i>';

      const header = document.createElement('div');
      header.className = 'dialog-header dialog-lightbox-header';

      const message = document.createElement('div');
      message.className = 'dialog-message dialog-lightbox-message';
      const popup = template.cloneNode(true);
      popup.style.display = 'block';
      message.append(popup);

      content.append(closeButton, header, message);
      modal.append(content);
      document.body.append(modal);
      document.body.classList.add('dialog-body', 'dialog-lightbox-body', 'dialog-container', 'dialog-lightbox-container');

      closeButton.addEventListener('click', (event) => { event.preventDefault(); close(); });
      // Elementor's `a11y_navigation` — clicking the backdrop dismisses, clicking
      // inside the card does not.
      modal.addEventListener('click', (event) => { if (event.target === modal) close(); });
      document.addEventListener('keydown', onKey);
      modal.focus();

      // Anything Elementor would have initialised inside the popup, we do too.
      initWidgets(popup);
    };

    document.addEventListener('click', (event) => {
      const trigger = event.target.closest(selector);
      if (!trigger) return;
      // The trigger is a menu item whose own <a href="#"> would otherwise jump.
      const link = event.target.closest('a');
      if (link && (link.getAttribute('href') || '#') === '#') event.preventDefault();
      open();
    });
  }
}
/* ------------------------------------------------------------------ */

/** Wire up every widget inside `root` — the document, or a popup once opened. */
function initWidgets(root) {
  for (const widget of root.querySelectorAll('[data-widget_type]')) {
    // The sticky spacer is a visibility-hidden clone; wiring its widgets up would
    // duplicate every document-level listener for no visible effect.
    if (widget.closest('.elementor-sticky__spacer')) continue;
    const type = widget.getAttribute('data-widget_type');
    if (type === 'nav-menu.default') initNavMenu(widget);
    else if (type === 'video.default') initVideo(widget);
    else if (type === 'media-carousel.default' || type === 'reviews.default') initElementorCarousel(widget);
    else if (type === 'eael-testimonial-slider.default') initEaelTestimonialSlider(widget);
    else if (type === 'jet-horizontal-timeline.default') initJetTimeline(widget);
  }
}

onReady(() => {
  initEnvironment();
  initLazyBackgrounds();
  initSticky();
  initJetParallax();
  initAnchors();
  initCounters();
  initWidgets(document);
  initPopups();
});
