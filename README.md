# lifeagentgrowthsystems.com — Astro clone

A pixel-faithful static clone of the WordPress/Elementor site at
<https://lifeagentgrowthsystems.com>, built to the team's
[migration playbook](../MIGRATION-PLAYBOOK.md). Astro 5, `output: 'static'`, no UI
framework, no serverless functions — the lead forms are third-party embeds that
ship exactly as WordPress serves them.

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

The GoHighLevel chat loader is kept; it is the client's own property and outlives the
WordPress install. `PUBLIC_CHAT_WIDGET=off` removes it. Its `src` is repointed at the
vendor, because the WordPress copy asks for an asset that no longer exists — fixed
bug 8.

---

## Forms

Two LeadConnector ("Trustymail") widgets are embedded on the WordPress site, and the
first of them twice. **All three ship exactly as WordPress serves them.**

| Widget | Where | Fields |
| --- | --- | --- |
| contact | the home page's own contact section (element `ee9032b`) **and** popup 394, which the header's "Contact Us" item opens on every page | Name\*, Email\*, Phone\*, Write your Message\*, two consent checkboxes, Terms/Privacy |
| subscribe | "Sign up for updates" in the footer, every page (element `f9de94f`) | Name\*, Email\* |

They are served from `verified.trustymail.co`, a GoHighLevel host that outlives the
WordPress install — so the embed *is* the working form, and it keeps working after
cutover; it just stops being ours to route. Rebuilding it would trade a form that
works today for one that needs an endpoint configured before it does.

Each ships with its `form_embed.js` resizer, and that detail is load-bearing rather
than incidental: the iframe is served with `style="height:100%"`, which on a
block-level iframe resolves to the default 150px. The resizer is what receives the
rendered height from inside the frame and rewrites the inline style to it. Drop it
and the form renders clipped to a sliver. `npm run functional` asserts the iframes
and the resizer.

The booking widgets — the calendar on `/schedule-a-call/` and the pair on the
orphaned `/home-2/` — are untouched for the same reason and one more: they are
appointment calendars, not contact forms. Both `/home-2/` widgets come from a host
that no longer resolves; see the open items.

`npm run form:inspect` reads what each widget actually renders, which is how you
check an embed still works after cutover without clicking through the site.

---

## Environment variables

Everything is optional; the defaults reproduce the WordPress site.

| Variable | Default | Effect |
| --- | --- | --- |
| `PUBLIC_SITE_URL` | `https://lifeagentgrowthsystems.com` | canonical tags + sitemap |
| `PUBLIC_WEBFONTS` | `on` | `off` drops the Google fonts |
| `PUBLIC_CHAT_WIDGET` | `on` | `off` drops the GoHighLevel chat loader |
| `PUBLIC_ORIGINAL_BUGS` | *(empty)* | `keep` reproduces the WordPress site's own bugs instead of fixing them — what `npm run compare` needs |

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
# the fidelity diff needs a build that still carries the original site's bugs
PUBLIC_ORIGINAL_BUGS=keep npm run build && npm run compare
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

**36 comparisons (12 pages × 3 widths), 0 diffs**, against
`PUBLIC_ORIGINAL_BUGS=keep npm run build` — the harness diffs against the live
WordPress site, so it can only be meaningful against a build that still carries that
site's bugs. `npm run functional` passes 142/142 on a normal build and 126/126 in
`keep` mode, and `npm run audit` reports no broken internal reference at all on a
normal build (one, the privacy policy's, in `keep` mode — which production has too).

The lead widgets are blocked on both sides by default — their host resets headless
traffic at random, and a run where one side's resizer handshake completes and the
other's does not invents a 700px difference that is not real.
`KEEP_EMBEDS=1 npm run compare --only=/` lets them load; the home page matches at all
three widths that way too.

---

## Original-site bugs

The clone was first built to reproduce production exactly, bugs included, and every
defect found was recorded. The client then asked for them to be fixed, so most are
now fixed — in `src/lib/fixes.ts`, not by editing `src/fragments/`, because
`npm run extract` rewrites the fragments from the crawl and would undo the edits.

`PUBLIC_ORIGINAL_BUGS=keep` turns every fix back off. `npm run compare` needs that,
since it diffs against the live WordPress site.

**The context for most of this list: the site is an incompletely rebranded copy of
roofinggrowthsystems.com, and before that of a concrete-marketing site.**

### Fixed

**Content and branding**

1. **`/about/` addressed the wrong industry.** "Your Concrete Marketing Specialists",
   "You're a concrete business owner", "Concrete Industry Specialists" — all three now
   say life insurance.

2. **Placeholder copy was live on two indexed pages, and is now removed.** `/about/`
   carried a whole unfinished section — an "About Us" label, a heading reading
   "Lorem Ipsum", and two stock portraits each captioned "I am text block. Click edit
   button to change this text. Lorem ipsum dolor sit amet…" (section `37b262a6`,
   removed entire, because the heading and the portraits were the same placeholder
   and would read as broken on their own). On `/how-it-works/`, the bodies of both
   "Step 2 – Convert" **and** "Step 3: Evolve Online" were the stock filler *about*
   Lorem Ipsum; only Step 1 has real copy. Both bodies are removed and both steps
   keep their headings. **Those two steps now need real copy.**

3. **Three sets of contact details belonged to other people.** `/about/` said
   "Contact us today at hello@concretegrowthpros.com or call (615) 880-9511" — a
   different company. `/google-my-business-walkthrough/` told clients to invite
   `rgs-clients@gmail.com` and offered support at `support@jeremyb126.sg-host.com`, a
   host that does not resolve. `/privacy-policy/` published `615.488.4889`. The site
   has no contact address of its own, so all of them now route to the contact paths
   the rest of the site already uses — the popup form and `/schedule-a-call/`.
   **One still needs a real value: the Google Business step now reads "Enter the Life
   Agent Growth Systems email address we sent you", which is only true once someone
   sends it. Give us the address and it goes back in.**

4. **The home page's search snippet sold roofing.** Yoast derives descriptions from
   the page body, so the meta description, `og:description`, `twitter:description`
   and the schema.org graph all read "Proven results. Guaranteed. We grow roofing
   companies." Rewritten from the site's own copy, as were `/about/`'s and
   `/home-2/`'s.

5. **`/privacy-policy/` pointed at another client's site** — it defined the Website
   as "Roofing Growth Systems, accessible from www.roofinggrowthsystems.com", and
   wrote that address without a scheme so the link 404'd. Both halves now name this
   site, over https.

6. **"RGS" on `/guarantee/` and `/google-my-business-walkthrough/`** — the roofing
   brand's initials — now "Life Agent Growth Systems".

**Layout, typography and behaviour**

7. **80% of the site rendered in the operating system's UI font.** Elementor kit 11
   sets no body font and no heading font, so everything the designer did not style
   widget-by-widget inherited hello-elementor's
   `body { font-family: -apple-system, … }` — **640 of 796 visible text elements**,
   including the home page's hero H2 and its four timeline steps, every footer
   heading, all of `/privacy-policy/` and all of `/how-it-works/`. Five webfont
   families were downloaded and used for the other 20%. Two rules now apply the kit's
   own declared intent — Text = Roboto for body, Primary = Inter for headings — at
   deliberately low specificity, so every per-widget family Elementor compiled still
   wins and nothing the designer actually chose is overridden.

8. **`/privacy-policy/` scrolled sideways on a phone.** The policy pastes a full
   Adobe support URL as its own link text with nothing to let it wrap; at 390px it
   ran 453px past the viewport and dragged the page with it. Now wraps.

9. **The popup card could not show its own form.** `.dialog-message` is pinned at
   800px tall while its contents — 40px of padding, a heading, a paragraph and a
   720px form — are taller, and it could not scroll, so the submit button sat below
   the fold. The card now sizes to its content, caps at the viewport, and scrolls.

10. **The chat bubble never loaded, on either site.** The GoHighLevel loader is a
    LiteSpeed-cached copy of the vendor bundle and resolves its own assets relative
    to itself, so it asked for
    `/wp-content/litespeed/js/chat-widget/chat-widget.esm.js` — purged, and a 404.
    It now points at `widgets.leadconnectorhq.com`, which is the documented embed.

11. **A counter rendered empty.** `/home-2/`'s first statistic shipped with an empty
    from-value *and* empty text, so the strip read "$ B+" until the count-up ran.
    Both now `0`.

12. **A hidden placeholder reviews carousel shipped on every home-page load** — three
    "John Doe" reviews and Elementor's placeholder image, marked hidden at every
    breakpoint. Now removed from layout entirely. Recommend deleting the widget in
    Elementor.

**Links, images and indexing**

13. **Seven of `/home-2/`'s eight images were hotlinked from a dead staging host.**
    `jeremyb126.sg-host.com` no longer resolves, and the URLs were `http://` on an
    `https://` page, so they were blocked twice over. The same files are on this
    site's own uploads and now load from there. The eighth, `RoofHeader3.jpg`, is a
    roofing hero image with no counterpart here; it is left pointing at the dead
    host, and `npm run functional` asserts it is the only one.

14. **Four `/home-2/` buttons linked to `http://jeremyb126.sg-host.com/#contact-us`**
    instead of the anchor on their own page. Now local anchors.

15. **`/home-2/` and `/template/` are retired.** Both 308 to `/` (`vercel.json`) and
    both are out of the sitemap, so no inbound link breaks and neither stale page
    stays in the index. `/top-8-things-to-grow/` and
    `/google-my-business-walkthrough/` are kept as they were, per your call — the
    latter is already `noindex` and out of the sitemap.

16. **`/category/uncategorized/` invited indexing.** The site has no posts, so it
    renders a bare heading; its robots directive was `index, follow` and is now
    `noindex, follow`.

### Still open — these need information only you have

1. **An email address for the Google Business onboarding step.** It currently says
   "Enter the Life Agent Growth Systems email address we sent you" in place of
   `rgs-clients@gmail.com`. A real address makes the instruction self-contained
   again. A public contact email and phone would also let items 3 above use the
   client's own details instead of routing everything to the form.

2. **The privacy policy's legal entity.** It names "Roofing Growth Systems, LLC, 2000
   Mallory Lane STE 130-274, Franklin, Tn 37064" as the Company, and repeats that
   postal address as the contact address. Deliberately left alone — one agency runs
   several of these niche brands, so this may well be the correct operating entity,
   and it is not a detail to guess at. Please confirm or replace.

3. **Real copy for "Step 2 – Convert" and "Step 3: Evolve Online"** on
   `/how-it-works/`, whose placeholder bodies were removed.

4. **The home page's `#contact-us` anchor is orphaned.** The menu-anchor widget is
   there, but nothing on that page links to it — the header's "Contact Us" opens the
   popup instead. Harmless; noted so it is not mistaken for a migration slip.

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

A human should submit each embed once end to end. They post to GoHighLevel, not to
this site, so they behave identically before and after cutover — and there is
nothing to configure for them.

Do **not** set `PUBLIC_ORIGINAL_BUGS` in the Vercel project — it exists so the
fidelity harness can still measure against WordPress, and setting it in production
would ship the original site's bugs back.

Going live on the real domain: playbook §8.
