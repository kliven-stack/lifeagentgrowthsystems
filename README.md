# lifeagentgrowthsystems.com — Astro clone

A pixel-faithful static clone of the WordPress/Elementor site at
<https://lifeagentgrowthsystems.com>, built to the team's
[migration playbook](../MIGRATION-PLAYBOOK.md). Astro 5, `output: 'static'`, no UI
framework, no serverless functions — the two lead forms post straight from the
browser to the Growthmap endpoint (playbook §4b).

12 routes: 10 Elementor pages, the category archive and the theme's 404 template.
The site has no posts.

---

## How the clone is put together

The site is Elementor on `hello-elementor` + a child theme, behind LiteSpeed Cache,
with Elementor Pro, Essential Addons and JetElements on top. Fidelity comes from
shipping **Elementor's own compiled CSS verbatim**, in the exact order each page
linked it, rather than re-deriving any of it:

```
_extract/html/*.html        crawled WordPress HTML (gitignored; `npm run crawl`)
public/wp/css/*.css         one file per WordPress stylesheet handle, plus the
                            inline <style> blocks, URLs rewritten root-relative
public/wp/fonts/*.woff2     Elementor's local Google Fonts, latin subsets only
public/wp-content/…         every image, icon font and the vendor bundles
src/fragments/*.html        rendered Elementor markup, split header / content /
                            footer / popup, URLs rewritten
src/data/pages.json         per page: path, title, SEO head, body class, the
                            ordered stylesheet list, which fragments to use
src/pages/[...slug].astro   one route renders all of it
src/scripts/elementor.js    replaces the WordPress JS (see below)
```

`src/styles/global.css` is Tailwind v4 **without preflight** and with `source(none)`
— a reset or a stray utility-name collision would repaint the ported markup. Only
`src/components` and `src/pages` are scanned.

### What replaced the WordPress JavaScript

`src/scripts/elementor.js` (~945 lines) stands in for elementor-frontend,
elementor-pro-frontend, the dialog library behind popups, SmartMenus, e-sticky,
jquery-numerator, Swiper, the Essential Addons and JetElements frontend bundles, and
jQuery. It reproduces the **DOM contract** those scripts created — the classes,
inline styles and injected nodes the compiled CSS depends on — each one read off the
live post-init DOM with `npm run inspect`, or transcribed out of the plugin's own
bundle rather than guessed:

| Feature | Contract |
| --- | --- |
| Environment | `e--ua-*` classes on `<body>`, plus `data-elementor-device-mode`, kept current on resize |
| Sticky header | pinned copy + a visibility-hidden `elementor-sticky__spacer` clone, `elementor-sticky--effects` past the 5px offset |
| Burger menu | the widget is *dropdown-on-mobile*, so the panel only takes over at ≤767. On open Elementor writes `--menu-height` = the space left below the panel, which the CSS uses as `max-height` |
| Popup | the modal is built on open — `dialog-widget … elementor-popup-modal` wrapper, `dialog-body …` on `<body>` — and the popup markup is kept in a `<template>` until then, because Elementor keeps it out of the document entirely |
| Menu anchor | smooth scroll with the pinned header subtracted |
| Counters | jQuery `swing` count-up on first view, delimiter and decimals preserved |
| Video | the empty `div.elementor-video` is **replaced** by the YouTube iframe, not wrapped — nesting breaks the wrapper's aspect-ratio height chain (playbook §3.12) |
| Carousels | one Swiper engine drives all three widgets: the media carousel, Pro's reviews widget and the Essential Addons testimonial slider, each at its own measured slides-per-view and gaps |
| Jet parallax | `jet-parallax-section` plus the prepended layer div, gated on each layer's own device list, with the plugin's scroll formula |
| Jet timeline | the connecting line spans centre-to-centre of the first and last numbered points — the one thing its CSS cannot express |

Two of those are worth calling out, because getting them wrong was invisible on
screen but wrecked the measurements:

- **Elementor's dialog stylesheet is a conditional asset.** It is in no page's
  `<link>` list; elementor-pro fetches it only when a popup is first opened, and it
  is what carries `position: fixed; inset: 0; z-index: 9999` for
  `.dialog-type-lightbox`. Without it the modal lays out in flow at the foot of the
  page. It is mirrored under its original path and injected on first open, the way
  Elementor injects it.
- **The reviews widget's loop needs one duplicate slide per side, not three.**
  Elementor Pro's `slidesPerView` default for that widget is 1. The widget is hidden
  at every breakpoint so nothing shows either way — but every extra loop clone shifts
  the document order of everything after it.

LiteSpeed's lazy-load rewrite is undone **at extract time** instead: `data-src` →
`src`, `data-srcset` → `srcset`, and the duplicate `<noscript>` image dropped. Same
URLs, same declared dimensions, same rendering as production's post-init DOM, one
fewer script, and no placeholder flash.

The GoHighLevel chat loader is kept as-is; it is the client's own property and
outlives the WordPress install. `PUBLIC_CHAT_WIDGET=off` removes it. (It does not
actually render — see bug 9.)

---

## Forms

Two LeadConnector ("Trustymail") widgets are embedded on the WordPress site, and the
first of them twice:

| Variant | Where | Fields |
| --- | --- | --- |
| `contact` | the home page's own contact section (element `ee9032b`) **and** popup 394, which the header's "Contact Us" item opens on every page | Name\*, Email\*, Phone\*, Write your Message\*, two consent checkboxes, Terms/Privacy |
| `subscribe` | "Sign up for updates" in the footer, every page (element `f9de94f`) | Name\*, Email\* |

`src/components/ContactForm.astro` replaces all three with one static form that POSTs
`FormData` to `PUBLIC_CONTACT_ENDPOINT`: inline success/error via `aria-live`, button
disabled in flight, a CSS-hidden `website` honeypot, native validation. The field
set, placeholders, consent copy, colours (`#e9ecef` fields, `#096eef` button), radii,
paddings and the 51px/18px row rhythm were read out of the live widgets' own
documents with `npm run form:inspect`.

Three deliberate departures from the widgets, all accessibility fixes: every field
gets a visually-hidden `<label>` (a placeholder is not an accessible name), the
fields the widgets mark with an asterisk are actually `required` (the widgets render
the asterisk but set `required` on nothing), and the phone field is a plain `tel`
input rather than the widget's country-picker component.

**Until `PUBLIC_CONTACT_ENDPOINT` is set, the pages keep the original iframes**, so a
deploy before the endpoint exists never ships a form that goes nowhere.
`PUBLIC_FORM_MODE=embed` forces them back afterwards.

The booking widgets — the calendar on `/schedule-a-call/` and the pair on the
orphaned `/home-2/` — are **not** replaced. They are appointment calendars, not
contact forms. See bug 2 for the state of the `/home-2/` pair.

---

## Environment variables

Everything is optional; the defaults reproduce the WordPress site.

| Variable | Default | Effect |
| --- | --- | --- |
| `PUBLIC_SITE_URL` | `https://lifeagentgrowthsystems.com` | canonical tags + sitemap |
| `PUBLIC_CONTACT_ENDPOINT` | *(empty)* | Growthmap lead endpoint; empty keeps the original embeds |
| `PUBLIC_FORM_MODE` | `growthmap` | `embed` forces the original iframes back |
| `PUBLIC_WEBFONTS` | `on` | `off` drops the Google fonts |
| `PUBLIC_CHAT_WIDGET` | `on` | `off` drops the GoHighLevel chat loader |

`PUBLIC_WEBFONTS` defaults to **on** here, unlike the sibling roofinggrowthsystems
clone. That site's font stylesheets address their `.woff2` files over `http://` on an
`https://` page, so Chrome blocks every one as mixed content; this install spells all
five `https://`, so its typography actually arrives. Worth re-checking per site.

---

## Commands

```bash
npm install
npm run dev                 # http://localhost:4321
npm run build               # -> dist/
npm run serve               # serve dist/ (honours vercel.json redirects)

# rebuild the clone from the live site
npm run crawl               # -> _extract/html/ + crawl-manifest.json
npm run css                 # -> public/wp/css/ + referenced assets
npm run fonts               # -> public/wp/fonts/ + the gf-local stylesheets
npm run extract             # -> src/fragments/, src/data/pages.json
npm run media               # -> public/wp-content/
npm run images              # re-encode uploads in place, same dimensions

# verification
npm run compare             # computed-style + box diff vs production @1440/900/390
npm run functional          # behavioural assertions against dist/
npm run audit               # every internal href/src/url() resolves in dist/
npm run inspect -- /about/  # dump the live post-init DOM
npm run form:inspect        # read the live LeadConnector widgets
```

`npm run preview` works — there is no Vercel adapter (playbook §4a/§4b).

**Run the harness against `dist/` via `npm run serve`, not against `npm run dev`.**
Editing any file mid-run makes Vite reload the page and the measurement dies with
"execution context was destroyed". Check the `<title>` of whatever is on :4321 before
trusting numbers, too — a stale dev server from a sibling site owning that port is a
recurring trap (playbook §7.6), and it cost a run here.

---

## Fidelity

Measured, not eyeballed (playbook §2). `scripts/compare.mjs` loads each page from
production and from the local build at 1440 / 900 / 390 px, waits for fonts and a
full scroll on both, pins all three carousels to slide 0, and then diffs every
Elementor element by its `data-id` plus the theme-rendered leaves in document order —
position, size, font, colour, background, display, padding, margin, text-align and
text.

**36 comparisons (12 pages × 3 widths), 0 diffs.** `npm run functional` passes
134/134 with an endpoint configured and 124/124 without. `npm run audit` reports no
broken internal reference that production does not already have.

The lead widgets are blocked on both sides by default — their host resets headless
traffic at random, and a run where one side's resizer handshake completes and the
other's does not invents a 700px difference that is not real.
`KEEP_EMBEDS=1 npm run compare --only=/` lets them load; the home page matches at all
three widths that way too.

---

## Original-site bugs, cloned faithfully

Everything here is reproduced as production behaves. Nothing in this list is a
migration defect — each is a decision for the client.

**The headline: this site is an incompletely rebranded copy of
roofinggrowthsystems.com, and before that of a concrete-marketing site.** Bugs 1–5
are all facets of that, and several are live on indexed pages.

1. **`/about/` is still a concrete company's page.** The heading reads "Your
   Concrete Marketing Specialists", the body opens "You're a concrete business owner
   and you want to grow your business", and the call to action gives a different
   company's contact details: `hello@concretegrowthpros.com` and (615) 880-9511. The
   page is indexed and linked from the main nav. **This is the most commercially
   significant item in this list.**

2. **`/home-2/` is the old roofing home page, published and indexed.** "We grow
   roofing companies. No hassle. No bull.", testimonials credited to "Roofing Growth
   Systems Client", and a product called "Sybrware". It is in the Yoast sitemap. It
   is also broken three ways over: its eight images are hotlinked from
   `jeremyb126.sg-host.com`, a SiteGround staging host that no longer resolves
   (NXDOMAIN), so they are broken on the live site; its two embedded widgets come
   from `links.sybrware.com`, also NXDOMAIN, so both are blank frames; and four of
   its buttons point at `http://jeremyb126.sg-host.com/#contact-us` instead of the
   `#contact-us` anchor on their own page. **Recommend deleting the page.**

3. **`/privacy-policy/` names the wrong company.** The policy identifies the operator
   as "Roofing Growth Systems, LLC, 2000 Mallory Lane STE 130-274, Franklin, TN" and
   the website as "Roofing Growth Systems, accessible from
   www.roofinggrowthsystems.com". That link is also written without a scheme, so the
   browser resolves it relative to the current directory and it 404s — on WordPress
   and here. `scripts/audit.mjs` lists it as known-broken so it cannot quietly become
   a regression. Fix = rewrite the policy for the right entity.

4. **`/guarantee/` refers to the client as "RGS"** in the terms of the performance
   guarantee.

5. **`/google-my-business-walkthrough/` is a roofing-era instruction page.** It tells
   customers to add "RGS" as a manager, gives `rgs-clients@gmail.com` as the address
   to invite, and offers support at `support@jeremyb126.sg-host.com` — a dead host.
   It is `noindex, nofollow` and orphaned: absent from the sitemap and unlinked from
   every page, so it was only found by enumerating the REST API. Cloned so the URL
   keeps resolving; **recommend deleting it**, or rewriting the three identifiers.

6. **Three published pages are placeholders or near-empty**, all indexed and all in
   the sitemap: `/template/` (a page titled "Template", carrying a stray testimonial
   slider), `/top-8-things-to-grow/` (a heading and nothing else), and
   `/schedule-a-call/` (the word "Calendar" above the booking embed).

7. **`/category/uncategorized/` is an empty archive that invites indexing.** The site
   has no posts at all, so the page renders a bare "Category: Uncategorized" heading —
   and its robots directive is `index, follow`. It is not in the sitemap. Cloned so
   the URL keeps resolving; the archive should be `noindex` or the category deleted.

8. **Three headings have no font-family anywhere in the cascade** and fall back to
   the system stack while every other heading renders in Roboto: the home page's hero
   H2, "The AI-Driven Growth System for Life Insurance Agents" — the largest piece of
   type on the site — and the footer's two column headings, "QUICK LINKS" and
   "SERVICES" (playbook §3.8). A test asserts this stays matched to production, so
   fixing it is a deliberate change rather than a silent one. Fix = set the family on
   those three widgets in Elementor.

9. **The chat bubble does not load, on either site.** The GoHighLevel loader asks for
   `/wp-content/litespeed/js/chat-widget/chat-widget.esm.js`; LiteSpeed cached the
   vendor bundle under that path and has since purged it, so the request 404s on
   production. The clone serves the same 404 and the bubble never appears. Fix =
   point the loader at `widgets.leadconnectorhq.com` directly, or purge and rebuild
   the LiteSpeed cache before cutover.

10. **One home-page counter renders empty.** On `/home-2/` the first statistic ships
    with `data-from-value=""`, so between first paint and the count-up the strip
    reads "$ B+". The other two ship `0`. Moot if the page is deleted.

11. **A reviews widget is hidden at every breakpoint.** The home page carries an
    Elementor Pro reviews carousel with three placeholder reviews — "John Doe" and
    Elementor's own placeholder image — marked `elementor-hidden-desktop`,
    `-tablet` and `-mobile`, so it never renders anywhere. It is invisible weight and
    its markup is in the page source. Recommend deleting the widget.

12. **The home page's `#contact-us` anchor is orphaned.** The menu-anchor widget is
    there, but nothing on the page links to it any more — the header's "Contact Us"
    item opens the popup instead. Harmless; noted so it is not mistaken for a
    migration slip.

13. **The popup's form is taller than the card that holds it.** Custom CSS pins
    `.popup-form iframe` to 720px (820px at ≤767) inside a `.dialog-message` fixed at
    800px, and the card also carries 40px of top padding plus a heading and a
    paragraph above the form. The card scrolls rather than growing. Once the
    Growthmap endpoint is set our form is a normal in-flow block in the same card, so
    it is worth a look at that breakpoint after the first deploy.

---

## Deployment

Import the repo at vercel.com/new — the standard config needs no settings.
`vercel.json` carries the security headers and the redirects WordPress served:

- `/author/admin` and `/home` → `/`
- the Yoast sitemap URLs (`/sitemap.xml`, `/sitemap_index.xml`, `/page-sitemap.xml`,
  `/post-sitemap.xml`) → `/sitemap-index.xml`
- `/feed`, `/comments/feed` → `/`

The generated sitemap lists exactly the nine URLs Yoast lists — `/category/…`,
`/google-my-business-walkthrough/` and the 404 route are built so their URLs keep
resolving, and kept out of the sitemap because production keeps them out.

Then set `PUBLIC_CONTACT_ENDPOINT` in the project's environment variables and
redeploy to hand both forms over to Growthmap. A human should submit each one once
end to end.

Going live on the real domain: playbook §8.
