/** Site-wide switches that a project lead may want to flip without touching markup. */

/**
 * There is no form switch on this site, and that is the decision rather than an
 * omission: every form ships exactly as WordPress serves it.
 *
 * The "Contact Us" form inside Elementor popup 394 (and its twin in the home
 * page's own contact section), and the "Sign up for updates" form in the footer,
 * are LeadConnector / GoHighLevel iframes served from `verified.trustymail.co` — a
 * host that outlives the WordPress install. The embed *is* the working form, so
 * replacing it would trade a form that works for one that needs an endpoint
 * configured before it does.
 *
 * The two booking widgets — `/schedule-a-call/`'s calendar and the pair on the
 * orphaned /home-2/ — are likewise untouched. They are appointment calendars, not
 * contact forms.
 */

/**
 * Whether the page links Elementor's Google-font stylesheets — Inter, Roboto,
 * Montserrat, Poppins and Fira Sans, self-hosted by scripts/build-fonts.mjs.
 *
 * `on` is the default because it is what the WordPress site renders. (Worth
 * checking per site: the sibling roofinggrowthsystems install spells the same
 * `src: url(...)` values with an `http://` scheme on an `https://` page, so Chrome
 * blocks every one and that site falls back to the system stack. This install
 * spells all five `https://`, so its typography arrives.)
 */
export const WEBFONTS: 'off' | 'on' =
  (import.meta.env.PUBLIC_WEBFONTS as 'off' | 'on') || 'on';

/** The GoHighLevel chat bubble the WordPress head loads on every page. */
export const CHAT_WIDGET = (import.meta.env.PUBLIC_CHAT_WIDGET || 'on') !== 'off';

export const SITE_NAME = 'Life Agent Growth Systems';
