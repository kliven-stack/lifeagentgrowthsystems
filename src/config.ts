/** Site-wide switches that a project lead may want to flip without touching markup. */

/**
 * How the site's one lead-capture form renders — the "Contact Us" form inside
 * Elementor popup 394, which the header's "Contact Us" menu item opens.
 *
 * - `growthmap`  — our own static form, POSTing to `PUBLIC_CONTACT_ENDPOINT`
 *                  (playbook §4b). This is the migration target.
 * - `embed`      — the original LeadConnector / GoHighLevel iframe, byte-identical
 *                  to the WordPress site. It is served from `verified.trustymail.co`,
 *                  a GoHighLevel host that outlives the WordPress install, so it is
 *                  a safe fallback until the Growthmap endpoint exists.
 *
 * With no endpoint configured the embed is kept regardless, so a deploy that
 * happens before the endpoint is created never ships a form that goes nowhere.
 *
 * The two booking widgets — `/schedule-a-call/`'s calendar and the pair on the
 * orphaned /home-2/ — are never replaced. They are appointment calendars, not
 * contact forms.
 */
export const FORM_MODE: 'growthmap' | 'embed' =
  (import.meta.env.PUBLIC_FORM_MODE as 'growthmap' | 'embed') || 'growthmap';

/** Growthmap lead endpoint (public by design — it is read in the browser). */
export const CONTACT_ENDPOINT = import.meta.env.PUBLIC_CONTACT_ENDPOINT || '';

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
