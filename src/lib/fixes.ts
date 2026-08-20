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
    from: 'data-from-value=""',
    to: 'data-from-value="0"',
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
];

/** Applies every rewrite that targets this fragment. */
export function fixFragment(html: string, name: string): string {
  if (!FIXES_ON) return html;
  let out = html;
  for (const rule of REWRITES) {
    if (rule.match && !rule.match.test(name)) continue;
    out = typeof rule.from === 'string' ? out.split(rule.from).join(rule.to) : out.replace(rule.from, rule.to);
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

/* bug 11 — an Elementor Pro reviews carousel ships on the home page carrying three
   placeholder reviews ("John Doe", Elementor's own placeholder image). It is marked
   hidden at every breakpoint so it never rendered; this stops it being downloaded,
   laid out and read out by assistive technology as well. */
.elementor-19 .elementor-element.elementor-element-3f24abe { display: none !important; }
`.trim();
