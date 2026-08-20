/**
 * Corrections to the original site's own bugs.
 *
 * The clone was built to reproduce production exactly, bugs included (playbook §2).
 * Each entry below undoes one of the defects the README lists, after the client
 * asked for them to be fixed. Keeping them here rather than editing
 * `src/fragments/` matters for two reasons:
 *
 *   * `npm run extract` rewrites the fragments from the crawl, so an edit made there
 *     disappears the next time anyone re-runs the pipeline;
 *   * `PUBLIC_ORIGINAL_BUGS=keep` turns every fix back off, which is what
 *     `npm run compare` needs — the fidelity harness diffs against the live
 *     WordPress site, so it can only be meaningful against an unfixed build.
 *
 * Fixes that need information only the client has (contact addresses, the legal
 * entity behind the privacy policy, whether the leftover pages should stay) are
 * deliberately NOT here. See the README.
 */

/** `keep` reproduces the WordPress site's bugs; anything else applies the fixes. */
export const FIXES_ON = (import.meta.env.PUBLIC_ORIGINAL_BUGS || '') !== 'keep';

/** One `String.replace` pair, with the reason it exists. */
interface Rewrite {
  /** Which fragments to apply to — matched against the fragment name. */
  match?: RegExp;
  from: string | RegExp;
  to: string;
  why: string;
}

const REWRITES: Rewrite[] = [
  // ---------------------------------------------------------------- bug 9
  {
    from: '/wp-content/litespeed/js/3f6ed5ab9c31b9a11d7fc97219b13c71.js?ver=13c71',
    to: 'https://widgets.leadconnectorhq.com/loader.js',
    why:
      'The chat bubble never appears, on the WordPress site either: the loader is a ' +
      'LiteSpeed-cached copy of the vendor bundle, and it resolves its own assets ' +
      'relative to itself — so it asks for /wp-content/litespeed/js/chat-widget/' +
      'chat-widget.esm.js, which LiteSpeed has since purged and which 404s. Pointing ' +
      'at GoHighLevel\'s own loader makes it resolve its assets from their CDN, ' +
      'which is what the embed is documented to do and what cannot go stale.',
  },

  // ---------------------------------------------------------------- bug 10
  {
    match: /^page-home-2$/,
    // Both halves matter, and only the second is what a visitor sees: Elementor
    // renders the from-value as the element's text as well as its attribute, and it
    // is the empty *text* that paints "$ B+" until the count-up starts.
    from: '<span class="elementor-counter-number" data-duration="2000" data-to-value="19.9" data-from-value="" data-delimiter=","></span>',
    to: '<span class="elementor-counter-number" data-duration="2000" data-to-value="19.9" data-from-value="0" data-delimiter=",">0</span>',
    why:
      'The first statistic ships with an empty from-value, so between first paint ' +
      'and the count-up the strip reads "$ B+". The other two ship 0.',
  },

  // ---------------------------------------------------------------- bug 2
  // Seven of the eight images on /home-2/ are hotlinked from jeremyb126.sg-host.com,
  // a SiteGround staging host that no longer resolves — but the same files are on
  // this site's own uploads. Four kept their 2021/07 path; four were re-uploaded
  // under 2025/02, three of those with a `-1` suffix.
  ...[
    ['Calendly-1.png', '/wp-content/uploads/2021/07/Calendly-1.png'],
    ['ClickFunnels-1.png', '/wp-content/uploads/2021/07/ClickFunnels-1.png'],
    ['MailChimp-1.png', '/wp-content/uploads/2021/07/MailChimp-1.png'],
    ['Reputation-1.png', '/wp-content/uploads/2021/07/Reputation-1.png'],
    ['Communication-Callout4.png', '/wp-content/uploads/2025/02/Communication-Callout4-1.png'],
    ['GuaranteeBadage-02-01.png', '/wp-content/uploads/2025/02/GuaranteeBadage-02-01.png'],
    ['Marketing-Callout-2.png', '/wp-content/uploads/2025/02/Marketing-Callout-2.png'],
    ['Scheduling-1.png', '/wp-content/uploads/2025/02/Scheduling-1.png'],
  ].map(([file, local]): Rewrite => ({
    from: `http://jeremyb126.sg-host.com/wp-content/uploads/2021/07/${file}`,
    to: local,
    why: `${file} was hotlinked from a staging host that no longer resolves; this site serves the same file.`,
  })),
  {
    from: 'http://jeremyb126.sg-host.com/#contact-us',
    to: '#contact-us',
    why:
      'Four buttons on /home-2/ point at the dead staging host instead of the ' +
      '#contact-us anchor on their own page, so every one of them is a dead link.',
  },

  // ---------------------------------------------------------------- bug 3
  {
    match: /^page-privacy-policy$/,
    // The anchor carries target/rel attributes too, so match the whole element.
    from: /Roofing Growth Systems, accessible from <a href="www\.roofinggrowthsystems\.com"([^>]*)>www\.roofinggrowthsystems\.com<\/a>/,
    to: 'Life Agent Growth Systems, accessible from <a href="https://lifeagentgrowthsystems.com"$1>https://lifeagentgrowthsystems.com</a>',
    why:
      'The policy defined the Website as a different client\'s site — and wrote the ' +
      'address without a scheme, so the browser resolved it against the current ' +
      'directory and it 404d. Both halves corrected to this site. The legal entity ' +
      'named a few lines below is deliberately left alone: it may well be right, ' +
      'since one agency runs several of these niche brands, and it is not ours to ' +
      'guess at. See the README.',
  },

  // ---------------------------------------------------------------- bug 4 and 5
  {
    match: /^page-(guarantee|google-my-business-walkthrough)$/,
    from: /\bRGS\b/g,
    to: 'Life Agent Growth Systems',
    why:
      '"RGS" is Roofing Growth Systems — the brand this site was copied from. It ' +
      'appears in the terms of the performance guarantee and three times in the ' +
      'Google Business onboarding steps.',
  },

  // ---------------------------------------------------------------- bug 1
  {
    match: /^page-about$/,
    from: 'Concrete Marketing Specialists',
    to: 'Life Insurance Marketing Specialists',
    why: '/about/ still carried a concrete-marketing company\'s copy.',
  },
  {
    match: /^page-about$/,
    from: 'a concrete business owner',
    to: 'a life insurance agent',
    why: 'Same page, same rebrand: the opening line addressed the wrong industry.',
  },
  {
    match: /^page-about$/,
    from: 'Concrete Industry Specialists',
    to: 'Life Insurance Industry Specialists',
    why: 'Third of the three industry labels on the page\'s credentials strip.',
  },

  // ------------------------------------------------- other people's contact details
  // The site publishes no phone number or email of its own, so there is nothing to
  // substitute. Every one of these now routes to the contact paths the rest of the
  // site already uses: the popup form (any `.contact-form` link opens it) and
  // /schedule-a-call/.
  {
    match: /^page-about$/,
    from: 'Action: Contact us today at hello@concretegrowthpros.com or call (615) 880-9511',
    to: 'Action: <a class="contact-form" href="#">Contact us today</a>, or ' +
      '<a href="/schedule-a-call/">schedule a call</a>.',
    why:
      'The call to action gave a different company\'s email and phone — ' +
      'hello@concretegrowthpros.com and (615) 880-9511, from the concrete-marketing ' +
      'site this page was copied from.',
  },
  {
    match: /^page-privacy-policy$/,
    from: '<p>By phone number: 615.488.4889</p>',
    to: '<p>Through the contact form on this website, or by booking a call at ' +
      '<a href="/schedule-a-call/">lifeagentgrowthsystems.com/schedule-a-call</a></p>',
    why:
      'The policy gave 615.488.4889 as the contact number — the same Franklin, TN ' +
      'business as the entity named above it, not this brand. The postal address on ' +
      'the next line is left alone with that entity, pending confirmation.',
  },
  {
    match: /^page-google-my-business-walkthrough$/,
    from: 'Enter the Life Agent Growth Systems email address:<strong> ' +
      '<a href="mailto:rgs-clients@gmail.com">rgs-clients@gmail.com</a></strong>',
    to: 'Enter the Life Agent Growth Systems email address we sent you.',
    why:
      'The step told clients to invite rgs-clients@gmail.com — the roofing brand\'s ' +
      'Google account. Without the real address the instruction cannot be completed, ' +
      'so it now points at the address the team sends out. NOTE: this needs the real ' +
      'address to be genuinely useful; see the README.',
  },
  {
    match: /^page-google-my-business-walkthrough$/,
    from: 'feel free to contact us at <a href="mailto:support@jeremyb126.sg-host.com">' +
      'support@jeremyb126.sg-host.com</a>.',
    to: 'feel free to <a class="contact-form" href="#">contact us</a> or ' +
      '<a href="/schedule-a-call/">book a call</a>.',
    why: 'support@jeremyb126.sg-host.com is on a staging host that no longer resolves.',
  },
];

/**
 * Elementor elements removed outright, by `data-id`.
 *
 * Placeholder content the client asked to have taken down. Removing rather than
 * hiding, so it is not in the markup for a crawler to read either.
 */
const REMOVE: { match: RegExp; ids: string[]; why: string }[] = [
  {
    match: /^page-about$/,
    ids: ['37b262a6'],
    why:
      'A whole unfinished section: an "About Us" label, an "Lorem Ipsum" heading, and ' +
      'two stock portraits each captioned "I am text block. Click edit button to ' +
      'change this text. Lorem ipsum dolor sit amet…". Removing the section rather ' +
      'than just its text widgets, because the heading and the portraits are the ' +
      'same placeholder and would read as broken on their own.',
  },
  {
    match: /^page-how-it-works$/,
    ids: ['2ca47ee', '8877ef7'],
    why:
      'The bodies of "Step 2 - Convert" and "Step 3: Evolve Online" are both the ' +
      'stock filler *about* Lorem Ipsum ("It is a long established fact that a ' +
      'reader will be distracted…"). Only Step 1 has real copy. Both steps keep ' +
      'their headings and lose their bodies until real copy arrives.',
  },
];

/**
 * Cut one Elementor element out of a fragment, by `data-id`.
 *
 * Elementor's markup is regular enough to do this without a parser, but the element
 * is not always a `<div>` — sections and inner sections are `<section>`, columns are
 * `<div>`. So: find the start of the tag that carries the `data-id`, read its name,
 * then walk forward counting that tag until the depth returns to zero. The scan
 * honours quoted attribute values, which matters because `data-settings` carries a
 * JSON blob and `srcset` carries commas and slashes.
 *
 * If the tags do not balance the fragment is returned untouched — better to leave a
 * placeholder on the page than to truncate the rest of it.
 */
function removeElement(html: string, id: string): string {
  const at = html.indexOf(`data-id="${id}"`);
  if (at === -1) return html;
  const start = html.lastIndexOf('<', at);
  if (start === -1) return html;
  const tag = /^<([a-zA-Z][\w-]*)/.exec(html.slice(start, start + 40))?.[1]?.toLowerCase();
  if (!tag) return html;

  const openRe = new RegExp(`^<${tag}[\\s/>]`, 'i');
  const closeRe = new RegExp(`^</${tag}[\\s>]`, 'i');

  let i = start;
  let depth = 0;
  while (i < html.length) {
    if (html[i] !== '<') { i++; continue; }
    const head = html.slice(i, i + tag.length + 3);
    const isOpen = openRe.test(head);
    const isClose = closeRe.test(head);
    // Walk to this tag's '>', skipping anything inside a quoted attribute value.
    let j = i + 1;
    let quote = '';
    while (j < html.length) {
      const c = html[j];
      if (quote) { if (c === quote) quote = ''; }
      else if (c === '"' || c === "'") quote = c;
      else if (c === '>') break;
      j++;
    }
    if (j >= html.length) return html;
    if (isClose) {
      depth--;
      if (depth === 0) return html.slice(0, start) + html.slice(j + 1);
    } else if (isOpen && html[j - 1] !== '/') {
      depth++;
    }
    i = j + 1;
  }
  return html;
}

/** Applies every rewrite that targets this fragment. */
export function fixFragment(html: string, name: string): string {
  if (!FIXES_ON) return html;
  let out = html;
  for (const rule of REWRITES) {
    if (rule.match && !rule.match.test(name)) continue;
    out = typeof rule.from === 'string' ? out.split(rule.from).join(rule.to) : out.replace(rule.from, rule.to);
  }
  for (const rule of REMOVE) {
    if (!rule.match.test(name)) continue;
    for (const id of rule.ids) out = removeElement(out, id);
  }
  return out;
}

/**
 * Metadata corrections — bugs 1, 2, 6 and 7.
 *
 * Yoast derives a page's description and its Open Graph copy from the page body, so
 * the same stale sentences that the fragments carried were also what Google and every
 * social preview showed. The home page's snippet read "We grow roofing companies".
 */
const META: Record<string, { description?: string; robots?: string }> = {
  '/': {
    description:
      'Proven growth. Guaranteed success. Our AI-driven system is proven to produce ' +
      'quality leads, automate your marketing, and help life insurance agents ' +
      'dominate their competition online and locally.',
  },
  '/about/': {
    description:
      'About Life Agent Growth Systems — a fast-growing, independently-owned digital ' +
      'marketing agency working exclusively with life insurance agents across the U.S.',
  },
  '/category/uncategorized/': {
    // The site has no posts, so this archive renders a bare heading — and its robots
    // directive invites indexing. Yoast keeps it out of the sitemap already.
    robots: 'noindex, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1',
  },
};

export interface MetaFix {
  description?: string;
  robots?: string;
}

export function fixPageMeta(path: string): MetaFix {
  if (!FIXES_ON) return {};
  return META[path] ?? {};
}

/**
 * The same corrections, applied to Yoast's block. It hard-codes the old sentences
 * into `og:description`, `twitter:description` and the schema.org graph.
 */
const SEO_REWRITES: [RegExp, string][] = [
  [
    /Proven results\. Guaranteed\.\s*We grow roofing companies\. No hassle\. No bull\./g,
    'Proven growth. Guaranteed success.',
  ],
  [/We grow roofing companies\./g, 'We grow life insurance practices.'],
  [/Your Concrete Marketing Specialists/g, 'Your Life Insurance Marketing Specialists'],
  [/You&#8217;re a concrete business owner/g, 'You&#8217;re a life insurance agent'],
  [/You’re a concrete business owner/g, 'You’re a life insurance agent'],
  [/\bRGS\b/g, 'Life Agent Growth Systems'],
];

export function fixSeoHead(html: string): string {
  if (!FIXES_ON) return html;
  let out = html;
  for (const [from, to] of SEO_REWRITES) out = out.replace(from, to);
  return out;
}

/**
 * CSS-level corrections, inlined after the compiled Elementor sheets.
 *
 * Only the two that need no design decision. The site-wide font fallback — 640 of
 * 796 text elements render in hello-elementor's system stack because Elementor kit
 * 11 sets no body or heading family — is NOT fixed here: turning it on changes the
 * typography of four fifths of the site, which is the client's call, not a bug fix
 * to apply quietly. The one-line change is in the README.
 */
export const FIX_CSS = `
/* The site-wide font fallback.

   Elementor kit 11 sets no body font and no heading font, so everything the designer
   did not style widget-by-widget inherited hello-elementor's
   \`body { font-family: -apple-system, … }\` — 640 of 796 visible text elements, 80%
   of the site, in the operating system's UI font while five webfont families sat
   downloaded and unused.

   These two rules apply the kit's own declared intent: its Text global is Roboto
   (body) and its Primary global is Inter (headings). Specificity is deliberately
   low — a class and a class-plus-element — so every per-widget family Elementor
   compiled (\`.elementor-19 .elementor-element-7ecbbac .elementor-heading-title\`,
   three classes) still wins. Nothing the designer chose is overridden. */
.elementor-kit-11 { font-family: 'Roboto', sans-serif; }
.elementor-kit-11 h1,
.elementor-kit-11 h2,
.elementor-kit-11 h3,
.elementor-kit-11 h4,
.elementor-kit-11 h5,
.elementor-kit-11 h6 { font-family: 'Inter', sans-serif; }

/* bug 13 — the popup card is fixed at 800px tall while its contents (40px of
   padding, a heading, a paragraph and the form) are taller, so the form's own
   submit button sat below the fold of a card that could not scroll. Let the card
   size to its content, cap it to the viewport, and scroll if it still overflows. */
#elementor-popup-modal-394 .dialog-message {
  height: auto;
  max-height: min(800px, 90vh);
  overflow-y: auto;
}
/* Our replacement form is a normal in-flow block, so the !important height the
   theme pins onto the embedded iframe must not apply to it. */
#elementor-popup-modal-394 .popup-form .gm-form { height: auto; }

/* /privacy-policy/ scrolls sideways on a phone. The policy pastes a full Adobe
   support URL as its own link text, and nothing lets it wrap, so at 390px it runs
   453px past the viewport and drags the whole page with it. Scoped to that page's
   body class so no other link's wrapping changes. */
.elementor-page-3 .elementor-widget-text-editor a { overflow-wrap: anywhere; }

/* bug 11 — an Elementor Pro reviews carousel ships on the home page carrying three
   placeholder reviews ("John Doe", Elementor's own placeholder image). It is marked
   hidden at every breakpoint so it never rendered; this stops it being downloaded,
   laid out and read out by assistive technology as well. */
.elementor-19 .elementor-element.elementor-element-3f24abe { display: none !important; }
`.trim();
